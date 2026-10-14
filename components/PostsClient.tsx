"use client";

import Link from "next/link";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  FileText, Search, Linkedin, Calendar, CheckSquare, Square, MinusSquare,
  Trash2, Clock, CheckCircle, Loader2, X, AlertCircle,
  Image as ImageIcon, Copy, Download, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import PostImage from "@/components/PostImage";
import GeneratePostsButton from "@/components/GeneratePostsButton";
import { useGeneration } from "@/components/GenerationProvider";
import { derivePostState } from "@/lib/dashboard-overview";
import type { OverviewStatus } from "@/lib/dashboard-overview";
import { Stepper, RuleHeader } from "@/components/dashboard/ledger";

/**
 * The post library.
 *
 * Organising idea: this is not a list of posts, it is a bound volume of weekly
 * issues. Generation writes exactly POSTS_PER_BATCH posts against ONE
 * ContentPlan, so the archive's real grain is the week, and the week carries a
 * theme the user can read. The old screen knew this and threw it away - it
 * flattened eight plans into one run and then printed "Posts from Oct 6, 2025"
 * on every row, two hundred times. Here the repeated field becomes the
 * structure.
 *
 * THE TWO LAWS hold (see components/DashboardClient.tsx): one bordered
 * container (the chassis), and nothing is shown then hidden - titles wrap in
 * full, postError wraps in full, and there is no row excerpt to half-truncate.
 *
 * State is derived CLIENT-side on purpose. Shipping a server-derived state
 * would quietly break every optimistic update here: "mark ready" patches
 * `status`, and a row rendering a frozen server value would ignore it until the
 * refetch landed.
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
  carouselImages?: string | null;
  documentUrl?: string | null;
  postError?: string | null;
  postedToLinkedIn?: boolean;
  linkedinPostId?: string | null;
  weekLabel: string;
  planId: string;
  weekStartIso: string;
  weekLabelShort: string;
  weekTheme: string | null;
}

type Decorated = Post & { state: OverviewStatus };

/** Legal `postType` values, including the two the schema comment allows. */
const POST_TYPE_LABELS: Record<string, string> = {
  "thought-leadership": "Thought Leadership",
  tips: "Tips",
  story: "Story",
  question: "Question",
  listicle: "Listicle",
  poll: "Poll",
  carousel: "Carousel",
};
const typeLabel = (t: string) => POST_TYPE_LABELS[t] ?? t;

const STATE_WORD: Record<OverviewStatus, string> = {
  draft: "Drafts",
  ready: "Ready",
  published: "Published",
  missed: "Missed",
  failed: "Failed",
};

const STATE_DOT: Record<OverviewStatus, string> = {
  draft: "bg-warning/70",
  ready: "bg-accent",
  published: "bg-success",
  missed: "bg-warning ring-[1.5px] ring-warning",
  failed: "bg-danger ring-[1.5px] ring-danger",
};

/** The status values the list can actually filter by. */
const POST_STATUSES = ["draft", "ready", "published"];

/* ── Inline schedule ───────────────────────────────────────────────────────
   Hand-rolled rather than Radix Popover, which is NOT a dependency here
   (only avatar/dialog/dropdown-menu/progress/separator/tabs/tooltip are).
   Escape and outside-click are wired explicitly to make up for it. */
