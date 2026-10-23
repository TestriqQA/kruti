/**
 * Default ordering for the posts page: generation date first, then schedule.
 *
 * The previous order came from the query - content plans by `weekStart` desc,
 * posts within a plan by `scheduledAt` asc - which is not the same thing. A plan
 * generated today for a week starting next month sorted by that future week, so
 * a freshly generated batch could appear below an older one.
 *
 * ── Why generation DAY rather than the raw timestamp ─────────────────────────
 * Posts are created one at a time in a loop, so every post in a batch has a
 * distinct `createdAt` roughly a second apart (verified against real data: 25 of
 * 25 posts had unique timestamps). Sorting on the raw value would therefore:
 *   - never reach `scheduledAt` as a tiebreaker, since no two values are equal,
 *   - and reverse each batch, listing the last-generated post first, so a week
 *     would read 27th, 23rd, 22nd, 21st, 20th.
 * Bucketing by day is what makes "then the scheduled date" mean anything.
 *
 * The bucket is the UTC calendar day. A batch completes in seconds, so it can
 * never straddle a boundary; the only effect is that two batches generated
 * either side of UTC midnight land in different buckets, which is both rare and
 * harmless - they stay adjacent and in the right order regardless.
 */

export interface SortablePost {
  createdAt: Date | string;
  scheduledAt: Date | string | null;
}

const dayBucket = (value: Date | string): string =>
  new Date(value).toISOString().slice(0, 10);

const time = (value: Date | string | null): number | null =>
  value === null ? null : new Date(value).getTime();

/**
 * Comparator: newest generation day first; within a day, soonest scheduled
 * first, with unscheduled posts last; then original generation order.
 */
export function compareByGenerationThenSchedule(a: SortablePost, b: SortablePost): number {
  const dayA = dayBucket(a.createdAt);
  const dayB = dayBucket(b.createdAt);
  if (dayA !== dayB) return dayA < dayB ? 1 : -1; // desc: newest batch on top

  const schedA = time(a.scheduledAt);
  const schedB = time(b.scheduledAt);

  // Unscheduled drafts sink to the bottom of their batch - they are not part of
  // the posting run yet, so interleaving them with dated posts just adds noise.
  if (schedA === null && schedB === null) {
    return time(a.createdAt)! - time(b.createdAt)!;
  }
  if (schedA === null) return 1;
  if (schedB === null) return -1;
  if (schedA !== schedB) return schedA - schedB; // asc: soonest first

  // Same batch, same slot - fall back to the order they were generated in so
  // the result is stable rather than dependent on the engine's sort.
  return time(a.createdAt)! - time(b.createdAt)!;
}

/** Non-mutating convenience wrapper. */
export function sortPostsForDisplay<T extends SortablePost>(posts: T[]): T[] {
  return [...posts].sort(compareByGenerationThenSchedule);
}
