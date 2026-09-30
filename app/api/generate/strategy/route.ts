import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateText, parseJSON } from "@/lib/gemini";
import { buildStrategyPrompt, PreviousWeekSummary, deriveAllowedPostTypes } from "@/lib/prompts";
import { buildProfileContext } from "@/lib/linkedin";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getNextScheduledSlots, toZonedDayKey } from "@/lib/timezone";
import { parsePostingSchedule } from "@/lib/posting-schedule";
import { ndjsonResponse } from "@/lib/ndjson";

// Streaming route: emits step-by-step NDJSON progress so the client can show the
// whole pipeline (preflight -> start date -> history -> strategy -> save).
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  return ndjsonResponse(
    async (send) => {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) {
        send({ type: "preflight", key: "auth", status: "error", message: "Unauthorized" });
        send({ type: "error", message: "Unauthorized" });
        return;
      }
      const userId = session.user.id;
      send({ type: "preflight", key: "auth", status: "done" });

      const { allowed, reason } = await checkActiveSubscription(userId);
      if (!allowed) {
        send({ type: "preflight", key: "subscription", status: "error", message: reason });
        send({ type: "error", message: reason, subscriptionRequired: true });
        return;
      }
      send({ type: "preflight", key: "subscription", status: "done" });

      const rl = checkRateLimit(userId, "generate", RATE_LIMITS.generation);
      if (!rl.allowed) {
        const message = `Too many requests. Try again in ${rl.retryAfterSecs}s.`;
        send({ type: "preflight", key: "ratelimit", status: "error", message });
        send({ type: "error", message });
        return;
      }
      send({ type: "preflight", key: "ratelimit", status: "done" });

      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        send({ type: "preflight", key: "user", status: "error", message: "User not found" });
        send({ type: "error", message: "User not found" });
        return;
      }
      send({ type: "preflight", key: "user", status: "done" });

      // Determine the start date: the first day this batch will actually be scheduled
      // on - the next free day matching the posting schedule. Uses the same helper as
      // /api/generate/posts so the plan label matches the posts inside it.
      send({ type: "startdate", status: "start" });
      let weekStart: Date;
      if (body.weekStart) {
        weekStart = new Date(body.weekStart);
        weekStart.setHours(0, 0, 0, 0);
      } else {
        const schedule = parsePostingSchedule(user.postingSchedule);
        const timezone = user.timezone || "Asia/Kolkata";

        const alreadyScheduled = await prisma.post.findMany({
          where: {
            plan: { userId },
            scheduledAt: { gte: new Date(Date.now() - 48 * 60 * 60 * 1000) },
          },
          select: { scheduledAt: true },
        });
        const occupiedDays = new Set(
          alreadyScheduled.map((p) => toZonedDayKey(p.scheduledAt as Date, timezone))
        );

        const [firstSlot] = getNextScheduledSlots(
          new Date(),
          schedule.days,
          schedule.time,
          timezone,
          1,
          occupiedDays
        );

        // Anchor on the user calendar day (not the server one) so the label cannot
        // drift by a day for early-morning posting times.
        const dayKey = toZonedDayKey(firstSlot ?? new Date(), timezone);
        weekStart = new Date(`${dayKey}T00:00:00Z`);
      }
      send({
        type: "startdate",
        status: "done",
        weekStart: weekStart.toISOString(),
        label: weekStart.toISOString().slice(0, 10),
      });

      // Fetch previous plans (up to 4) with their posts for continuity
      send({ type: "history", status: "start" });
      const previousPlans = await prisma.contentPlan.findMany({
        where: {
          userId: user.id,
          weekStart: { lt: weekStart }, // only weeks before the selected week
        },
        orderBy: { weekStart: "desc" },
        take: 4,
        include: {
          posts: {
            select: { title: true, postType: true },
            orderBy: { scheduledAt: "asc" },
          },
        },
      });

      // Build previous weeks summary for the prompt
      const previousWeeks: PreviousWeekSummary[] = previousPlans.map((plan) => {
        let weekTheme = "Not specified";
        let weekFocus = "Not specified";
        try {
          const strat = JSON.parse(plan.strategy);
          weekTheme = strat.weekTheme || weekTheme;
          weekFocus = strat.weekFocus || weekFocus;
        } catch {
          // strategy might not be valid JSON
        }
        return {
          weekStart: plan.weekStart.toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
          weekTheme,
          weekFocus,
          postTitles: plan.posts.map((p) => p.title),
          postTypes: plan.posts.map((p) => p.postType),
        };
      });
      send({
        type: "history",
        status: "done",
        count: previousWeeks.length,
        themes: previousWeeks.map((w) => w.weekTheme),
      });

      const profileContext = buildProfileContext(user);
      const allowedTypes = deriveAllowedPostTypes(user.contentStyles);
      const prompt = buildStrategyPrompt(profileContext, weekStart, previousWeeks, allowedTypes);

      // reuseStrategy = the user is satisfied with the current strategy, so copy it
      // instead of regenerating with AI. The true age is tracked by an embedded
      // `generatedAt` (carried forward on every reuse) so it still auto-refreshes
      // once it is 30+ days old - the strategy changes monthly by default even if
      // the user keeps reusing it.
      const reuseRequested = body.reuseStrategy === true;
      const latestPlan = previousPlans[0]; // most recent existing plan = current strategy
      const STRATEGY_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

      let latestStrategy: Record<string, unknown> | null = null;
      try {
        latestStrategy = latestPlan ? (JSON.parse(latestPlan.strategy) as Record<string, unknown>) : null;
      } catch {
        latestStrategy = null;
      }
      const generatedAtMs =
        latestStrategy && typeof latestStrategy.generatedAt === "string"
          ? new Date(latestStrategy.generatedAt).getTime()
          : latestPlan
          ? new Date(latestPlan.createdAt).getTime()
          : 0;
      const strategyAgeMs = latestStrategy ? Date.now() - generatedAtMs : Infinity;
      const canReuse = reuseRequested && !!latestStrategy && strategyAgeMs < STRATEGY_MAX_AGE_MS;

      let strategy: Record<string, unknown>;
      if (canReuse && latestStrategy) {
        send({
          type: "strategy",
          status: "reused",
          ageDays: Math.floor(strategyAgeMs / 86400000),
          theme: (latestStrategy.weekTheme as string) ?? null,
        });
        strategy = latestStrategy; // reuse current strategy (carries its original generatedAt)
      } else {
        send({
          type: "strategy",
          status: "start",
          message: reuseRequested
            ? "Current strategy is 30+ days old - building a fresh one"
            : "Building a fresh content strategy",
          allowedTypes,
          prompt,
        });
        const raw = await generateText(prompt);
        strategy = parseJSON<Record<string, unknown>>(raw);
        strategy.generatedAt = new Date().toISOString(); // stamp when this strategy was created
        send({
          type: "strategy",
          status: "done",
          theme: (strategy.weekTheme as string) ?? null,
          focus: (strategy.weekFocus as string) ?? null,
          pillars: Array.isArray(strategy.pillars) ? strategy.pillars.length : 0,
          postTypes: (strategy.postTypes as string[]) ?? [],
        });
      }
      const strategyStr = JSON.stringify(strategy);

      // Upsert without relying on a specific ON CONFLICT unique constraint
      // (the shared DB ContentPlan unique may differ across branches).
      send({ type: "save", status: "start" });
      const existing = await prisma.contentPlan.findFirst({
        where: { userId: user.id, weekStart },
        select: { id: true },
      });
      const plan = existing
        ? await prisma.contentPlan.update({
            where: { id: existing.id },
            data: { strategy: strategyStr },
          })
        : await prisma.contentPlan.create({
            data: { userId: user.id, weekStart, strategy: strategyStr },
          });
      send({ type: "save", status: "done", reusedPlan: !!existing });

      send({ type: "done", plan, strategy, reused: canReuse });
    },
    (err) => {
      const raw = err instanceof Error ? err.message : String(err);
      console.error("Strategy generation error:", raw);
      const m = raw.toLowerCase();
      return m.includes("spending cap") ||
        m.includes("resource_exhausted") ||
        m.includes("quota") ||
        m.includes("exceeded") ||
        m.includes("429")
        ? "AI is temporarily unavailable - the monthly quota has been reached. Please try again later."
        : "Couldn't generate your content strategy right now. Please try again in a moment.";
    }
  );
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const weekStartParam = searchParams.get("weekStart");

  if (weekStartParam) {
    const weekStart = new Date(weekStartParam);
    weekStart.setHours(0, 0, 0, 0);
    const plan = await prisma.contentPlan.findFirst({
      where: { userId: session.user.id, weekStart },
      include: { posts: { orderBy: { scheduledAt: "asc" } } },
    });
    return NextResponse.json(plan);
  }

  // Return most recent plan
  const plan = await prisma.contentPlan.findFirst({
    where: { userId: session.user.id },
    orderBy: { weekStart: "desc" },
    include: { posts: { orderBy: { scheduledAt: "asc" } } },
  });
  return NextResponse.json(plan);
}
