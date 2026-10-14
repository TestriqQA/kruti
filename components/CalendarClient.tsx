"use client";

import Link from "next/link";
import { Calendar, Sparkles, FileText, ChevronLeft, ChevronRight, Linkedin, GripVertical } from "lucide-react";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn, getPostTypeColor, getStatusColor } from "@/lib/utils";
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Content Calendar
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{monthName}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {rescheduling && (
            <span className="text-xs text-blue-600 dark:text-blue-400 animate-pulse">Saving...</span>
          )}
          {/* Month Navigation */}
          <div className="flex items-center gap-1 border border-slate-200 dark:border-white/10 rounded-lg overflow-hidden">
            <button
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-2 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors text-slate-600 dark:text-slate-400"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 min-w-[130px] text-center">
              {monthName}
            </span>
            <button
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-2 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors text-slate-600 dark:text-slate-400"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {/* View Toggle */}
          <div className="flex rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
            <button
              onClick={() => setView("calendar")}
              className={cn("px-4 py-2 text-sm font-medium", view === "calendar" ? "bg-blue-600 text-white" : "bg-white dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]")}
            >
              Calendar
            </button>
            <button
              onClick={() => setView("list")}
              className={cn("px-4 py-2 text-sm font-medium", view === "list" ? "bg-blue-600 text-white" : "bg-white dark:bg-white/[0.03] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]")}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {/* Drag hint */}
      {hasAnyPosts && view === "calendar" && (
        <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
          <GripVertical className="w-3 h-3" />
          Drag posts to reschedule them to a different day
        </p>
      )}

      {!hasAnyPosts ? (
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 p-12 text-center shadow-sm">
          <Sparkles className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No content plan yet</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Generate your weekly content strategy to see posts on the calendar.</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium hover:opacity-90"
          >
            <Sparkles className="w-4 h-4" />
            Generate Content Plan
          </Link>
        </div>
      ) : view === "calendar" ? (
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden">
          {/* Calendar Header */}
          <div className="grid grid-cols-7 border-b border-slate-100 dark:border-white/10">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="p-3 text-xs font-semibold text-slate-500 dark:text-slate-400 text-center bg-slate-50 dark:bg-white/[0.06]">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7">
            {/* Empty cells before month start */}
            {Array.from({ length: startDay }, (_, i) => (
              <div key={`empty-${i}`} className="min-h-[100px] border-b border-r border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03]" />
            ))}

            {/* Day cells */}
            {days.map((day) => {
              const dayPosts = getPostsForDay(day);
              const today = isToday(day);
              const dayKey = day.toISOString();
              const isDropHere = dropTarget === dayKey;

              return (
                <div
                  key={dayKey}
                  className={cn(
                    "min-h-[100px] border-b border-r border-slate-100 dark:border-white/10 p-2 transition-colors",
                    today && "bg-blue-50/30 dark:bg-blue-900/10",
                    isDropHere && "bg-blue-100/50 dark:bg-blue-900/30 ring-2 ring-inset ring-blue-500/40"
                  )}
                  onDragOver={(e) => handleDragOver(e, dayKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day)}
                >
                  <div className={cn(
                    "text-xs font-semibold mb-1.5 w-6 h-6 flex items-center justify-center rounded-full",
                    today ? "bg-blue-600 text-white" : "text-slate-400 dark:text-slate-500"
                  )}>
                    {format(day, "d")}
                  </div>
                  <div className="space-y-1">
                    {dayPosts.slice(0, 2).map((post) => (
                      <div
                        key={post.id}
                        draggable={!post.postedToLinkedIn}
                        onDragStart={() => handleDragStart(post.id)}
                        onDragEnd={() => { setDragPostId(null); setDropTarget(null); }}
                        className={cn(
                          "group relative",
                          !post.postedToLinkedIn && "cursor-grab active:cursor-grabbing"
                        )}
                      >
                        <Link
                          href={`/posts/${post.id}`}
                          className={cn(
                            "block text-xs px-1.5 py-1 rounded truncate border hover:opacity-80 transition-opacity",
                            getPostTypeColor(post.postType)
                          )}
                          title={`${post.title} - drag to reschedule`}
                          draggable={false}
                        >
                          {post.postedToLinkedIn && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />
                          )}
                          {post.title.slice(0, 18)}{post.title.length > 18 ? "..." : ""}
                        </Link>
                      </div>
                    ))}
                    {dayPosts.length > 2 && (
                      <div className="text-xs text-slate-400 dark:text-slate-500 px-1">+{dayPosts.length - 2} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* List View */
        <div className="space-y-3">
          {!monthHasPosts ? (
            <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 p-10 text-center shadow-sm">
              <p className="text-slate-500 dark:text-slate-400">No posts scheduled for {monthName}.</p>
            </div>
          ) : (
            weekGroups.map(({ weekLabel, weekStart, posts: weekPosts }) => (
              <div key={weekStart.toISOString()} className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-slate-50 dark:bg-white/[0.06] border-b border-slate-100 dark:border-white/10">
                  <h3 className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{weekLabel}</h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/10">
                  {weekPosts.map((post) => (
                    <Link
                      key={post.id}
                      href={`/posts/${post.id}`}
                      className="flex items-center justify-between px-5 py-4 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <FileText className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{post.title}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full border", getPostTypeColor(post.postType))}>
                              {post.style || post.postType}
                            </span>
                            <span className={cn("text-xs px-2 py-0.5 rounded-full", getStatusColor(post.status))}>
                              {post.status}
                            </span>
                            {post.postedToLinkedIn && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 flex items-center gap-1">
                                <Linkedin className="w-3 h-3" />
                                Published
                              </span>
                            )}
                            {post.scheduledAt && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {formatInTimeZone(new Date(post.scheduledAt), userTimezone, "MMM d, yyyy h:mm a")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Legend */}
      {hasAnyPosts && (
        <div className="flex items-center gap-4 flex-wrap">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Post types:</span>
          {["thought-leadership", "tips", "story", "question", "listicle"].map((type) => (
            <span key={type} className={cn("text-xs px-2 py-1 rounded-full border", getPostTypeColor(type))}>
              {type}
            </span>
          ))}
          <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 ml-2">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
            = Posted to LinkedIn
          </span>
        </div>
      )}
    </div>
  );
}
