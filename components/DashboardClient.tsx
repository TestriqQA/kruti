"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useGeneration } from "@/components/GenerationProvider";
import StrategyConfirmDialog from "@/components/StrategyConfirmDialog";
import {
  Sparkles, FileText, TrendingUp, Clock, CheckCircle, AlertCircle, ArrowRight,
  Loader2, BarChart3, Info, Lock, RefreshCw, XCircle, ListChecks, Calendar as CalIcon,
  Target, ChevronRight, X, Pencil,
} from "lucide-react";
import { cn, safeJsonParse } from "@/lib/utils";
import PostImage from "@/components/PostImage";
import type { ProfileGap } from "@/lib/profile-completeness";
import { StatCard, Pill, StatusBadge, MixBar, PillarRow } from "@/components/dashboard/bits";

interface Post {
  id: string;
  title: string;
  postType: string;
  style?: string | null;
  scheduledAt: Date | null;
  status: string;
  weekNumber: number;
  postedToLinkedIn: boolean;
  imageUrl?: string | null;
}

interface Props {
  user: { name?: string | null; headline?: string | null; industry?: string | null; image?: string | null; positioning?: string | null; contentStyles?: string | null } | null;
  recentPlan: { id: string; strategy: string; weekStart: Date } | null;
  stats: { totalPosts: number; readyPosts: number; draftPosts: number; publishedPosts: number; newsletters: number };
  trends: { total: number[]; ready: number[]; published: number[]; draft: number[] };
  skills: string[];
  upcomingPosts: Post[];
  batchDates: string[];
  postsRemaining: number;
  postsLimit: number;
  isTrialExpired: boolean;
  postsPerBatch: number;
  cycleResetDate: string | null;
  /** Profile fields still missing; non-empty means generation is blocked. */
  profileGaps: ProfileGap[];
}

interface Pillar {
  name?: string;
  description?: string;
  percentage?: number;
}

const NOTICE_KEY = "dashboardNoticeDismissed";

function timeOfDay() {
  const h = new Date().getHours();
  return h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
}

const shortDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function DashboardClient({
  user, recentPlan, stats, trends, skills, upcomingPosts, batchDates,
  postsRemaining, postsLimit, isTrialExpired, postsPerBatch, cycleResetDate, profileGaps,
}: Props) {
  // The run itself lives in GenerationProvider, above every page, so navigating
  // away doesn't kill it. This component only reads and controls it.
  const {
    generating, progress, error: generationError,
    startGeneration, cancelGeneration, postPipeline, showPipeline,
  } = useGeneration();

  // Time-of-day would mismatch between the server and the first client render.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [showStrategyConfirm, setShowStrategyConfirm] = useState(false);

  const [noticeOpen, setNoticeOpen] = useState(false);
  useEffect(() => {
    try {
      setNoticeOpen(localStorage.getItem(NOTICE_KEY) !== "1");
    } catch {
      setNoticeOpen(true);
    }
  }, []);
  function dismissNotice() {
    try {
      localStorage.setItem(NOTICE_KEY, "1");
    } catch {
      /* storage blocked - it just won't persist */
    }
    setNoticeOpen(false);
  }

  const limitReached = postsRemaining < postsPerBatch;
  const blocked = profileGaps.length > 0;

  const strategy = recentPlan
    ? safeJsonParse<{
        weekTheme?: string;
        weekFocus?: string;
        // Written by the model as an object, not a string.
        tone?: string | { voice?: string; style?: string; avoid?: string };
        pillars?: Pillar[];
        postMix?: Record<string, number>;
      }>(recentPlan.strategy, {})
    : null;

  const pillars = (strategy?.pillars ?? [])
    .map((p) => ({ name: p?.name ?? "", pct: typeof p?.percentage === "number" ? p.percentage : 0 }))
    .filter((p) => p.name);

  // tone arrives as { voice, style, avoid } on current plans and as a plain
  // string on older ones. Both have to render.
  const tone = (() => {
    const t = strategy?.tone;
    if (!t) return [] as { label: string; value: string }[];
    if (typeof t === "string") return [{ label: "Voice", value: t }];
    return (["voice", "style", "avoid"] as const)
      .map((k) => ({ label: k, value: typeof t[k] === "string" ? (t[k] as string) : "" }))
      .filter((x) => x.value);
  })();

  const mix = Object.entries(strategy?.postMix ?? {})
    .map(([label, pct]) => ({ label, pct: typeof pct === "number" ? pct : 0 }))
    .filter((p) => p.pct > 0)
    .sort((a, b) => b.pct - a.pct);

  function onGenerateClick() {
    if (limitReached) return;
    if (recentPlan) setShowStrategyConfirm(true);
    else startGeneration(false);
  }

  const batchStart = batchDates.length > 0 ? new Date(batchDates[0]) : null;
  const batchEnd = batchDates.length > 0 ? new Date(batchDates[batchDates.length - 1]) : null;

  const statusOf = (p: Post): "scheduled" | "draft" | "published" =>
    p.postedToLinkedIn || p.status === "published"
      ? "published"
      : p.status === "ready"
        ? "scheduled"
        : "draft";

  return (
    <div className="space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-5 pt-1">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 font-display text-[34px] font-bold leading-[1.1] tracking-[-0.03em] text-text">
            Good {mounted ? timeOfDay() : "day"}, {user?.name?.split(" ")[0] ?? "there"}
            <span aria-hidden="true">&#128075;</span>
          </h1>

          {/* Positioning plus the skills the model actually writes from, as
              chips. These are real profile fields, not decoration. */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {user?.positioning && (
              <span className="text-[13.5px] font-semibold text-text-2">{user.positioning}</span>
            )}
            {skills.map((s) => (
              <span
                key={s}
                className="rounded-full border border-edge bg-card px-3 py-1 text-[12.5px] font-medium text-text-2"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {isTrialExpired ? (
            <Link
              href="/subscribe"
              className="ring-focus flex h-12 items-center gap-2.5 rounded-control bg-gradient-to-r from-violet to-brand px-6 text-[14.5px] font-semibold text-white shadow-[0_8px_24px_-8px_rgb(var(--brand)/0.7)] transition-all hover:brightness-110"
            >
              <Lock className="h-4 w-4" />
              Subscribe to Generate
            </Link>
          ) : (
            <button
              onClick={onGenerateClick}
              disabled={generating || limitReached}
              className="ring-focus group flex h-12 items-center gap-2.5 rounded-control bg-gradient-to-r from-violet to-brand px-6 text-[14.5px] font-semibold text-white shadow-[0_8px_24px_-8px_rgb(var(--brand)/0.7)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {limitReached ? "Post Limit Reached" : `Generate Next ${postsPerBatch} Posts`}
              {!generating && !limitReached && (
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              )}
            </button>
          )}

          <p className="nums flex items-center gap-1.5 text-[12.5px] text-text-2">
            <CalIcon className="h-3.5 w-3.5 text-text-3" />
            {batchStart && batchEnd
              ? `${shortDate(batchStart)} – ${shortDate(batchEnd)}`
              : "No posting days selected"}
            <span className="text-text-3">&bull;</span>
            {postsRemaining === Infinity
              ? "Unlimited posts remaining"
              : `${postsRemaining} of ${postsLimit} remaining`}
          </p>
        </div>
      </div>

      {/* ── Profile gate ────────────────────────────────────────────────── */}
      {blocked && (
        <div className="card border-l-[3px] border-warn p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warn" />
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-semibold text-text">
                Finish your profile to start generating
              </p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-text-2">
                Your posts are written from your profile. Without these, every post reads like it
                could have been written for anybody.
              </p>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {profileGaps.map((g) => (
                  <li key={g.key} className="flex items-start gap-2 text-[12.5px] text-text-2">
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-warn" />
                    <span>
                      <span className="font-semibold text-text">{g.label}:</span> {g.hint}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Link
                  href="/onboarding"
                  className="ring-focus inline-flex h-9 items-center gap-1.5 rounded-control bg-brand px-4 text-[13px] font-semibold text-white hover:bg-brand-hover"
                >
                  Finish setup
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link href="/settings" className="text-[12.5px] font-semibold text-text-2 underline underline-offset-2 hover:text-text">
                  Or edit in Settings
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Dismissible notice ──────────────────────────────────────────── */}
      {noticeOpen && (
        <div className="flex items-start gap-3 rounded-control bg-brand-tint px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" />
          <p className="flex-1 text-[13px] leading-relaxed text-text-2">
            Posts arrive as drafts. Review each one, add an image, then mark it{" "}
            <span className="font-semibold text-text">Ready to Publish</span> &mdash; anything marked
            ready publishes itself at its scheduled time.
          </p>
          <button
            onClick={dismissNotice}
            aria-label="Dismiss"
            className="ring-focus -m-1 rounded p-1 text-text-3 transition-colors hover:text-text"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Generation progress ─────────────────────────────────────────── */}
      {generating && progress.length > 0 && (
        <div className="card p-5">
          <div className="mb-3 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
            <h3 className="flex-1 text-[14.5px] font-semibold text-text">
              Generating your next {postsPerBatch} posts…
            </h3>
            {postPipeline && (
              <button
                onClick={() => showPipeline("posts")}
                className="ring-focus flex h-8 items-center gap-1.5 rounded-control border border-edge px-3 text-[12.5px] font-semibold text-text-2 hover:bg-card-muted"
              >
                <ListChecks className="h-3.5 w-3.5" />
                View pipeline
              </button>
            )}
            <button
              onClick={cancelGeneration}
              className="ring-focus flex h-8 items-center gap-1.5 rounded-control px-3 text-[12.5px] font-semibold text-bad hover:bg-bad-tint"
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancel
            </button>
          </div>
          <div className="space-y-1.5">
            {progress.map((msg, i) => (
              <div key={i} className="flex items-center gap-2 text-[12.5px] text-text-2">
                <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-ok" />
                {msg}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Generation error ────────────────────────────────────────────── */}
      {generationError && !generating && (
        <div className="card border-l-[3px] border-bad p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-bad" />
            <div className="min-w-0 flex-1">
              <h3 className="text-[14px] font-semibold text-text">Generation failed</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-text-2">{generationError}</p>
            </div>
            <button
              onClick={onGenerateClick}
              className="ring-focus flex h-9 flex-shrink-0 items-center gap-1.5 rounded-control bg-bad px-4 text-[13px] font-semibold text-white hover:opacity-90"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total posts" value={stats.totalPosts} icon={FileText} tone="brand" data={trends.total} href="/posts" />
        <StatCard label="Ready to post" value={stats.readyPosts} icon={CheckCircle} tone="ok" data={trends.ready} href="/posts" />
        <StatCard label="Published" value={stats.publishedPosts} icon={BarChart3} tone="violet" data={trends.published} href="/posts" />
        <StatCard label="Drafts" value={stats.draftPosts} icon={Clock} tone="warn" data={trends.draft} href="/posts" />
      </div>

      {/* ── Two columns ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
        {/* Upcoming posts, on a timeline rail */}
        <div className="card">
          <div className="flex items-start justify-between gap-3 px-6 pb-4 pt-5">
            <div>
              <h2 className="flex items-center gap-2 font-display text-[17px] font-bold tracking-[-0.02em] text-text">
                <Clock className="h-4 w-4 text-brand" />
                Upcoming Posts
              </h2>
              <p className="mt-1 text-[12.5px] text-text-2">
                Your scheduled content for the next 10 days.
              </p>
            </div>
            <Link href="/posts" className="flex flex-shrink-0 items-center gap-1 text-[13px] font-semibold text-brand hover:underline">
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="px-6 pb-5">
            {upcomingPosts.length === 0 ? (
              <p className="py-10 text-center text-[13.5px] text-text-2">
                {recentPlan
                  ? "No upcoming posts. Generate your next batch to fill the schedule."
                  : "Generate your first batch of posts to get started."}
              </p>
            ) : (
              <ol className="relative">
                {/* The rail. One continuous line behind the markers rather than
                    a border per row, so the list reads as a sequence in time. */}
                <span
                  aria-hidden="true"
                  className="absolute bottom-6 left-[5px] top-6 w-px bg-edge"
                />
                {upcomingPosts.map((post) => {
                  const kind = statusOf(post);
                  const when = post.scheduledAt ? new Date(post.scheduledAt) : null;
                  return (
                    <li key={post.id} className="relative flex gap-4 py-3 pl-6">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "absolute left-0 top-[26px] h-[11px] w-[11px] rounded-full border-2 bg-card",
                          kind === "published"
                            ? "border-ok"
                            : kind === "scheduled"
                              ? "border-brand"
                              : "border-violet"
                        )}
                      />
                      <Link href={`/posts/${post.id}`} className="ring-focus flex min-w-0 flex-1 items-center gap-4 rounded-control">
                        {post.imageUrl ? (
                          <PostImage
                            src={post.imageUrl}
                            className="h-[52px] w-[52px] flex-shrink-0 rounded-control object-cover"
                            iconClassName="h-4 w-4"
                          />
                        ) : (
                          <span className="flex h-[52px] w-[52px] flex-shrink-0 items-center justify-center rounded-control bg-card-muted">
                            <FileText className="h-4 w-4 text-text-3" />
                          </span>
                        )}

                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold text-text">
                            {post.title}
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            {post.style && <Pill>{post.style}</Pill>}
                          </span>
                          <span className="nums mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-text-2">
                            {when && (
                              <span className="flex items-center gap-1">
                                <CalIcon className="h-3 w-3 text-text-3" />
                                {when.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            )}
                            {when && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-text-3" />
                                {when.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
                              </span>
                            )}
                          </span>
                        </span>

                        <StatusBadge kind={kind} />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>

        {/* Current strategy */}
        <div className="card">
          <div className="flex items-center justify-between gap-3 px-6 pb-4 pt-5">
            <h2 className="flex items-center gap-2 font-display text-[17px] font-bold tracking-[-0.02em] text-text">
              <TrendingUp className="h-4 w-4 text-brand" />
              Current Strategy
            </h2>
            {recentPlan && (
              <span className="nums flex-shrink-0 text-[12px] text-text-2">
                Starting {shortDate(new Date(recentPlan.weekStart))}
              </span>
            )}
          </div>

          {!strategy ? (
            <p className="px-6 pb-6 text-[13.5px] text-text-2">
              Your first generation builds a strategy from your profile.
            </p>
          ) : (
            <div className="space-y-5 px-6 pb-6">
              {/* Setup */}
              <div className="rounded-control bg-card-muted p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-text">Your content setup</p>
                    {user?.positioning && (
                      <p className="mt-0.5 text-[12.5px] text-text-2">
                        Positioning: {user.positioning}
                      </p>
                    )}
                  </div>
                  <Link href="/settings" className="flex flex-shrink-0 items-center gap-1 text-[12.5px] font-semibold text-brand hover:underline">
                    <Pencil className="h-3 w-3" />
                    Edit
                  </Link>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {safeJsonParse<string[]>(user?.contentStyles ?? null, []).map((s) => (
                    <Pill key={s}>{s}</Pill>
                  ))}
                </div>
              </div>

              {/* This week's theme */}
              {strategy.weekTheme && (
                <div className="flex items-start gap-3 rounded-control bg-brand-tint p-4">
                  <Target className="mt-0.5 h-4 w-4 flex-shrink-0 text-brand" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold leading-snug text-brand">
                      {strategy.weekTheme}
                    </p>
                    {strategy.weekFocus && (
                      <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-2">
                        {strategy.weekFocus}
                      </p>
                    )}
                  </div>
                  <Link
                    href="/posts"
                    aria-label="See posts from this strategy"
                    className="ring-focus flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-card text-brand shadow-lift"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              )}

              {tone.length > 0 && (
                <div>
                  <p className="text-[13px] font-semibold text-text">Voice &amp; tone</p>
                  <div className="mt-1.5 space-y-1.5">
                    {tone.map((t) => (
                      <p key={t.label} className="text-[12.5px] leading-relaxed text-text-2">
                        <span className="font-semibold capitalize text-text">{t.label}: </span>
                        {t.value}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {mix.length > 0 && (
                <div>
                  <p className="mb-2.5 text-[13px] font-semibold text-text">Post mix</p>
                  <MixBar parts={mix} />
                </div>
              )}

              {pillars.length > 0 && (
                <div>
                  <p className="mb-2.5 text-[13px] font-semibold text-text">Content pillars</p>
                  <div className="space-y-3">
                    {pillars.map((p) => (
                      <PillarRow key={p.name} name={p.name} pct={p.pct} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showStrategyConfirm && (
        <StrategyConfirmDialog
          strategyTheme={strategy?.weekTheme ?? null}
          weekStart={recentPlan?.weekStart ?? new Date()}
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
