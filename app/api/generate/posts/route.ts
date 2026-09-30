import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateText, parseJSON, generateGroundedText } from "@/lib/gemini";
import { buildPostsPrompt, buildResearchPrompt, deriveAllowedPostTypes, parseSelectedStyles, assignPostStyles } from "@/lib/prompts";
import { buildProfileContext } from "@/lib/linkedin";
import { getNextScheduledSlots, toZonedDayKey } from "@/lib/timezone";
import { parsePostingSchedule, POSTS_PER_BATCH } from "@/lib/posting-schedule";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { formatPostBody, cleanInline } from "@/lib/format";
import { IMAGE_CATEGORIES, imageStyleTaxonomyBlock, clampImageStyle } from "@/lib/image-categories";

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
  const { planId } = body;

  const plan = await prisma.contentPlan.findFirst({
    where: { id: planId, userId: session.user.id },
  });
  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { subscription: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Determine how many posts to generate based on user's posting schedule.
  // The fallback lives in one shared place so Settings and the scheduler can
  // never disagree about which days an unset schedule means.
  const schedule = parsePostingSchedule(user.postingSchedule);
  // Fixed batch size: the schedule decides which DAYS the posts land on, not how
  // many posts are written.
  const postCount = POSTS_PER_BATCH;

  // ── Enforce 30-post limit per billing cycle ──
  const POST_LIMIT_PER_CYCLE = 30;
  const subscription = user.subscription;

  if (subscription) {
    // Reset counter if it's been more than 30 days since last reset
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (!subscription.cyclePostsResetAt || subscription.cyclePostsResetAt < thirtyDaysAgo) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { postsGeneratedThisCycle: 0, cyclePostsResetAt: new Date() },
      });
      subscription.postsGeneratedThisCycle = 0;
    }

    // Check limit (Admins have no limits)
    if (user.role !== "admin" && subscription.postsGeneratedThisCycle + postCount > POST_LIMIT_PER_CYCLE) {
      const remaining = POST_LIMIT_PER_CYCLE - subscription.postsGeneratedThisCycle;
      return NextResponse.json(
        {
          error: `Post generation limit reached for this billing cycle. You have ${remaining} post(s) remaining out of ${POST_LIMIT_PER_CYCLE}.`,
          postsRemaining: remaining,
          postsLimit: POST_LIMIT_PER_CYCLE,
        },
        { status: 429 }
      );
    }
  }

  const strategy = JSON.parse(plan.strategy) as {
    weekTheme: string;
    weekFocus: string;
    postTypes: string[];
    pillars: object[];
    tone: object;
    postMix: object;
  };

  const profileContext = buildProfileContext(user);
  // Posts are generated in Human Mode by default; the per-post editor toggle
  // can switch an individual post to AI mode (which regenerates it).
  const humanMode = true;

  const allowedTypes = deriveAllowedPostTypes(user.contentStyles);
  // The user's LITERAL selected styles drive a per-post style plan so each post is
  // written in a distinct style they actually chose (not a single flattened type).
  const selectedStyles = parseSelectedStyles(user.contentStyles);

  // Web-research step: ground the posts in real, current facts before writing.
  // Best-effort - if grounding fails (quota, network, etc.) we write without a brief.
  let researchBrief = "";
  try {
    const researchPrompt = buildResearchPrompt(
      strategy.weekTheme ?? "",
      strategy.weekFocus ?? "",
      strategy.pillars ?? [],
      user.industry || "business",
      user.targetAudience || ""
    );
    researchBrief = await generateGroundedText(researchPrompt);
  } catch (err) {
    console.error("Research step failed, writing without a brief:", (err as Error).message);
    researchBrief = "";
  }

  const postTypesForPrompt = strategy.postTypes ?? allowedTypes;
  // Same assignment the prompt uses, so each saved post.style matches the style the
  // writer was told to use for that post (used for the per-post style badge in the UI).
  const styleAssignment = assignPostStyles(selectedStyles, postTypesForPrompt, postCount);

  const prompt = buildPostsPrompt(
    profileContext,
    strategy.weekTheme ?? "Professional Growth",
    strategy.weekFocus ?? "Sharing expertise",
    postTypesForPrompt,
    { pillars: strategy.pillars, tone: strategy.tone, postMix: strategy.postMix },
    humanMode,
    postCount,
    allowedTypes,
    researchBrief,
    selectedStyles,
    imageStyleTaxonomyBlock(),
    IMAGE_CATEGORIES.map((c) => c.id).join("|")
  );

  try {
    const raw = await generateText(prompt);
    const posts = parseJSON<
      Array<{
        title: string;
        body: string;
        hashtags: string[];
        postType: string;
        imageStyle: string;
        imagePrompt: string;
        bestTimeToPost: string;
        callToAction: string;
      }>
    >(raw);

    // Schedule on the user's chosen posting days (in their timezone), starting from
    // now, never in the past, and skipping every day that already holds a post - so a
    // new batch fills the next FREE matching days and rolls into the following weeks
    // instead of reusing dates that are already taken.
    const timezone = user.timezone || "Asia/Kolkata";

    // Days already holding a post. The 48h lookback covers "today" in any timezone
    // (past days can never be picked anyway, since slots must be in the future).
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

    const postingSlots = getNextScheduledSlots(
      new Date(),
      schedule.days,
      schedule.time,
      timezone,
      posts.length, // one slot per post actually written, continuing into later weeks
      occupiedDays
    );

    // One slot per post, in order. If slots somehow run out the post is left
    // unscheduled rather than silently reusing a date that is already taken.
    const createdPosts = await Promise.all(
      posts.map(async (post, idx) => {
        const scheduledAt: Date | undefined = postingSlots[idx];

        return prisma.post.create({
          data: {
            planId: plan.id,
            title: cleanInline(post.title),
            body: formatPostBody(post.body),
            hashtags: JSON.stringify(post.hashtags),
            // Enforce the user's onboarding selection: never save a post type the
            // model produced outside the allowed set. Coerce any stray type to an
            // allowed one so the calendar only ever shows selected types.
            postType: allowedTypes.includes(post.postType) ? post.postType : allowedTypes[0],
            // The actual user-selected style this post was written in (drives the UI
            // badge); falls back to null for safety so the badge shows the post type.
            style: styleAssignment[idx] ?? null,
            imageStyle: clampImageStyle(post.imageStyle),
            imagePrompt: post.imagePrompt,
            weekNumber: 1,
            scheduledAt,
            humanModeOverride: true, // default to Human Mode; editor toggle can switch to AI
            status: "draft", // user must review, add image, and mark as ready
          },
        });
      })
    );

    // Increment billing cycle counter
    let postsRemaining = POST_LIMIT_PER_CYCLE;
    if (subscription) {
      const newCount = subscription.postsGeneratedThisCycle + createdPosts.length;
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          postsGeneratedThisCycle: newCount,
          cyclePostsResetAt: subscription.cyclePostsResetAt ?? new Date(),
        },
      });
      postsRemaining = POST_LIMIT_PER_CYCLE - newCount;
    }

    return NextResponse.json({
      posts: createdPosts,
      weekTheme: strategy.weekTheme,
      postsRemaining,
      postsLimit: POST_LIMIT_PER_CYCLE,
    });
  } catch (err) {
    console.error("Posts generation error:", err);
    return NextResponse.json({ error: "Failed to generate posts" }, { status: 500 });
  }
}
