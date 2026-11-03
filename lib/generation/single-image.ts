import { prisma } from "@/lib/prisma";
import {
  generatePostImage,
  renderAndStoreDesignedImage,
  generateAndStoreArtImage,
  lastImageGenError,
} from "@/lib/imagen";
import { getImageBrief, describeDesignBrief } from "@/lib/image-brief";
import { resolveImageCategory } from "@/lib/image-categories";
import { appendImageHistory, parseImageHistory } from "@/lib/image-history";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { checkProfileReady } from "@/lib/profile-guard";
import type { SendFn } from "@/lib/ndjson";
import { PREVIEW_TOOLS_ENABLED, promptField } from "@/lib/preview-tools";

/**
 * Single-post image generation, shared by the website and the mobile API.
 *
 * Extracted from app/api/generate/image/route.ts. The bulk pipeline only
 * accepts posts with no image yet (it filters imageUrl: null), so this is the
 * only way to REGENERATE the image on a post that already has one - which is
 * what the app editor needs.
 *
 * Emits events rather than returning a Response, so both callers can wrap it in
 * respondByAccept(): the website asks for NDJSON and draws the live pipeline,
 * the mobile app asks for JSON and gets exactly the body it got before. The
 * event vocabulary is deliberately the bulk pipeline's - preflight / queue /
 * post - so the client reducer that already renders bulk runs renders this one
 * with no new code.
 *
 * Authentication happens before this is called; a 401 never originates here.
 *
 * Every terminal event's HTTP status is preserved from the Response-returning
 * version this replaces, via respondByAccept's statusForError(). A run that
 * finishes WITHOUT an image is still a `done` carrying error text, because that
 * case answered 200 before and the app branches on `imageUrl` being null.
 */

const IMAGE_GEN_LIMIT_PER_POST = 2;

