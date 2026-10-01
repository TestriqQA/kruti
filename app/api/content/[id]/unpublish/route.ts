import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { deleteLinkedInPost } from "@/lib/linkedin-post";

/**
 * Remove a published post from LinkedIn and unlock it for editing + re-posting.
 * The LinkedIn delete happens FIRST (idempotent); the post is only unlocked once it
 * is confirmed gone from LinkedIn, so re-posting can never create a duplicate.
 * Works for any already-published post (existing rows included).
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sub = await checkActiveSubscription(session.user.id);
  if (!sub.allowed) {
    return NextResponse.json(
      { error: sub.reason, subscriptionRequired: true },
      { status: 403 }
    );
  }

  const post = await prisma.post.findFirst({
    where: { id: params.id, plan: { userId: session.user.id } },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!post.postedToLinkedIn) {
    return NextResponse.json({ error: "This post is not published to LinkedIn." }, { status: 400 });
  }

  // Delete from LinkedIn first. Bail out (and keep the post locked) if it is still
  // live and we could not remove it, so we never unlock a post that still exists.
  if (post.linkedinPostId) {
    const result = await deleteLinkedInPost(session.user.id, post.linkedinPostId);
    if (!result.success) {
      return NextResponse.json(
        { error: result.error, requiresReauth: result.requiresReauth ?? false },
        { status: result.requiresReauth ? 401 : 502 }
      );
    }
  } else {
    // Published but no recorded post id: we cannot confirm it is gone from LinkedIn,
    // so keep it locked rather than risk unlocking a still-live post that could be
    // re-posted as a duplicate. A normally-published post always stores its URN.
    return NextResponse.json(
      {
        error:
          "Kruti doesn't have this post's LinkedIn id, so it can't be removed automatically. Please delete it on LinkedIn manually.",
      },
      { status: 409 }
    );
  }

  await prisma.post.update({
    where: { id: post.id },
    data: {
      postedToLinkedIn: false,
      linkedinPostId: null,
      postError: null,
      // Drop it OUT of the auto-post cron window (which requires status "ready" AND a
      // due scheduledAt) so it can never auto-repost the unedited post before the
      // user gets to edit it.
      status: "draft",
      scheduledAt: null,
    },
  });

  return NextResponse.json({ success: true });
}
