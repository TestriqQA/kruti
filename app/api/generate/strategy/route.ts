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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { allowed, reason } = await checkActiveSubscription(session.user.id);
  if (!allowed) {
    return NextResponse.json({ error: reason, subscriptionRequired: true }, { status: 403 });
  }

  const rl = checkRateLimit(session.user.id, "generate", RATE_LIMITS.generation);
  if (!rl.allowed) {
    return NextResponse.json({ error: `Too many requests. Try again in ${rl.retryAfterSecs}s.` }, { status: 429 });
  }

  const body = await req.json();

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Determine the start date: the first day this batch will actually be scheduled
  // on - the next free day matching the user's posting schedule. Uses the same
  // helper as /api/generate/posts so the plan's label matches the posts inside it.
  let weekStart: Date;
  if (body.weekStart) {
    weekStart = new Date(body.weekStart);
    weekStart.setHours(0, 0, 0, 0);
  } else {
    const schedule = parsePostingSchedule(user.postingSchedule);
    const timezone = user.timezone || "Asia/Kolkata";

    const alreadyScheduled = await prisma.post.findMany({
      where: {
        plan: { userId: user.id },
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

    // Anchor on the user's calendar day (not the server's) so the label cannot
    // drift by a day for early-morning posting times.
    const dayKey = toZonedDayKey(firstSlot ?? new Date(), timezone);
    weekStart = new Date(`${dayKey}T00:00:00Z`);
  }

  // Fetch previous plans (up to 4) with their posts for continuity
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

  const profileContext = buildProfileContext(user);
  const allowedTypes = deriveAllowedPostTypes(user.contentStyles);
  const prompt = buildStrategyPrompt(profileContext, weekStart, previousWeeks, allowedTypes);

  // reuseStrategy = the user is satisfied with the current strategy → copy it
  // instead of regenerating with AI. The strategy's true age is tracked by an
  // embedded `generatedAt` (carried forward on every reuse) so it still
  // auto-refreshes once it is 30+ days old — i.e. the strategy changes monthly
  // by default even if the user keeps reusing it.
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

  try {
    let strategy: Record<string, unknown>;
    if (canReuse && latestStrategy) {
      strategy = latestStrategy; // reuse current strategy (carries its original generatedAt)
    } else {
      const raw = await generateText(prompt);
      strategy = parseJSON<Record<string, unknown>>(raw);
      strategy.generatedAt = new Date().toISOString(); // stamp when this strategy was created
    }
    const strategyStr = JSON.stringify(strategy);

    // Upsert without relying on a specific ON CONFLICT unique constraint
    // (the shared DB's ContentPlan unique may differ across branches).
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

    return NextResponse.json({ plan, strategy, reused: canReuse });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("Strategy generation error:", raw);
    const m = raw.toLowerCase();
    const friendly =
      m.includes("spending cap") ||
      m.includes("resource_exhausted") ||
      m.includes("quota") ||
      m.includes("exceeded") ||
      m.includes("429")
        ? "AI is temporarily unavailable - the monthly quota has been reached. Please try again later."
        : "Couldn't generate your content strategy right now. Please try again in a moment.";
    return NextResponse.json({ error: friendly }, { status: 500 });
  }
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

