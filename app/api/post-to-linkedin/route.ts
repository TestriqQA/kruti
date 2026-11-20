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
    // The cooldown goes out as a NUMBER as well as inside the sentence. Clients
    // were scraping it back out of the text with /(\d+)\s*s/, which breaks the
    // moment this wording changes. `rateLimited` says whose refusal this is:
    // ours, not LinkedIn's, which the sentence alone never made clear.
    const retryAfterSecs = rl.retryAfterSecs ?? RATE_LIMITS.linkedinPost.windowSecs;
    console.warn(
      `[publish:web] rate limited user ${session.user.id} for ${retryAfterSecs}s ` +
        `(limit ${RATE_LIMITS.linkedinPost.maxRequests} per ${RATE_LIMITS.linkedinPost.windowSecs}s, per user)`,
    );
    return NextResponse.json(
      {
        error: `Too many requests. Try again in ${retryAfterSecs}s.`,
        rateLimited: true,
        retryAfterSecs,
        limit: RATE_LIMITS.linkedinPost.maxRequests,
        windowSecs: RATE_LIMITS.linkedinPost.windowSecs,
        scope: "user",
      },
      { status: 429, headers: { "Retry-After": String(retryAfterSecs) } },
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

  // A duplicate refusal is not a failure: LinkedIn named the share it already
  // has, so the content IS live and only our record was stale. Reconciling to
  // that urn breaks the loop - the user stops retrying a post that can never
  // succeed, and the account stops earning LinkedIn's 429 "UGC action was
  // blocked" for hammering it.
  const live = result.success || !!result.duplicateOf;
  const linkedinPostId = result.linkedinPostId ?? result.duplicateOf;
  if (result.duplicateOf) {
    console.warn(
      `[publish] post ${post.id} was already on LinkedIn as ${result.duplicateOf} - reconciling`
    );
  }

  // A failed publish must never leave the post reading as Published. "published"
  // is a value PATCH /api/content/[id] accepts, so a post can already carry it
  // before the attempt - and keeping it there on failure hid the failure
  // completely: nothing retries the post, and nobody can tell it never went out.
  // Anything else the post was (draft, ready) is left alone.
  const statusOnFailure = post.status === "published" ? "ready" : post.status;

  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      postedToLinkedIn: live,
      linkedinPostId: linkedinPostId ?? undefined,
      // live, not result.success: a duplicate refusal names the share LinkedIn
      // already has, so the post IS out and only our record was stale.
      status: live ? "published" : statusOnFailure,
      postError: live ? null : result.error ?? null,
    },
  });

  if (live) {
    return NextResponse.json({
      success: true,
      linkedinPostId,
      alreadyPublished: !result.success,
      post: updated,
    });
  } else {
    console.error(
      `[publish:web] post ${postId} user ${session.user.id} failed:`,
      result.linkedinStatus ?? "-",
      result.error,
    );
    // 502, not 500: the request was fine, the upstream refused it. The real
    // LinkedIn status and message ride along so the caller can tell an expired
    // token from a duplicate post from LinkedIn being down.
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        requiresReauth: result.requiresReauth ?? false,
        ...(result.linkedinStatus !== undefined && { linkedinStatus: result.linkedinStatus }),
        ...(result.linkedinMessage !== undefined && { linkedinMessage: result.linkedinMessage }),
      },
      { status: 502 },
    );
  }
}
