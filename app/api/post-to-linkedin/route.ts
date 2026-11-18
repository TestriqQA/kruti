import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postToLinkedIn } from "@/lib/linkedin-post";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

// Publishing fetches the image from Blob and uploads it to LinkedIn, so it is
// bounded by media size, not by our own work. The mobile route and the cron
// both allow 60s; this one had no setting at all and took the platform
// default, which is far below that.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, reason } = await checkActiveSubscription(session.user.id);
  if (!allowed) {
    return NextResponse.json({ error: reason, subscriptionRequired: true }, { status: 403 });
  }

  const rl = checkRateLimit(session.user.id, "linkedin-post", RATE_LIMITS.linkedinPost);
  if (!rl.allowed) {
    // retryAfterSecs as a number and a real Retry-After header: the mobile app
    // was pulling the figure out of the sentence with a regex, which breaks the
    // moment the wording changes.
    return NextResponse.json(
      {
        error: `Too many requests. Try again in ${rl.retryAfterSecs}s.`,
        rateLimited: true,
        retryAfterSecs: rl.retryAfterSecs,
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSecs ?? 60) } }
    );
  }

  const body = await req.json();
  const { postId } = body;

  if (!postId) {
    return NextResponse.json({ error: "postId is required" }, { status: 400 });
  }

  // Validate post ownership
  const post = await prisma.post.findFirst({
    where: { id: postId, plan: { userId: session.user.id } },
  });

  if (!post) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (post.postedToLinkedIn) {
    // Flagged, not just worded. The editor used to print every rejection as
    // "Failed to post: <message>", so a post that is sitting live on LinkedIn
    // showed the user a red failure - which is most of what "publishing is
    // broken" turned out to mean.
    return NextResponse.json(
      {
        error: "This post is already on LinkedIn.",
        alreadyPublished: true,
        linkedinPostId: post.linkedinPostId,
      },
      { status: 409 }
    );
  }

  // Atomic claim, the same one the mobile route already had. Without it two
  // clicks a second apart both read postedToLinkedIn: false and both publish,
  // putting the post on LinkedIn twice.
  const claim = await prisma.post.updateMany({
    where: { id: post.id, postedToLinkedIn: false, status: { not: "publishing" } },
    data: { status: "publishing" },
  });
  if (claim.count === 0) {
    return NextResponse.json(
      { error: "This post is already being published.", inFlight: true },
      { status: 409 }
    );
  }

  // Parsed defensively: a malformed carouselImages used to throw here, 500 the
  // route before LinkedIn was ever called, and leave the claim above set.
  let carouselImages: string[] | null = null;
  if (post.carouselImages) {
    try {
      const parsed = JSON.parse(post.carouselImages);
      if (Array.isArray(parsed)) {
        carouselImages = parsed.filter((u): u is string => typeof u === "string" && !!u);
      }
    } catch {
      console.warn(`[publish] post ${post.id}: carouselImages is not valid JSON, ignoring`);
    }
  }

  let result;
  try {
    result = await postToLinkedIn(session.user.id, {
      title: post.title,
      body: post.body,
      hashtags: post.hashtags,
      imageUrl: post.imageUrl,
      carouselImages,
      documentUrl: post.documentUrl,
      documentName: post.documentName,
      customSignature: post.customSignature,
    });
  } catch (err) {
    // The claim above set status to "publishing". Releasing it here is what
    // stops a thrown request from locking the post out of every later attempt
    // AND out of the cron, which only ever looks at status "ready".
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[publish] post ${post.id} user ${session.user.id} threw:`, message);
    await prisma.post.update({
      where: { id: post.id },
      data: { status: post.status, postError: message.slice(0, 500) },
    });
    return NextResponse.json(
      { success: false, error: `Publishing failed before it reached LinkedIn: ${message.slice(0, 200)}` },
      { status: 500 }
    );
  }

  if (!result.success) {
    console.error(
      `[publish] post ${post.id} user ${session.user.id} failed` +
        `${result.linkedinStatus ? ` (LinkedIn ${result.linkedinStatus})` : ""}: ${result.error}`
    );
  }

  // Update post record
  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      postedToLinkedIn: result.success,
      linkedinPostId: result.linkedinPostId ?? undefined,
      // Back to what it was, because the claim above moved it to "publishing".
      status: result.success ? "published" : post.status,
      postError: result.error ?? null,
    },
  });

  if (result.success) {
    return NextResponse.json({
      success: true,
      linkedinPostId: result.linkedinPostId,
      post: updated,
    });
  } else {
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        linkedinStatus: result.linkedinStatus,
        requiresReauth: result.requiresReauth ?? false,
      },
      { status: 502 }
    );
  }
}
