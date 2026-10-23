/**
 * GET /api/mobile/posts?status=draft|ready|published
 *
 * The app's post list. Three fixes applied when this moved onto the website's
 * branch:
 *
 *  - Auth went through an inline `decode()`, so a malformed Bearer token threw
 *    and became a 500 rather than a 401. getMobileUserId() returns null for a
 *    bad token, which is what the other mobile routes already do.
 *
 *  - The query used `include`, which makes Prisma name every column of both
 *    ContentPlan and Post in its SELECT. That is why this route started 500ing
 *    once the database no longer had the mobile branch's own columns. The
 *    explicit `select` below asks only for the fields this response returns.
 *
 *  - The catch returned `err.message` to the caller, handing internal errors
 *    (including Prisma's) to anyone who asked. Detail goes to the log now.
 *
 * Ordering matches the website: generation day first, then schedule within the
 * day. The query cannot express that - plan.weekStart is the week a plan
 * COVERS, not when it was generated - so sortPostsForDisplay re-sorts after
 * flattening. `createdAt` is returned because the app needs the same key to
 * order by, and because it was previously absent.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";
import { sortPostsForDisplay } from "@/lib/post-sort";

export async function GET(req: NextRequest) {
  try {
    const userId = await getMobileUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    const plans = await prisma.contentPlan.findMany({
      where: { userId },
      select: {
        weekStart: true,
        posts: {
          where: statusFilter ? { status: statusFilter } : undefined,
          select: {
            id: true,
            title: true,
            body: true,
            postType: true,
            status: true,
            scheduledAt: true,
            createdAt: true,
            imageUrl: true,
            hashtags: true,
            postedToLinkedIn: true,
            linkedinPostId: true,
            // Per-post signature, so the app's editor can show and edit it.
            customSignature: true,
            // Past image sets, offered for reuse at no further cost.
            imageHistory: true,
            // Why an auto-publish failed. Without it, a scheduled post the
            // cron could not publish looks unchanged in the app and the user
            // never learns it did not go out.
            postError: true,
          },
          orderBy: { scheduledAt: "asc" },
        },
      },
      orderBy: { weekStart: "desc" },
      take: 8,
    });

    const posts = sortPostsForDisplay(
      plans.flatMap((plan) =>
        plan.posts.map((post) => ({ ...post, weekStart: plan.weekStart })),
      ),
    );

    return NextResponse.json({ posts, total: posts.length });
  } catch (err) {
    console.error("[mobile/posts] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
