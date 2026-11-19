/**
 * Local harness for the auto-publish schedule states (lib/post-schedule.ts).
 *
 * Every one of these states is invisible without real data in a real account:
 * you cannot see "Missed" without a post whose time ran out three days ago, and
 * you cannot see "No date" without arming one and then clearing its date. So a
 * change to the rule, the wording or a badge colour could only be checked by
 * waiting days for a post to rot, which is why the stranded-post problem went
 * unnoticed in the first place.
 *
 * This renders the real postScheduleKind(), the real scheduleNote() and the
 * real StatusBadge against fixed timestamps, so all six states are on one
 * screen at once.
 *
 * DEV ONLY. Not linked from anywhere, and 404s in production - same as
 * /render-preview, and for the same reason: the route sits outside
 * APP_ROUTE_PREFIXES in middleware.ts and would otherwise be reachable.
 */
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/dashboard/bits";
import {
  postScheduleKind,
  scheduleNote,
  needsAttention,
  AUTO_POST_STALE_HOURS,
  AUTO_POST_STALE_MS,
  type SchedulablePost,
} from "@/lib/post-schedule";

export const dynamic = "force-dynamic";

// Fixed, so the page reads the same on every load and the boundary cases are
// exact rather than drifting by however long the request took.
const NOW = new Date("2026-11-19T12:00:00Z");
const ago = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
const ahead = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString();

const CASES: Array<{ what: string; post: SchedulablePost }> = [
  { what: "Published to LinkedIn", post: { status: "published", postedToLinkedIn: true, scheduledAt: ago(100) } },
  { what: "Ready, due tomorrow", post: { status: "ready", postedToLinkedIn: false, scheduledAt: ahead(24) } },
  { what: "Ready, time passed an hour ago", post: { status: "ready", postedToLinkedIn: false, scheduledAt: ago(1) } },
  { what: `Ready, exactly ${AUTO_POST_STALE_HOURS}h ago (last moment the cron still has it)`, post: { status: "ready", postedToLinkedIn: false, scheduledAt: ago(AUTO_POST_STALE_HOURS) } },
  { what: `Ready, ${AUTO_POST_STALE_HOURS}h + 1ms ago (one millisecond too late)`, post: { status: "ready", postedToLinkedIn: false, scheduledAt: new Date(NOW.getTime() - AUTO_POST_STALE_MS - 1).toISOString() } },
  { what: "Ready, time passed 146 days ago (a real row in the dev database)", post: { status: "ready", postedToLinkedIn: false, scheduledAt: "2026-06-26T08:30:00Z" } },
  { what: "Ready, but no date at all", post: { status: "ready", postedToLinkedIn: false, scheduledAt: null } },
  { what: "Draft with no date", post: { status: "draft", postedToLinkedIn: false, scheduledAt: null } },
  { what: "Draft that someone gave a date to", post: { status: "draft", postedToLinkedIn: false, scheduledAt: ahead(24) } },
];

export default function SchedulePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="font-display text-[30px] font-bold tracking-[-0.03em] text-text">
        Auto-publish schedule states
      </h1>
      <p className="mt-2 text-[13px] leading-relaxed text-text-2">
        Rendered at a fixed {NOW.toISOString().slice(0, 16)}Z. The cron takes a post only when its
        status is Ready and its time falls inside a window that starts{" "}
        {AUTO_POST_STALE_HOURS} hours in the past &mdash; so the two red states below never go out
        on their own, and nothing used to say so.
      </p>

      <ul className="mt-8 space-y-4">
        {CASES.map(({ what, post }) => {
          const kind = postScheduleKind(post, NOW);
          const note = scheduleNote(post, NOW);
          return (
            <li key={what} className="card px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="min-w-0 text-[13px] font-medium text-text">{what}</p>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <code className="text-[11px] text-text-3">{kind}</code>
                  <StatusBadge kind={kind} />
                </div>
              </div>
              {note ? (
                <p
                  className={
                    "mt-3 flex items-start gap-1.5 rounded-control px-2.5 py-2 text-[11px] leading-snug " +
                    (needsAttention(kind) ? "bg-bad-tint text-bad" : "bg-card-muted text-text-2")
                  }
                >
                  <span aria-hidden="true">&#9888;</span>
                  <span>{note}</span>
                </p>
              ) : (
                <p className="mt-3 text-[11px] italic text-text-3">
                  Nothing to say &mdash; this post needs no attention.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
