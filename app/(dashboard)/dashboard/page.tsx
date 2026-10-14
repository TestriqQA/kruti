import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/DashboardClient";
import { getNextScheduledSlots, toZonedDayKey } from "@/lib/timezone";
import { parsePostingSchedule, POSTS_PER_BATCH } from "@/lib/posting-schedule";
import { postsRemainingInCycle, POST_LIMIT_PER_CYCLE } from "@/lib/post-quota";
import { assessProfile } from "@/lib/profile-completeness";
import { safeJsonParse } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const now = new Date();

  const [user, recentPlan, allPostCounts, newsletters, trendRows, upcomingPosts] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true, headline: true, industry: true, image: true, postingSchedule: true,
        role: true, positioning: true, contentStyles: true, timezone: true,
        // Added for the profile-completeness banner. The select already carried
        // most of what assessProfile() reads, so the banner costs no extra query.
        summary: true, skills: true, contentGoals: true, targetAudience: true, tonePrefs: true,
      },
    }),
    // Get most recent week's plan
    prisma.contentPlan.findFirst({
      where: { userId: session.user.id },
      orderBy: { weekStart: "desc" },
    }),
    // Count all posts for this user
    prisma.post.groupBy({
      by: ["status"],
      where: { plan: { userId: session.user.id } },
      _count: { _all: true },
    }),
    prisma.newsletter.count({ where: { userId: session.user.id } }),
    // Eight weeks of creation dates, for the sparkline on each stat card.
    prisma.post.findMany({
      where: {
        plan: { userId: session.user.id },
        createdAt: { gte: new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000) },
      },
      select: { createdAt: true, status: true, postedToLinkedIn: true },
    }),
    // Upcoming posts across ALL plans - scheduled in the future and not yet posted
    prisma.post.findMany({
      where: {
        plan: { userId: session.user.id },
        postedToLinkedIn: false,
        scheduledAt: { gt: now },
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        postType: true,
        style: true,
        scheduledAt: true,
        status: true,
        weekNumber: true,
        postedToLinkedIn: true,
        // The dashboard of a product that generates artwork showed none of it.
        imageUrl: true,
      },
    }),
  ]);

  // Also count posts that are posted to LinkedIn (safety net for status mismatch)
  const [linkedInPostedCount, alreadyScheduled, subscription] = await Promise.all([
    prisma.post.count({
      where: { plan: { userId: session.user.id }, postedToLinkedIn: true },
    }),
    // Days that already hold a post - the next batch skips them, exactly as
    // /api/generate/posts does, so this preview matches what really gets created.
    prisma.post.findMany({
      where: {
        plan: { userId: session.user.id },
        scheduledAt: { gte: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
      },
      select: { scheduledAt: true },
    }),
    // Get subscription for billing cycle post count
    prisma.subscription.findUnique({
      where: { userId: session.user.id },
      select: { postsGeneratedThisCycle: true, currentPeriodEnd: true, status: true, createdAt: true, cyclePostsResetAt: true, trialEnd: true },
    }),
  ]);

  // Posts per batch, and the exact dates that batch will land on. This calls the
  // same helper as /api/generate/posts with the same inputs, so the range shown
  // here is the range the user actually gets.
  const postingSchedule = parsePostingSchedule(user?.postingSchedule);
  const postsPerBatch = POSTS_PER_BATCH;
  const timezone = user?.timezone || "Asia/Kolkata";
  const occupiedDays = new Set(
    alreadyScheduled.map((p) => toZonedDayKey(p.scheduledAt as Date, timezone))
  );
  const batchDates = getNextScheduledSlots(
    now,
    postingSchedule.days,
    postingSchedule.time,
    timezone,
    postsPerBatch,
    occupiedDays
  );

  // Check if trial is expired
  const isTrialExpired = subscription?.status === "trialing" &&
    subscription.trialEnd != null && subscription.trialEnd < now;

  // Posts remaining in the billing cycle (same rule the posts page uses).
  const postsRemaining = postsRemainingInCycle(user?.role, subscription, now);

  // Build stats from grouped counts
  const statusMap = Object.fromEntries(
    allPostCounts.map((g) => [g.status, g._count._all])
  );
  const totalPosts = Object.values(statusMap).reduce((a, b) => a + b, 0);
  // Use the higher of status-based count or postedToLinkedIn count
  const publishedPosts = Math.max(statusMap["published"] ?? 0, linkedInPostedCount);
  // Subtract any mismatched posts from "ready" count (posts marked ready but already published)
  const readyPosts = Math.max(0, (statusMap["ready"] ?? 0) - Math.max(0, linkedInPostedCount - (statusMap["published"] ?? 0)));
  const draftPosts = statusMap["draft"] ?? 0;

  // Fallback: if no future posts, show the most recent posts so the section isn't blank
  let postsToShow = upcomingPosts;
  if (postsToShow.length === 0 && totalPosts > 0) {
    postsToShow = await prisma.post.findMany({
      where: { plan: { userId: session.user.id } },
      orderBy: { scheduledAt: "desc" },
      take: 5,
      select: {
        id: true,
        title: true,
        postType: true,
        style: true,
        scheduledAt: true,
        status: true,
        weekNumber: true,
        postedToLinkedIn: true,
        imageUrl: true,
      },
    });
  }

  // What still blocks generation. Rendered as a banner right above the Generate
  // button, because that is where the user finds out otherwise - the generation
  // preflight refuses with the same gaps.
  const profileGaps = assessProfile(user).gaps;

  // Eight weekly buckets per stat, so each card carries its own shape rather
  // than a decorative squiggle. Counted here because the client should receive
  // numbers, not rows.
  const bucketOf = (d: Date) =>
    Math.min(7, Math.floor((now.getTime() - d.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  const blank = () => [0, 0, 0, 0, 0, 0, 0, 0];
  const trends = { total: blank(), ready: blank(), published: blank(), draft: blank() };
  for (const row of trendRows) {
    const i = 7 - bucketOf(new Date(row.createdAt));
    if (i < 0 || i > 7) continue;
    trends.total[i] += 1;
    if (row.postedToLinkedIn || row.status === "published") trends.published[i] += 1;
    else if (row.status === "ready") trends.ready[i] += 1;
    else trends.draft[i] += 1;
  }

  function parseSkills(raw?: string | null): string[] {
    const v = safeJsonParse<string[]>(raw ?? null, []);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).slice(0, 6) : [];
  }

  return (
    <DashboardClient
      user={user}
      profileGaps={profileGaps}
      recentPlan={
        recentPlan
          ? { id: recentPlan.id, strategy: recentPlan.strategy, weekStart: recentPlan.weekStart }
          : null
      }
      stats={{ totalPosts, readyPosts, draftPosts, publishedPosts, newsletters }}
      trends={trends}
      skills={parseSkills(user?.skills)}
      upcomingPosts={postsToShow}
      batchDates={batchDates.map((d) => d.toISOString())}
      postsRemaining={postsRemaining}
      postsLimit={POST_LIMIT_PER_CYCLE}
      isTrialExpired={isTrialExpired}
      postsPerBatch={postsPerBatch}
      cycleResetDate={subscription?.cyclePostsResetAt
        ? new Date(subscription.cyclePostsResetAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null}
    />
  );
}
