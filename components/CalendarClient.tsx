"use client";

import Link from "next/link";
import {
  Sparkles, ChevronLeft, ChevronRight, Linkedin, GripVertical, AlertCircle, Loader2,
} from "lucide-react";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday,
  addMonths, subMonths, startOfWeek,
} from "date-fns";
import { toZonedTime, formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { derivePostState } from "@/lib/dashboard-overview";
import type { OverviewStatus } from "@/lib/dashboard-overview";
import { Stepper, RuleHeader } from "@/components/dashboard/ledger";

/**
 * The schedule.
 *
 * The product's whole promise is that the right post leaves on the right day,
 * so this is the page where that promise is handled directly. It stays a month
 * grid, because a month grid is the one layout everybody can already read - the
 * distinctive part is that it draws the USER'S week, not a generic one: their
 * posting days are the live columns, every other day is dimmed, and an empty
 * posting day reads as a gap they can see.
 *
 * Deliberately plain everywhere else. An earlier pass on the post list proved
 * that a clever widget nobody can decode is worse than an ordinary one that
 * works, so every control here is labelled and looks like a control.
 */

interface Post {
  id: string;
  title: string;
  postType: string;
  style?: string | null;
  scheduledAt: Date | string | null;
  status: string;
  body: string;
  imageUrl?: string | null;
  postError?: string | null;
  postedToLinkedIn?: boolean;
  linkedinPostId?: string | null;
  weekStart: Date | string;
}

interface Props {
  posts: Post[];
  userTimezone?: string;
  postingDays?: string[];
  postingTime?: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FULL_WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

/** Status is the only colour on this page. Post-type hues were decoration. */
const CHIP: Record<OverviewStatus, string> = {
  draft: "border-warning/35 bg-warning/[0.10] text-ink",
  ready: "border-accent/40 bg-accent/[0.10] text-ink",
  published: "border-success/35 bg-success/[0.10] text-ink",
  missed: "border-warning bg-warning/[0.14] text-ink",
  failed: "border-danger bg-danger/[0.12] text-ink",
};

const LEGEND: { state: OverviewStatus; label: string }[] = [
  { state: "draft", label: "Draft — needs your review" },
  { state: "ready", label: "Ready — will publish itself" },
  { state: "published", label: "Published to LinkedIn" },
  { state: "missed", label: "Missed its slot" },
  { state: "failed", label: "Failed to publish" },
];

export default function CalendarClient({
  posts: initialPosts,
  userTimezone = "Asia/Kolkata",
  postingDays = [],
  postingTime = "09:00",
}: Props) {
  const router = useRouter();
  const [posts, setPosts] = useState(initialPosts);
  // useState only seeds on the FIRST render, so without this the calendar ignores
  // every later router.refresh() - newly generated posts wouldn't appear until a
  // reload, and a reschedule wouldn't pick up server-side corrections.
  useEffect(() => setPosts(initialPosts), [initialPosts]);

  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dragPostId, setDragPostId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  // Captured after mount so "missed" cannot differ between server and client.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  const epoch = useMemo(() => new Date(0), []);
  const stateOf = useCallback(
    (p: Post): OverviewStatus => derivePostState(p, now ?? epoch),
    [now, epoch]
  );

  const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthName = format(monthDate, "MMMM yyyy");
  const days = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
  const startDay = getDay(startOfMonth(monthDate));

  const postingSet = useMemo(
    () => new Set(postingDays.map((d) => d.toLowerCase())),
    [postingDays]
  );

  const getPostsForDay = useCallback(
    (date: Date): Post[] =>
      posts.filter((p) => {
        if (!p.scheduledAt) return false;
        return isSameDay(toZonedTime(new Date(p.scheduledAt), userTimezone), date);
      }),
    [posts, userTimezone]
  );

  const handleDragStart = useCallback((postId: string) => setDragPostId(postId), []);

  const handleDragOver = useCallback((e: React.DragEvent, dayKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(dayKey);
  }, []);

  const handleDragLeave = useCallback(() => setDropTarget(null), []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetDay: Date) => {
      e.preventDefault();
      setDropTarget(null);
      if (!dragPostId) return;

      const post = posts.find((p) => p.id === dragPostId);
      if (!post || post.postedToLinkedIn) {
        setDragPostId(null);
        return;
      }

      // Keep the existing time, change only the date.
      const existingDate = post.scheduledAt
        ? toZonedTime(new Date(post.scheduledAt), userTimezone)
        : null;
      const hours = existingDate ? existingDate.getHours() : 9;
      const minutes = existingDate ? existingDate.getMinutes() : 0;

      const newLocal = new Date(targetDay);
      newLocal.setHours(hours, minutes, 0, 0);
      const newUtc = fromZonedTime(newLocal, userTimezone);

      setPosts((prev) =>
        prev.map((p) => (p.id === dragPostId ? { ...p, scheduledAt: newUtc.toISOString() } : p))
      );
      setRescheduling(true);
      setDragPostId(null);

      try {
        await fetch(`/api/content/${post.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scheduledAt: newUtc.toISOString() }),
        });
        router.refresh();
      } catch {
        // Revert on failure.
        setPosts((prev) =>
          prev.map((p) => (p.id === post.id ? { ...p, scheduledAt: post.scheduledAt } : p))
        );
      } finally {
        setRescheduling(false);
      }
    },
    [dragPostId, posts, userTimezone, router]
  );

  const monthPosts = useMemo(
    () =>
      posts.filter((p) => {
        if (!p.scheduledAt) return false;
        const d = toZonedTime(new Date(p.scheduledAt), userTimezone);
        return (
          d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth()
        );
      }),
    [posts, userTimezone, currentDate]
  );

  const weekGroups = useMemo(() => {
    const weeks = new Map<string, { weekLabel: string; weekStart: Date; posts: Post[] }>();
    monthPosts.forEach((post) => {
      const d = toZonedTime(new Date(post.scheduledAt!), userTimezone);
      const weekMon = startOfWeek(d, { weekStartsOn: 1 });
      const key = weekMon.toISOString();
      if (!weeks.has(key)) {
        weeks.set(key, {
          weekLabel: `Week of ${format(weekMon, "MMM d")}`,
          weekStart: weekMon,
          posts: [],
        });
      }
      weeks.get(key)!.posts.push(post);
    });
    return Array.from(weeks.values()).sort(
      (a, b) => a.weekStart.getTime() - b.weekStart.getTime()
    );
  }, [monthPosts, userTimezone]);

  const hasAnyPosts = posts.length > 0;
  const monthHasPosts = monthPosts.length > 0;

  const monthTally = useMemo(() => {
    const t = { scheduled: 0, published: 0, problem: 0 };
    for (const p of monthPosts) {
      const s = stateOf(p);
      if (s === "published") t.published += 1;
      else if (s === "failed" || s === "missed") t.problem += 1;
      else t.scheduled += 1;
    }
    return t;
  }, [monthPosts, stateOf]);

  const viewingThisMonth =
    currentDate.getFullYear() === new Date().getFullYear() &&
    currentDate.getMonth() === new Date().getMonth();

  return (
    <div className="space-y-7">
      {/* ═══ CHASSIS ════════════════════════════════════════════════════════ */}
      <section className="animate-rise-in divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface shadow-e1 motion-reduce:animate-none dark:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-6 px-7 py-6">
          <div className="min-w-0">
            <p className="tabular text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Schedule · {userTimezone}
            </p>
            <h1 className="mt-2 font-display text-[28px] font-bold leading-[1.1] tracking-[-0.03em] text-ink">
              {monthName}
            </h1>
            <p className="mt-1.5 text-[13px] text-ink-muted">
              {monthHasPosts ? (
                <>
                  <span className="tabular font-semibold text-ink">{monthPosts.length}</span>{" "}
                  {monthPosts.length === 1 ? "post" : "posts"} this month
                  {monthTally.published > 0 && (
                    <>
                      <span className="px-1.5 text-line-strong">·</span>
                      <span className="tabular text-success">{monthTally.published} published</span>
                    </>
                  )}
                  {monthTally.problem > 0 && (
                    <>
                      <span className="px-1.5 text-line-strong">·</span>
                      <span className="tabular text-danger">{monthTally.problem} need attention</span>
                    </>
                  )}
                </>
              ) : (
                "Nothing scheduled this month."
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {rescheduling && (
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-accent">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </span>
            )}

            <div className="flex items-center rounded-control border border-line">
              <button
                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                aria-label="Previous month"
                className="focus-ring flex h-9 w-9 items-center justify-center rounded-l-control text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                disabled={viewingThisMonth}
                className="focus-ring h-9 border-x border-line px-3 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink disabled:opacity-40"
              >
                Today
              </button>
              <button
                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                aria-label="Next month"
                className="focus-ring flex h-9 w-9 items-center justify-center rounded-r-control text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center rounded-control border border-line p-0.5">
              {(["calendar", "list"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={cn(
                    "focus-ring rounded-[7px] px-3 py-1.5 text-[12px] font-semibold capitalize transition-colors",
                    view === v
                      ? "bg-accent text-accent-ink"
                      : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Your week, stated in words before it is drawn in columns. */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-7 py-3">
          <p className="text-[12px] text-ink-muted">
            <span className="font-semibold text-ink">Your posting days:</span>{" "}
            {postingDays.length > 0 ? (
              <>
                {postingDays.join(", ")} at <span className="tabular">{postingTime}</span>
              </>
            ) : (
              "none set"
            )}
            <Link href="/settings" className="ml-2 font-semibold text-accent hover:underline">
              Change
            </Link>
          </p>
          {hasAnyPosts && view === "calendar" && (
            <p className="flex items-center gap-1.5 text-[12px] text-ink-muted">
              <GripVertical className="h-3.5 w-3.5" />
              Drag a post to another day to reschedule it
            </p>
          )}
        </div>
      </section>

      {/* ═══ BODY ═══════════════════════════════════════════════════════════ */}
      {!hasAnyPosts ? (
        <div className="py-10">
          <p className="text-[15px] text-ink">No content plan yet.</p>
          <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-ink-muted">
            Generate your weekly batch and the posts land on your posting days automatically.
          </p>
          <Link
            href="/dashboard"
            className="focus-ring mt-5 inline-flex h-10 items-center gap-2 rounded-control bg-accent px-4 text-[13px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
          >
            <Sparkles className="h-4 w-4" />
            Generate content plan
          </Link>
        </div>
      ) : view === "calendar" ? (
        <div
          className="animate-rise-in overflow-hidden rounded-panel border border-line bg-surface motion-reduce:animate-none"
          style={{ animationDelay: "70ms" }}
        >
          {/* Weekday header. A posting day is stated, not implied. */}
          <div className="grid grid-cols-7 border-b border-line">
            {WEEKDAYS.map((d, i) => {
              const isPosting = postingSet.has(FULL_WEEKDAYS[i].toLowerCase());
              return (
                <div
                  key={d}
                  className={cn(
                    "px-3 py-2.5 text-center",
                    isPosting ? "bg-accent-soft" : "bg-surface-sunken"
                  )}
                >
                  <p
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-[0.1em]",
                      isPosting ? "text-accent" : "text-ink-muted"
                    )}
                  >
                    {d}
                  </p>
                  {isPosting && (
                    <p className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-accent">
                      Posting day
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-7">
            {Array.from({ length: startDay }, (_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[124px] border-b border-r border-line bg-surface-sunken/50"
              />
            ))}

            {days.map((day) => {
              const dayPosts = getPostsForDay(day);
              const today = isToday(day);
              const dayKey = day.toISOString();
              const isDropHere = dropTarget === dayKey;
              const isPosting = postingSet.has(FULL_WEEKDAYS[getDay(day)].toLowerCase());

              return (
                <div
                  key={dayKey}
                  onDragOver={(e) => handleDragOver(e, dayKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day)}
                  className={cn(
                    "min-h-[124px] border-b border-r border-line p-2 transition-colors",
                    !isPosting && "bg-surface-sunken/40",
                    today && "bg-accent/[0.06]",
                    isDropHere && "bg-accent/[0.12] ring-2 ring-inset ring-accent/40"
                  )}
                >
                  <div className="mb-1.5 flex items-center justify-between">
                    <span
                      className={cn(
                        "tabular flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                        today ? "bg-accent text-accent-ink" : "text-ink-muted"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {isPosting && dayPosts.length === 0 && (
                      <span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                        Free
                      </span>
                    )}
                  </div>

                  <div className="space-y-1">
                    {/* Every post is shown. The cell grows rather than hiding
                        work behind "+2 more". */}
                    {dayPosts.map((post) => {
                      const s = stateOf(post);
                      return (
                        <div
                          key={post.id}
                          draggable={!post.postedToLinkedIn}
                          onDragStart={() => handleDragStart(post.id)}
                          onDragEnd={() => {
                            setDragPostId(null);
                            setDropTarget(null);
                          }}
                          className={cn(!post.postedToLinkedIn && "cursor-grab active:cursor-grabbing")}
                        >
                          <Link
                            href={`/posts/${post.id}`}
                            draggable={false}
                            title={post.title}
                            className={cn(
                              "focus-ring block rounded border px-1.5 py-1 transition-opacity hover:opacity-80",
                              CHIP[s]
                            )}
                          >
                            <span className="tabular flex items-center gap-1 text-[9.5px] font-semibold text-ink-muted">
                              {post.scheduledAt &&
                                formatInTimeZone(new Date(post.scheduledAt), userTimezone, "HH:mm")}
                              {post.postedToLinkedIn && <Linkedin className="h-2.5 w-2.5 text-success" />}
                              {(s === "failed" || s === "missed") && (
                                <AlertCircle className="h-2.5 w-2.5 text-danger" />
                              )}
                            </span>
                            <span className="mt-0.5 block text-[11px] font-medium leading-tight text-ink">
                              {post.title}
                            </span>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          className="animate-rise-in space-y-7 motion-reduce:animate-none"
          style={{ animationDelay: "70ms" }}
        >
          {!monthHasPosts ? (
            <div className="py-10">
              <p className="text-[15px] text-ink">Nothing scheduled in {monthName}.</p>
              <p className="mt-1.5 text-[13px] text-ink-muted">
                Use the arrows above to look at another month.
              </p>
            </div>
          ) : (
            weekGroups.map(({ weekLabel, weekStart, posts: weekPosts }) => (
              <section key={weekStart.toISOString()}>
                <RuleHeader
                  label={weekLabel}
                  trailing={
                    <span className="tabular text-[11px] text-ink-muted">
                      {weekPosts.length} {weekPosts.length === 1 ? "post" : "posts"}
                    </span>
                  }
                />
                <div>
                  {weekPosts.map((post, i) => {
                    const s = stateOf(post);
                    return (
                      <Link
                        key={post.id}
                        href={`/posts/${post.id}`}
                        className={cn(
                          "group -mx-3 grid grid-cols-[88px_minmax(0,1fr)_116px] items-start gap-4 rounded-card px-3 py-3 transition-colors hover:bg-surface focus-ring",
                          i > 0 && "border-t border-line-strong/70"
                        )}
                      >
                        <div>
                          <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                            {post.scheduledAt &&
                              formatInTimeZone(new Date(post.scheduledAt), userTimezone, "EEE")}
                          </p>
                          <p className="tabular text-[12.5px] font-semibold text-ink">
                            {post.scheduledAt &&
                              formatInTimeZone(new Date(post.scheduledAt), userTimezone, "d MMM")}
                          </p>
                          <p className="tabular text-[10.5px] text-ink-muted">
                            {post.scheduledAt &&
                              formatInTimeZone(new Date(post.scheduledAt), userTimezone, "HH:mm")}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <p className="text-[14px] font-semibold leading-snug text-ink">
                            {post.title}
                          </p>
                          {post.postError ? (
                            <p className="mt-1 text-[11px] leading-relaxed text-danger">
                              {post.postError}
                            </p>
                          ) : (
                            <p className="mt-1 text-[11px] text-ink-muted">
                              {post.style || post.postType}
                              {post.postedToLinkedIn && (
                                <>
                                  <span className="px-1.5 text-line-strong">·</span>
                                  <Linkedin className="mr-1 inline h-3 w-3 text-success" />
                                  Published
                                </>
                              )}
                            </p>
                          )}
                        </div>

                        <Stepper state={s} className="mt-0.5" />
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {/* Legend. Spelled out, because a colour the reader has to decode is not
          information. */}
      {hasAnyPosts && (
        <div className="border-t border-line-strong pt-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              What the colours mean
            </span>
            {LEGEND.map((l) => (
              <span key={l.state} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                <span className={cn("block h-3 w-5 rounded border", CHIP[l.state])} />
                {l.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