export async function runSingleImageGeneration(
  userId: string,
  postId: unknown,
  customPrompt: unknown,
  send: SendFn,
): Promise<void> {
  // The caller has already authenticated. Emitted so the website's pipeline
  // shows its first check complete rather than stuck pending.
  send({ type: "preflight", key: "auth", status: "done" });

  // Prisma DROPS an `undefined` id filter, so without this the lookup below
  // collapses to { plan: { userId } } and regenerates an arbitrary post of the
  // caller's. Same hazard the carousel pipeline guards against.
  if (!postId || typeof postId !== "string") {
    const message = "Missing or invalid post reference.";
    send({ type: "preflight", key: "input", status: "error", message });
    send({ type: "error", message, status: 400 });
    return;
  }
  send({ type: "preflight", key: "input", status: "done" });

  const { allowed, reason } = await checkActiveSubscription(userId);
  if (!allowed) {
    send({ type: "preflight", key: "subscription", status: "error", message: reason });
    send({ type: "error", message: reason, subscriptionRequired: true });
    return;
  }
  send({ type: "preflight", key: "subscription", status: "done" });

  // Content-quality gate, same contract as the text routes. The image is
  // briefed from the post and the post is written from the profile, so artwork
  // for a generic post is a model call the user throws away the moment their
  // profile is filled in. Blocked with the gaps so the client can link straight
  // to the fix.
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

  const rl = checkRateLimit(userId, "image-gen", RATE_LIMITS.imageGeneration);
  if (!rl.allowed) {
    const message = `Too many requests. Try again in ${rl.retryAfterSecs}s.`;
    send({ type: "preflight", key: "ratelimit", status: "error", message });
    send({ type: "error", message, rateLimited: true, retryAfterSecs: rl.retryAfterSecs });
    return;
  }
  send({ type: "preflight", key: "ratelimit", status: "done" });

  // Validate customPrompt to prevent prompt injection / resource exhaustion
  if (customPrompt && (typeof customPrompt !== "string" || customPrompt.length > 2000)) {
    const message = "Image prompt must be under 2000 characters";
    send({ type: "preflight", key: "input", status: "error", message });
    send({ type: "error", message, status: 400 });
    return;
  }

  // Narrowed for the rest of the function. The check above already rejected
  // a non-string or over-long value, so a truthy customPrompt is a usable
  // string - but TypeScript cannot carry that through from a compound test.
  const prompt: string | null =
    typeof customPrompt === "string" && customPrompt.length > 0 ? customPrompt : null;

  const post = await prisma.post.findFirst({
    where: { id: postId, plan: { userId: userId } },
    include: { plan: { include: { user: true } } },
  });
  if (!post) {
    const message = "Post not found";
    send({ type: "preflight", key: "post", status: "error", message });
    send({ type: "error", message, status: 404 });
    return;
  }
  send({ type: "preflight", key: "post", status: "done" });

  // Enforce per-post image generation limit (Admins have no limits)
  const isAdmin = post.plan.user.role === "admin";
  if (!isAdmin && post.imageGenCount >= IMAGE_GEN_LIMIT_PER_POST) {
    const message = `Image generation limit reached (${IMAGE_GEN_LIMIT_PER_POST} per post). You can still upload a custom image.`;
    send({ type: "preflight", key: "quota", status: "error", message });
    send({
      type: "error",
      message,
      remaining: 0,
      limit: IMAGE_GEN_LIMIT_PER_POST,
      status: 429,
    });
    return;
  }
  send({ type: "preflight", key: "quota", status: "done" });

  // One row, so the pipeline's item list has something to fill in. The bulk
  // run sends this same shape for each of its posts.
  send({
    type: "queue",
    total: 1,
    posts: [{ index: 0, id: post.id, title: post.title }],
  });
  const base = { type: "post", index: 0, id: post.id, title: post.title };

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

  let imageUrl: string | null;
  let savedPrompt: string;

  if (prompt) {
    // Explicit user override: respect the literal prompt on the legacy no-text
    // path. There is no brief to describe, so the user's own prompt IS the
    // prompt, and it goes out as such.
    send({
      ...base,
      status: "rendering",
      renderer: "image-model",
      ...promptField(prompt),
    });
    imageUrl = await generatePostImage(prompt, post.id, industry);
    savedPrompt = prompt;
  } else {
    // Content-aware: derive a brief from THIS post, then render a branded graphic
    // that represents the post and displays a short headline of its key point.
    const category = resolveImageCategory(post.imageStyle);
    send({ ...base, status: "brief", category: category.label });

    const brief = await getImageBrief(
      { title: post.title, body: post.body, postType: post.postType },
      category,
      userVisualProfile
    );

    // A degraded brief means the text model was unavailable, so this brief knows
    // nothing about the post beyond its title. Generating from it produces the
    // generic, unrelated image users complain about - and it silently burns an
    // image-model call doing it. Refuse, and say why.
    if (brief.degraded) {
      const message =
        "AI is temporarily unavailable, so we couldn't read this post properly. Rather than generate a generic image, we've stopped here - please try again shortly.";
      send({ ...base, status: "error", message });
      send({
        type: "error",
        message,
        remaining: IMAGE_GEN_LIMIT_PER_POST - post.imageGenCount,
        limit: IMAGE_GEN_LIMIT_PER_POST,
        status: 503,
      });
      return;
    }

    const rendering = {
      ...base,
      status: "rendering",
      category: category.label,
      headline: brief.headline || brief.bodyText || "",
      visual: brief.visual,
      renderer: "image-model",
    };
    send(rendering);

    // Art-directed first: the model draws the whole graphic, lettering included.
    // The code renderer is the FALLBACK now, not the default - plain type on a
    // flat field beats no image, but it is nowhere near what a good LinkedIn
    // graphic looks like, and that is the bar.
    imageUrl = await generateAndStoreArtImage(brief, post.id, category, {
      // Regenerating steps onto the NEXT palette rather than redrawing the
      // same one. Pressing "generate again" almost always means the last
      // result was not wanted, and handing back an identical colourway reads
      // as the button having done nothing. The post id still decides where in
      // the list this post starts, so two posts do not march in lockstep.
      themeOffset: parseImageHistory(post.imageHistory).length,
      // Spread over the rendering event rather than sent alone, because the
      // client recomputes the row's detail line from these fields - a bare
      // prompt event would blank the headline for the rest of the render.
      //
      // Left off entirely in production, so no second event goes out at all.
      onPrompt: PREVIEW_TOOLS_ENABLED
        ? (built) => send({ ...rendering, prompt: built })
        : undefined,
    });
    savedPrompt = [
      `[${category.label}]`,
      brief.visualStyle ?? "auto",
      brief.headline,
      brief.scene ?? "",
    ].join(" | ");

    if (!imageUrl) {
      console.warn(`[image] art generation failed for ${post.id}, using the code renderer`);
      send({ ...rendering, renderer: "code-renderer" });
      imageUrl = await renderAndStoreDesignedImage(category, brief, post.id, {
        author: { name: post.plan.user.name, headline: post.plan.user.headline },
      });
      savedPrompt = describeDesignBrief(category, brief);
    }
  }

  if (imageUrl) {
    await prisma.post.update({
      where: { id: postId },
      data: {
        imageUrl,
        imagePrompt: savedPrompt,
        imageGenCount: post.imageGenCount + 1,
        // Keep every generated image in the per-post history so it stays reusable
        imageHistory: appendImageHistory(post.imageHistory, [imageUrl]),
        // An image and a PDF document are mutually exclusive on LinkedIn
        documentUrl: null,
        documentName: null,
      },
    });
    send({ ...base, status: "done", url: imageUrl });
  } else {
    send({
      ...base,
      status: "error",
      message: lastImageGenError || "Image generation failed",
    });
  }

  const remaining = IMAGE_GEN_LIMIT_PER_POST - (post.imageGenCount + (imageUrl ? 1 : 0));

  // Deliberately a `done` even when no image was produced: that case answered
  // HTTP 200 with { imageUrl: null, error } before this was a stream, and the
  // app branches on imageUrl rather than on the status code.
  send({
    type: "done",
    imageUrl,
    remaining,
    limit: IMAGE_GEN_LIMIT_PER_POST,
    ...(imageUrl
      ? {}
      : { error: lastImageGenError || "Image generation failed - all models returned no image" }),
  });
}
