"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useGeneration } from "@/components/GenerationProvider";
import StrategyConfirmDialog from "@/components/StrategyConfirmDialog";
import {
  Sparkles,
  Calendar,
  FileText,
  Mail,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Loader2,
  Linkedin,
  Info,
  Lock,
  RefreshCw,
  XCircle,
  ListChecks,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import PostImage from "@/components/PostImage";
import type { ProfileGap } from "@/lib/profile-completeness";

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
  upcomingPosts: Post[];
  batchDates: string[]; // ISO dates the next batch will be scheduled on (server-computed)
  postsRemaining: number; // posts remaining in billing cycle
  postsLimit: number; // total posts allowed per cycle (30)
  isTrialExpired: boolean; // whether user's trial has ended
  postsPerBatch: number; // posts per generation (fixed POSTS_PER_BATCH, not schedule-derived)
  cycleResetDate: string | null; // ISO date when post counter resets
  /** Profile fields still missing; non-empty means generation is blocked. */
  profileGaps: ProfileGap[];
}

export default function DashboardClient({ user, recentPlan, stats, upcomingPosts, batchDates, postsRemaining, postsLimit, isTrialExpired, postsPerBatch, cycleResetDate, profileGaps }: Props) {
  // The run itself lives in GenerationProvider, above every page, so navigating
  // away doesn't kill it. This component only reads and controls it.
  const {
    generating,
    progress,
    error: generationError,
    startGeneration,
    cancelGeneration,
    postPipeline,
    showPipeline,
  } = useGeneration();
  // Avoid SSR/client hydration mismatch for time-of-day-dependent UI: render a
  // stable value on the server + first client render, then the real one after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [showStrategyConfirm, setShowStrategyConfirm] = useState(false);

  const limitReached = postsRemaining < postsPerBatch;

  // Current strategy's theme (for the confirm dialog). No Date here — keep render hydration-safe.
  const strategyTheme = recentPlan
    ? (() => {
        try {
          return (JSON.parse(recentPlan.strategy) as { weekTheme?: string }).weekTheme ?? null;
        } catch {
          return null;
        }
      })()
    : null;

  // On "Generate": if there's already a strategy, ask the user whether to keep or change it.
  function onGenerateClick() {
    if (limitReached) return;
    if (recentPlan) {
      setShowStrategyConfirm(true);
    } else {
      startGeneration(false); // first time — nothing to confirm, build a strategy
    }
  }

  function confirmStrategy(reuse: boolean) {
    setShowStrategyConfirm(false);
    startGeneration(reuse);
  }

  // The dates of the next batch, computed on the server with the same helper the
  // generator uses - so this range is exactly what will be created, including days
  // skipped because they already hold a post.
  const batchStart = batchDates.length > 0 ? new Date(batchDates[0]) : null;
  const batchEnd =
    batchDates.length > 0 ? new Date(batchDates[batchDates.length - 1]) : null;

  function formatShortDate(date: Date): string {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  const statCards = [
    { label: "Total posts", value: stats.totalPosts, icon: FileText, color: "text-text-3", href: "/posts" },
    { label: "Ready to post", value: stats.readyPosts, icon: CheckCircle, color: "text-ok", href: "/posts" },
    { label: "Published", value: stats.publishedPosts, icon: Linkedin, color: "text-brand", href: "/posts" },
    { label: "Drafts", value: stats.draftPosts, icon: AlertCircle, color: "text-warn", href: "/posts" },
  ];

  return (
    <div className="space-y-5">
      {/* ── Profile completeness ───────────────────────────────────────────
          This was a soft "tip" gated on `!headline || !industry`, which missed
          the fields that actually matter - summary, skills and target audience
          - and read as optional advice. It is now driven by the same
          assessProfile() the generation preflight refuses on, so what it lists
          is exactly what is blocking the Generate button, and it links to the
          guided wizard rather than the Settings form. */}
      {profileGaps.length > 0 && (
        <div className="bg-warn-tint border border-warn/30 rounded-control px-4 py-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warn flex-shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text">
                Finish your profile to start generating
              </p>
              <p className="text-sm text-text-2 mt-0.5">
                Your posts are written from your profile. Without these, every post reads like it
                could have been written for anybody - which is why we pause generation until they
                are filled in.
              </p>
              <ul className="mt-2.5 space-y-1">
                {profileGaps.map((g) => (
                  <li key={g.key} className="text-xs text-text-2">
                    <span className="font-semibold">{g.label}:</span> {g.hint}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex items-center gap-4 flex-wrap">
                <Link
                  href="/onboarding"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-brand hover:bg-brand-hover px-4 py-2 rounded-control transition-colors"
                >
                  Finish setup
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/settings"
                  className="text-xs font-medium text-text underline underline-offset-2 hover:text-amber-700 dark:hover:text-amber-100"
                >
                  Or edit in Settings
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 pt-1">
        <div>
          <h1 className="font-display text-[32px] font-bold leading-[1.1] tracking-[-0.03em] text-text">
            Good {mounted ? getTimeOfDay() : "day"}, {user?.name?.split(" ")[0] ?? "there"}
          </h1>
          <p className="mt-2 max-w-3xl text-[14.5px] leading-relaxed text-text-2">
            {user?.headline ?? "Ready to build your LinkedIn presence?"}
          </p>
        </div>

        {/* Generate Button */}
        <div className="flex flex-col items-end gap-2">
          {isTrialExpired ? (
            <Link
              href="/subscribe"
              className="ring-focus flex h-10 items-center gap-2 rounded-control border border-edge bg-card px-4 text-[13.5px] font-semibold text-text-2 transition-colors hover:bg-card-muted"
            >
              <Lock className="w-4 h-4" />
              Subscribe to Generate Posts
            </Link>
          ) : (
          <button
            onClick={onGenerateClick}
            disabled={generating || limitReached}
            className="ring-focus flex h-11 items-center gap-2 rounded-control bg-brand px-5 text-[14px] font-semibold text-white shadow-[0_6px_16px_-6px_rgb(var(--brand)/0.65)] transition-all hover:bg-brand-hover hover:shadow-[0_10px_22px_-8px_rgb(var(--brand)/0.75)] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
          >
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            {limitReached ? "Post Limit Reached" : `Generate Next ${postsPerBatch} Posts`}
          </button>
          )}
          {limitReached ? (
            <div className="text-right">
              <p className="nums text-[11.5px] font-medium text-bad">
                {postsRemaining} of {postsLimit} posts remaining this cycle
              </p>
              {cycleResetDate && (
                <p className="nums text-[11.5px] text-text-3">
                  Resets {formatShortDate(new Date(cycleResetDate))}
                </p>
              )}
            </div>
          ) : (
            <div className="text-right">
              <p className="nums text-[11.5px] font-medium text-text-2">
                {batchStart && batchEnd
                  ? `Lands ${formatShortDate(batchStart)} - ${formatShortDate(batchEnd)}`
                  : "No posting days selected"}
              </p>
              <p className="nums text-[11.5px] text-text-3">
                {postsRemaining === Infinity ? "Unlimited posts remaining" : `${postsRemaining} of ${postsLimit} posts remaining`}
                {cycleResetDate && postsRemaining !== Infinity && (
                  <> · resets {formatShortDate(new Date(cycleResetDate))}</>
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Workflow Notice */}
      <div className="flex items-start gap-2.5 rounded-control border border-edge bg-card-muted px-4 py-2.5">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-text-3" />
        <p className="text-[12.5px] leading-relaxed text-text-2">
          Posts arrive as drafts. Review each one, add an image, then mark it{" "}
          <span className="font-semibold text-text">Ready to Publish</span> &mdash; anything marked
          ready publishes itself at its scheduled time.
        </p>
      </div>

      {/* Generation Progress */}
      {generating && progress.length > 0 && (
        <div className="bg-brand-tint border border-brand-edge rounded-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="w-5 h-5 text-brand animate-spin" />
            <h3 className="font-semibold text-brand flex-1">
              Generating your next {postsPerBatch} posts...
            </h3>
            {postPipeline && (
              <button
                onClick={() => showPipeline("posts")}
                className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-brand-edge text-brand rounded-control hover:bg-blue-100/60 dark:hover:bg-blue-900/30 transition-colors"
              >
                <ListChecks className="w-4 h-4" />
                View pipeline
              </button>
            )}
            <button
              onClick={cancelGeneration}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-bad/30 text-bad rounded-control hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Cancel
            </button>
          </div>
          <div className="space-y-2">
            {progress.map((msg, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-brand">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                {msg}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generation Error with Retry */}
      {generationError && !generating && (
        <div className="bg-bad-tint border border-bad/30 rounded-card p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-bad flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-bad text-sm">Generation failed</h3>
              <p className="text-sm text-bad mt-1">{generationError}</p>
            </div>
            <button
              onClick={onGenerateClick}
              className="flex items-center gap-1.5 text-sm px-4 py-2 bg-bad hover:opacity-90 text-white rounded-control transition-colors font-medium flex-shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      {/* The number is the content, so it leads. The 40px tinted icon tile that
          used to sit above it was the largest element in each card and carried
          none of the information. */}
      {/* One surface, four readings, separated by light. Four bordered tiles
          with a tinted icon in each was the single busiest thing on the page. */}
      <div className="card grid grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => (
          <Link
            key={stat.label}
            href={stat.href}
            className={cn(
              "ring-focus group relative px-6 py-5 transition-colors first:rounded-l-card last:rounded-r-card hover:bg-card-muted",
              i > 0 && "lg:before:absolute lg:before:inset-y-5 lg:before:left-0 lg:before:w-px lg:before:bg-edge-soft"
            )}
          >
            <div className="flex items-center gap-2">
              <stat.icon className={cn("h-3.5 w-3.5", stat.color)} />
              <p className="eyebrow">{stat.label}</p>
            </div>
            <p className="nums mt-2.5 font-display text-[30px] font-bold leading-none tracking-[-0.03em] text-text">
              {stat.value}
            </p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Upcoming / Recent Posts */}
        <div className="card">
          <div className="card-head">
            <h2 className="card-title flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              {mounted && upcomingPosts.length > 0 && upcomingPosts[0].scheduledAt && new Date(upcomingPosts[0].scheduledAt) > new Date()
                ? "Upcoming Posts"
                : "Recent Posts"}
            </h2>
            <Link href="/posts" className="text-sm text-brand hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-2">
            {upcomingPosts.length === 0 ? (
              <div className="py-8 text-center text-text-2 text-sm">
                {recentPlan
                  ? "No upcoming posts. Generate your next batch of content!"
                  : "Generate your first batch of posts to get started."}
              </div>
            ) : (
              upcomingPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className="ring-focus group flex items-center gap-3.5 rounded-control p-3 transition-colors hover:bg-card-muted"
                >
                  {/* The artwork is the product. A list of its output with no
                      output in it is why this page felt like a spreadsheet. */}
                  {post.imageUrl ? (
                    <PostImage
                      src={post.imageUrl}
                      className="h-11 w-11 flex-shrink-0 rounded-control object-cover"
                      iconClassName="h-4 w-4"
                    />
                  ) : (
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-control bg-card-muted">
                      <FileText className="h-4 w-4 text-text-3" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-text">{post.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[11.5px] font-medium text-text-2">
                        {post.style || post.postType}
                      </span>
                      {post.scheduledAt && (
                        <>
                          <span className="text-text-3">&middot;</span>
                          <span className="nums text-[11.5px] text-text-3">{formatDate(post.scheduledAt)}</span>
                        </>
                      )}
                      {post.postedToLinkedIn && (
                        <span className="rounded-full bg-ok-tint px-2 py-0.5 text-[10.5px] font-semibold text-ok">
                          Posted
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 flex-shrink-0 text-text-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Content Strategy */}
        <div className="card">
          <div className="card-head">
            <h2 className="card-title flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              Current Strategy
            </h2>
            {recentPlan && (
              <span className="text-xs text-text-3">
                Starting{" "}
                {new Date(recentPlan.weekStart).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
          </div>
          <div className="p-5 space-y-4">
            {/* Your selected setup - always shown so the user can see their own positioning
                and content styles are captured and driving the plan. */}
            <UserContentSetup positioning={user?.positioning} contentStyles={user?.contentStyles} />
            {recentPlan ? (
              <StrategyPillars strategy={recentPlan.strategy} />
            ) : (
              <div className="py-8 text-center">
                <Sparkles className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-text-2">
                  Click &quot;Generate Next {postsPerBatch} Posts&quot; above to create your personalized strategy and content
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { href: "/calendar", icon: Calendar, label: "Content Calendar", color: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" },
          { href: "/newsletter", icon: Mail, label: "Newsletter Planner", color: "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400" },
          { href: "/settings", icon: FileText, label: "Update Profile", color: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400" },
        ].map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="flex items-center gap-3 p-4 rounded-card shadow-sm bg-white dark:bg-white/[0.03] hover:shadow-md transition-shadow"
          >
            <div className={cn("w-9 h-9 rounded-control flex items-center justify-center", a.color)}>
              <a.icon className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-text hidden sm:block">{a.label}</span>
            <ArrowRight className="w-4 h-4 text-slate-400 ml-auto" />
          </Link>
        ))}
      </div>

      {/* Strategy confirmation dialog — shown when a strategy already exists */}
      {showStrategyConfirm && recentPlan && (
        <StrategyConfirmDialog
          strategyTheme={strategyTheme}
          weekStart={recentPlan.weekStart}
          onConfirm={confirmStrategy}
          onClose={() => setShowStrategyConfirm(false)}
        />
      )}
    </div>
  );
}

// Turns an internal post-type key (e.g. "thought-leadership") into a readable label.
function humanPostType(type: string): string {
  return String(type)
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Shows the user their own selected positioning + content styles, so they can see
// their onboarding choices are captured and actually driving the plan.
function UserContentSetup({ positioning, contentStyles }: { positioning?: string | null; contentStyles?: string | null }) {
  let styles: string[] = [];
  try {
    const parsed = contentStyles ? JSON.parse(contentStyles) : [];
    if (Array.isArray(parsed)) styles = parsed.map(String);
  } catch {
    styles = [];
  }
  if (!positioning && styles.length === 0) return null;

  return (
    <div className="rounded-control border border-edge-soft bg-slate-50/60 dark:bg-white/[0.04] px-3 py-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Your content setup</p>
        <Link href="/settings" className="text-xs text-brand hover:underline">Edit</Link>
      </div>
      {positioning && (
        <p className="text-xs text-text-2 mt-1.5">
          Positioning: <span className="font-medium text-slate-700 dark:text-slate-300">{positioning}</span>
        </p>
      )}
      {styles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {styles.map((s) => (
            <span
              key={s}
              className="text-xs px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300 bg-indigo-50/60 dark:bg-indigo-500/10"
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function StrategyPillars({ strategy }: { strategy: string }) {
  try {
    const parsed = JSON.parse(strategy) as {
      pillars?: Array<{ name: string; description: string; percentage: number }>;
      weekTheme?: string;
      weekFocus?: string;
      weeklyGoal?: string;
      tone?: { voice?: string; style?: string; avoid?: string[] };
      postMix?: Record<string, number>;
      callToAction?: string;
      audience?: { primaryAudience?: string };
    };
    const pillars = parsed.pillars ?? [];
    const postMixEntries = parsed.postMix
      ? Object.entries(parsed.postMix).filter(([, v]) => typeof v === "number")
      : [];
    const toneLine = [parsed.tone?.voice, parsed.tone?.style].filter(Boolean).join(" — ");

    return (
      <div className="space-y-3">
        {parsed.weekTheme && (
          <div className="bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-control">
            <p className="text-xs font-semibold text-brand">{parsed.weekTheme}</p>
            {parsed.weekFocus && (
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">{parsed.weekFocus}</p>
            )}
          </div>
        )}

        {/* Voice & tone actually steering the writing this cycle */}
        {toneLine && (
          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-0.5">Voice &amp; tone</p>
            <p className="text-xs text-text-2">{toneLine}</p>
          </div>
        )}

        {/* Post mix - which content types this cycle leans on (from the user's styles) */}
        {postMixEntries.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Post mix</p>
            <div className="flex flex-wrap gap-1.5">
              {postMixEntries.map(([type, pct]) => (
                <span
                  key={type}
                  className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300"
                >
                  {humanPostType(type)} {pct}%
                </span>
              ))}
            </div>
          </div>
        )}

        {pillars.length > 0 && (
          <div className="space-y-3 pt-1">
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Content pillars</p>
            {pillars.map((p, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{p.name}</span>
                  <span className="text-xs text-text-2">{p.percentage}%</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 hover:bg-blue-700 rounded-full"
                    style={{ width: `${p.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-text-2 mt-1">{p.description}</p>
              </div>
            ))}
          </div>
        )}

        {parsed.weeklyGoal && (
          <p className="text-xs text-text-2 bg-slate-50 dark:bg-white/[0.06] px-3 py-2 rounded-control mt-2">
            Goal: {parsed.weeklyGoal}
          </p>
        )}
        {parsed.callToAction && (
          <p className="text-xs text-text-2 px-3">
            <span className="font-medium text-slate-600 dark:text-slate-300">CTA:</span> {parsed.callToAction}
          </p>
        )}
      </div>
    );
  } catch {
    return <p className="text-sm text-text-2">Strategy data unavailable.</p>;
  }
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
