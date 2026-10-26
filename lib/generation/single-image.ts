import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  generatePostImage,
  renderAndStoreDesignedImage,
  generateAndStoreArtImage,
  lastImageGenError,
} from "@/lib/imagen";
import { getImageBrief, describeDesignBrief } from "@/lib/image-brief";
import { resolveImageCategory } from "@/lib/image-categories";
import { appendImageHistory } from "@/lib/image-history";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { checkProfileReady } from "@/lib/profile-guard";

/**
 * Single-post image generation, shared by the website and the mobile API.
 *
 * Extracted from app/api/generate/image/route.ts. The bulk pipeline only
 * accepts posts with no image yet (it filters imageUrl: null), so this is the
 * only way to REGENERATE the image on a post that already has one - which is
 * what the app editor needs.
 *
 * Returns a Response rather than a value so both routes answer identically
 * without re-deriving status codes. Authentication happens before this is
 * called; a 401 never originates here.
 */

const IMAGE_GEN_LIMIT_PER_POST = 2;

export async function runSingleImageGeneration(
  userId: string,
  postId: unknown,
  customPrompt: unknown,
): Promise<NextResponse> {
  // Prisma DROPS an `undefined` id filter, so without this the lookup below
  // collapses to { plan: { userId } } and regenerates an arbitrary post of the
  // caller's. Same hazard the carousel pipeline guards against.
  if (!postId || typeof postId !== "string") {
    return NextResponse.json({ error: "Missing or invalid post reference." }, { status: 400 });
  }

  const { allowed, reason } = await checkActiveSubscription(userId);
  if (!allowed) {
    return NextResponse.json({ error: reason, subscriptionRequired: true }, { status: 403 });
  }

  // Content-quality gate, same contract as the text routes. The image is
  // briefed from the post and the post is written from the profile, so artwork
  // for a generic post is a model call the user throws away the moment their
  // profile is filled in. Blocked with the gaps so the client can link straight
  // to the fix.
  const profile = await checkProfileReady(userId);
  if (!profile.ready) {
    return NextResponse.json(
      { error: profile.message, profileIncomplete: true, gaps: profile.gaps },
      { status: 403 }
    );
  }

  const rl = checkRateLimit(userId, "image-gen", RATE_LIMITS.imageGeneration);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Too many requests. Try again in ${rl.retryAfterSecs}s.`, rateLimited: true, retryAfterSecs: rl.retryAfterSecs }, { status: 429 });
  }

  // Validate customPrompt to prevent prompt injection / resource exhaustion
  if (customPrompt && (typeof customPrompt !== "string" || customPrompt.length > 2000)) {
    return NextResponse.json(
      { error: "Image prompt must be under 2000 characters" },
      { status: 400 }
    );
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
      summary: post.plan.user.summary,
      targetAudience: post.plan.user.targetAudience,
  };

  let imageUrl: string | null;
  let savedPrompt: string;

  if (prompt) {
    // Explicit user override: respect the literal prompt on the legacy no-text path.
    imageUrl = await generatePostImage(prompt, post.id, industry);
    savedPrompt = prompt;
  } else {
    // Content-aware: derive a brief from THIS post, then render a branded graphic
    // that represents the post and displays a short headline of its key point.
    const category = resolveImageCategory(post.imageStyle);
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
      return NextResponse.json(
        {
          error:
            "AI is temporarily unavailable, so we couldn't read this post properly. Rather than generate a generic image, we've stopped here - please try again shortly.",
          remaining: IMAGE_GEN_LIMIT_PER_POST - post.imageGenCount,
          limit: IMAGE_GEN_LIMIT_PER_POST,
        },
        { status: 503 }
      );
    }

    // Art-directed first: the model draws the whole graphic, lettering included.
    // The code renderer is the FALLBACK now, not the default - plain type on a
    // flat field beats no image, but it is nowhere near what a good LinkedIn
    // graphic looks like, and that is the bar.
    imageUrl = await generateAndStoreArtImage(brief, post.id, category);
    savedPrompt = [
      `[${category.label}]`,
      brief.visualStyle ?? "auto",
      brief.headline,
      brief.scene ?? "",
    ].join(" | ");

    if (!imageUrl) {
      console.warn(`[image] art generation failed for ${post.id}, using the code renderer`);
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
  }

  const remaining = IMAGE_GEN_LIMIT_PER_POST - (post.imageGenCount + (imageUrl ? 1 : 0));

  return NextResponse.json({
    imageUrl,
    remaining,
    limit: IMAGE_GEN_LIMIT_PER_POST,
    ...(imageUrl ? {} : { error: lastImageGenError || "Image generation failed - all models returned no image" }),
  });
}
