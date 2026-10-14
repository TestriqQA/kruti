"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useGeneration } from "@/components/GenerationProvider";
import StrategyConfirmDialog from "@/components/StrategyConfirmDialog";
import { Sparkles, Loader2, Lock, XCircle, AlertTriangle, Target, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfileGap } from "@/lib/profile-completeness";
import type { Ask, ContinuityWeek, OverviewPost, Pillar, RunwayDay } from "@/lib/dashboard-overview";
import RhythmStrip from "@/components/dashboard/RhythmStrip";
import {
  AttentionList,
  OnDeck,
  QueueList,
  BriefBlock,
  ContinuityBars,
  Footnote,
} from "@/components/dashboard/ledger";

/**
 * The Overview.
 *
 * TWO LAWS. Both are design properties, not preferences, and a change that
 * breaks either has started turning this back into the admin template it
 * replaced:
 *
 *   LAW 1 - ONE BORDER. Exactly one bordered container exists on this page: the
 *   chassis below. Nothing inside it gets a border, a background or a radius
 *   above 3px. Everything under it is typeset on bare `bg-app` and structured
 *   by hairlines and whitespace. Six bordered rectangles stacked vertically is
 *   precisely what read as generic last time.
 *
 *   LAW 2 - NOTHING IS SHOWN THEN HIDDEN. No `truncate`, no `line-clamp` and no
 *   "+N more" on the user's headline, a post title, a profile-gap hint or an
 *   error message. The single clamp on this page is the two-line ON DECK
 *   excerpt, which is labelled as an excerpt and carries a link to the rest.
 */

interface Props {
  user: {
    name?: string | null;
    headline?: string | null;
    industry?: string | null;
    positioning?: string | null;
  };
  dateline: string;
  profileGaps: ProfileGap[];
  asks: Ask[];
  runway: { days: RunwayDay[]; ghostBeyond: string[] };
  queue: OverviewPost[];
  onDeck: { post: OverviewPost; excerpt: string; isUpcoming: boolean } | null;
  brief:
    | {
        weekStartLabel: string;
        weekStartIso: string;
        weekTheme: string | null;
        weekFocus: string | null;
        pillars: Pillar[];
      }
    | null;
  continuity: ContinuityWeek[];
  stats: { totalPosts: number; readyPosts: number; draftPosts: number; publishedPosts: number };
  quota: { remaining: number; limit: number; perBatch: number; resetIso: string | null };
  armed: { count: number; entitled: boolean };
  footnote: {
    newsletter: { title: string; dateLabel: string } | null;
    billing: string | null;
    postingTime: string;
  };
  hasPlan: boolean;
  isTrialExpired: boolean;
}

const QUEUE_ROWS = 6;

