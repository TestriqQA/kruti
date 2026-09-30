import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePostImage, buildCategoryImagePrompt } from "@/lib/imagen";
import { getImageBrief } from "@/lib/image-brief";
import { resolveImageCategory } from "@/lib/image-categories";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { ndjsonResponse } from "@/lib/ndjson";

// Streaming route: emits step-by-step NDJSON progress so the client can show the
// whole pipeline (preflight -> per-post brief/render/save -> summary).
export const runtime = "nodejs";
export const maxDuration = 60;

const IMAGE_GEN_LIMIT_PER_POST = 2;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { postIds } = body as { postIds?: string[] };

  return ndjsonResponse(async (send) => {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      send({ type: "preflight", key: "auth", status: "error", message: "Unauthorized" });
      send({ type: "error", message: "Unauthorized" });
      return;
    }
    const userId = session.user.id;
    send({ type: "preflight", key: "auth", status: "done" });

    if (!Array.isArray(postIds) || postIds.length === 0 || postIds.length > 10) {
      const message = "Provide 1-10 post IDs";
      send({ type: "preflight", key: "input", status: "error", message });
      send({ type: "error", message });
      return;
    }
    send({ type: "preflight", key: "input", status: "done", requested: postIds.length });

    const { allowed, reason } = await checkActiveSubscription(userId);
    if (!allowed) {
      send({ type: "preflight", key: "subscription", status: "error", message: reason });
      send({ type: "error", message: reason, subscriptionRequired: true });
      return;
    }
    send({ type: "preflight", key: "subscription", status: "done" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isAdmin = user?.role === "admin";

    // Only posts the user owns, without an image, still inside the per-post cap.
    const posts = await prisma.post.findMany({
      where: {
        id: { in: postIds },
        plan: { userId },
        imageUrl: null,
        ...(isAdmin ? {} : { imageGenCount: { lt: IMAGE_GEN_LIMIT_PER_POST } }),
      },
      include: {
        plan: {
          include: {
            user: {
              select: {
                industry: true,
                positioning: true,
                contentStyles: true,
                name: true,
                headline: true,
              },
            },
          },
        },
      },
    });

    if (posts.length === 0) {
      const message = "No eligible posts found (already have images or limit reached)";
      send({ type: "preflight", key: "eligible", status: "error", message });
      send({ type: "error", message, generated: 0 });
      return;
    }
    send({
      type: "preflight",
      key: "eligible",
      status: "done",
      eligible: posts.length,
      skipped: postIds.length - posts.length,
    });

    // One row per post so the client can list them before any work starts.
    send({
      type: "queue",
      total: posts.length,
      posts: posts.map((p, i) => ({ index: i, id: p.id, title: p.title })),
    });

    let generated = 0;
    const errors: string[] = [];
    const images: { id: string; imageUrl: string }[] = [];

    // Sequential on purpose - the image API rate-limits hard under parallel load.
    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const base = { type: "post", index: i, id: post.id, title: post.title };

      try {
        const industry = post.plan.user.industry || "business";
        const userVisualProfile = {
          positioning: post.plan.user.positioning,
          contentStyles: post.plan.user.contentStyles,
          industry,
          name: post.plan.user.name,
          headline: post.plan.user.headline,
        };
        const category = resolveImageCategory(post.imageStyle);
        send({ ...base, status: "brief", category: category.label });

        const brief = await getImageBrief(
          { title: post.title, body: post.body, postType: post.postType },
          industry,
          category,
          userVisualProfile
        );
        const prompt = buildCategoryImagePrompt(category, brief);
        send({
          ...base,
          status: "rendering",
          category: category.label,
          headline: brief.headline || brief.bodyText || "",
          visual: brief.visual,
          prompt,
        });
        const imageUrl = await generatePostImage(prompt, post.id, industry, true);

        if (imageUrl) {
          await prisma.post.update({
            where: { id: post.id },
            data: {
              imageUrl,
              imagePrompt: `${brief.headline || brief.bodyText || category.label} - ${brief.visual}`,
              imageGenCount: post.imageGenCount + 1,
            },
          });
          images.push({ id: post.id, imageUrl });
          generated++;
          send({ ...base, status: "done", url: imageUrl });
        } else {
          errors.push(post.id);
          send({ ...base, status: "error", message: "No image was produced" });
        }
      } catch (err) {
        errors.push(post.id);
        send({
          ...base,
          status: "error",
          message: (err as Error)?.message || "Image generation failed",
        });
      }
    }

    send({
      type: "done",
      generated,
      total: posts.length,
      images,
      errors: errors.length > 0 ? `Failed for ${errors.length} post(s)` : undefined,
    });
  }, () => "Image generation failed");
}
