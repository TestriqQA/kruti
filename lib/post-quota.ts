/** Posts a user may generate per billing cycle. */
export const POST_LIMIT_PER_CYCLE = 30;

interface QuotaSubscription {
  postsGeneratedThisCycle: number;
  cyclePostsResetAt: Date | null;
}

/**
 * How many posts are left in the current billing cycle.
 *
 * Admins are unlimited. The counter is treated as already reset once the 30-day
 * window has elapsed, mirroring the reset /api/generate/posts performs when it
 * next runs - so the number shown never lags behind what generation will allow.
 */
export function postsRemainingInCycle(
  role: string | null | undefined,
  subscription: QuotaSubscription | null | undefined,
  now: Date = new Date()
): number {
  if (role === "admin") return Infinity;
  if (!subscription) return POST_LIMIT_PER_CYCLE;

  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (!subscription.cyclePostsResetAt || subscription.cyclePostsResetAt < thirtyDaysAgo) {
    return POST_LIMIT_PER_CYCLE;
  }
  return POST_LIMIT_PER_CYCLE - subscription.postsGeneratedThisCycle;
}
