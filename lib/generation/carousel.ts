import { prisma } from "@/lib/prisma";
import { renderCarouselFromPlan, lastImageGenError } from "@/lib/imagen";
import { getCarouselPlan } from "@/lib/image-brief";
import { appendImageHistory } from "@/lib/image-history";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { checkProfileReady } from "@/lib/profile-guard";
import type { SendFn } from "@/lib/ndjson";

/**
 * The carousel pipeline, shared by the website and the mobile API.
 *
 * Extracted from app/api/generate/carousel/route.ts so both callers run the
 * same code rather than two copies that drift.
 *
 * That route built its own ReadableStream with a local finish() to close the
 * controller; ndjsonResponse does that, so the early returns are plain returns
 * now and the trailing catch is the onError argument instead.
 *
 * Authentication happens BEFORE this is called, so an auth failure is an HTTP
 * 401 rather than an event inside a 200 stream - which this route already did
 * correctly, unlike its three siblings.
 */

const IMAGE_GEN_LIMIT_PER_POST = 2;
const CAROUSEL_COUNT = 4;

export async function runCarouselGeneration(
  userId: string,
  postId: string | undefined,
  send: SendFn,
): Promise<void> {
  send({ type: "preflight", key: "auth", status: "done" });

  // Validate postId explicitly - Prisma would silently DROP an `undefined` id
  // filter and load an arbitrary post owned by the user, so never trust it.
  if (!postId || typeof postId !== "string") {
    send({ type: "error", message: "Missing or invalid post reference." });
    return;
  }

  // Active subscription
  const { allowed, reason } = await checkActiveSubscription(userId);
  if (!allowed) {
    send({ type: "preflight", key: "subscription", status: "error", message: reason });
    send({ type: "error", message: reason, subscriptionRequired: true });
    return;
  }
  send({ type: "preflight", key: "subscription", status: "done" });

  // Content-quality gate, same contract as the text routes. Four slides
  // is four model calls, so this is the most expensive thing an
  // incomplete profile can spend.
  const profile = await checkProfileReady(userId);
  if (!profile.ready) {
    send({ type: "preflight", key: "profile", status: "error", message: profile.message });
    send({
      type: "error",
      message: profile.message,
      profileIncomplete: true,
      gaps: profile.gaps,
    });
    return;
  }
  send({ type: "preflight", key: "profile", status: "done" });

  // Rate limit
  const rl = checkRateLimit(userId, "image-gen", RATE_LIMITS.imageGeneration);
  if (!rl.allowed) {
    const message = `Too many requests. Try again in ${rl.retryAfterSecs}s.`;
    send({ type: "preflight", key: "ratelimit", status: "error", message });
    send({ type: "error", message, rateLimited: true, retryAfterSecs: rl.retryAfterSecs });
    return;
  }
  send({ type: "preflight", key: "ratelimit", status: "done" });

  // Load + own the post
  const post = await prisma.post.findFirst({
    where: { id: postId, plan: { userId } },
    include: { plan: { include: { user: true } } },
  });
  if (!post) {
    send({ type: "preflight", key: "post", status: "error", message: "Post not found" });
    send({ type: "error", message: "Post not found" });
    return;
  }
  send({ type: "preflight", key: "post", status: "done", title: post.title });

  // Per-post generation cap (a whole carousel consumes one; admins are exempt)
  const isAdmin = post.plan.user.role === "admin";
  if (!isAdmin && post.imageGenCount >= IMAGE_GEN_LIMIT_PER_POST) {
    const message = `Image generation limit reached (${IMAGE_GEN_LIMIT_PER_POST} per post). You can still upload custom images.`;
    send({ type: "preflight", key: "quota", status: "error", message, remaining: 0, limit: IMAGE_GEN_LIMIT_PER_POST });
    send({ type: "error", message, remaining: 0, limit: IMAGE_GEN_LIMIT_PER_POST });
    return;
  }
  send({
    type: "preflight",
    key: "quota",
    status: "done",
    remaining: isAdmin ? null : IMAGE_GEN_LIMIT_PER_POST - post.imageGenCount,
    limit: IMAGE_GEN_LIMIT_PER_POST,
  });

  const industry = post.plan.user.industry || "business";
  const userVisualProfile = {
    positioning: post.plan.user.positioning,
    contentStyles: post.plan.user.contentStyles,
    industry,
    name: post.plan.user.name,
    headline: post.plan.user.headline, // the actual ROLE that drives the imagery
summary: post.plan.user.summary,
targetAudience: post.plan.user.targetAudience,
  };

  // Stage 1 - Planner: send the full post, get back the narrative arc as
  // text (per-slide headline, supporting line and labels) plus the ONE
  // palette id the whole set shares.
  send({ type: "plan", status: "start", message: "Sending the full post to the planner" });
  const plan = await getCarouselPlan(
    { title: post.title, body: post.body, postType: post.postType },
    CAROUSEL_COUNT,
    userVisualProfile
  );

  const total = plan.slides.length;
  send({
    type: "plan",
    status: "done",
    themeId: plan.themeId ?? null,
    slides: plan.slides.map((s, i) => ({
      index: i,
      role: i === 0 ? "hook" : i === total - 1 ? "takeaway" : "point",
      headline: s.headline,
      subheadline: s.subheadline ?? "",
      nodes: s.nodes ?? [],
    })),
  });

  // Stage 2 - Renderer. Laid out in code, so the slide text is exact and
  // the set costs nothing. getCarouselPlan always returns a plan now, so
  // there is no diffusion fallback branch to take.
  send({ type: "render", status: "start", total });
  const images = await renderCarouselFromPlan(plan, post.id, (e) =>
    send({ type: "slide", ...e })
  );
  const savedPrompt = plan.slides.map((s) => s.headline).join(" / ");

  if (images.length === 0) {
    send({
      type: "error",
      message: lastImageGenError || "Carousel generation failed - no images were produced.",
    });
    return;
  }

  // Stage 3 - Persist to the post.
  send({ type: "save", status: "start" });
  await prisma.post.update({
    where: { id: post.id },
    data: {
      carouselImages: JSON.stringify(images),
      imageUrl: images[0], // first slide doubles as the single-image fallback
      imagePrompt: savedPrompt,
      imageGenCount: post.imageGenCount + 1,
      imageHistory: appendImageHistory(post.imageHistory, images),
      documentUrl: null,
      documentName: null,
    },
  });
  send({ type: "save", status: "done" });

  const remaining = IMAGE_GEN_LIMIT_PER_POST - (post.imageGenCount + 1);
  send({
    type: "done",
    carouselImages: images,
    imageUrl: images[0],
    count: images.length,
    remaining,
    limit: IMAGE_GEN_LIMIT_PER_POST,
  });
  return;
}
