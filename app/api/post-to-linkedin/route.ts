import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { postToLinkedIn } from "@/lib/linkedin-post";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

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
    return NextResponse.json(
      { error: "Post has already been published to LinkedIn" },
      { status: 400 }
    );
  }

  const result = await postToLinkedIn(session.user.id, {
    title: post.title,
    body: post.body,
    hashtags: post.hashtags,
    imageUrl: post.imageUrl,
    carouselImages: post.carouselImages ? (JSON.parse(post.carouselImages) as string[]) : null,
    documentUrl: post.documentUrl,
    documentName: post.documentName,
    customSignature: post.customSignature,
  });

  // A failed publish must never leave the post reading as Published. "published"
  // is a value PATCH /api/content/[id] accepts, so a post can already carry it
  // before the attempt - and keeping it there on failure hid the failure
  // completely: nothing retries the post, and nobody can tell it never went out.
  // Anything else the post was (draft, ready) is left alone.
  const statusOnFailure = post.status === "published" ? "ready" : post.status;

  const updated = await prisma.post.update({
    where: { id: postId },
    data: {
      postedToLinkedIn: result.success,
      linkedinPostId: result.linkedinPostId ?? undefined,
      status: result.success ? "published" : statusOnFailure,
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
