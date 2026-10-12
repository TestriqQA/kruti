import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generatePostImage,
  buildCategoryImagePrompt,
  renderAndStoreDesignedImage,
  lastImageGenError,
} from "@/lib/imagen";
import { getImageBrief, describeDesignBrief } from "@/lib/image-brief";
import { resolveImageCategory, usesCodeRender } from "@/lib/image-categories";
import { appendImageHistory } from "@/lib/image-history";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

const IMAGE_GEN_LIMIT_PER_POST = 2;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, reason } = await checkActiveSubscription(session.user.id);
  if (!allowed) {
    return NextResponse.json({ error: reason, subscriptionRequired: true }, { status: 403 });
  }

  const rl = checkRateLimit(session.user.id, "image-gen", RATE_LIMITS.imageGeneration);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Too many requests. Try again in ${rl.retryAfterSecs}s.` }, { status: 429 });
  }

  const body = await req.json();
  const { postId, customPrompt } = body;

  // Validate customPrompt to prevent prompt injection / resource exhaustion
  if (customPrompt && (typeof customPrompt !== "string" || customPrompt.length > 2000)) {
    return NextResponse.json(
      { error: "Image prompt must be under 2000 characters" },
      { status: 400 }
    );
  }

  const post = await prisma.post.findFirst({
    where: { id: postId, plan: { userId: session.user.id } },
    include: { plan: { include: { user: true } } },
  });
  if (!post) return NextResponse.json({ error: "Post not found" }, { status: 404 });

  // Enforce per-post image generation limit (Admins have no limits)
  const isAdmin = post.plan.user.role === "admin";
  if (!isAdmin && post.imageGenCount >= IMAGE_GEN_LIMIT_PER_POST) {
    return NextResponse.json(
      {
        error: `Image generation limit reached (${IMAGE_GEN_LIMIT_PER_POST} per post). You can still upload a custom image.`,
        remaining: 0,
        limit: IMAGE_GEN_LIMIT_PER_POST,
      },
      { status: 429 }
    );
  }

  const industry = post.plan.user.industry || "business";
  const userVisualProfile = {
    positioning: post.plan.user.positioning,
    contentStyles: post.plan.user.contentStyles,
    industry,
    name: post.plan.user.name,
    headline: post.plan.user.headline, // the actual ROLE that drives the imagery
  };

  let imageUrl: string | null;
  let savedPrompt: string;

  if (customPrompt) {
    // Explicit user override: respect the literal prompt on the legacy no-text path.
    imageUrl = await generatePostImage(customPrompt, post.id, industry);
    savedPrompt = customPrompt;
  } else {
    // Content-aware: derive a brief from THIS post, then render a branded graphic
    // that represents the post and displays a short headline of its key point.
    const category = resolveImageCategory(post.imageStyle);
    const brief = await getImageBrief(
      { title: post.title, body: post.body, postType: post.postType },
      category,
      userVisualProfile
    );

    if (usesCodeRender(category)) {
      // Information design: laid out in code, so the text is exact and the
      // render is free. See lib/render-card.tsx.
      imageUrl = await renderAndStoreDesignedImage(category, brief, post.id, {
        author: { name: post.plan.user.name, headline: post.plan.user.headline },
      });
      savedPrompt = describeDesignBrief(category, brief);
    } else {
      // Photographic: a believable scene is what the image model is for.
      const prompt = buildCategoryImagePrompt(category, brief);
      imageUrl = await generatePostImage(prompt, post.id, industry, true);
      savedPrompt = `${brief.headline || brief.bodyText || category.label} - ${brief.visual ?? ""}`;
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
  }

  const remaining = IMAGE_GEN_LIMIT_PER_POST - (post.imageGenCount + (imageUrl ? 1 : 0));

  return NextResponse.json({
    imageUrl,
    remaining,
    limit: IMAGE_GEN_LIMIT_PER_POST,
    ...(imageUrl ? {} : { error: lastImageGenError || "Image generation failed - all models returned no image" }),
  });
}
