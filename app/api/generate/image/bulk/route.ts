import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generatePostImage, buildCategoryImagePrompt } from "@/lib/imagen";
import { getImageBrief } from "@/lib/image-brief";
import { resolveImageCategory } from "@/lib/image-categories";
import { checkActiveSubscription } from "@/lib/subscription-check";

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

  const { postIds } = (await req.json()) as { postIds: string[] };

  if (!Array.isArray(postIds) || postIds.length === 0 || postIds.length > 10) {
    return NextResponse.json(
      { error: "Provide 1-10 post IDs" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  const isAdmin = user?.role === "admin";

  // Fetch posts that belong to the user and don't already have an image and haven't exceeded gen limit (Admins have no limit)
  const posts = await prisma.post.findMany({
    where: {
      id: { in: postIds },
      plan: { userId: session.user.id },
      imageUrl: null,
      ...(isAdmin ? {} : { imageGenCount: { lt: IMAGE_GEN_LIMIT_PER_POST } }),
    },
    include: { plan: { include: { user: { select: { industry: true, positioning: true, contentStyles: true, name: true, headline: true } } } } },
  });

  if (posts.length === 0) {
    return NextResponse.json({
      error: "No eligible posts found (already have images or limit reached)",
      generated: 0,
    });
  }

  let generated = 0;
  const errors: string[] = [];
  // Returned so the caller can render the new images immediately instead of
  // waiting for a refetch.
  const images: { id: string; imageUrl: string }[] = [];

  // Generate sequentially to avoid overloading the image API
  for (const post of posts) {
    try {
      const industry = post.plan.user.industry || "business";
      const userVisualProfile = {
        positioning: post.plan.user.positioning,
        contentStyles: post.plan.user.contentStyles,
        industry,
        name: post.plan.user.name,
        headline: post.plan.user.headline, // the actual ROLE that drives the imagery
      };
      const category = resolveImageCategory(post.imageStyle);
      const brief = await getImageBrief(
        { title: post.title, body: post.body, postType: post.postType },
        industry,
        category,
        userVisualProfile
      );
      const prompt = buildCategoryImagePrompt(category, brief);
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
      }
    } catch (err) {
      errors.push(post.id);
    }
  }

  return NextResponse.json({
    generated,
    total: posts.length,
    images,
    errors: errors.length > 0 ? `Failed for ${errors.length} post(s)` : undefined,
  });
}
