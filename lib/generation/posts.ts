import { prisma } from "@/lib/prisma";
import { generateText, parseJSON, generateGroundedText } from "@/lib/gemini";
import { buildPostsPrompt, buildResearchPrompt, deriveAllowedPostTypes, parseSelectedStyles, assignPostStyles } from "@/lib/prompts";
import { buildProfileContext } from "@/lib/linkedin";
import { getNextScheduledSlots, toZonedDayKey, utcToLocalTime } from "@/lib/timezone";
import { parsePostingSchedule, POSTS_PER_BATCH } from "@/lib/posting-schedule";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { assessProfile, profileGapMessage } from "@/lib/profile-completeness";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { formatPostBody, cleanInline } from "@/lib/format";
import { IMAGE_CATEGORIES, imageStyleTaxonomyBlock, clampImageStyle } from "@/lib/image-categories";
import type { SendFn } from "@/lib/ndjson";
import { stopIfCancelled } from "@/lib/ndjson";
import { promptField } from "@/lib/preview-tools";
import { postLimitFor } from "@/lib/post-quota";

/**
 * The post-generation pipeline, shared by the website and the mobile API.
 *
 * Extracted from app/api/generate/posts/route.ts so both callers run the same
 * code. Two copies of this is what let the mobile API drift 237 commits behind
 * the website and then break; there is now one.
 *
 * The caller resolves the user and owns the transport:
 *   - the website wraps this in ndjsonResponse and always streams;
 *   - the mobile route uses respondByAccept and streams or buffers per request.
 *
 * Authentication happens BEFORE this is called, so an auth failure is an HTTP
 * 401 rather than an event inside a 200 stream.
 */

const SLOT_FORMAT = "EEE, MMM d - hh:mm a";