function InlineSchedule({
  post,
  onUpdate,
}: {
  post: Post;
  onUpdate: (id: string, scheduledAt: string) => void;
}) {
  const initDate = post.scheduledAt ? new Date(post.scheduledAt) : null;
  const [date, setDate] = useState(initDate ? initDate.toISOString().slice(0, 10) : "");
  const [time, setTime] = useState(initDate ? initDate.toTimeString().slice(0, 5) : "09:00");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const isWeekend = (() => {
    if (!date) return false;
    const d = new Date(date + "T00:00:00");
    return d.getDay() === 0 || d.getDay() === 6;
  })();

  const displayDate = initDate
    ? initDate.toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "No date";
  const displayTime = initDate
    ? initDate.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })
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
    <div className="relative" onClick={(e) => e.preventDefault()}>
      <button
        ref={triggerRef}
        onClick={() => !post.postedToLinkedIn && setOpen(!open)}
        disabled={post.postedToLinkedIn}
        className={cn(
          "focus-ring -mx-1 rounded px-1 text-left transition-colors",
          post.postedToLinkedIn ? "cursor-not-allowed" : "hover:bg-surface-sunken"
        )}
      >
        <span
          className={cn(
            "block text-[9.5px] font-semibold uppercase tracking-[0.12em]",
            isWeekend ? "text-warning" : "text-ink-muted"
          )}
        >
          {initDate ? initDate.toLocaleDateString("en-IN", { weekday: "short" }) : "—"}
        </span>
        <span className="tabular block text-[12.5px] font-semibold text-ink">{displayDate}</span>
        {displayTime && (
          <span className="tabular block text-[10.5px] text-ink-muted">{displayTime}</span>
        )}
        {isWeekend && (
          <span className="block text-[9.5px] font-semibold text-warning">Weekend</span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 w-64 space-y-3 rounded-panel border border-line bg-surface p-3 shadow-e3">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Schedule
            </p>
            <div className="space-y-2">
              <label className="block">
                <span className="mb-1 block text-[11px] text-ink-muted">Date</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={cn(
                    "focus-ring w-full rounded-control border bg-surface px-2 py-1.5 text-[12px] text-ink",
                    isWeekend ? "border-warning/40" : "border-line"
                  )}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[11px] text-ink-muted">Time</span>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="focus-ring w-full rounded-control border border-line bg-surface px-2 py-1.5 text-[12px] text-ink"
                />
              </label>
              {isWeekend && (
                <p className="flex items-start gap-1 text-[11px] leading-relaxed text-warning">
                  <AlertCircle className="mt-0.5 h-3 w-3 flex-shrink-0" />
                  Weekend &mdash; posts may get less engagement
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="focus-ring flex-1 rounded-control border border-line py-1.5 text-[12px] font-semibold text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !date}
                className="focus-ring flex flex-1 items-center justify-center gap-1 rounded-control bg-accent py-1.5 text-[12px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle className="h-3 w-3" />
                )}
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── Artwork mark ──────────────────────────────────────────────────────────── */

function ArtMark({ post }: { post: Post }) {
  const slides = (() => {
    if (!post.carouselImages) return 0;
    try {
      const a = JSON.parse(post.carouselImages);
      return Array.isArray(a) ? a.length : 0;
    } catch {
      return 0;
    }
  })();

  if (post.imageUrl) {
    return (
      <div>
        <PostImage
          src={post.imageUrl}
          className="h-12 w-14 rounded-card object-cover ring-1 ring-line-strong"
          iconClassName="h-4 w-4"
        />
        {slides > 1 && (
          <span className="tabular mt-1 block text-[9.5px] font-semibold text-ink-muted">
            {slides}&times;
          </span>
        )}
      </div>
    );
  }
  if (post.documentUrl) {
    return (
      <div className="flex h-12 w-14 items-center justify-center rounded-card bg-surface-sunken ring-1 ring-line-strong">
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          PDF
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-12 w-14 items-center justify-center rounded-card border border-dashed border-line-strong">
      <FileText className="h-4 w-4 text-ink-muted" />
    </div>
  );
}

/* ── Page ──────────────────────────────────────────────────────────────────── */

export default function PostsClient({
  posts: initialPosts,
  recentPlan,
  postsRemaining,
  postsLimit,
  initialStatus = null,
}: {
  posts: Post[];
  recentPlan: { strategy: string; weekStart: Date | string } | null;
  postsRemaining: number;
  postsLimit: number;
  /** From ?status= on the URL, so overview aggregates land pre-filtered. */
  initialStatus?: string | null;
}) {
  const router = useRouter();
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

  // Captured once after mount. Before it lands nothing can be "missed", which
  // keeps the first client render byte-identical to the server's.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState(
    initialStatus && POST_STATUSES.includes(initialStatus) ? initialStatus : "all"
  );
  const [seededFromUrl] = useState(
    () => !!(initialStatus && POST_STATUSES.includes(initialStatus))
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkSuccess, setBulkSuccess] = useState<string | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sortBy, setSortBy] = useState<"default" | "date-asc" | "date-desc">("default");

  const epoch = useMemo(() => new Date(0), []);
  const decorated: Decorated[] = useMemo(
    () => posts.map((p) => ({ ...p, state: derivePostState(p, now ?? epoch) })),
    [posts, now, epoch]
  );

  const filtered = decorated.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q);
    const matchType = filterType === "all" || p.postType === filterType;
    const matchStatus = filterStatus === "all" || p.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

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

  /* ── Readings. Derived from the LIVE array, so an optimistic bulk update
        moves the ledger counts at the same instant it moves the rows. ─────── */
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: decorated.length, draft: 0, ready: 0, published: 0 };
    for (const p of decorated) if (p.status in c) c[p.status] += 1;
    return c;
  }, [decorated]);

  const atRisk = useMemo(
    () => decorated.filter((p) => p.state === "failed" || p.state === "missed").length,
    [decorated]
  );

  const typeFacets = useMemo(() => {
    const seen = new Map<string, number>();
    for (const p of decorated) seen.set(p.postType, (seen.get(p.postType) ?? 0) + 1);
    return Array.from(seen.entries()).sort((a, b) => b[1] - a[1]);
  }, [decorated]);

  /* ── The fore-edge: one column per weekly plan, oldest on the left. ─────── */
  const weeks = useMemo(() => {
    const byPlan = new Map<
      string,
      { id: string; iso: string; label: string; theme: string | null; states: OverviewStatus[] }
    >();
    for (const p of decorated) {
      let w = byPlan.get(p.planId);
      if (!w) {
        w = { id: p.planId, iso: p.weekStartIso, label: p.weekLabelShort, theme: p.weekTheme, states: [] };
        byPlan.set(p.planId, w);
      }
      w.states.push(p.state);
    }
    // posts arrive newest-plan-first, so reverse to run oldest -> newest and
    // make the "Oldest week held" label on the left actually true.
    return Array.from(byPlan.values()).reverse();
  }, [decorated]);

  const filteredIds = sorted.map((p) => p.id);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
  const someFilteredSelected =
    !allFilteredSelected && filteredIds.some((id) => selected.has(id));

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
        // The route only touches rows that have not gone out, so the optimistic
        // patch is scoped the same way - otherwise a published row paints Ready
        // and is contradicted by the refresh.
        setPosts((prev) =>
          prev.map((p) =>
            selected.has(p.id) && !p.postedToLinkedIn ? { ...p, status: "ready" } : p
          )
        );
        showFeedback(`${data.updated} post${data.updated !== 1 ? "s" : ""} scheduled`);
      } else if (action === "status" && extra && "status" in extra) {
        const newStatus = (extra as { status: string }).status;
        setPosts((prev) =>
          prev.map((p) =>
            selected.has(p.id) && !p.postedToLinkedIn ? { ...p, status: newStatus } : p
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
  const filtersActive = search !== "" || filterType !== "all" || filterStatus !== "all";
  function clearFilters() {
    setSearch("");
    setFilterType("all");
    setFilterStatus("all");
  }

  /* ── Grouping. The week stays visible in every sort mode: it is the grain
        the archive actually has. ────────────────────────────────────────── */
  const groupByWeek = sortBy === "default";
  const groups = useMemo(() => {
    const out: { key: string; label: string; theme: string | null; rows: Decorated[] }[] = [];
    const index = new Map<string, number>();
    for (const p of sorted) {
      const key = groupByWeek
        ? `week-${p.planId}`
        : p.scheduledAt
          ? `month-${new Date(p.scheduledAt).toISOString().slice(0, 7)}`
          : "month-none";
      let i = index.get(key);
      if (i === undefined) {
        i = out.length;
        index.set(key, i);
        out.push({
          key,
          label: groupByWeek
            ? `Week of ${p.weekLabelShort}`
            : p.scheduledAt
              ? new Date(p.scheduledAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
              : "Unscheduled",
          theme: groupByWeek ? p.weekTheme : null,
          rows: [],
        });
      }
      out[i].rows.push(p);
    }
    return out;
  }, [sorted, groupByWeek]);

  const quotaCaption = !Number.isFinite(postsRemaining)
    ? "Unlimited on this account"
    : `${postsRemaining} of ${postsLimit} left this cycle`;

  const firstFiled = weeks[0]?.label ?? null;

  return (
    <div className="space-y-7">
      {/* ═══ CHASSIS ════════════════════════════════════════════════════════ */}
      <section className="animate-rise-in divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface shadow-e1 motion-reduce:animate-none dark:shadow-none">
        {/* State bands - one line each, never a card. Same grammar the Overview
            chassis uses: border-l-[3px] + the tone's soft fill. */}
        {imageGenerating && (
          <div className="flex items-center gap-3 border-l-[3px] border-accent bg-accent-soft px-7 py-2.5">
            <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-accent" />
            <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              Images
            </span>
            <span className="min-w-0 flex-1 text-[12.5px] text-ink-muted">
              {imageStatus ?? "Generating images…"}
            </span>
            {imagePipeline && (
              <button
                onClick={() => showPipeline("images")}
                className="flex-shrink-0 text-[12px] font-semibold text-accent hover:underline"
              >
                View pipeline
              </button>
            )}
            <button
              onClick={cancelImageGeneration}
              className="flex-shrink-0 text-[12px] font-semibold text-danger hover:underline"
            >
              Cancel
            </button>
          </div>
        )}
        {bulkError && (
          <div className="flex items-start gap-3 border-l-[3px] border-danger bg-danger-soft px-7 py-2.5">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-danger" />
            <span className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink-muted">
              {bulkError}
            </span>
          </div>
        )}
        {bulkSuccess && (
          <div className="flex items-center gap-3 border-l-[3px] border-success bg-success-soft px-7 py-2.5">
            <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-success" />
            <span className="min-w-0 flex-1 text-[12.5px] text-ink-muted">{bulkSuccess}</span>
          </div>
        )}
        {seededFromUrl && filterStatus !== "all" && (
          <div className="flex items-center gap-3 border-l-[3px] border-accent bg-accent-soft px-7 py-2.5">
            <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
              Filtered
            </span>
            <span className="min-w-0 flex-1 text-[12.5px] text-ink-muted">
              Showing {filterStatus} posts only, from the link you followed.
            </span>
            <button
              onClick={() => setFilterStatus("all")}
              className="flex-shrink-0 text-[12px] font-semibold text-accent hover:underline"
            >
              Show all
            </button>
          </div>
        )}

        {/* Header. Deliberately shorter than the Overview's: this page has no
            greeting to carry, and a 180px decorated page title is exactly the
            template smell being removed. Every value here is this account's. */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-7 px-7 py-6">
          <div className="min-w-0">
            <p className="tabular text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              Library · {posts.length} posts · {weeks.length}{" "}
              {weeks.length === 1 ? "week" : "weeks"}
            </p>
            <h1 className="mt-2.5 font-display text-[28px] font-bold leading-[1.1] tracking-[-0.03em] text-ink">
              {posts.length === 0
                ? "Nothing filed yet."
                : firstFiled
                  ? `Everything since ${firstFiled}.`
                  : "Your archive."}
            </h1>

            <div className="relative mt-4 max-w-[420px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search titles and bodies…"
                className="focus-ring h-10 w-full rounded-control border border-line bg-surface pl-9 pr-3 text-[13px] text-ink placeholder:text-ink-muted"
              />
            </div>
            <p className="tabular mt-2 text-[11px] text-ink-muted">
              Showing {sorted.length} of {posts.length}
              {filtersActive && (
                <button
                  onClick={clearFilters}
                  className="ml-2 font-semibold text-accent hover:underline"
                >
                  Clear filters
                </button>
              )}
            </p>
          </div>

          <div className="flex w-[220px] flex-shrink-0 flex-col items-stretch self-start pt-5">
            <GeneratePostsButton recentPlan={recentPlan} postsRemaining={postsRemaining} />
            <p className="tabular mt-2 text-right text-[11px] text-ink-muted">{quotaCaption}</p>
          </div>
        </div>

        {/* Instruments: the status ledger IS the status filter, so the control
            lives in the reading rather than in another toolbar select. */}
        <div className="grid h-[150px] grid-cols-[196px_minmax(0,1fr)]">
          <div className="flex flex-col justify-center gap-0.5 px-5 py-4">
            {(["all", "draft", "ready", "published"] as const).map((k) => {
              const active = filterStatus === k;
              return (
                <button
                  key={k}
                  onClick={() => setFilterStatus(k)}
                  className={cn(
                    "focus-ring flex h-6 items-center gap-2 rounded-[3px] px-1 text-left transition-colors",
                    active ? "bg-accent-soft" : "hover:bg-surface-sunken"
                  )}
                >
                  {k === "all" ? (
                    <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-ink-muted" />
                  ) : (
                    <span
                      className={cn(
                        "h-1.5 w-1.5 flex-shrink-0 rounded-full",
                        STATE_DOT[k as OverviewStatus]
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "w-[74px] flex-shrink-0 whitespace-nowrap text-[9.5px] font-semibold uppercase tracking-[0.12em]",
                      active ? "text-accent" : "text-ink-muted"
                    )}
                  >
                    {k === "all" ? "All posts" : STATE_WORD[k as OverviewStatus]}
                  </span>
                  <span
                    className={cn(
                      "tabular font-display text-[15px] font-bold tracking-[-0.02em]",
                      active ? "text-accent" : "text-ink"
                    )}
                  >
                    {counts[k]}
                  </span>
                </button>
              );
            })}
            {atRisk > 0 && (
              <p className="mt-1 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-danger">
                {atRisk} at risk
              </p>
            )}
          </div>

          {/* THE FORE-EDGE — the stack of weekly issues, seen end-on. Column
              height is that week's post count, colour mix is its outcome. */}
          <div className="border-l border-line py-4 pl-6 pr-5">
            <ForeEdge weeks={weeks} linkable={groupByWeek} />
          </div>
        </div>
      </section>

      {/* ═══ SHELF RULE — sticky, so bulk actions stay reachable 150 rows down */}
      {(sorted.length > 0 || selectedCount > 0) && (
        <div className="sticky top-16 z-20 -mt-2 flex h-11 items-center gap-4 border-y border-line-strong bg-app">
          <button
            onClick={toggleSelectAll}
            className="focus-ring flex flex-shrink-0 items-center gap-2 rounded px-1 text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            {allFilteredSelected ? (
              <CheckSquare className="h-4 w-4 text-accent" />
            ) : someFilteredSelected ? (
              <MinusSquare className="h-4 w-4 text-accent" />
            ) : (
              <Square className="h-4 w-4" />
            )}
            {allFilteredSelected ? "Deselect all" : `Select all ${sorted.length}`}
          </button>

          {selectedCount > 0 ? (
            <>
              <span className="tabular flex-shrink-0 text-[12px] font-semibold text-accent">
                {selectedCount} post{selectedCount !== 1 ? "s" : ""} selected
              </span>
              <div className="flex-1" />
              <button
                onClick={() => setShowScheduleModal(true)}
                disabled={bulkLoading}
                className="focus-ring flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
              >
                <Calendar className="h-3.5 w-3.5" />
                Set time
              </button>
              <button
                onClick={handleBulkImageGen}
                disabled={bulkLoading || imageGenerating}
                className="focus-ring flex items-center gap-1.5 text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
              >
                {imageGenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <ImageIcon className="h-3.5 w-3.5" />
                )}
                {imageGenerating ? "Generating…" : "Generate images"}
              </button>
              <button
                onClick={() => handleBulkStatus("ready")}
                disabled={bulkLoading}
                className="focus-ring flex items-center gap-1.5 text-[12px] font-semibold text-success transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {bulkLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="h-3.5 w-3.5" />
                )}
                Mark ready
              </button>
              <button
                onClick={() => handleBulkStatus("draft")}
                disabled={bulkLoading}
                className="focus-ring text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
              >
                Mark draft
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={bulkLoading}
                className="focus-ring flex items-center gap-1.5 text-[12px] font-semibold text-danger transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
              <button
                onClick={clearSelection}
                aria-label="Clear selection"
                className="focus-ring flex-shrink-0 rounded p-1 text-ink-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="focus-ring cursor-pointer rounded border-0 bg-transparent py-0 pl-0 pr-6 text-[12px] font-semibold text-ink-muted"
              >
                <option value="all">All types</option>
                {typeFacets.map(([t, n]) => (
                  <option key={t} value={t}>
                    {typeLabel(t)} ({n})
                  </option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="focus-ring cursor-pointer rounded border-0 bg-transparent py-0 pl-0 pr-6 text-[12px] font-semibold text-ink-muted"
              >
                <option value="default">By week</option>
                <option value="date-asc">Date, oldest first</option>
                <option value="date-desc">Date, newest first</option>
              </select>
              <div className="flex-1" />
              <a
                href="/api/content/export"
                download
                title="Export all posts as CSV"
                className="focus-ring flex flex-shrink-0 items-center gap-1.5 text-[12px] font-semibold text-ink-muted transition-colors hover:text-ink"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </a>
            </>
          )}
        </div>
      )}

      {/* ═══ THE VOLUME ═════════════════════════════════════════════════════ */}
      {sorted.length === 0 ? (
        <div className="py-10">
          <p className="text-[15px] text-ink">
            {posts.length === 0 ? "Nothing filed yet." : "Nothing matches those filters."}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
            {posts.length === 0
              ? "Your first run writes a batch against a brief built from your profile."
              : "Widen the search, or clear the filters to see the whole archive again."}
          </p>
        </div>
      ) : (
        <div
          className="animate-rise-in space-y-7 motion-reduce:animate-none"
          style={{ animationDelay: "70ms" }}
        >
          {groups.map((g) => {
            // The batch ledger: what the week was briefed for, versus what
            // survived. Posts arrive five at a time against one plan, so this
            // is the one tally that means something on this page.
            const ready = g.rows.filter((r) => r.state === "ready").length;
            const published = g.rows.filter((r) => r.state === "published").length;
            const broken = g.rows.filter(
              (r) => r.state === "failed" || r.state === "missed"
            ).length;
            return (
              <section key={g.key} id={g.key} className="scroll-mt-[120px]">
                <RuleHeader
                  label={g.label}
                  trailing={
                    <span className="tabular flex items-center gap-2 text-[11px] text-ink-muted">
                      <span>{g.rows.length} briefed</span>
                      {published > 0 && <span className="text-success">{published} published</span>}
                      {ready > 0 && <span className="text-accent">{ready} ready</span>}
                      {broken > 0 && <span className="text-danger">{broken} at risk</span>}
                    </span>
                  }
                />
                {g.theme && (
                  <p className="-mt-1 mb-3 text-[12px] leading-relaxed text-ink-muted">{g.theme}</p>
                )}

                <div>
                  {g.rows.map((post, i) => {
                    const isSelected = selected.has(post.id);
                    const problem = post.state === "failed" || post.state === "missed";
                    return (
                      <div
                        key={post.id}
                        className={cn(
                          "group relative",
                          i > 0 && "border-t border-line-strong/70"
                        )}
                      >
                        <div
                          className={cn(
                            "-mx-3 grid grid-cols-[20px_72px_56px_minmax(0,1fr)_116px_32px] items-start gap-4 rounded-card px-3 py-3 transition-colors",
                            isSelected
                              ? "border-l-2 border-accent bg-accent/[0.06] pl-[10px]"
                              : "hover:bg-surface",
                            problem &&
                              !isSelected &&
                              cn(
                                "border-l-2 pl-[10px]",
                                post.state === "failed" ? "border-danger" : "border-warning"
                              )
                          )}
                        >
                          <button
                            onClick={(e) => toggleSelect(post.id, e)}
                            aria-label={isSelected ? "Deselect post" : "Select post"}
                            className="focus-ring mt-0.5 flex-shrink-0 rounded text-ink-muted transition-colors hover:text-accent"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-accent" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>

                          <InlineSchedule
                            post={post}
                            onUpdate={(id, scheduledAt) => {
                              setPosts((prev) =>
                                prev.map((p) => (p.id === id ? { ...p, scheduledAt } : p))
                              );
                            }}
                          />

                          <Link href={`/posts/${post.id}`} className="focus-ring rounded-card">
                            <ArtMark post={post} />
                          </Link>

                          <Link href={`/posts/${post.id}`} className="focus-ring min-w-0 rounded">
                            {/* Wraps in full - LAW 2. The row is variable
                                height by design; 56px is a floor, not a size. */}
                            <p className="text-[14px] font-semibold leading-snug text-ink">
                              {post.title}
                            </p>
                            {post.postError ? (
                              <p className="mt-1 text-[11px] leading-relaxed text-danger">
                                {post.postError}
                              </p>
                            ) : (
                              <p className="mt-1 text-[11px] text-ink-muted">
                                {post.style || typeLabel(post.postType)}
                                {!groupByWeek && (
                                  <>
                                    <span className="px-1.5 text-line-strong">·</span>
                                    Week of {post.weekLabelShort}
                                  </>
                                )}
                                {post.postedToLinkedIn && (
                                  <>
                                    <span className="px-1.5 text-line-strong">·</span>
                                    <Linkedin className="mr-1 inline h-3 w-3 text-success" />
                                    Posted
                                  </>
                                )}
                              </p>
                            )}
                          </Link>

                          <Stepper state={post.state} className="mt-0.5" />

                          {!post.postedToLinkedIn && (
                            <button
                              onClick={(e) => handleDuplicate(post.id, e)}
                              title="Duplicate post"
                              aria-label="Duplicate post"
                              className="focus-ring mt-0.5 rounded p-1 text-ink-muted opacity-0 transition-opacity hover:text-accent group-hover:opacity-100"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="border-t border-line-strong pt-4 text-[11px] text-ink-muted">
        <span className="tabular">
          {posts.length} posts across {weeks.length} {weeks.length === 1 ? "week" : "weeks"}
        </span>
        <span className="px-2 text-line-strong">·</span>
        <span>Export includes every post, not the current view</span>
        <span className="px-2 text-line-strong">·</span>
        <span>Ready posts publish themselves at their scheduled time</span>
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────────── */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-5 rounded-panel border border-line bg-surface p-6 shadow-e3">
            <div className="flex items-start justify-between">
              <h3 className="font-display text-[17px] font-bold text-ink">
                Set time for {selectedCount} post{selectedCount !== 1 ? "s" : ""}
              </h3>
              <button
                onClick={() => setShowScheduleModal(false)}
                aria-label="Close"
                className="focus-ring rounded p-1 text-ink-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <label className="block">
              <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                Posting time
              </span>
              <input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="focus-ring h-10 w-full rounded-control border border-line bg-surface px-3 text-[13px] text-ink"
              />
            </label>
            <p className="text-[12px] leading-relaxed text-ink-muted">
              Each post keeps its existing date &mdash; only the time changes. Posts with no date
              are scheduled for tomorrow. All of them become Ready, which means the cron will
              publish them.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="focus-ring flex-1 rounded-control border border-line py-2.5 text-[13px] font-semibold text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkSchedule}
                className="focus-ring flex-1 rounded-control bg-accent py-2.5 text-[13px] font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
              >
                Apply time
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm space-y-5 rounded-panel border border-line bg-surface p-6 shadow-e3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-[17px] font-bold text-ink">
                  Delete {selectedCount} post{selectedCount !== 1 ? "s" : ""}?
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
                  This cannot be undone. Posts already published to LinkedIn are not affected.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                aria-label="Close"
                className="focus-ring flex-shrink-0 rounded p-1 text-ink-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="focus-ring flex-1 rounded-control border border-line py-2.5 text-[13px] font-semibold text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkDelete}
                className="focus-ring flex-1 rounded-control bg-danger py-2.5 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
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

/* ── Fore-edge ─────────────────────────────────────────────────────────────── */

function ForeEdge({
  weeks,
  linkable,
}: {
  weeks: { id: string; iso: string; label: string; theme: string | null; states: OverviewStatus[] }[];
  linkable: boolean;
}) {
  // Lane budget: h-[150px] − py-4 (32) − axis (16 + 8) − footer (16) = 78px.
  const PLOT = 78;
  const SLOT = 10;
  const MAX = Math.floor((PLOT - 14) / SLOT); // leave room for a +N token

  if (weeks.length === 0) {
    return (
      <div className="flex h-full items-center">
        <p className="text-[12px] text-ink-muted">
          Each weekly batch becomes a column here once you generate one.
        </p>
      </div>
    );
  }

  const cell = 100 / weeks.length;

  return (
    <Tooltip.Provider delayDuration={120}>
      <div className="flex h-full flex-col">
        <div className="relative flex-1">
          {weeks.map((w, i) => {
            const visible = w.states.slice(0, MAX);
            const hidden = w.states.length - visible.length;
            const isNewest = i === weeks.length - 1;
            const inner = (
              <>
                {hidden > 0 && (
                  <span className="tabular mb-0.5 block text-center text-[9.5px] font-semibold text-ink-muted">
                    +{hidden}
                  </span>
                )}
                <span className="flex flex-col-reverse items-center gap-1">
                  {visible.map((s, k) => (
                    <span
                      key={k}
                      className={cn("block h-1.5 w-[22px] rounded-full", STATE_DOT[s])}
                    />
                  ))}
                </span>
              </>
            );
            return (
              <Tooltip.Root key={w.id}>
                <Tooltip.Trigger asChild>
                  {linkable ? (
                    <a
                      href={`#week-${w.id}`}
                      className="focus-ring absolute bottom-0 flex -translate-x-1/2 flex-col items-center justify-end rounded"
                      style={{ left: `${(i + 0.5) * cell}%` }}
                    >
                      {inner}
                    </a>
                  ) : (
                    <span
                      className="absolute bottom-0 flex -translate-x-1/2 flex-col items-center justify-end"
                      style={{ left: `${(i + 0.5) * cell}%` }}
                    >
                      {inner}
                    </span>
                  )}
                </Tooltip.Trigger>
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="top"
                    sideOffset={6}
                    className="z-50 max-w-xs rounded-control border border-line bg-surface px-3 py-2 shadow-e3"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                      Week of {w.label}
                      {isNewest && <span className="ml-1 text-accent">· current</span>}
                    </p>
                    {w.theme && (
                      <p className="mt-1 text-[12.5px] leading-snug text-ink">{w.theme}</p>
                    )}
                    <p className="tabular mt-1 text-[11px] text-ink-muted">
                      {w.states.length} posts
                    </p>
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[9.5px] text-ink-muted">
          <span>Oldest week held</span>
          <span className="font-semibold text-accent">Current week</span>
        </div>
      </div>
    </Tooltip.Provider>
  );
}
