/**
 * One answer to "is this post actually going to go out", shared by every
 * surface that asks it.
 *
 * The auto-post cron is pickier than the word "Scheduled" suggests. It takes a
 * post only when the status is "ready", postedToLinkedIn is false, and
 * scheduledAt falls inside a window that STARTS 72 hours in the past. A post
 * that misses that window is not retried and not reported - it keeps its
 * scheduledAt, keeps status "ready", and sits there looking scheduled forever.
 *
 * Three copies of a statusOf() helper used to answer this with three states -
 * scheduled, draft, published - and none of them could tell a post that is
 * going out from one that never will. A post stranded by the 72-hour rule
 * showed the same badge, in the same colour, as one due tomorrow. That is why
 * this lives in one place now: the states below are the ones the cron actually
 * distinguishes, so a surface cannot accidentally promise a publish that is
 * never coming.
 */

/**
 * How far back the cron is willing to look. Older than this and a due post is
 * skipped permanently, so this figure is the whole reason "missed" exists.
 *
 * lib/scheduler.ts imports it rather than spelling 72 hours out again: the two
 * must agree or the UI would call a post missed while the cron still had it,
 * or worse, the other way round.
 */
export const AUTO_POST_STALE_HOURS = 72;
export const AUTO_POST_STALE_MS = AUTO_POST_STALE_HOURS * 60 * 60 * 1000;

export type PostScheduleKind =
  /** Live on LinkedIn. */
  | "published"
  /** Its time passed over 72 hours ago. The cron has given up; only the user can revive it. */
  | "missed"
  /** Its time has passed but the cron still has it. Goes out on the next run. */
  | "due"
  /** Armed, with a time still ahead of it. */
  | "scheduled"
  /** Marked ready but with no date at all, so nothing will ever pick it up. */
  | "unscheduled"
  /** Still a draft. The cron does not look at drafts. */
  | "draft";

/** The little a caller needs for any of this to be answerable. */
export type SchedulablePost = {
  status: string;
  postedToLinkedIn?: boolean | null;
  scheduledAt?: Date | string | null;
};

export function postScheduleKind(
  post: SchedulablePost,
  now: Date = new Date()
): PostScheduleKind {
  // postedToLinkedIn is the safety net for a status that did not get written,
  // which is why both are checked here and everywhere else in the app.
  if (post.postedToLinkedIn || post.status === "published") return "published";
  if (post.status !== "ready") return "draft";
  if (!post.scheduledAt) return "unscheduled";

  const at = new Date(post.scheduledAt).getTime();
  // A value that will not parse cannot match the cron's window either, so it
  // is reported as what it effectively is: not scheduled.
  if (Number.isNaN(at)) return "unscheduled";

  const t = now.getTime();
  if (at > t) return "scheduled";
  return at < t - AUTO_POST_STALE_MS ? "missed" : "due";
}

/** True when the post will not go out unless the user does something. */
export function needsAttention(kind: PostScheduleKind): boolean {
  return kind === "missed" || kind === "unscheduled";
}

/**
 * The sentence to put in front of the user, or null when there is nothing
 * worth saying. Written as what to DO, because every one of these states was
 * previously invisible and a label alone would not tell anyone how to fix it.
 *
 * Takes the post rather than the kind, because a draft that already carries a
 * date needs a different sentence from an ordinary draft - and that is a
 * mistake worth naming, since the date field sits right next to the status
 * dropdown and setting one without the other publishes nothing.
 */
export function scheduleNote(post: SchedulablePost, now: Date = new Date()): string | null {
  const kind = postScheduleKind(post, now);
  switch (kind) {
    case "missed":
      return `This post's time passed more than ${AUTO_POST_STALE_HOURS} hours ago, so auto-publish has stopped looking at it. Choose a new date and time, then save, and it goes back in the queue.`;
    case "unscheduled":
      return "This post is marked Ready but has no date, so nothing will publish it. Set a date and time to put it in the queue.";
    case "due":
      return "This post's time has passed. Auto-publish takes one post every five minutes, so it goes out on one of the next runs.";
    case "draft":
      return post.scheduledAt
        ? "This has a date, but it is still a Draft - auto-publish only takes posts marked Ready. Change the status to Ready to arm it."
        : null;
    default:
      return null;
  }
}
/**
 * Everything that has to be true for the cron to publish a post, as a list the
 * user can read and act on.
 *
 * These are not advice - they are the five conditions runAutoPost actually
 * applies, in the order it applies them. Keeping them here, next to the rule
 * itself, is what stops the screen drifting from the job again: a post sat in
 * "Scheduled" for hours because the account's subscription said "canceled",
 * and NOTHING anywhere said so. The cron filters that account out in SQL, so it
 * never even reaches the line that logs a held-back post. The user saw a
 * schedule, the logs showed an idle cron, and the two never met.
 *
 * profileComplete and entitled are passed in rather than computed, because
 * both need the database and this module is imported by client components.
 */
export type AutoPublishRequirement = {
  /** What is required, in the user's words. */
  label: string;
  met: boolean;
  /** What to do about it when it is not met. Empty when it is. */
  fix: string;
  /** Where that is done, when it is somewhere other than this screen. */
  href?: string;
};

export function autoPublishChecklist(
  post: SchedulablePost,
  opts: { profileComplete: boolean; entitled: boolean },
  now: Date = new Date()
): AutoPublishRequirement[] {
  const kind = postScheduleKind(post, now);
  const published = kind === "published";

  return [
    {
      label: "Status is Ready",
      met: published || kind !== "draft",
      fix: "Set the status to Ready. Auto-publish never looks at drafts.",
    },
    {
      label: "Has a date and time",
      met: published || kind !== "unscheduled",
      fix: "Pick a date and time above, then save.",
    },
    {
      label: `Scheduled within the last ${AUTO_POST_STALE_HOURS} hours`,
      met: kind !== "missed",
      fix: `Its time passed more than ${AUTO_POST_STALE_HOURS} hours ago, so auto-publish has stopped looking at it. Choose a new date and time, then save.`,
    },
    {
      label: "Your profile is complete",
      met: opts.profileComplete,
      fix: "Auto-publish holds posts back until your profile is finished.",
      href: "/settings",
    },
    {
      label: "Your subscription is active",
      met: opts.entitled,
      fix: "Auto-publish only runs for active, trialing or cancelling accounts. This post will not go out until the subscription is active again.",
      href: "/subscribe",
    },
  ];
}

/** The requirements that are not met - empty when the post is good to go. */
export function unmetRequirements(
  post: SchedulablePost,
  opts: { profileComplete: boolean; entitled: boolean },
  now: Date = new Date()
): AutoPublishRequirement[] {
  return autoPublishChecklist(post, opts, now).filter((r) => !r.met);
}