export default function DashboardClient({
  user,
  dateline,
  profileGaps,
  asks,
  runway,
  queue,
  onDeck,
  brief,
  continuity,
  stats,
  quota,
  armed,
  footnote,
  hasPlan,
  isTrialExpired,
}: Props) {
  const { generating, progress, error: generationError, startGeneration, cancelGeneration } =
    useGeneration();

  // Time-of-day greeting would mismatch between server and first client render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [showStrategyConfirm, setShowStrategyConfirm] = useState(false);
  const [ghost, setGhost] = useState(false);
  const [hoverId, setHoverId] = useState<string | null>(null);

  const unlimited = !Number.isFinite(quota.remaining);
  const used = unlimited ? 0 : Math.max(0, quota.limit - quota.remaining);
  const limitReached = !unlimited && quota.remaining < quota.perBatch;
  const blocked = profileGaps.length > 0;

  function onGenerateClick() {
    if (limitReached || blocked || isTrialExpired) return;
    if (hasPlan) setShowStrategyConfirm(true);
    else startGeneration(false);
  }

  const greeting = !mounted
    ? "Welcome back"
    : (() => {
        const h = new Date().getHours();
        return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
      })();
  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "there";

  const atRisk = queue.filter((p) => p.state === "failed" || p.state === "missed").length;
  const overdue = runway.days.length
    ? queue.filter(
        (p) => (p.state === "failed" || p.state === "missed") && p.dayKey < runway.days[0].key
      ).length
    : 0;

  const onDeckId = onDeck?.post.id;
  const queueRows = queue
    .filter((p) => p.id !== onDeckId && p.state !== "published")
    .sort((a, b) => {
      // Anything broken is pinned above the merely scheduled.
      const rank = (s: string) => (s === "failed" ? 0 : s === "missed" ? 1 : 2);
      return rank(a.state) - rank(b.state) || a.iso.localeCompare(b.iso);
    });

  const byline = [user?.positioning, user?.industry].filter(Boolean) as string[];

  /* ── Generate button caption: one line that explains every state ───────── */
  let caption: string;
  if (blocked) caption = "Generation is paused";
  else if (isTrialExpired) caption = "Your trial has ended";
  else if (limitReached)
    caption = quota.resetIso
      ? `Resets ${new Date(quota.resetIso).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      : "Resets soon";
  else if (generating) caption = progress.at(-1) ?? "Starting…";
  else if (unlimited) caption = "Unlimited on this account";
  else caption = `${quota.remaining} of ${quota.limit} left this cycle`;

  return (
    <div className="space-y-7">
      {/* ═══ CHASSIS — the page's only bordered container ═══════════════════ */}
      <section
        data-ghost={ghost ? "on" : "off"}
        className="group/chassis animate-rise-in divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface shadow-e1 motion-reduce:animate-none dark:shadow-none"
      >
        {/* (a) State band — one line, never a card */}
        {generationError && !generating && (
          <div className="flex items-start gap-3 border-l-[3px] border-danger bg-danger-soft px-7 py-2.5">
            <XCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-danger" />
            <span className="mt-[1px] flex-shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-danger">
              Generation failed
            </span>
            <span className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink-muted">
              {generationError}
            </span>
            <button
              onClick={onGenerateClick}
              className="flex-shrink-0 text-[12px] font-semibold text-danger hover:underline"
            >
              Retry
            </button>
          </div>
        )}
        {blocked && !generationError && (
          <div className="flex items-center gap-3 border-l-[3px] border-warning bg-warning-soft px-7 py-2.5">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-warning" />
            <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-warning">
              Generation paused
            </span>
            <span className="min-w-0 flex-1 text-[12.5px] text-ink-muted">
              {profileGaps.length} {profileGaps.length === 1 ? "input" : "inputs"} missing from your
              profile
            </span>
            <a
              href="#attention"
              className="flex-shrink-0 text-[12px] font-semibold text-warning hover:underline"
            >
              What&apos;s needed ↓
            </a>
          </div>
        )}

        {/* (b) Header */}
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto] gap-7 px-7 py-6">
          {/* A bezel behind the control column only — never a wash over the
              text column, which is half of why the old hero read as a template. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 w-2/5"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, rgb(var(--line) / 0.5) 0 1px, transparent 1px 28px)",
              maskImage: "linear-gradient(to left, #000, transparent)",
              WebkitMaskImage: "linear-gradient(to left, #000, transparent)",
            }}
          />

          <div className="relative min-w-0">
            <p className="tabular text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              {dateline}
            </p>

            {/* ONE line, ONE baseline, ONE size. The previous version stacked a
                13px greeting over a 32px name: two cap heights, two optical
                left edges and a dangling comma, which is what read as
                misaligned. Collapsing it removes the problem rather than
                nudging it. */}
            <h1 className="mt-2.5 font-display text-[34px] font-bold leading-[1.08] tracking-[-0.03em] [text-wrap:balance]">
              <span className="font-semibold text-ink-muted">{greeting}, </span>
              <span className="text-ink">{firstName}.</span>
            </h1>

            {/* Never truncated. This is the field every post is written from, so
                hiding half of it hides the thing the user most needs to check. */}
            {user?.headline && (
              <p className="mt-3 max-w-[62ch] text-[14.5px] leading-[1.55] text-ink-muted">
                {user.headline}
              </p>
            )}

            {byline.length > 0 && (
              <p className="mt-3.5 text-[12px] text-ink-muted">
                {byline.map((b, i) => (
                  <span key={b}>
                    {i > 0 && <span className="px-1.5 text-line-strong">·</span>}
                    {b}
                  </span>
                ))}
              </p>
            )}
          </div>

          {/* The generate button and one caption. Nothing else. `self-start` with
              a derived top padding, not `items-center`: centring would move the
              button every time the headline wrapped to another line. */}
          <div className="relative flex w-[220px] flex-shrink-0 flex-col items-stretch self-start pt-5">
            {generating ? (
              <div className="relative flex h-11 w-full items-center justify-center overflow-hidden rounded-control bg-accent-soft text-[14px] font-semibold text-accent">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
                <button
                  onClick={cancelGeneration}
                  aria-label="Cancel generation"
                  className="absolute right-0 top-0 flex h-full w-9 items-center justify-center border-l border-accent/25 text-accent hover:bg-accent/10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : blocked ? (
              <Link
                href="/onboarding"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-control bg-accent text-[14px] font-semibold text-accent-ink shadow-e1 hover:bg-accent-hover"
              >
                <Target className="h-4 w-4" />
                Finish your profile
              </Link>
            ) : isTrialExpired ? (
              <Link
                href="/subscribe"
                className="flex h-11 w-full items-center justify-center gap-2 rounded-control bg-accent text-[14px] font-semibold text-accent-ink shadow-e1 hover:bg-accent-hover"
              >
                Subscribe to generate
              </Link>
            ) : (
              <button
                onClick={onGenerateClick}
                onMouseEnter={() => setGhost(true)}
                onMouseLeave={() => setGhost(false)}
                onFocus={() => setGhost(true)}
                onBlur={() => setGhost(false)}
                disabled={limitReached}
                className="focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-control bg-accent text-[14px] font-semibold text-accent-ink shadow-e1 transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {limitReached ? <Lock className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                {limitReached ? "Cycle limit reached" : `Generate ${quota.perBatch} posts`}
              </button>
            )}
            <p
              className={cn(
                "tabular mt-2 text-right text-[11px]",
                blocked ? "text-warning" : "text-ink-muted"
              )}
            >
              {caption}
            </p>
          </div>
        </div>

        {/* (c) Instruments */}
        <div className="grid h-[150px] grid-cols-[164px_minmax(0,1fr)]">
          <div className="flex flex-col justify-center gap-2 px-5 py-4">
            <Gauge
              label="Quota"
              value={unlimited ? "∞" : String(used)}
              suffix={unlimited ? "no cap" : `/ ${quota.limit}`}
              pct={unlimited ? 100 : (used / quota.limit) * 100}
              tone={unlimited ? "success" : limitReached ? "danger" : "accent"}
              href="/posts"
            />
            <Gauge
              label="Drafts"
              value={String(stats.draftPosts)}
              suffix="waiting"
              pct={
                (stats.draftPosts /
                  Math.max(1, stats.draftPosts + stats.readyPosts + stats.publishedPosts)) *
                100
              }
              tone="warning"
              href="/posts?status=draft"
            />
            {/* Slot 3 is a REPLACEMENT, not an addition: an exception displaces a
                nominal reading the way an instrument behaves, and the gauge
                count never changes, so a failure cannot reflow the row. */}
            {atRisk > 0 ? (
              <Gauge
                label="At risk"
                value={String(atRisk)}
                suffix="need you"
                pct={100}
                tone="danger"
                href="#attention"
              />
            ) : (
              <Gauge
                label="Armed"
                value={armed.entitled && armed.count > 0 ? String(armed.count) : "—"}
                suffix={armed.entitled && armed.count > 0 ? "auto-publish" : "idle"}
                pct={armed.entitled && armed.count > 0 ? 100 : 0}
                tone="success"
                href="/posts?status=ready"
                title={
                  armed.count === 0
                    ? "Nothing is armed — mark a draft ready and the cron takes it from there."
                    : undefined
                }
              />
            )}
          </div>

          <div className="border-l border-line py-4 pl-6 pr-5">
            <RhythmStrip
              days={runway.days}
              ghostBeyond={runway.ghostBeyond}
              overdueCount={overdue}
              onHoverPost={setHoverId}
            />
          </div>
        </div>
      </section>

      {/* ═══ LEDGER — no borders, no fills, hairlines only ═══════════════════ */}
      <div
        className="grid animate-rise-in grid-cols-[minmax(0,1fr)_300px] motion-reduce:animate-none"
        style={{ animationDelay: "70ms" }}
      >
        <div className="min-w-0 space-y-7 pr-7">
          <AttentionList asks={asks} />
          {onDeck ? (
            <OnDeck post={onDeck.post} excerpt={onDeck.excerpt} isUpcoming={onDeck.isUpcoming} />
          ) : (
            stats.totalPosts === 0 && (
              <section>
                <p className="text-[15px] text-ink">Nothing filed yet.</p>
                <p className="mt-1.5 max-w-prose text-[13px] leading-relaxed text-ink-muted">
                  Your first run writes {quota.perBatch} posts against a brief built from your
                  profile, and lands them on the slots marked above.
                </p>
              </section>
            )
          )}
          <QueueList
            posts={queueRows.slice(0, QUEUE_ROWS)}
            total={queueRows.length}
            hoverId={hoverId}
          />
        </div>

        <aside className="space-y-7 border-l border-line-strong pl-7">
          <BriefBlock brief={brief} />
          <ContinuityBars weeks={continuity} />
        </aside>
      </div>

      <Footnote {...footnote} />

      {showStrategyConfirm && (
        <StrategyConfirmDialog
          strategyTheme={brief?.weekTheme ?? null}
          weekStart={brief?.weekStartIso ?? new Date().toISOString()}
          onConfirm={(reuse) => {
            setShowStrategyConfirm(false);
            startGeneration(reuse);
          }}
          onClose={() => setShowStrategyConfirm(false)}
        />
      )}
    </div>
  );
}

/* ── Gauge ─────────────────────────────────────────────────────────────────── */

function Gauge({
  label,
  value,
  suffix,
  pct,
  tone,
  href,
  title,
}: {
  label: string;
  value: string;
  suffix: string;
  pct: number;
  tone: "accent" | "warning" | "success" | "danger";
  href: string;
  title?: string;
}) {
  const fill = {
    accent: "bg-accent",
    warning: "bg-warning",
    success: "bg-success",
    danger: "bg-danger",
  }[tone];

  return (
    <Link href={href} title={title} className="focus-ring block rounded-[3px]">
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </p>
      <p className="mt-0.5 flex items-baseline gap-1">
        <span className="tabular font-display text-[17px] font-bold tracking-[-0.02em] text-ink">
          {value}
        </span>
        <span className="text-[12px] text-ink-muted">{suffix}</span>
      </p>
      <span className="mt-1.5 block h-[2px] w-full overflow-hidden bg-line-strong/50">
        <span
          className={cn("block h-full transition-[width] duration-500", fill)}
          style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
        />
      </span>
    </Link>
  );
}
