"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  LayoutDashboard,
  FileText,
  Calendar,
  BarChart3,
  Mail,
  Settings,
  LifeBuoy,
  Sparkles,
  CornerDownLeft,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Global command palette, opened with Cmd/Ctrl+K.
 *
 * The product's problem was never that a page was missing - it was that
 * reaching a specific post meant going to /posts, scrolling, and reading
 * titles. Everything addressable is reachable from here in two keystrokes and
 * a few letters, which is the difference between a dashboard you navigate and
 * one you operate.
 *
 * Posts are fetched once per open, not on mount: this component is in the
 * layout, so fetching eagerly would add a request to every single page load
 * for a feature most visits never use.
 */

export const OPEN_PALETTE_EVENT = "kruti:open-palette";

type Command = {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  group: "Actions" | "Go to" | "Posts";
  run: () => void;
  /** Extra text matched against the query but not displayed. */
  keywords?: string;
};

type PostLite = { id: string; title: string; status: string; style?: string | null };

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [posts, setPosts] = useState<PostLite[] | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* ── Open / close ────────────────────────────────────────────────────── */

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") setOpen(false);
    }
    // Clicking the search box in the topbar opens the same palette. A real
    // event rather than a synthesised keystroke, so it cannot be confused with
    // the user actually pressing the shortcut.
    function onOpenRequest() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setCursor(0);
      return;
    }
    // Focus after paint, or the dialog steals it back on mount.
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Posts load on first open and are kept for the rest of the session.
  useEffect(() => {
    if (!open || posts !== null || loadingPosts) return;
    setLoadingPosts(true);
    fetch("/api/content")
      .then((r) => (r.ok ? r.json() : []))
      .then((plans: { posts?: PostLite[] }[]) => {
        const all = Array.isArray(plans) ? plans.flatMap((p) => p.posts ?? []) : [];
        setPosts(all);
      })
      .catch(() => setPosts([]))
      .finally(() => setLoadingPosts(false));
  }, [open, posts, loadingPosts]);

  const go = useCallback(
    (href: string) => () => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  /* ── Commands ────────────────────────────────────────────────────────── */

  const commands = useMemo<Command[]>(() => {
    const base: Command[] = [
      {
        id: "a-generate",
        label: "Generate this week's posts",
        hint: "Opens the overview",
        icon: Sparkles,
        group: "Actions",
        run: go("/dashboard"),
        keywords: "new write create batch",
      },
      {
        id: "a-ticket",
        label: "Contact support",
        icon: LifeBuoy,
        group: "Actions",
        run: go("/support"),
        keywords: "help ticket issue bug problem",
      },
      { id: "n-dash", label: "Overview", icon: LayoutDashboard, group: "Go to", run: go("/dashboard"), keywords: "home dashboard" },
      { id: "n-posts", label: "Posts", icon: FileText, group: "Go to", run: go("/posts"), keywords: "drafts content library" },
      { id: "n-cal", label: "Calendar", icon: Calendar, group: "Go to", run: go("/calendar"), keywords: "schedule when" },
      { id: "n-analytics", label: "Analytics", icon: BarChart3, group: "Go to", run: go("/analytics"), keywords: "stats performance" },
      { id: "n-news", label: "Newsletter", icon: Mail, group: "Go to", run: go("/newsletter"), keywords: "email" },
      { id: "n-settings", label: "Settings", icon: Settings, group: "Go to", run: go("/settings"), keywords: "profile schedule tone preferences" },
    ];

    const postCommands: Command[] = (posts ?? []).map((p) => ({
      id: `p-${p.id}`,
      label: p.title || "Untitled post",
      hint: p.status,
      icon: FileText,
      group: "Posts",
      run: go(`/posts/${p.id}`),
      keywords: `${p.style ?? ""} ${p.status}`,
    }));

    return [...base, ...postCommands];
  }, [posts, go]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Nothing typed: show every action and destination, plus a few posts, so
      // the palette is useful before the user knows what to search for.
      const base = commands.filter((c) => c.group !== "Posts");
      return [...base, ...commands.filter((c) => c.group === "Posts").slice(0, 5)];
    }
    return commands
      .filter((c) => `${c.label} ${c.keywords ?? ""}`.toLowerCase().includes(q))
      .slice(0, 24);
  }, [commands, query]);

  useEffect(() => setCursor(0), [query]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (results.length ? (c + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (results.length ? (c - 1 + results.length) % results.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      results[cursor]?.run();
    }
  }

  if (!open) return null;

  // Group headings are rendered inline, so the flat index stays correct for
  // keyboard navigation.
  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-[180] flex items-start justify-center bg-slate-950/40 px-4 pt-[12vh] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-panel border border-line bg-surface shadow-e3 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 flex-shrink-0 text-ink-subtle" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search posts, pages and actions..."
            className="h-12 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-subtle"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold text-ink-subtle">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-sm text-ink-subtle">
              {loadingPosts ? "Loading your posts..." : `Nothing matches "${query}"`}
            </p>
          )}

          {results.map((c, i) => {
            const showGroup = c.group !== lastGroup;
            lastGroup = c.group;
            const active = i === cursor;
            return (
              <div key={c.id}>
                {showGroup && (
                  <p className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-subtle">
                    {c.group}
                  </p>
                )}
                <button
                  data-index={i}
                  onMouseEnter={() => setCursor(i)}
                  onClick={c.run}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-control px-3 py-2 text-left transition-colors",
                    active ? "bg-accent-soft text-accent" : "text-ink hover:bg-surface-sunken"
                  )}
                >
                  <c.icon
                    className={cn(
                      "h-4 w-4 flex-shrink-0",
                      active ? "text-accent" : "text-ink-subtle"
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                    {c.label}
                  </span>
                  {c.hint && (
                    <span className="flex-shrink-0 text-[11px] capitalize text-ink-subtle">
                      {c.hint}
                    </span>
                  )}
                  {active && <CornerDownLeft className="h-3.5 w-3.5 flex-shrink-0 text-accent" />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
