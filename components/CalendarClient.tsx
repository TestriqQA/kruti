"use client";

import Link from "next/link";
import {
  Sparkles, FileText, ChevronLeft, ChevronRight, Linkedin, GripVertical,
  CalendarDays, CheckCircle, Clock, LayoutGrid, Loader2,
} from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { StatCard, Pill, StatusBadge } from "@/components/dashboard/bits";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, addMonths, subMonths, startOfWeek } from "date-fns";
import { toZonedTime, formatInTimeZone, fromZonedTime } from "date-fns-tz";

interface Post {
  id: string;
  title: string;
  postType: string;
  style?: string | null;
  scheduledAt: Date | string | null;
  status: string;
  body: string;
  imageUrl?: string | null;
  postedToLinkedIn?: boolean;
  linkedinPostId?: string | null;
  weekStart: Date | string;
}

interface Props {
  posts: Post[];
  userTimezone?: string;
}

export default function CalendarClient({ posts: initialPosts, userTimezone = "Asia/Kolkata" }: Props) {
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

  const monthDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthName = format(monthDate, "MMMM yyyy");
  const days = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
  const startDay = getDay(startOfMonth(monthDate));

  function getPostsForDay(date: Date): Post[] {
    return posts.filter((p) => {
      if (!p.scheduledAt) return false;
      const postLocalDate = toZonedTime(new Date(p.scheduledAt), userTimezone);
      return isSameDay(postLocalDate, date);
    });
  }

  const handleDragStart = useCallback((postId: string) => {
    setDragPostId(postId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, dayKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(dayKey);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, targetDay: Date) => {
    e.preventDefault();
    setDropTarget(null);

    if (!dragPostId) return;

    const post = posts.find((p) => p.id === dragPostId);
    if (!post || post.postedToLinkedIn) {
      setDragPostId(null);
      return;
    }

    // Keep existing time, change the date
    const existingDate = post.scheduledAt ? toZonedTime(new Date(post.scheduledAt), userTimezone) : null;
    const hours = existingDate ? existingDate.getHours() : 9;
    const minutes = existingDate ? existingDate.getMinutes() : 0;

    const newLocal = new Date(targetDay);
    newLocal.setHours(hours, minutes, 0, 0);
    const newUtc = fromZonedTime(newLocal, userTimezone);

    // Optimistic update
    setPosts((prev) =>
      prev.map((p) => p.id === dragPostId ? { ...p, scheduledAt: newUtc.toISOString() } : p)
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
      // Revert on failure
      setPosts((prev) =>
        prev.map((p) => p.id === post.id ? { ...p, scheduledAt: post.scheduledAt } : p)
      );
    } finally {
      setRescheduling(false);
    }
  }, [dragPostId, posts, userTimezone, router]);

  // Group posts by week for list view
  function groupByWeek() {
    const weeks: Map<string, { weekLabel: string; weekStart: Date; posts: Post[] }> = new Map();

    const filtered = posts.filter((p) => {
      if (!p.scheduledAt) return false;
      const d = toZonedTime(new Date(p.scheduledAt), userTimezone);
      return d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth();
    });

    filtered.forEach((post) => {
      const d = toZonedTime(new Date(post.scheduledAt!), userTimezone);
      const weekMon = startOfWeek(d, { weekStartsOn: 1 });
      const key = weekMon.toISOString();
      if (!weeks.has(key)) {
        weeks.set(key, {
          weekLabel: `Week of ${format(weekMon, "MMM d, yyyy")}`,
          weekStart: weekMon,
          posts: [],
        });
      }
      weeks.get(key)!.posts.push(post);
    });

    return Array.from(weeks.values()).sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  }

  const weekGroups = groupByWeek();
  const hasAnyPosts = posts.length > 0;
  const monthHasPosts = posts.some((p) => {
    if (!p.scheduledAt) return false;
    const d = toZonedTime(new Date(p.scheduledAt), userTimezone);
    return d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth();
  });

  /* ── Month readings. Each card says something only it can say, the same way
        the dashboard cards do. ─────────────────────────────────────────── */
  const monthPosts = posts.filter((p) => {
    if (!p.scheduledAt) return false;
    const d = toZonedTime(new Date(p.scheduledAt), userTimezone);
    return d.getFullYear() === currentDate.getFullYear() && d.getMonth() === currentDate.getMonth();
  });
  const monthScheduled = monthPosts.filter((p) => !p.postedToLinkedIn && p.status === "ready");
  const monthPublished = monthPosts.filter((p) => p.postedToLinkedIn || p.status === "published");
  const monthDrafts = monthPosts.filter((p) => !p.postedToLinkedIn && p.status === "draft");
  const daysUsed = new Set(
    monthPosts.map((p) => toZonedTime(new Date(p.scheduledAt!), userTimezone).getDate())
  ).size;

  const nextOut = [...monthScheduled].sort(
    (a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime()
  )[0];
  const fmtShort = (d: Date | string) =>
    formatInTimeZone(new Date(d), userTimezone, "MMM d");

  const statusOf = (p: Post): "scheduled" | "draft" | "published" =>
    p.postedToLinkedIn || p.status === "published"
      ? "published"
      : p.status === "ready"
        ? "scheduled"
        : "draft";

  const viewingThisMonth =
    currentDate.getFullYear() === new Date().getFullYear() &&
    currentDate.getMonth() === new Date().getMonth();

  const DOT: Record<"scheduled" | "draft" | "published", string> = {
    scheduled: "bg-brand",
    draft: "bg-violet",
    published: "bg-ok",
  };

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-5 pt-1">
        <div className="min-w-0">
          <h1 className="font-display text-[34px] font-bold leading-[1.1] tracking-[-0.03em] text-text">
            Content Calendar
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-text-2">
            Every post you have scheduled, on the day it goes out. Drag one to another day to move it.
          </p>
        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          {rescheduling && (
            <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </span>
          )}

          <div className="flex items-center rounded-control border border-edge bg-card">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              aria-label="Previous month"
              className="ring-focus flex h-10 w-10 items-center justify-center rounded-l-control text-text-2 transition-colors hover:bg-card-muted hover:text-text"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="nums min-w-[132px] border-x border-edge px-3 text-center text-[13.5px] font-semibold text-text">
              {monthName}
            </span>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              aria-label="Next month"
              className="ring-focus flex h-10 w-10 items-center justify-center rounded-r-control text-text-2 transition-colors hover:bg-card-muted hover:text-text"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <button
            onClick={() => setCurrentDate(new Date())}
            disabled={viewingThisMonth}
            className="ring-focus h-10 rounded-control border border-edge bg-card px-4 text-[13.5px] font-semibold text-text-2 transition-colors hover:bg-card-muted hover:text-text disabled:opacity-40"
          >
            Today
          </button>

          <div className="flex items-center rounded-control border border-edge bg-card p-1">
            {([
              { k: "calendar", label: "Calendar", icon: CalendarDays },
              { k: "list", label: "List", icon: LayoutGrid },
            ] as const).map((v) => (
              <button
                key={v.k}
                onClick={() => setView(v.k)}
                aria-pressed={view === v.k}
                className={cn(
                  "ring-focus flex h-8 items-center gap-1.5 rounded-[6px] px-3 text-[13px] font-semibold transition-colors",
                  view === v.k ? "bg-brand text-white" : "text-text-2 hover:bg-card-muted hover:text-text"
                )}
              >
                <v.icon className="h-3.5 w-3.5" />
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Month readings ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Scheduled"
          value={monthScheduled.length}
          note={nextOut ? `next goes out ${fmtShort(nextOut.scheduledAt!)}` : "nothing queued this month"}
          icon={Clock}
          tone="brand"
          href="/posts?status=ready"
        />
        <StatCard
          label="Published"
          value={monthPublished.length}
          note={`live on LinkedIn in ${monthName.split(" ")[0]}`}
          icon={CheckCircle}
          tone="ok"
          href="/posts?status=published"
        />
        <StatCard
          label="Drafts"
          value={monthDrafts.length}
          note={monthDrafts.length > 0 ? "waiting for your review" : "nothing waiting"}
          icon={FileText}
          tone="warn"
          href="/posts?status=draft"
        />
        <StatCard
          label="Days used"
          value={daysUsed}
          note={`of ${days.length} days in ${monthName.split(" ")[0]}`}
          icon={CalendarDays}
          tone="violet"
          href="/calendar"
        />
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      {!hasAnyPosts ? (
        <div className="card px-6 py-14 text-center">
          <Sparkles className="mx-auto mb-4 h-10 w-10 text-text-3" />
          <h3 className="font-display text-[18px] font-bold text-text">No content plan yet</h3>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-text-2">
            Generate your weekly batch and the posts land on your posting days automatically.
          </p>
          <Link
            href="/dashboard"
            className="btn-brand ring-focus mt-6 inline-flex h-11 items-center gap-2 rounded-control px-5 text-[14px] font-semibold"
          >
            <Sparkles className="h-4 w-4" />
            Generate Content Plan
          </Link>
        </div>
      ) : view === "calendar" ? (
        <div className="card overflow-hidden">
          {hasAnyPosts && (
            <p className="flex items-center gap-1.5 px-5 pt-4 text-[12px] text-text-3">
              <GripVertical className="h-3.5 w-3.5" />
              Drag a post to another day to reschedule it
            </p>
          )}

          <div className="grid grid-cols-7 px-2 pb-2 pt-3">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="eyebrow py-2 text-center">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-edge-soft px-2 pb-2">
            {Array.from({ length: startDay }, (_, i) => (
              <div key={`empty-${i}`} className="min-h-[132px] bg-card-muted/40" />
            ))}

            {days.map((day) => {
              const dayPosts = getPostsForDay(day);
              const today = isToday(day);
              const dayKey = day.toISOString();
              const isDropHere = dropTarget === dayKey;

              return (
                <div
                  key={dayKey}
                  onDragOver={(e) => handleDragOver(e, dayKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day)}
                  className={cn(
                    "min-h-[132px] bg-card p-2 transition-colors",
                    today && "bg-brand-tint",
                    isDropHere && "bg-brand-tint ring-2 ring-inset ring-brand/40"
                  )}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={cn(
                        "nums flex h-6 w-6 items-center justify-center rounded-full text-[11.5px] font-semibold",
                        today ? "bg-brand text-white" : "text-text-3"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {dayPosts.length > 0 && (
                      <span className="nums text-[10.5px] font-semibold text-text-3">
                        {dayPosts.length}
                      </span>
                    )}
                  </div>

                  {/* Every post is shown. A cell that hides work behind
                      "+2 more" is the one place a calendar must not. */}
                  <div className="space-y-1.5">
                    {dayPosts.map((post) => {
                      const kind = statusOf(post);
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
                            className="ring-focus block rounded-[7px] bg-card-muted px-2 py-1.5 transition-colors hover:bg-edge-soft"
                          >
                            <span className="nums flex items-center gap-1.5 text-[10px] font-semibold text-text-3">
                              <span className={cn("h-1.5 w-1.5 rounded-full", DOT[kind])} />
                              {post.scheduledAt &&
                                formatInTimeZone(new Date(post.scheduledAt), userTimezone, "HH:mm")}
                              {post.postedToLinkedIn && <Linkedin className="h-2.5 w-2.5 text-ok" />}
                            </span>
                            <span className="mt-0.5 block text-[11px] font-medium leading-tight text-text">
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
        <div className="space-y-5">
          {!monthHasPosts ? (
            <div className="card px-6 py-12 text-center">
              <p className="text-[14px] text-text-2">No posts scheduled for {monthName}.</p>
            </div>
          ) : (
            weekGroups.map(({ weekLabel, weekStart, posts: weekPosts }) => (
              <div key={weekStart.toISOString()} className="card overflow-hidden">
                <div className="flex items-center justify-between px-6 pb-3 pt-5">
                  <h3 className="font-display text-[16px] font-bold tracking-[-0.02em] text-text">
                    {weekLabel}
                  </h3>
                  <span className="nums text-[12px] text-text-2">
                    {weekPosts.length} {weekPosts.length === 1 ? "post" : "posts"}
                  </span>
                </div>
                <div className="px-3 pb-3">
                  {weekPosts.map((post) => {
                    const kind = statusOf(post);
                    return (
                      <Link
                        key={post.id}
                        href={`/posts/${post.id}`}
                        className="ring-focus flex items-center gap-4 rounded-control px-3 py-3 transition-colors hover:bg-card-muted"
                      >
                        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-control bg-card-muted">
                          <FileText className="h-4 w-4 text-text-3" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-semibold leading-snug text-text">
                            {post.title}
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-2">
                            {post.style && <Pill>{post.style}</Pill>}
                            {post.scheduledAt && (
                              <span className="nums text-[11.5px] text-text-2">
                                {formatInTimeZone(
                                  new Date(post.scheduledAt),
                                  userTimezone,
                                  "MMM d, yyyy · HH:mm"
                                )}
                              </span>
                            )}
                          </span>
                        </span>
                        <StatusBadge kind={kind} />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Legend. Spelled out, because a colour the reader has to decode is
            not information. ───────────────────────────────────────────── */}
      {hasAnyPosts && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-1">
          <span className="eyebrow">What the dots mean</span>
          {(
            [
              { k: "scheduled", label: "Scheduled — publishes itself" },
              { k: "draft", label: "Draft — needs your review" },
              { k: "published", label: "Published to LinkedIn" },
            ] as const
          ).map((l) => (
            <span key={l.k} className="flex items-center gap-1.5 text-[12px] text-text-2">
              <span className={cn("h-2 w-2 rounded-full", DOT[l.k])} />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
