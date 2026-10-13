import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderCarouselFromPlan, lastImageGenError } from "@/lib/imagen";
import { getCarouselPlan } from "@/lib/image-brief";
import { appendImageHistory } from "@/lib/image-history";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// Streaming route: emits step-by-step NDJSON progress so the client popup can show
// the whole background pipeline (preflight -> plan -> per-slide render -> save).
export const runtime = "nodejs";
// Generating 4 images can take longer than the default serverless limit.
export const maxDuration = 60;

const IMAGE_GEN_LIMIT_PER_POST = 2;
const CAROUSEL_COUNT = 4;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => ({}));
  const { postId } = body as { postId?: string };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: Record<string, unknown>) => {
        if (closed) return;
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };

      try {
        send({ type: "preflight", key: "auth", status: "done" });

        // Validate postId explicitly - Prisma would silently DROP an `undefined` id
        // filter and load an arbitrary post owned by the user, so never trust it.
        if (!postId || typeof postId !== "string") {
          send({ type: "error", message: "Missing or invalid post reference." });
          return finish();
        }

        // Active subscription
        const { allowed, reason } = await checkActiveSubscription(userId);
        if (!allowed) {
          send({ type: "preflight", key: "subscription", status: "error", message: reason });
          send({ type: "error", message: reason, subscriptionRequired: true });
          return finish();
        }
        send({ type: "preflight", key: "subscription", status: "done" });

        // Rate limit
        const rl = checkRateLimit(userId, "image-gen", RATE_LIMITS.imageGeneration);
        if (!rl.allowed) {
          const message = `Too many requests. Try again in ${rl.retryAfterSecs}s.`;
          send({ type: "preflight", key: "ratelimit", status: "error", message });
          send({ type: "error", message });
          return finish();
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
          return finish();
        }
        send({ type: "preflight", key: "post", status: "done", title: post.title });

        // Per-post generation cap (a whole carousel consumes one; admins are exempt)
        const isAdmin = post.plan.user.role === "admin";
        if (!isAdmin && post.imageGenCount >= IMAGE_GEN_LIMIT_PER_POST) {
          const message = `Image generation limit reached (${IMAGE_GEN_LIMIT_PER_POST} per post). You can still upload custom images.`;
          send({ type: "preflight", key: "quota", status: "error", message, remaining: 0, limit: IMAGE_GEN_LIMIT_PER_POST });
          send({ type: "error", message, remaining: 0, limit: IMAGE_GEN_LIMIT_PER_POST });
          return finish();
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
          return finish();
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
        return finish();
      } catch (err) {
        send({ type: "error", message: (err as Error).message || "Carousel generation failed" });
        return finish();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
