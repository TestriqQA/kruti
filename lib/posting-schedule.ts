export interface PostingSchedule {
  days: string[]; // e.g. ["Monday", "Wednesday", "Friday"]
  time: string;   // "HH:MM" in the user's timezone
}

/**
 * The schedule used when a user has never saved one.
 *
 * Settings and every server-side consumer MUST share this value: when they
 * disagreed, Settings showed Mon/Wed/Fri while generation scheduled posts
 * Mon-Fri, so posts landed on days the user never selected.
 */
export const DEFAULT_POSTING_SCHEDULE: PostingSchedule = {
  days: ["Monday", "Wednesday", "Friday"],
  time: "09:00",
};

/**
 * How many posts one "Generate" produces. Deliberately a fixed number rather
 * than `days.length`: the batch size stays the same no matter how many posting
 * days the user picked, and the schedule only decides WHICH days those posts
 * land on (rolling into later weeks when the batch needs more days than a
 * single week provides).
 */
export const POSTS_PER_BATCH = 5;

/**
 * Parse the JSON string stored on `User.postingSchedule`, falling back to
 * DEFAULT_POSTING_SCHEDULE for missing, malformed or empty values.
 */
export function parsePostingSchedule(raw?: string | null): PostingSchedule {
  if (!raw) return { ...DEFAULT_POSTING_SCHEDULE };

  try {
    const parsed = JSON.parse(raw) as Partial<PostingSchedule>;
    const days =
      Array.isArray(parsed.days) && parsed.days.length > 0
        ? parsed.days
        : DEFAULT_POSTING_SCHEDULE.days;
    const time =
      typeof parsed.time === "string" && /^\d{1,2}:\d{2}$/.test(parsed.time)
        ? parsed.time
        : DEFAULT_POSTING_SCHEDULE.time;
    return { days, time };
  } catch {
    return { ...DEFAULT_POSTING_SCHEDULE };
  }
}
