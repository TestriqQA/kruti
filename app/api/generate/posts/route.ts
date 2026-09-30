import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateText, parseJSON, generateGroundedText } from "@/lib/gemini";
import { buildPostsPrompt, buildResearchPrompt, deriveAllowedPostTypes, parseSelectedStyles, assignPostStyles } from "@/lib/prompts";
import { buildProfileContext } from "@/lib/linkedin";
import { getNextScheduledSlots, toZonedDayKey, utcToLocalTime } from "@/lib/timezone";
import { parsePostingSchedule, POSTS_PER_BATCH } from "@/lib/posting-schedule";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { formatPostBody, cleanInline } from "@/lib/format";
import { IMAGE_CATEGORIES, imageStyleTaxonomyBlock, clampImageStyle } from "@/lib/image-categories";
import { ndjsonResponse } from "@/lib/ndjson";

// Streaming route: emits step-by-step NDJSON progress so the client can show the
// whole pipeline (preflight -> research -> writing -> scheduling -> save).
export const runtime = "nodejs";
export const maxDuration = 60;

const POST_LIMIT_PER_CYCLE = 30;
const SLOT_FORMAT = "EEE, MMM d - hh:mm a";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { planId } = body as { planId?: string };

  return ndjsonResponse(async (send) => {
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

    const plan = await prisma.contentPlan.findFirst({ where: { id: planId, userId } });
    if (!plan) {
      send({ type: "preflight", key: "plan", status: "error", message: "Plan not found" });
      send({ type: "error", message: "Plan not found" });
      return;
    }
    send({ type: "preflight", key: "plan", status: "done" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });
    if (!user) {
      send({ type: "preflight", key: "user", status: "error", message: "User not found" });
      send({ type: "error", message: "User not found" });
      return;
    }

    // The schedule decides WHICH days posts land on; the batch size is fixed.
    const schedule = parsePostingSchedule(user.postingSchedule);
    const postCount = POSTS_PER_BATCH;
    const timezone = user.timezone || "Asia/Kolkata";
    send({
      type: "preflight",
      key: "schedule",
      status: "done",
      days: schedule.days,
      time: schedule.time,
      timezone,
      batchSize: postCount,
    });

    // Enforce the per-cycle limit.
    const subscription = user.subscription;
    if (subscription) {
      // Reset the counter once the 30-day window has elapsed.
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (!subscription.cyclePostsResetAt || subscription.cyclePostsResetAt < thirtyDaysAgo) {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { postsGeneratedThisCycle: 0, cyclePostsResetAt: new Date() },
        });
        subscription.postsGeneratedThisCycle = 0;
      }

      if (user.role !== "admin" && subscription.postsGeneratedThisCycle + postCount > POST_LIMIT_PER_CYCLE) {
        const remaining = POST_LIMIT_PER_CYCLE - subscription.postsGeneratedThisCycle;
        const message = `Post generation limit reached for this billing cycle. You have ${remaining} post(s) remaining out of ${POST_LIMIT_PER_CYCLE}.`;
        send({ type: "preflight", key: "quota", status: "error", message, postsRemaining: remaining });
        send({ type: "error", message, postsRemaining: remaining, postsLimit: POST_LIMIT_PER_CYCLE });
        return;
      }
    }
    send({
      type: "preflight",
      key: "quota",
      status: "done",
      used: subscription?.postsGeneratedThisCycle ?? 0,
      limit: POST_LIMIT_PER_CYCLE,
    });

    const strategy = JSON.parse(plan.strategy) as {
      weekTheme: string;
      weekFocus: string;
      postTypes: string[];
      pillars: object[];
      tone: object;
      postMix: object;
    };
    send({
      type: "strategy",
      status: "done",
      theme: strategy.weekTheme ?? null,
      focus: strategy.weekFocus ?? null,
      postTypes: strategy.postTypes ?? [],
    });

    const profileContext = buildProfileContext(user);
    // Posts are generated in Human Mode by default; the per-post editor toggle
    // can switch an individual post to AI mode (which regenerates it).
    const humanMode = true;

    const allowedTypes = deriveAllowedPostTypes(user.contentStyles);
    // The LITERAL selected styles drive a per-post style plan so each post is
    // written in a distinct style the user actually chose.
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
      send({
        type: "research",
        status: "start",
        message: "Searching the web for current facts",
        prompt: researchPrompt,
      });
      researchBrief = await generateGroundedText(researchPrompt);
      send({
        type: "research",
        status: "done",
        chars: researchBrief.length,
        excerpt: researchBrief.slice(0, 280),
      });
    } catch (err) {
      console.error("Research step failed, writing without a brief:", (err as Error).message);
      researchBrief = "";
      send({
        type: "research",
        status: "skipped",
        message: "Research unavailable - writing without a brief",
      });
    }

    const postTypesForPrompt = strategy.postTypes ?? allowedTypes;
    // Same assignment the prompt uses, so each saved post.style matches the style the
    // writer was told to use for that post (drives the per-post style badge).
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

    send({
      type: "write",
      status: "start",
      count: postCount,
      styles: styleAssignment,
      allowedTypes,
      prompt,
    });

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
    send({
      type: "write",
      status: "done",
      count: posts.length,
      titles: posts.map((p) => cleanInline(p.title)),
    });

    // Schedule on the chosen posting days (in the user timezone), starting from now,
    // never in the past, and skipping every day that already holds a post.
    send({ type: "schedule", status: "start" });

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

    const postingSlots = getNextScheduledSlots(
      new Date(),
      schedule.days,
      schedule.time,
      timezone,
      posts.length,
      occupiedDays
    );
    send({
      type: "schedule",
      status: "done",
      skippedDays: Array.from(occupiedDays).sort(),
      slots: postingSlots.map((d) => ({
        iso: d.toISOString(),
        label: utcToLocalTime(d, timezone, SLOT_FORMAT),
      })),
    });

    // One slot per post, in order. If slots somehow run out the post is left
    // unscheduled rather than silently reusing a date that is already taken.
    send({ type: "save", status: "start", total: posts.length });
    const createdPosts = [];
    for (let idx = 0; idx < posts.length; idx++) {
      const post = posts[idx];
      const scheduledAt: Date | undefined = postingSlots[idx];

      const created = await prisma.post.create({
        data: {
          planId: plan.id,
          title: cleanInline(post.title),
          body: formatPostBody(post.body),
          hashtags: JSON.stringify(post.hashtags),
          // Enforce the onboarding selection: never save a post type the model
          // produced outside the allowed set. Coerce any stray type to an allowed
          // one so the calendar only ever shows selected types.
          postType: allowedTypes.includes(post.postType) ? post.postType : allowedTypes[0],
          // The actual selected style this post was written in (drives the UI badge);
          // falls back to null for safety so the badge shows the post type.
          style: styleAssignment[idx] ?? null,
          imageStyle: clampImageStyle(post.imageStyle),
          imagePrompt: post.imagePrompt,
          weekNumber: 1,
          scheduledAt,
          humanModeOverride: true, // default to Human Mode; editor toggle can switch to AI
          status: "draft", // user must review, add image, and mark as ready
        },
      });
      createdPosts.push(created);

      send({
        type: "post",
        index: idx,
        id: created.id,
        title: created.title,
        postType: created.postType,
        style: created.style,
        imageStyle: created.imageStyle,
        scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
        scheduledLabel: scheduledAt ? utcToLocalTime(scheduledAt, timezone, SLOT_FORMAT) : null,
        status: "done",
      });
    }
    send({ type: "save", status: "done", count: createdPosts.length });

    // Increment the billing cycle counter.
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

    send({
      type: "done",
      posts: createdPosts.map((p) => ({ id: p.id, title: p.title })),
      count: createdPosts.length,
      weekTheme: strategy.weekTheme,
      postsRemaining,
      postsLimit: POST_LIMIT_PER_CYCLE,
    });
  }, () => "Failed to generate posts");
}
