/**
 * POST /api/mobile/posts/[id]/publish
 *
 * Publishes a post to LinkedIn right away (the "Publish to LinkedIn" button in
 * the mobile editor). Supports single image, multi-image carousels (via the
 * versioned Posts API) and PDF document posts — same as the auto-post cron.
 *
 * Returns the REAL LinkedIn error on failure so the app can show it.
 *
 * Place at: app/api/mobile/posts/[id]/publish/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";
import { postToLinkedIn } from "@/lib/linkedin-post";

export const maxDuration = 60;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const post = await prisma.post.findFirst({
    where: { id: params.id, plan: { userId } },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.postedToLinkedIn)
    return NextResponse.json(
      { error: "This post is already published to LinkedIn." },
      { status: 400 },
    );

  // Atomic claim so the cron and a manual tap can't double-post.
  const claim = await prisma.post.updateMany({
    where: { id: post.id, postedToLinkedIn: false, status: { not: "publishing" } },
    data: { status: "publishing" },
  });
  if (claim.count === 0)
    return NextResponse.json(
      { error: "This post is already being published.", success: false },
      { status: 409 },
    );

  // Parse the carousel images (JSON string) so multi-image posts publish all
  // slides, not just the cover.
  let images: string[] | null = null;
  if (post.carouselImages) {
    try {
      const parsed = JSON.parse(post.carouselImages);
      if (Array.isArray(parsed)) {
        images = parsed.filter(
          (u): u is string => typeof u === "string" && !!u,
        );
      }
    } catch {
      /* not valid JSON — ignore */
    }
  }

  const result = await postToLinkedIn(userId, {
    title: post.title,
    body: post.body,
    hashtags: post.hashtags,
    imageUrl: post.imageUrl,
    // 2+ images are published as a swipeable PDF carousel document, not a
    // multi-image grid — that is the only way LinkedIn renders a real carousel.
    carouselImages: images,
    documentUrl: post.documentUrl,
    documentName: post.documentName,
    customSignature: post.customSignature,
  });

  await prisma.post.update({
    where: { id: post.id },
    data: {
      postedToLinkedIn: result.success,
      linkedinPostId: result.linkedinPostId ?? undefined,
      status: result.success ? "published" : "ready",
      postError: result.error ?? null,
    },
  });

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error || "Failed to publish to LinkedIn.",
        requiresReauth: result.requiresReauth ?? false,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    linkedinPostId: result.linkedinPostId,
  });
}