export async function runPostsGeneration(
  userId: string,
  planId: string | undefined,
  send: SendFn,
  /** The route's request.signal, so a user who cancels is not charged. */
  signal?: AbortSignal,
): Promise<void> {
  // The caller has already authenticated. Emitted so the website client still
  // sees its "auth" pipeline step complete.
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
    send({ type: "error", message, rateLimited: true, retryAfterSecs: rl.retryAfterSecs });
    return;
  }
  send({ type: "preflight", key: "ratelimit", status: "done" });

  // Validate planId explicitly. Prisma DROPS an `undefined` id filter, so
  // without this the where clause collapses to { userId } and quietly matches
  // an arbitrary plan of the caller's - posts then attach to the wrong week.
  // The carousel pipeline has guarded its postId this way all along; this one
  // never did. status 400 is carried through to a buffered caller by
  // respondByAccept, which reads it off the terminal error event.
  if (!planId || typeof planId !== "string") {
    send({ type: "preflight", key: "plan", status: "error", message: "Missing or invalid plan reference." });
    send({ type: "error", message: "Missing or invalid plan reference.", status: 400 });
    return;
  }

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
  send({ type: "preflight", key: "user", status: "done" });

  // Content-quality gate. buildProfileContext() is the only thing that makes
  // these posts this person's - a thin profile spends five of the user's 30
  // monthly posts on output that reads like anybody's. `user` is the full row,
  // so this adds no query.
  const profile = assessProfile(user);
  if (!profile.complete) {
    const message = profileGapMessage(profile.gaps);
    send({ type: "preflight", key: "profile", status: "error", message });
    send({ type: "error", message, profileIncomplete: true, gaps: profile.gaps });
    return;
  }
  send({ type: "preflight", key: "profile", status: "done" });

  // ── Allowance ───────────────────────────────────────────────────────────
  //
  // Settled BEFORE the batch size, because the batch now shrinks to fit what
  // is left rather than being refused outright. A trial with 2 posts to spare
  // was told the limit was reached while the dashboard said 2 remaining.
  const subscription = user.subscription;
  const isAdmin = user.role === "admin";
  const postLimit = postLimitFor(subscription);

  // checkActiveSubscription() creates this row before the run reaches here, so
  // a missing one means something upstream went wrong. It used to be an
  // `if (subscription)` wrapped around the entire check, which meant no row =
  // no limit of any kind, and an account in that state could generate without
  // end. Refusing is the only safe reading.
  if (!isAdmin && !subscription) {
    const message = "We could not read your subscription. Please reload and try again.";
    send({ type: "preflight", key: "quota", status: "error", message });
    send({ type: "error", message, status: 403 });
    return;
  }

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
  }

  const used = subscription?.postsGeneratedThisCycle ?? 0;
  const allowanceLeft = isAdmin ? POSTS_PER_BATCH : Math.max(0, postLimit - used);
  if (allowanceLeft <= 0) {
    const message = `You have used all ${postLimit} posts for this cycle.`;
    send({ type: "preflight", key: "quota", status: "error", message, postsRemaining: 0 });
    send({ type: "error", message, postsRemaining: 0, postsLimit: postLimit });
    return;
  }

  // A short batch beats a refusal: it spends exactly what is left.
  const postCount = Math.min(POSTS_PER_BATCH, allowanceLeft);
  send({
    type: "preflight",
    key: "quota",
    status: "done",
    used,
    limit: postLimit,
  });

  // The schedule decides WHICH days posts land on.
  const schedule = parsePostingSchedule(user.postingSchedule);
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
      ...promptField(researchPrompt),
    });
    if (stopIfCancelled(signal, send)) return;
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
  // Where this batch starts in the style rotation. Without it the rotation
  // restarts at index 0 every time, so any style past the fifth is stored and
  // never written - including every style a user adds in their own words,
  // since those are appended to the end of the list.
  const postsInPlan = await prisma.post.count({ where: { planId: plan.id } });
  const styleAssignment = assignPostStyles(
    selectedStyles,
    postTypesForPrompt,
    postCount,
    postsInPlan
  );

  
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
    IMAGE_CATEGORIES.map((c) => c.id).join("|"),
    postsInPlan
  );

  send({
    type: "write",
    status: "start",
    count: postCount,
    styles: styleAssignment,
    allowedTypes,
    ...promptField(prompt),
  });

  // The big one: writing every post in the batch is a single long call.
  if (stopIfCancelled(signal, send)) return;
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
    // The model is ASKED for postCount posts and usually obliges, but nothing
    // forces it to. A longer answer used to be created in full while the
    // allowance had only accounted for postCount of them.
  >(raw).slice(0, postCount);
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
  // Deliberately before the loop and nowhere inside it. The cycle counter is
  // incremented once at the end from however many rows were created, so
  // stopping part way through would leave a half-written batch the user is
  // partly charged for. Past this line the save runs to completion.
  if (stopIfCancelled(signal, send)) return;

  // The allowance is CLAIMED here, in one statement that tests and increments
  // together, and this is the check that actually holds the line. The preflight
  // above is only a fast fail: it reads a number, then spends half a minute in
  // the model before anything is written back, and two runs overlapping in that
  // window - two tabs, a double click, a retry - both read the same count and
  // both passed it. That is how an account got past 30.
  //
  // updateMany applies the condition and the increment in a single UPDATE, so
  // the second run matches no row and stops here, before a post exists.
  if (!isAdmin && subscription) {
    const claimed = await prisma.subscription.updateMany({
      where: {
        id: subscription.id,
        postsGeneratedThisCycle: { lte: postLimit - posts.length },
      },
      data: { postsGeneratedThisCycle: { increment: posts.length } },
    });
    if (claimed.count === 0) {
      const message = `You have used all ${postLimit} posts for this cycle.`;
      send({ type: "error", message, postsRemaining: 0, postsLimit: postLimit });
      return;
    }
  }

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

  // The allowance was claimed before the loop, so there is nothing to add here
  // - only something to hand back, when the loop created fewer rows than it
  // planned to. The remaining figure is read from the row rather than computed
  // from the count this request started with, which another run may have moved
  // on since.
  let postsRemaining = postLimit;
  if (!isAdmin && subscription) {
    const shortfall = Math.max(0, posts.length - createdPosts.length);
    const row = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        ...(shortfall > 0
          ? { postsGeneratedThisCycle: { decrement: shortfall } }
          : {}),
        cyclePostsResetAt: subscription.cyclePostsResetAt ?? new Date(),
      },
      select: { postsGeneratedThisCycle: true },
    });
    postsRemaining = Math.max(0, postLimit - row.postsGeneratedThisCycle);
  }

  send({
    type: "done",
    posts: createdPosts.map((p) => ({ id: p.id, title: p.title })),
    count: createdPosts.length,
    weekTheme: strategy.weekTheme,
    postsRemaining,
    postsLimit: postLimit,
  });
}
