import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/DashboardClient";
import {
  getNextScheduledSlots,
  toZonedDayKey,
  zonedDayKey,
  startOfZonedDay,
  utcToLocalTime,
} from "@/lib/timezone";
import { parsePostingSchedule, POSTS_PER_BATCH } from "@/lib/posting-schedule";
import { postsRemainingInCycle, POST_LIMIT_PER_CYCLE } from "@/lib/post-quota";
import { assessProfile } from "@/lib/profile-completeness";
import {
  toOverviewPost,
  buildAsks,
  buildRunway,
  buildContinuity,
  parseStrategy,
  excerpt,
  type OverviewPost,
} from "@/lib/dashboard-overview";

/** today-3 ... today+10, so a slipped post stays on screen next to what is due. */
const WINDOW_DAYS = 14;
const WINDOW_LOOKBACK = 3;

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const now = new Date();

  const [user, allPostCounts, plans, linkedInPostedCount, alreadyScheduled, subscription] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true, headline: true, industry: true, image: true, postingSchedule: true,
          role: true, positioning: true, contentStyles: true, timezone: true,
          summary: true, skills: true, contentGoals: true, targetAudience: true, tonePrefs: true,
        },
      }),
      prisma.post.groupBy({
        by: ["status"],
        where: { plan: { userId } },
        _count: { _all: true },
      }),
      // D. Seven plans cover six weeks of continuity plus the current one.
      // @@unique([userId, weekStart]) means at most one plan per week.
      prisma.contentPlan.findMany({
        where: { userId },
        orderBy: { weekStart: "desc" },
        take: 7,
        select: { id: true, weekStart: true, strategy: true },
      }),
      prisma.post.count({ where: { plan: { userId }, postedToLinkedIn: true } }),
      // Days that already hold a post - the next batch skips them, exactly as
      // /api/generate/posts does, so this preview matches what really gets created.
      prisma.post.findMany({
        where: {
          plan: { userId },
          scheduledAt: { gte: new Date(now.getTime() - 48 * 60 * 60 * 1000) },
        },
        select: { scheduledAt: true },
      }),
      prisma.subscription.findUnique({
        where: { userId },
        select: {
          postsGeneratedThisCycle: true, currentPeriodEnd: true, status: true,
          createdAt: true, cyclePostsResetAt: true, trialEnd: true,
        },
      }),
    ]);

  const timezone = user?.timezone || "Asia/Kolkata";
  const postingSchedule = parsePostingSchedule(user?.postingSchedule);
  const postsPerBatch = POSTS_PER_BATCH;

  // The window has to be computed in the user's calendar, which needs `user` -
  // hence the second batch rather than one big Promise.all.
  const windowStartKey = zonedDayKey(now, timezone, -WINDOW_LOOKBACK);
  const windowEndKey = zonedDayKey(now, timezone, WINDOW_DAYS - WINDOW_LOOKBACK);
  const windowStart = startOfZonedDay(windowStartKey, timezone);
  const windowEnd = startOfZonedDay(windowEndKey, timezone);

  // Queries B, E and F are guarded individually. This page lives in the
  // (dashboard) route group, where an unhandled throw 500s seven pages at once -
  // the P2021 incident in layout.tsx is the precedent. A degraded block is
  // always better than a dead section of the app.
  const [windowRows, outsideRows, planPosts, nextNewsletter] = await Promise.all([
    // A. One source of truth for the runway, ON DECK, the queue and the gauges.
    // `body` is deliberately not selected: @db.Text bodies x 20 rows is a
    // multi-KB RSC payload for text that is only shown for one post.
    prisma.post.findMany({
      where: { plan: { userId }, scheduledAt: { gte: windowStart, lt: windowEnd } },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true, title: true, status: true, scheduledAt: true, postedToLinkedIn: true,
        postError: true, imageUrl: true, carouselImages: true, documentUrl: true,
        style: true, postType: true,
      },
    }),
    // B. The query that makes failures reachable at all. A failed publish is
    // left at status "ready" with its PAST scheduledAt (lib/scheduler.ts), so a
    // forward-only list can never show it - which is how a broken post used to
    // exist on this page only as a number.
    prisma.post
      .findMany({
        where: {
          plan: { userId },
          postedToLinkedIn: false,
          scheduledAt: { not: null, lt: windowStart },
          OR: [{ postError: { not: null } }, { status: "ready" }],
        },
        orderBy: { scheduledAt: "desc" },
        take: 10,
        select: {
          id: true, title: true, status: true, scheduledAt: true, postError: true,
          imageUrl: true, carouselImages: true, documentUrl: true, style: true, postType: true,
        },
      })
      .catch(() => []),
    // E. Continuity counts, <= ~70 rows.
    plans.length > 0
      ? prisma.post
          .findMany({
            where: { planId: { in: plans.map((p) => p.id) } },
            select: { planId: true, postedToLinkedIn: true, status: true },
          })
          .catch(() => [])
      : Promise.resolve([]),
    // F. "scheduled" is the status the cron actually consumes; a draft with a
    // future date never sends.
    prisma.newsletter
      .findFirst({
        where: { userId, status: "scheduled", scheduledAt: { gt: now } },
        orderBy: { scheduledAt: "asc" },
        select: { id: true, title: true, scheduledAt: true },
      })
      .catch(() => null),
  ]);

  const windowPosts = windowRows.map((r) => toOverviewPost(r, timezone, now));
  const outsidePosts = outsideRows.map((r) => toOverviewPost(r, timezone, now));

  // Stats, with the long-standing published reconciliation preserved.
  const statusMap = Object.fromEntries(allPostCounts.map((g) => [g.status, g._count._all]));
  const totalPosts = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const publishedPosts = Math.max(statusMap["published"] ?? 0, linkedInPostedCount);
  const readyPosts = Math.max(
    0,
    (statusMap["ready"] ?? 0) - Math.max(0, linkedInPostedCount - (statusMap["published"] ?? 0))
  );
  const draftPosts = statusMap["draft"] ?? 0;

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

  const isTrialExpired =
    subscription?.status === "trialing" &&
    subscription.trialEnd != null &&
    subscription.trialEnd < now;

  const postsRemaining = postsRemainingInCycle(user?.role, subscription, now);
  const profileGaps = assessProfile(user).gaps;

  const trialEndsInDays =
    subscription?.status === "trialing" && subscription.trialEnd && !isTrialExpired
      ? Math.max(
          0,
          Math.ceil((subscription.trialEnd.getTime() - now.getTime()) / 86_400_000)
        )
      : null;

  const asks = buildAsks({
    profileGaps,
    windowPosts,
    outsidePosts,
    draftCount: draftPosts,
    trialEndsInDays: trialEndsInDays !== null && trialEndsInDays <= 3 ? trialEndsInDays : null,
  });

  const runway = buildRunway({
    windowPosts,
    postingDays: postingSchedule.days,
    batchDates: batchDates.map((d) => d.toISOString()),
    timezone,
    now,
    windowStartKey,
    days: WINDOW_DAYS,
  });

  const continuity = buildContinuity({ plans, planPosts, timezone, now });

  // ON DECK: the soonest future post that has not gone out. One extra read for
  // its body, guarded - a failure just hides the excerpt.
  const onDeckSource: OverviewPost | null =
    windowPosts.find((p) => p.state !== "published" && p.iso && new Date(p.iso) > now) ?? null;
  const lastPublished: OverviewPost | null = onDeckSource
    ? null
    : [...windowPosts].reverse().find((p) => p.state === "published") ?? null;
  const bodySource = onDeckSource ?? lastPublished;

  let onDeckExcerpt = "";
  if (bodySource) {
    const row = await prisma.post
      .findUnique({ where: { id: bodySource.id }, select: { body: true } })
      .catch(() => null);
    onDeckExcerpt = excerpt(row?.body, 180);
  }

  const currentPlan = plans[0] ?? null;

  return (
    <DashboardClient
      user={{
        name: user?.name ?? null,
        headline: user?.headline ?? null,
        industry: user?.industry ?? null,
        positioning: user?.positioning ?? null,
      }}
      dateline={`${utcToLocalTime(now, timezone, "EEE d MMM").toUpperCase()} · ${timezone.toUpperCase()}`}
      profileGaps={profileGaps}
      asks={asks}
      runway={runway}
      queue={[...outsidePosts, ...windowPosts]}
      onDeck={
        bodySource
          ? { post: bodySource, excerpt: onDeckExcerpt, isUpcoming: !!onDeckSource }
          : null
      }
      brief={
        currentPlan
          ? {
              weekStartLabel: utcToLocalTime(currentPlan.weekStart, timezone, "d MMM"),
              weekStartIso: new Date(currentPlan.weekStart).toISOString(),
              ...parseStrategy(currentPlan.strategy),
            }
          : null
      }
      continuity={continuity}
      stats={{ totalPosts, readyPosts, draftPosts, publishedPosts }}
      quota={{
        remaining: postsRemaining,
        limit: POST_LIMIT_PER_CYCLE,
        perBatch: postsPerBatch,
        resetIso: subscription?.cyclePostsResetAt
          ? new Date(
              subscription.cyclePostsResetAt.getTime() + 30 * 24 * 60 * 60 * 1000
            ).toISOString()
          : null,
      }}
      armed={{
        count: windowPosts.filter((p) => p.state === "ready").length,
        entitled: ["active", "trialing", "cancel_pending"].includes(subscription?.status ?? ""),
      }}
      footnote={{
        newsletter: nextNewsletter
          ? {
              title: nextNewsletter.title,
              dateLabel: utcToLocalTime(nextNewsletter.scheduledAt!, timezone, "d MMM"),
            }
          : null,
        billing:
          subscription?.status === "trialing" && subscription.trialEnd
            ? `Trial ends ${utcToLocalTime(subscription.trialEnd, timezone, "d MMM")}`
            : subscription?.currentPeriodEnd
              ? `Renews ${utcToLocalTime(subscription.currentPeriodEnd, timezone, "d MMM")}`
              : null,
        postingTime: `${postingSchedule.time} ${timezone}`,
      }}
      hasPlan={!!currentPlan}
      isTrialExpired={!!isTrialExpired}
    />
  );
}
