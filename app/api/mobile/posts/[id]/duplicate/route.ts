/**
 * POST /api/mobile/posts/[id]/duplicate
 *
 * Creates a draft copy of a post, mirroring the website's
 * /api/content/[id]/duplicate. Useful for reworking a post that performed
 * well without losing the original.
 *
 * Place at: app/api/mobile/posts/[id]/duplicate/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const original = await prisma.post.findFirst({
    where: { id: params.id, plan: { userId } },
  });
  if (!original)
    return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const duplicate = await prisma.post.create({
    data: {
      planId: original.planId,
      title: `${original.title} (copy)`,
      body: original.body,
      postType: original.postType,
      style: original.style,
      hashtags: original.hashtags,
      status: "draft",
      weekNumber: original.weekNumber,
      imagePrompt: original.imagePrompt,
      humanModeOverride: original.humanModeOverride,
      // Deliberately NOT copied — a copy starts unscheduled and unpublished:
      // scheduledAt, imageUrl, images, imageGenCount, imageHistory,
      // postedToLinkedIn, linkedinPostId, postError.
    },
  });

  return NextResponse.json({ post: duplicate });
}
