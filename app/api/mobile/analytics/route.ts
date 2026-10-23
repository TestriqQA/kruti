/**
 * GET /api/mobile/analytics
 *
 * Server-computed analytics for the mobile Analytics screen — a mirror of the
 * website's app/(dashboard)/analytics/page.tsx so both surfaces show the SAME
 * numbers.
 *
 * The app used to compute all of this on-device from /api/mobile/posts, which
 * was wrong in four ways:
 *   • engagement columns were never sent, so the engagement UI was dead code
 *   • success rate was published/(draft+ready+published) instead of
 *     published/(published+errors)
 *   • buckets keyed off scheduledAt (createdAt wasn't sent), so future-dated
 *     posts landed in future buckets and unscheduled posts vanished
 *   • the posts feed is capped at 8 plans, so totals under-reported
 *
 * Place at: app/api/mobile/analytics/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

export async function GET(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const userFilter = { plan: { userId } };

  const [
    postsByStatus,
    postsByType,
    linkedinPublished,
    linkedinErrors,
    totalPosts,
    weeklyPosts,
    heatmapPosts,
    engagementPosts,
  ] = await Promise.all([
    prisma.post.groupBy({
      by: ["status"],
      where: userFilter,
      _count: { _all: true },
    }),
    prisma.post.groupBy({
      by: ["postType"],
      where: userFilter,
      _count: { _all: true },
    }),
    prisma.post.count({ where: { ...userFilter, postedToLinkedIn: true } }),
    prisma.post.count({ where: { ...userFilter, postError: { not: null } } }),
    prisma.post.count({ where: userFilter }),
    prisma.post.findMany({
      where: { ...userFilter, createdAt: { gte: eightWeeksAgo } },
      select: { createdAt: true, postedToLinkedIn: true },
    }),
    prisma.post.findMany({
      where: { ...userFilter, createdAt: { gte: ninetyDaysAgo } },
      select: { createdAt: true },
    }),
    prisma.post.findMany({
      where: { ...userFilter, postedToLinkedIn: true },
      select: {
        id: true,
        title: true,
        postType: true,
        linkedinLikes: true,
        linkedinComments: true,
        linkedinShares: true,
        linkedinImpressions: true,
        engagementSyncedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  // Posts created this calendar week (Mon-Sun).
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay() + 1);
  startOfWeek.setHours(0, 0, 0, 0);
  const postsThisWeek = await prisma.post.count({
    where: { ...userFilter, createdAt: { gte: startOfWeek } },
  });

  const statusMap: Record<string, number> = {};
  postsByStatus.forEach((g) => {
    statusMap[g.status] = g._count._all;
  });

  const typeMap: Record<string, number> = {};
  postsByType.forEach((g) => {
    typeMap[g.postType] = g._count._all;
  });

  // Weekly activity — last 8 weeks, created vs published.
  const weekBuckets: Record<string, { created: number; published: number }> =
    {};
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    weekBuckets[weekStart.toISOString().slice(0, 10)] = {
      created: 0,
      published: 0,
    };
  }
  weeklyPosts.forEach((p) => {
    const d = new Date(p.createdAt);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay() + 1);
    const key = weekStart.toISOString().slice(0, 10);
    if (weekBuckets[key]) {
      weekBuckets[key].created++;
      if (p.postedToLinkedIn) weekBuckets[key].published++;
    }
  });
  const weeklyActivity = Object.entries(weekBuckets).map(([date, data]) => {
    const d = new Date(date + "T00:00:00");
    return {
      // ISO yyyy-mm-dd so the app can render its "Week of …" tooltip.
      weekStart: date,
      weekLabel: d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      ...data,
    };
  });

  // Calendar heatmap — last 90 days.
  const heatmapMap: Record<string, number> = {};
  heatmapPosts.forEach((p) => {
    const key = new Date(p.createdAt).toISOString().slice(0, 10);
    heatmapMap[key] = (heatmapMap[key] || 0) + 1;
  });
  const calendarHeatmap: { date: string; count: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const key = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    calendarHeatmap.push({ date: key, count: heatmapMap[key] || 0 });
  }

  const weeksActive = Math.max(
    1,
    Math.ceil(
      (now.getTime() - eightWeeksAgo.getTime()) / (7 * 24 * 60 * 60 * 1000),
    ),
  );
  const avgPostsPerWeek =
    totalPosts > 0 ? Math.round((totalPosts / weeksActive) * 10) / 10 : 0;

  const successRate =
    linkedinPublished + linkedinErrors > 0
      ? Math.round(
          (linkedinPublished / (linkedinPublished + linkedinErrors)) * 100,
        )
      : 0;

  // Engagement aggregated by post type.
  const engagementByType: Record<
    string,
    {
      count: number;
      likes: number;
      comments: number;
      shares: number;
      impressions: number;
    }
  > = {};
  engagementPosts.forEach((p) => {
    if (!engagementByType[p.postType]) {
      engagementByType[p.postType] = {
        count: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        impressions: 0,
      };
    }
    const t = engagementByType[p.postType];
    t.count++;
    t.likes += p.linkedinLikes ?? 0;
    t.comments += p.linkedinComments ?? 0;
    t.shares += p.linkedinShares ?? 0;
    t.impressions += p.linkedinImpressions ?? 0;
  });

  const engagementTotals = {
    likes: 0,
    comments: 0,
    shares: 0,
    impressions: 0,
    hasSyncedData: false,
  };
  const engagementByPost = engagementPosts.map((p) => {
    const likes = p.linkedinLikes ?? 0;
    const comments = p.linkedinComments ?? 0;
    const shares = p.linkedinShares ?? 0;
    const impressions = p.linkedinImpressions ?? 0;
    engagementTotals.likes += likes;
    engagementTotals.comments += comments;
    engagementTotals.shares += shares;
    engagementTotals.impressions += impressions;
    if (p.engagementSyncedAt) engagementTotals.hasSyncedData = true;
    return {
      id: p.id,
      title: p.title,
      postType: p.postType,
      likes,
      comments,
      shares,
      impressions,
      engagementRate:
        impressions > 0
          ? Math.round(((likes + comments + shares) / impressions) * 1000) / 10
          : 0,
    };
  });

  return NextResponse.json({
    stats: {
      totalPosts,
      postsThisWeek,
      linkedinPublished,
      linkedinErrors,
      avgPostsPerWeek,
      successRate,
    },
    postsByStatus: statusMap,
    postsByType: typeMap,
    weeklyActivity,
    calendarHeatmap,
    engagement: {
      totals: engagementTotals,
      byPost: engagementByPost,
      byType: Object.entries(engagementByType).map(([type, data]) => ({
        postType: type,
        ...data,
        avgEngagement:
          data.impressions > 0
            ? Math.round(
                ((data.likes + data.comments + data.shares) /
                  data.impressions) *
                  1000,
              ) / 10
            : 0,
      })),
    },
  });
}
