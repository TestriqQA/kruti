"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
} from "lucide-react";
import { cn, formatDate, getPostTypeColor } from "@/lib/utils";

interface Post {
  id: string;
  title: string;
  postType: string;
  style?: string | null;
  scheduledAt: Date | null;
  status: string;
  weekNumber: number;
  postedToLinkedIn: boolean;
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
}

export default function DashboardClient({ user, recentPlan, stats, upcomingPosts, batchDates, postsRemaining, postsLimit, isTrialExpired, postsPerBatch, cycleResetDate }: Props) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);
  // Avoid SSR/client hydration mismatch for time-of-day-dependent UI: render a
  // stable value on the server + first client render, then the real one after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const abortControllerRef = useRef<AbortController | null>(null);
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
      handleGenerate(false); // first time — nothing to confirm, build a strategy
    }
  }

  function confirmStrategy(reuse: boolean) {
    setShowStrategyConfirm(false);
    handleGenerate(reuse);
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

  async function handleGenerate(reuse: boolean) {
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setGenerating(true);
    setProgress([]);
    setGenerationError(null);

    try {
      setProgress([
        reuse ? "Using your current content strategy..." : "Building a fresh content strategy...",
      ]);

      // reuseStrategy: true keeps the current strategy (unless it's 30+ days old);
      // false regenerates it. weekStart is auto-computed by the API.
      const stratRes = await fetch("/api/generate/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reuseStrategy: reuse }),
        signal: abortController.signal,
      });
      if (!stratRes.ok) {
        const errData = await stratRes.json().catch(() => null);
        throw new Error(errData?.error || "Strategy generation failed. Please try again.");
      }
      const { plan: newPlan, strategy, reused } = await stratRes.json();

      setProgress((p) => [
        ...p,
        `${reused ? "Using your strategy" : "New strategy ready"}: "${strategy.weekTheme ?? "Content theme"}"`,
      ]);

      setProgress((p) => [...p, `Generating ${postsPerBatch} posts for your scheduled days...`]);
      const postsRes = await fetch("/api/generate/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: newPlan.id }),
        signal: abortController.signal,
      });

      if (!postsRes.ok) {
        const errorData = await postsRes.json().catch(() => null);
        if (postsRes.status === 429 && errorData?.error) {
          setProgress((p) => [...p, errorData.error]);
          return;
        }
        throw new Error("Posts generation failed");
      }

      const { posts, postsRemaining: remaining } = await postsRes.json();

      setProgress((p) => [
        ...p,
        `${posts?.length ?? 5} draft posts created (${remaining} remaining this cycle)`,
        "Done! Redirecting to your posts...",
      ]);

      setTimeout(() => router.push("/posts"), 1500);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        setProgress((p) => [...p, "Generation cancelled."]);
        setGenerationError(null);
      } else {
        console.error(err);
        const message = err instanceof Error ? err.message : "Something went wrong";
        setGenerationError(message);
        setProgress((p) => [...p, `Error: ${message}`]);
      }
    } finally {
      abortControllerRef.current = null;
      setTimeout(() => {
        setGenerating(false);
        router.refresh();
      }, 2000);
    }
  }

  function handleCancelGeneration() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }

  const statCards = [
    { label: "Total Posts", value: stats.totalPosts, icon: FileText, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30" },
    { label: "Ready to Post", value: stats.readyPosts, icon: CheckCircle, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/30" },
    { label: "Published", value: stats.publishedPosts, icon: Linkedin, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30" },
    { label: "Drafts", value: stats.draftPosts, icon: AlertCircle, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/30" },
  ];

  const profileIncomplete = !user?.headline || !user?.industry;

  return (
    <div className="space-y-8">
      {/* Profile tip */}
      {profileIncomplete && (
        <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Update your professional headline, industry, and skills in{" "}
            <Link href="/settings" className="font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200">
              Settings
            </Link>{" "}
            before generating content for better, more personalized results.
          </p>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-gray-100">
            Good {mounted ? getTimeOfDay() : "day"}, {user?.name?.split(" ")[0] ?? "there"}!
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            {user?.headline ?? "Ready to build your LinkedIn presence?"}
          </p>
        </div>

        {/* Generate Button */}
        <div className="flex flex-col items-end gap-2">
          {isTrialExpired ? (
            <Link
              href="/subscribe"
              className="flex items-center gap-2 bg-slate-300 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 px-5 py-2.5 rounded-xl font-medium hover:bg-slate-400 dark:hover:bg-white/[0.08] transition-colors"
            >
              <Lock className="w-4 h-4" />
              Subscribe to Generate Posts
            </Link>
          ) : (
          <button
            onClick={onGenerateClick}
            disabled={generating || limitReached}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-70 shadow-md shadow-blue-200 dark:shadow-blue-900/30"
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
              <p className="text-xs text-red-500 dark:text-red-400">
                {postsRemaining} of {postsLimit} posts remaining this cycle
              </p>
              {cycleResetDate && (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Resets {formatShortDate(new Date(cycleResetDate))}
                </p>
              )}
            </div>
          ) : (
            <div className="text-right">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {batchStart && batchEnd
                  ? `${formatShortDate(batchStart)} - ${formatShortDate(batchEnd)}`
                  : "No posting days selected"}
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500">
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
      <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl px-4 py-3">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium mb-1">How it works</p>
          <p>
            Your posts are created as drafts. For each post: review and edit the content, generate or upload an image, then mark as <span className="font-semibold">Ready to Publish</span>. Posts marked ready will auto-publish at their scheduled time.
          </p>
        </div>
      </div>

      {/* Generation Progress */}
      {generating && progress.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
            <h3 className="font-semibold text-blue-600 dark:text-blue-400 flex-1">
              Generating your next {postsPerBatch} posts...
            </h3>
            <button
              onClick={handleCancelGeneration}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Cancel
            </button>
          </div>
          <div className="space-y-2">
            {progress.map((msg, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                {msg}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generation Error with Retry */}
      {generationError && !generating && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-red-800 dark:text-red-300 text-sm">Generation failed</h3>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{generationError}</p>
            </div>
            <button
              onClick={onGenerateClick}
              className="flex items-center gap-1.5 text-sm px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium flex-shrink-0"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-white/[0.03] rounded-2xl p-5 border border-slate-100 dark:border-white/10 shadow-sm">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-3", stat.bg)}>
              <stat.icon className={cn("w-5 h-5", stat.color)} />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-gray-100">{stat.value}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming / Recent Posts */}
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-white/10">
            <h2 className="font-semibold text-slate-900 dark:text-gray-100 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              {mounted && upcomingPosts.length > 0 && upcomingPosts[0].scheduledAt && new Date(upcomingPosts[0].scheduledAt) > new Date()
                ? "Upcoming Posts"
                : "Recent Posts"}
            </h2>
            <Link href="/posts" className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="p-2">
            {upcomingPosts.length === 0 ? (
              <div className="py-8 text-center text-slate-500 dark:text-slate-400 text-sm">
                {recentPlan
                  ? "No upcoming posts. Generate your next batch of content!"
                  : "Generate your first batch of posts to get started."}
              </div>
            ) : (
              upcomingPosts.map((post) => (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className="flex items-start gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-gray-100 truncate">{post.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border", getPostTypeColor(post.postType))}>
                        {post.style || post.postType}
                      </span>
                      {post.scheduledAt && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(post.scheduledAt)}</span>
                      )}
                      {post.postedToLinkedIn && (
                        <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full">
                          Posted
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0 mt-1" />
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Content Strategy */}
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-white/10">
            <h2 className="font-semibold text-slate-900 dark:text-gray-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              Current Strategy
            </h2>
            {recentPlan && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
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
                <p className="text-sm text-slate-500 dark:text-slate-400">
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
            className="flex items-center gap-3 p-4 rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm bg-white dark:bg-white/[0.03] hover:shadow-md transition-shadow"
          >
            <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", a.color)}>
              <a.icon className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium text-slate-900 dark:text-gray-100 hidden sm:block">{a.label}</span>
            <ArrowRight className="w-4 h-4 text-slate-400 ml-auto" />
          </Link>
        ))}
      </div>

      {/* Strategy confirmation dialog — shown when a strategy already exists */}
      {showStrategyConfirm && recentPlan && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={() => setShowStrategyConfirm(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#0D131F]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
              Are you satisfied with the current strategy?
            </h2>
            {strategyTheme && (
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                Current strategy:{" "}
                <span className="font-medium text-slate-700 dark:text-slate-300">{strategyTheme}</span>
              </p>
            )}
            {Math.floor((Date.now() - new Date(recentPlan.weekStart).getTime()) / 86400000) >= 30 ? (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                Your strategy is over a month old — we recommend refreshing it.
              </p>
            ) : (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Keep it to generate more posts from the same plan, or change it for a fresh direction.
              </p>
            )}
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <button
                onClick={() => confirmStrategy(true)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                <CheckCircle className="h-4 w-4" /> Yes, generate posts
              </button>
              <button
                onClick={() => confirmStrategy(false)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.1]"
              >
                <RefreshCw className="h-4 w-4" /> No, change strategy
              </button>
            </div>
            <button
              onClick={() => setShowStrategyConfirm(false)}
              className="mt-3 w-full text-center text-xs text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
        </div>
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
    <div className="rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.04] px-3 py-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Your content setup</p>
        <Link href="/settings" className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Edit</Link>
      </div>
      {positioning && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
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
          <div className="bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg">
            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">{parsed.weekTheme}</p>
            {parsed.weekFocus && (
              <p className="text-xs text-blue-600 dark:text-blue-300 mt-0.5">{parsed.weekFocus}</p>
            )}
          </div>
        )}

        {/* Voice & tone actually steering the writing this cycle */}
        {toneLine && (
          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-0.5">Voice &amp; tone</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{toneLine}</p>
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
                  <span className="text-xs text-slate-500 dark:text-slate-400">{p.percentage}%</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 hover:bg-blue-700 rounded-full"
                    style={{ width: `${p.percentage}%` }}
                  />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{p.description}</p>
              </div>
            ))}
          </div>
        )}

        {parsed.weeklyGoal && (
          <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.06] px-3 py-2 rounded-lg mt-2">
            Goal: {parsed.weeklyGoal}
          </p>
        )}
        {parsed.callToAction && (
          <p className="text-xs text-slate-500 dark:text-slate-400 px-3">
            <span className="font-medium text-slate-600 dark:text-slate-300">CTA:</span> {parsed.callToAction}
          </p>
        )}
      </div>
    );
  } catch {
    return <p className="text-sm text-slate-500 dark:text-slate-400">Strategy data unavailable.</p>;
  }
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}
