/** Posts a paying user may generate per billing cycle. */
export const POST_LIMIT_PER_CYCLE = 30;

/**
 * Posts a user may generate during the 7-day free trial.
 *
 * One per day for the length of the trial. The per-day part needs no code:
 * getNextScheduledSlots() gives each post its own calendar day and skips days
 * that already hold one, so a batch can never stack two posts on one day. This
 * number is the whole-trial cap.
 */
export const TRIAL_POST_LIMIT = 7;

interface QuotaSubscription {
  postsGeneratedThisCycle: number;
  cyclePostsResetAt: Date | null;
  /** trialing|active|past_due|canceled|unpaid. Absent is read as a trial. */
  status?: string | null;
}

/**
 * The cap that applies to this subscription.
 *
 * A missing row reads as a trial, because that is what the user will get: the
 * subscription is created on first use by checkActiveSubscription(), as
 * `trialing`. Reading it as a paying cycle would quote 30 to someone about to
 * be held to 7.
 *
 * Only an ACTIVE trial reaches a generation run - checkActiveSubscription()
 * refuses an expired one before any of this is consulted.
 */
export function postLimitFor(subscription: QuotaSubscription | null | undefined): number {
  const status = subscription?.status ?? "trialing";
  return status === "trialing" ? TRIAL_POST_LIMIT : POST_LIMIT_PER_CYCLE;
}

/**
 * How many posts are left in the current cycle.
 *
 * Admins are unlimited. The counter is treated as already reset once the 30-day
 * window has elapsed, mirroring the reset the posts pipeline performs when it
 * next runs - so the number shown never lags behind what generation will allow.
 *
 * Never returns a negative number: a counter can legitimately sit above the cap
 * when someone's trial allowance carries into their first paid cycle, and
 * "-3 posts remaining" is not a thing to show anybody.
 */
export function postsRemainingInCycle(
  role: string | null | undefined,
  subscription: QuotaSubscription | null | undefined,
  now: Date = new Date()
): number {
  if (role === "admin") return Infinity;

  const limit = postLimitFor(subscription);
  if (!subscription) return limit;

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (!subscription.cyclePostsResetAt || subscription.cyclePostsResetAt < thirtyDaysAgo) {
    return limit;
  }
  return Math.max(0, limit - subscription.postsGeneratedThisCycle);
}

/**
 * The fields that start a fresh cycle, for an activation write to spread in.
 *
 * A paid month begins with its full allowance. Activation used to leave the
 * counter alone, so a trial user who spent all 7 trial posts and then
 * subscribed started their first paid month at 7/30 - they paid for 30 and got
 * 23. Every activation path spreads this now, so none of them can forget half
 * of it: zeroing the count without moving cyclePostsResetAt would leave the
 * 30-day window still running from the trial.
 */
export function startOfCycle(now: Date = new Date()): {
  postsGeneratedThisCycle: number;
  cyclePostsResetAt: Date;
} {
  return { postsGeneratedThisCycle: 0, cyclePostsResetAt: now };
}
