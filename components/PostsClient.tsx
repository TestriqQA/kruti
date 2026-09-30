"use client";

import Link from "next/link";
import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText, Search, Linkedin, Calendar, CheckSquare, Square,
  Trash2, Clock, CheckCircle, Loader2, X, AlertCircle,
  Image as ImageIcon, Copy, ArrowUpDown, Download,
} from "lucide-react";
import { cn, formatDate, getPostTypeColor, getStatusColor } from "@/lib/utils";
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
            ? "text-slate-400 dark:text-slate-500 cursor-not-allowed"
            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] cursor-pointer",
          isWeekend && "text-amber-600 dark:text-amber-400"
        )}
      >
        <Clock className="w-3 h-3 flex-shrink-0" />
        <span>{displayDate}</span>
        {displayTime && <span className="text-slate-400 dark:text-slate-500">{displayTime}</span>}
        {isWeekend && <span className="text-[10px] text-amber-500 font-medium">Weekend</span>}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl shadow-lg p-3 space-y-3 w-64">
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Schedule Date & Time</p>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={cn(
                    "w-full px-2 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-white/[0.06] dark:text-slate-200",
                    isWeekend ? "border-amber-300 bg-amber-50 dark:bg-amber-900/20" : "border-slate-200 dark:border-white/10"
                  )}
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 dark:text-slate-400 block mb-0.5">Time</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-white/[0.06] dark:text-slate-200"
                />
              </div>
              {isWeekend && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Weekend - posts may get less engagement
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 text-xs py-1.5 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] text-slate-600 dark:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !date}
                className="flex-1 text-xs py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-1"
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            All Posts
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{posts.length} posts generated</p>
        </div>
        {/* Generate without going back to the dashboard. */}
        <GeneratePostsButton recentPlan={recentPlan} postsRemaining={postsRemaining} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search posts..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white dark:bg-white/[0.03] dark:text-gray-100"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-white/[0.03] dark:text-gray-100"
        >
          <option value="all">All Types</option>
          <option value="thought-leadership">Thought Leadership</option>
          <option value="tips">Tips</option>
          <option value="story">Story</option>
          <option value="question">Question</option>
          <option value="listicle">Listicle</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-white/[0.03] dark:text-gray-100"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="ready">Ready</option>
          <option value="published">Published</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-white/[0.03] dark:text-gray-100"
        >
          <option value="default">Sort: Default</option>
          <option value="date-asc">Date (Oldest first)</option>
          <option value="date-desc">Date (Newest first)</option>
        </select>
        <a
          href="/api/content/export"
          download
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors text-slate-600 dark:text-slate-300"
          title="Export all posts as CSV"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </a>
      </div>

      {/* Bulk action feedback */}
      {(bulkError || bulkSuccess) && (
        <div className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm",
          bulkError
            ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800"
            : "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
        )}>
          {bulkError ? <AlertCircle className="w-4 h-4 flex-shrink-0" /> : <CheckCircle className="w-4 h-4 flex-shrink-0" />}
          {bulkError || bulkSuccess}
        </div>
      )}

      {/* Image generation - shown independently of the selection, so it survives
          clearing the selection and navigating away and back. */}
      {imageGenerating && (
        <div className="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 dark:border-purple-800 dark:bg-purple-900/20">
          <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin text-purple-600 dark:text-purple-400" />
          <span className="flex-1 text-sm text-purple-700 dark:text-purple-300">
            {imageStatus ?? "Generating images..."}
          </span>
          {imagePipeline && (
            <button
              onClick={() => showPipeline("images")}
              className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-purple-300 px-3 py-1.5 text-sm text-purple-700 transition-colors hover:bg-purple-100/60 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/30"
            >
              View pipeline
            </button>
          )}
          <button
            onClick={cancelImageGeneration}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
          >
            <X className="w-3.5 h-3.5" />
            Cancel
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 bg-blue-600/5 dark:bg-blue-600/10 border border-blue-600/20 rounded-xl px-4 py-3 flex-wrap">
          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
            {selectedCount} post{selectedCount !== 1 ? "s" : ""} selected
          </span>
          <div className="flex-1" />

          {/* Schedule */}
          <button
            onClick={() => setShowScheduleModal(true)}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-slate-300 dark:border-white/10 rounded-lg hover:bg-white dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50 dark:text-slate-300"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
            Schedule
          </button>

          {/* Generate Images */}
          <button
            onClick={handleBulkImageGen}
            disabled={bulkLoading || imageGenerating}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors disabled:opacity-50"
          >
            {imageGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            {imageGenerating ? "Generating..." : "Generate Images"}
          </button>

          {/* Mark as Ready */}
          <button
            onClick={() => handleBulkStatus("ready")}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {bulkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
            Mark Ready
          </button>

          {/* Mark as Draft */}
          <button
            onClick={() => handleBulkStatus("draft")}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-slate-300 dark:border-white/10 rounded-lg hover:bg-white dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50 dark:text-slate-300"
          >
            Mark Draft
          </button>

          {/* Delete */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>

          {/* Clear */}
          <button
            onClick={clearSelection}
            className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Posts List */}
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden">
        {/* Table header with select-all */}
        {sorted.length > 0 && (
          <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/[0.03]">
            <button
              onClick={toggleSelectAll}
              className="flex-shrink-0 text-slate-400 hover:text-blue-600 transition-colors"
              title={allFilteredSelected ? "Deselect all" : "Select all"}
            >
              {allFilteredSelected ? (
                <CheckSquare className="w-4 h-4 text-blue-600" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {allFilteredSelected ? "Deselect all" : `Select all ${sorted.length}`}
            </span>
          </div>
        )}

        {sorted.length === 0 ? (
          <div className="py-16 text-center">
            <FileText className="w-12 h-12 text-slate-200 dark:text-white/10 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-slate-400">No posts found.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50 dark:divide-white/10">
            {sorted.map((post) => {
              const isSelected = selected.has(post.id);
              return (
                <div key={post.id} className={cn("flex items-start gap-3 px-5 py-4 transition-colors", isSelected ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-slate-50 dark:hover:bg-white/[0.06]")}>
                  {/* Checkbox */}
                  <button
                    onClick={(e) => toggleSelect(post.id, e)}
                    className="flex-shrink-0 mt-0.5 text-slate-300 dark:text-white/10 hover:text-blue-600 transition-colors"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>

                  {/* Post content - clicking navigates to editor */}
                  <Link
                    href={`/posts/${post.id}`}
                    className="flex items-start gap-4 flex-1 min-w-0"
                  >
                    {post.imageUrl ? (
                      <PostImage
                        src={post.imageUrl}
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        iconClassName="w-5 h-5"
                      />
                    ) : (
                      <div className={cn("w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0", getPostTypeColor(post.postType))}>
                        <FileText className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-gray-100 truncate">{post.title}</p>
                        {post.postedToLinkedIn && (
                          <span className="flex-shrink-0 flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400">
                            <Linkedin className="w-3 h-3" />
                            Posted
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{post.body.slice(0, 100)}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full border", getPostTypeColor(post.postType))}>
                          {post.style || post.postType}
                        </span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", getStatusColor(post.status))}>
                          {post.status}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500">{post.weekLabel}</span>
                      </div>
                      <InlineSchedule
                        post={post}
                        onUpdate={(id, scheduledAt) => {
                          setPosts((prev) =>
                            prev.map((p) => p.id === id ? { ...p, scheduledAt } : p)
                          );
                        }}
                      />
                    </div>
                  </Link>
                  {/* Duplicate button */}
                  {!post.postedToLinkedIn && (
                    <button
                      onClick={(e) => handleDuplicate(post.id, e)}
                      className="flex-shrink-0 mt-0.5 p-1.5 text-slate-300 dark:text-white/10 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
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
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-gray-100">Set Time for {selectedCount} Post{selectedCount !== 1 ? "s" : ""}</h3>
              <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Posting Time</label>
                <input
                  type="time"
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white dark:bg-white/[0.06] dark:text-gray-100"
                />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Each post keeps its existing scheduled date. Only the posting time is updated.
                Posts without a date will be scheduled for tomorrow at this time.
                Status will be set to Ready.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkSchedule}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-all"
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
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-gray-100">Delete {selectedCount} post{selectedCount !== 1 ? "s" : ""}?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  This cannot be undone. Already-published posts will not be affected.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors"
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
