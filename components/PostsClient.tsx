"use client";

import Link from "next/link";
import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Search, Linkedin, Calendar, CheckSquare, Square,
  Trash2, Clock, CheckCircle, Loader2, X, AlertCircle,
  Image as ImageIcon, Copy, ArrowUpDown, Download, ExternalLink,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { StatCard, Pill, StatusBadge } from "@/components/dashboard/bits";
import PostImage from "@/components/PostImage";
import GeneratePostsButton from "@/components/GeneratePostsButton";
import { useGeneration } from "@/components/GenerationProvider";

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
  weekLabel: string;
}

// Schedule picker for individual posts - click to open picker popover
function InlineSchedule({ post, onUpdate }: { post: Post; onUpdate: (id: string, scheduledAt: string) => void }) {
  const initDate = post.scheduledAt ? new Date(post.scheduledAt) : null;
  const [date, setDate] = useState(initDate ? initDate.toISOString().slice(0, 10) : "");
  const [time, setTime] = useState(initDate ? initDate.toTimeString().slice(0, 5) : "09:00");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const isWeekend = (() => {
    if (!date) return false;
    const d = new Date(date + "T00:00:00");
    return d.getDay() === 0 || d.getDay() === 6;
  })();

  const displayDate = initDate
    ? initDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "No date";
  const displayTime = initDate
    ? initDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
    : "";

  async function handleSave() {
    if (!date) return;
    setSaving(true);
    const scheduledAt = new Date(`${date}T${time || "09:00"}:00`).toISOString();
    try {
      await fetch(`/api/content/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt }),
      });
      onUpdate(post.id, scheduledAt);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative mt-1.5" onClick={(e) => e.preventDefault()}>
      <button
        onClick={() => !post.postedToLinkedIn && setOpen(!open)}
        disabled={post.postedToLinkedIn}
        className={cn(
          "flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md transition-colors",
          post.postedToLinkedIn
            ? "text-text-3 cursor-not-allowed"
            : "text-text-2 hover:bg-card-muted cursor-pointer",
          isWeekend && "text-warn"
        )}
      >
        <Clock className="w-3 h-3 flex-shrink-0" />
        <span>{displayDate}</span>
        {displayTime && <span className="text-text-3">{displayTime}</span>}
        {isWeekend && <span className="text-[10px] text-amber-500 font-medium">Weekend</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 bg-card rounded-control shadow-lift-lg p-3 space-y-3 w-64">
            <p className="text-xs font-semibold text-text">Schedule Date & Time</p>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-text-2 block mb-0.5">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={cn(
                    "w-full px-2 py-1.5 text-xs border rounded-control focus:outline-none focus:ring-2 focus:ring-brand/25 bg-card ",
                    isWeekend ? "border-amber-300 bg-warn-tint" : "border-edge"
                  )}
                />
              </div>
              <div>
                <label className="text-[10px] text-text-2 block mb-0.5">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-edge rounded-control focus:outline-none focus:ring-2 focus:ring-brand/25 bg-card"
                />
              </div>
              {isWeekend && (
                <p className="text-[10px] text-warn flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Weekend - posts may get less engagement
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 text-xs py-1.5 border border-edge rounded-control hover:bg-card-muted text-text-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !date}
                className="flex-1 text-xs py-1.5 bg-brand text-white rounded-control hover:bg-brand-hover disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
              >
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function PostsClient({
  posts: initialPosts,
  recentPlan,
  postsRemaining,
}: {
  posts: Post[];
  recentPlan: { strategy: string; weekStart: Date | string } | null;
  postsRemaining: number;
}) {
  const router = useRouter();
  // Image generation runs in GenerationProvider (above every page), so it keeps
  // going if the user navigates away mid-batch.
  const {
    imageGenerating,
    imageStatus,
    lastImageBatch,
    startImageGeneration,
    cancelImageGeneration,
    imagePipeline,
    showPipeline,
  } = useGeneration();
  const [posts, setPosts] = useState(initialPosts);
  // useState only seeds on the FIRST render, so without this the list ignores
  // every later router.refresh() and keeps showing stale rows - which is why
  // freshly generated images (and duplicated posts) never appeared.
  useEffect(() => setPosts(initialPosts), [initialPosts]);

  // Paint a finished batch immediately rather than waiting on the refetch.
  useEffect(() => {
    if (!lastImageBatch || lastImageBatch.length === 0) return;
    const byId = new Map(lastImageBatch.map((i) => [i.id, i.imageUrl]));
    setPosts((prev) =>
      prev.map((p) => (byId.has(p.id) ? { ...p, imageUrl: byId.get(p.id)! } : p))
    );
  }, [lastImageBatch]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Bulk action state
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);

  // Schedule modal (time-only - each post keeps its own date)
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("09:00");

  // Delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Sort
  const [sortBy, setSortBy] = useState<"default" | "date-asc" | "date-desc">("default");

  // True once the page header has scrolled past. The toolbar is `sticky` either
  // way; this only controls how it LOOKS when pinned, and whether it is holding
  // the Generate action.
  const [stuck, setStuck] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    // The page scrolls inside <main>, not the window, so both mechanisms are
    // pointed at that element. Two of them on purpose: an observer rooted on
    // the scroller is the right tool, and a scroll listener covers the cases
    // where it does not deliver. Whichever fires first wins; the state is
    // idempotent, and if neither runs the bar is still position:sticky and
    // the action simply stays in the header.
    const scroller = el.closest("main");
    const measure = () => {
      const top = scroller ? scroller.getBoundingClientRect().top : 0;
      setStuck(el.getBoundingClientRect().top <= top);
    };

    let frame = 0;
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; measure(); });
    };

    measure();
    scroller?.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    let io: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting), {
        root: scroller,
        threshold: 0,
      });
      io.observe(el);
    }

    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller?.removeEventListener("scroll", onScroll);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      io?.disconnect();
    };
  }, []);

  const filtered = posts.filter((p) => {
    const matchSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.body.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === "all" || p.postType === filterType;
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  // Apply sorting
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "date-asc") {
      const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Infinity;
      const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Infinity;
      return aTime - bTime;
    }
    if (sortBy === "date-desc") {
      const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return bTime - aTime;
    }
    return 0;
  });

  const filteredIds = sorted.map((p) => p.id);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filteredIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function toggleSelect(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setBulkError(null);
    setBulkSuccess(null);
  }

  const showFeedback = useCallback((msg: string, isError = false) => {
    if (isError) {
      setBulkError(msg);
      setBulkSuccess(null);
    } else {
      setBulkSuccess(msg);
      setBulkError(null);
    }
    setTimeout(() => {
      setBulkError(null);
      setBulkSuccess(null);
    }, 4000);
  }, []);

  async function bulkAction(action: string, extra?: object) {
    setBulkLoading(true);
    setBulkError(null);
    try {
      const res = await fetch("/api/content/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, postIds: Array.from(selected), ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");

      if (action === "delete") {
        setPosts((prev) => prev.filter((p) => !selected.has(p.id)));
        showFeedback(`${data.deleted} post${data.deleted !== 1 ? "s" : ""} deleted`);
      } else if (action === "schedule-time") {
        // Update status to ready; actual date+time refreshed via router.refresh()
        setPosts((prev) =>
          prev.map((p) => selected.has(p.id) ? { ...p, status: "ready" } : p)
        );
        showFeedback(`${data.updated} post${data.updated !== 1 ? "s" : ""} scheduled`);
      } else if (action === "status" && extra && "status" in extra) {
        const newStatus = (extra as { status: string }).status;
        setPosts((prev) =>
          prev.map((p) =>
            selected.has(p.id) ? { ...p, status: newStatus } : p
          )
        );
        showFeedback(`${data.updated} post${data.updated !== 1 ? "s" : ""} updated`);
      }

      clearSelection();
      router.refresh();
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Action failed", true);
    } finally {
      setBulkLoading(false);
    }
  }

  function handleBulkSchedule() {
    if (!scheduleTime) return;
    setShowScheduleModal(false);
    bulkAction("schedule-time", { time: scheduleTime });
  }

  function handleBulkStatus(status: string) {
    bulkAction("status", { status });
  }

  function handleBulkDelete() {
    setShowDeleteConfirm(false);
    bulkAction("delete");
  }

  function handleBulkImageGen() {
    startImageGeneration(Array.from(selected));
    // The run is detached now, so it can no longer clear this for us.
    clearSelection();
  }

  async function handleDuplicate(postId: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`/api/content/${postId}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Duplicate failed");
      showFeedback("Post duplicated");
      router.refresh();
    } catch (err) {
      showFeedback(err instanceof Error ? err.message : "Duplicate failed", true);
    }
  }

  const selectedCount = selected.size;

  // Readings for the four cards. Derived from the live `posts` array, so an
  // optimistic bulk update moves them at the same instant it moves the rows.
  const readyPosts = posts.filter((p) => !p.postedToLinkedIn && p.status === "ready");
  const draftPosts = posts.filter((p) => !p.postedToLinkedIn && p.status === "draft");
  const publishedPosts = posts.filter((p) => p.postedToLinkedIn || p.status === "published");
  const nextOut = [...readyPosts]
    .filter((p) => p.scheduledAt)
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime())[0];
  const weeksHeld = new Set(posts.map((p) => p.weekLabel)).size;
  const shortDate = (d: Date | string) =>
    new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const statusOf = (p: Post): "scheduled" | "draft" | "published" =>
    p.postedToLinkedIn || p.status === "published"
      ? "published"
      : p.status === "ready"
        ? "scheduled"
        : "draft";


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-5 pt-1">
        <div className="min-w-0">
          <h1 className="font-display text-[34px] font-bold leading-[1.1] tracking-[-0.03em] text-text">
            All Posts
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-text-2">
            Everything you have written, newest week first. Open any post to edit it, add an image
            or mark it ready to publish.
          </p>
        </div>
        {/* Generate without going back to the dashboard. Once the toolbar is
            pinned this control moves into it, so there is never two of them. */}
        <div className={cn("flex flex-shrink-0 items-start transition-opacity", stuck && "pointer-events-none opacity-0")}>
          <GeneratePostsButton recentPlan={recentPlan} postsRemaining={postsRemaining} />
        </div>
      </div>

      {/* Readings */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total posts"
          value={posts.length}
          note={`across ${weeksHeld} ${weeksHeld === 1 ? "week" : "weeks"}`}
          icon={FileText}
          tone="brand"
          href="/posts"
        />
        <StatCard
          label="Ready to post"
          value={readyPosts.length}
          note={nextOut?.scheduledAt ? `next goes out ${shortDate(nextOut.scheduledAt)}` : "nothing queued"}
          icon={CheckCircle}
          tone="ok"
          href="/posts"
        />
        <StatCard
          label="Published"
          value={publishedPosts.length}
          note="live on LinkedIn"
          icon={Linkedin}
          tone="violet"
          href="/posts"
        />
        <StatCard
          label="Drafts"
          value={draftPosts.length}
          note={draftPosts.length > 0 ? "waiting for your review" : "nothing waiting"}
          icon={Clock}
          tone="warn"
          href="/posts"
        />
      </div>

      {/* Bulk action feedback */}
      {(bulkError || bulkSuccess) && (
        <div className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-control text-sm",
          bulkError
            ? "bg-bad-tint text-bad border border-bad/30"
            : "bg-ok-tint text-ok border border-green-200 dark:border-green-800"
        )}>
          {bulkError ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 flex-shrink-0" />}
          {bulkError || bulkSuccess}
        </div>
      )}

      {/* Image generation - shown independently of the selection, so it survives
          clearing the selection and navigating away and back. */}
      {imageGenerating && (
        <div className="flex items-center gap-3 rounded-control border border-purple-200 bg-purple-50 px-4 py-3 dark:border-purple-800 dark:bg-purple-900/20">
          <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin text-purple-600 dark:text-purple-400" />
          <span className="flex-1 text-sm text-purple-700 dark:text-purple-300">
            {imageStatus ?? "Generating images..."}
          </span>
          {imagePipeline && (
            <button
              onClick={() => showPipeline("images")}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-control border border-purple-300 px-3 py-1.5 text-sm text-purple-700 transition-colors hover:bg-purple-100/60 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/30"
            >
              View pipeline
            </button>
          )}
          <button
            onClick={cancelImageGeneration}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-control border border-red-200 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      )}

      {/* Sentinel at the bar's resting position. The observer flips `stuck`
          when it leaves the top of the scrollport - reading a scroll offset
          would not work, because the page scrolls inside <main>, not the
          window. */}
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />

      <div
        className={cn(
          "sticky top-0 z-30 -mx-8 space-y-3 px-8 transition-[padding,background-color,box-shadow] duration-200",
          stuck ? "border-b border-edge bg-field/92 py-3 shadow-lift backdrop-blur-md" : "py-0"
        )}
      >
        {/* Filters. Every control is labelled and looks like a control. The
          Generate action joins this row once the header has scrolled away, so
          the primary action is never off screen. */}
        <div className="flex items-center gap-3">
          <div className="card flex min-w-0 flex-1 flex-wrap items-center gap-3 px-4 py-3">
            <div className="relative min-w-[170px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-3" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search titles and post text…"
                className="ring-focus h-10 w-full rounded-control border border-edge bg-card pl-9 pr-3 text-[13.5px] text-text placeholder:text-text-3"
              />
            </div>

            <label className="flex flex-shrink-0 items-center gap-2 whitespace-nowrap">
              <span className="eyebrow">Type</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="ring-focus h-10 cursor-pointer rounded-control border border-edge bg-card pl-3 pr-8 text-[13px] font-medium text-text"
              >
                <option value="all">All types</option>
                <option value="thought-leadership">Thought Leadership</option>
                <option value="tips">Tips</option>
                <option value="story">Story</option>
                <option value="question">Question</option>
                <option value="listicle">Listicle</option>
              </select>
            </label>

            <label className="flex flex-shrink-0 items-center gap-2 whitespace-nowrap">
              <span className="eyebrow">Status</span>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="ring-focus h-10 cursor-pointer rounded-control border border-edge bg-card pl-3 pr-8 text-[13px] font-medium text-text"
              >
                <option value="all">All status</option>
                <option value="draft">Draft</option>
                <option value="ready">Ready</option>
                <option value="published">Published</option>
              </select>
            </label>

            <label className="flex flex-shrink-0 items-center gap-2 whitespace-nowrap">
              <span className="eyebrow">Sort</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="ring-focus h-10 cursor-pointer rounded-control border border-edge bg-card pl-3 pr-8 text-[13px] font-medium text-text"
              >
                <option value="default">By week</option>
                <option value="date-asc">Date, oldest first</option>
                <option value="date-desc">Date, newest first</option>
              </select>
            </label>

            <a
              href="/api/content/export"
              download
              title="Export every post as CSV"
              className="ring-focus flex h-10 items-center gap-1.5 rounded-control border border-edge bg-card px-3 text-[13px] font-semibold text-text-2 transition-colors hover:bg-card-muted hover:text-text"
            >
              <Download className="h-4 w-4" />
              {/* Collapses to its icon when pinned, so the bar stays one row. */}
              <span className={cn(stuck && "hidden xl:inline")}>Export CSV</span>
            </a>
          </div>

          {stuck && (
            <div className="flex-shrink-0">
              <GeneratePostsButton recentPlan={recentPlan} postsRemaining={postsRemaining} />
            </div>
          )}
        </div>

        {/* Bulk action bar */}
        {selectedCount > 0 && (
          <div className="flex items-center gap-3 bg-brand/5 dark:bg-brand/10 border border-blue-600/20 rounded-control px-4 py-3 flex-wrap">
            <span className="text-sm font-semibold text-brand">
              {selectedCount} post{selectedCount !== 1 ? "s" : ""} selected
            </span>
            <div className="flex-1" />

            {/* Schedule */}
            <button
              onClick={() => setShowScheduleModal(true)}
              disabled={bulkLoading}
              className="ring-focus flex h-9 items-center gap-1.5 rounded-control border border-edge bg-card px-3 text-[13px] font-semibold text-text transition-colors hover:bg-card-muted disabled:opacity-50"
            >
              <Calendar className="h-3.5 w-3.5 text-text-3" />
              Schedule
            </button>

            {/* Generate Images */}
            <button
              onClick={handleBulkImageGen}
              disabled={bulkLoading || imageGenerating}
              className="ring-focus flex h-9 items-center gap-1.5 rounded-control border border-edge bg-card px-3 text-[13px] font-semibold text-text transition-colors hover:bg-card-muted disabled:opacity-50"
            >
              {imageGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
              {imageGenerating ? "Generating…" : "Generate images"}
            </button>

            {/* Mark as Ready */}
            <button
              onClick={() => handleBulkStatus("ready")}
              disabled={bulkLoading}
              className="ring-focus flex h-9 items-center gap-1.5 rounded-control bg-ok px-3.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
              Mark ready
            </button>

            {/* Mark as Draft */}
            <button
              onClick={() => handleBulkStatus("draft")}
              disabled={bulkLoading}
              className="ring-focus flex h-9 items-center gap-1.5 rounded-control border border-edge bg-card px-3 text-[13px] font-semibold text-text transition-colors hover:bg-card-muted disabled:opacity-50"
            >
              Mark draft
            </button>

            {/* Delete */}
            <button
              onClick={() => setShowDeleteConfirm(true)}
              disabled={bulkLoading}
              className="ring-focus flex h-9 items-center gap-1.5 rounded-control bg-bad px-3.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>

            {/* Clear */}
            <button
              onClick={clearSelection}
              className="ring-focus flex h-9 w-9 items-center justify-center rounded-control text-text-2 transition-colors hover:bg-card-muted hover:text-text"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>

      {/* Posts List */}
      <div className="card overflow-hidden">
        {/* Table header with select-all */}
        {sorted.length > 0 && (
          <div className="flex items-center gap-2.5 border-b border-edge-soft px-5 py-3">
            <button
              onClick={toggleSelectAll}
              className="flex-shrink-0 text-text-3 hover:text-brand transition-colors"
              title={allFilteredSelected ? "Deselect all" : "Select all"}
            >
              {allFilteredSelected ? (
                <CheckSquare className="w-4 h-4 text-brand" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
            <span className="text-[12.5px] font-semibold text-text-2">
              {allFilteredSelected ? "Deselect all" : `Select all ${sorted.length}`}
            </span>
          </div>
        )}

        {sorted.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="mx-auto mb-3 h-10 w-10 text-text-3" />
            <p className="text-text-2">No posts found.</p>
          </div>
        ) : (
          <div className="divide-y divide-edge-soft">
            {sorted.map((post) => {
              const isSelected = selected.has(post.id);
              return (
                <div
                  key={post.id}
                  className={cn(
                    "group flex items-start gap-3.5 px-5 py-4 transition-colors",
                    isSelected ? "bg-brand-tint" : "hover:bg-card-muted"
                  )}
                >
                  <button
                    onClick={(e) => toggleSelect(post.id, e)}
                    aria-label={isSelected ? "Deselect post" : "Select post"}
                    className="ring-focus mt-1 flex-shrink-0 rounded text-text-3 transition-colors hover:text-brand"
                  >
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-brand" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>

                  <Link href={`/posts/${post.id}`} className="ring-focus flex min-w-0 flex-1 items-start gap-4 rounded-control">
                    {post.imageUrl ? (
                      <PostImage
                        src={post.imageUrl}
                        className="h-14 w-14 flex-shrink-0 rounded-control object-cover"
                        iconClassName="h-5 w-5"
                      />
                    ) : (
                      <span className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-control bg-card-muted">
                        <FileText className="h-5 w-5 text-text-3" />
                      </span>
                    )}

                    <span className="min-w-0 flex-1">
                      {/* Wraps in full. The title is the work; cutting it at a
                          fixed width is the habit this redesign removes. */}
                      <span className="block text-[14.5px] font-semibold leading-snug text-text">
                        {post.title}
                      </span>
                      <span className="mt-2 flex flex-wrap items-center gap-2">
                        {(post.style || post.postType) && <Pill>{post.style || post.postType}</Pill>}
                        <span className="text-[11.5px] text-text-3">{post.weekLabel}</span>
                        {post.postedToLinkedIn && (
                          <span className="flex items-center gap-1 text-[11.5px] font-semibold text-ok">
                            <Linkedin className="h-3 w-3" />
                            Posted
                          </span>
                        )}
                      </span>
                      <span className="mt-1.5 block">
                        <InlineSchedule
                          post={post}
                          onUpdate={(id, scheduledAt) => {
                            setPosts((prev) =>
                              prev.map((p) => (p.id === id ? { ...p, scheduledAt } : p))
                            );
                          }}
                        />
                      </span>
                    </span>
                  </Link>

                  <div className="flex flex-shrink-0 items-center gap-2 pt-0.5">
                    {/* Same link as the post editor's, sized to sit beside the
                        badge rather than as a toolbar button. Guarded on the id
                        as well as the flag: the editor falls back to an empty
                        id, which is a harmless dead link on one post but would
                        be a row of them here. The label hides on narrow screens
                        so a long title keeps its width. */}
                    {post.postedToLinkedIn && post.linkedinPostId && (
                      <a
                        href={`https://www.linkedin.com/feed/update/${post.linkedinPostId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ring-focus inline-flex items-center gap-1.5 rounded-control border border-ok/30 bg-ok-tint px-3 py-1.5 text-[12px] font-semibold text-ok transition-colors hover:bg-ok/15"
                        title="Open this post on LinkedIn"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">View on LinkedIn</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    <StatusBadge kind={statusOf(post)} />
                  </div>

                  {/* Duplicate button */}
                  {!post.postedToLinkedIn && (
                    <button
                      onClick={(e) => handleDuplicate(post.id, e)}
                      className="ring-focus mt-0.5 flex-shrink-0 rounded-control p-1.5 text-text-3 opacity-0 transition-all hover:bg-card-muted hover:text-brand group-hover:opacity-100"
                      title="Duplicate post"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule Modal - time only (each post keeps its own date) */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-card shadow-lift-lg w-full max-w-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-text">Set Time for {selectedCount} Post{selectedCount !== 1 ? "s" : ""}</h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-text-3 hover:text-text">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-text mb-1">Posting Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-4 py-2.5 border border-edge rounded-control text-sm focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand bg-card"
                />
              </div>
              <p className="text-xs text-text-3">
                Each post keeps its existing scheduled date. Only the posting time is updated.
                Posts without a date will be scheduled for tomorrow at this time.
                Status will be set to Ready.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 py-2.5 border border-edge rounded-control text-sm font-medium text-text hover:bg-card-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkSchedule}
                className="flex-1 py-2.5 bg-brand hover:bg-brand-hover text-white rounded-control text-sm font-medium hover:opacity-90 transition-all"
              >
                Apply Time
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-card rounded-card shadow-lift-lg w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-bad-tint rounded-control flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-bad" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text">Delete {selectedCount} post{selectedCount !== 1 ? "s" : ""}?</h3>
                <p className="text-sm text-text-2 mt-1">
                  This cannot be undone. Already-published posts will not be affected.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 border border-edge rounded-control text-sm font-medium text-text hover:bg-card-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex-1 py-2.5 bg-bad text-white rounded-control text-sm font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
