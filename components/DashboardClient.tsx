"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useGeneration } from "@/components/GenerationProvider";
import StrategyConfirmDialog from "@/components/StrategyConfirmDialog";
import {
  Sparkles,
  Calendar,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
  Linkedin,
  Lock,
  RefreshCw,
  XCircle,
  PenLine,
  Send,
  ChevronRight,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProfileGap } from "@/lib/profile-completeness";
import {
  Panel,
  PanelHeader,
  Button,
  LinkButton,
  Pill,
  Meter,
  EmptyState,
  SectionLabel,
} from "@/components/ui/primitives";

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
  /** Profile fields still missing; non-empty means generation is blocked. */
  profileGaps: ProfileGap[];
}

const SHORT_DATE: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

export default function DashboardClient({
  user,
  recentPlan,
  stats,
  upcomingPosts,
  batchDates,
  postsRemaining,
  postsLimit,
  isTrialExpired,
  postsPerBatch,
  cycleResetDate,
  profileGaps,
}: Props) {
  // The run itself lives in GenerationProvider, above every page, so navigating
  // away doesn't kill it. This component only reads and controls it.
  const {
    generating,
    progress,
    error: generationError,
    startGeneration,
    cancelGeneration,
    showPipeline,
  } = useGeneration();

  // Avoid SSR/client hydration mismatch for time-of-day-dependent UI: render a
  // stable value on the server + first client render, then the real one after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [showStrategyConfirm, setShowStrategyConfirm] = useState(false);

  // Admin and lifetime-free accounts come through with Infinity remaining, so
  // every arithmetic display here has to survive a non-finite number - the
  // quota meter read "-Infinity / 30" until it did.
  const unlimited = !Number.isFinite(postsRemaining);
  const used = unlimited ? 0 : Math.max(0, postsLimit - postsRemaining);
  const limitReached = !unlimited && postsRemaining < postsPerBatch;
  const blocked = profileGaps.length > 0;

  const strategyTheme = recentPlan
    ? (() => {
        try {
          return (JSON.parse(recentPlan.strategy) as { weekTheme?: string }).weekTheme ?? null;
        } catch {
          return null;
        }
      })()
    : null;

  const strategy = recentPlan
    ? (() => {
        try {
          return JSON.parse(recentPlan.strategy) as {
            weekTheme?: string;
            weekFocus?: string;
            // Pillars come back from the model as objects, not strings -
            // { name, description, percentage }. Older plans may still hold
            // plain strings, so both shapes have to render.
            pillars?: (string | { name?: string; description?: string; percentage?: number })[];
            tone?: string;
          };
        } catch {
          return null;
        }
      })()
    : null;

  function onGenerateClick() {
    if (limitReached) return;
    if (recentPlan) setShowStrategyConfirm(true);
    else startGeneration(false); // first time - nothing to confirm
  }

  function confirmStrategy(reuse: boolean) {
    setShowStrategyConfirm(false);
    startGeneration(reuse);
  }

  const batchStart = batchDates.length > 0 ? new Date(batchDates[0]) : null;
  const batchEnd = batchDates.length > 0 ? new Date(batchDates[batchDates.length - 1]) : null;
  const fmt = (d: Date) => d.toLocaleDateString("en-US", SHORT_DATE);

  const greeting = !mounted
    ? "Welcome back"
    : (() => {
        const h = new Date().getHours();
        return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
      })();

  const firstName = user?.name?.trim().split(/\s+/)[0] ?? "there";

  /* ── Pipeline ──────────────────────────────────────────────────────────
     Draft -> Ready -> Published is the actual lifecycle in the data model, so
     the dashboard shows it as one object rather than four unrelated counters.
     Where the volume is sitting tells the user what to do next far faster than
     any of the numbers do on their own. */
  const pipeline = [
    { key: "draft", label: "Drafts", help: "Written, waiting for your review", value: stats.draftPosts, icon: PenLine, tone: "warning" as const, href: "/posts?status=draft" },
    { key: "ready", label: "Ready", help: "Queued for auto-publish", value: stats.readyPosts, icon: Clock, tone: "accent" as const, href: "/posts?status=ready" },
    { key: "published", label: "Published", help: "Live on LinkedIn", value: stats.publishedPosts, icon: Linkedin, tone: "success" as const, href: "/posts?status=published" },
  ];
  const pipelineTotal = Math.max(1, stats.draftPosts + stats.readyPosts + stats.publishedPosts);

  // The soonest post that has not gone out yet - the one thing on this page
  // with a deadline attached.
  const nextUp = upcomingPosts.find((p) => !p.postedToLinkedIn && p.scheduledAt) ?? null;

  /* ── The single next action ────────────────────────────────────────────
     Rather than showing five equal calls to action, the hero resolves to the
     one that is actually blocking progress right now. */
  const nextAction: { label: string; hint: string; href?: string; onClick?: () => void; icon: typeof Sparkles } =
    blocked
      ? { label: "Finish your profile", hint: "Generation is paused until this is done", href: "/onboarding", icon: Target }
      : stats.draftPosts > 0
        ? { label: `Review ${stats.draftPosts} draft${stats.draftPosts === 1 ? "" : "s"}`, hint: "Mark them ready and they publish on schedule", href: "/posts?status=draft", icon: PenLine }
        : { label: `Generate ${postsPerBatch} posts`, hint: batchStart && batchEnd ? `Lands ${fmt(batchStart)} - ${fmt(batchEnd)}` : "Build this week's batch", onClick: onGenerateClick, icon: Sparkles };

  return (
    <div className="space-y-6">
      {/* ── Profile completeness ─────────────────────────────────────────
          Driven by the same assessProfile() the generation preflight refuses
          on, so what it lists is exactly what is blocking the button. */}
      {blocked && (
        <Panel className="border-warning/30 bg-warning-soft animate-rise-in">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-semibold text-ink">
                Finish your profile to start generating
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                Your posts are written from your profile. Without these, every post reads like it
                could have been written for anybody &mdash; which is why generation is paused.
              </p>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {profileGaps.map((g) => (
                  <li key={g.key} className="flex items-start gap-1.5 text-xs text-ink-muted">
                    <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-warning" />
                    <span>
                      <span className="font-semibold text-ink">{g.label}:</span> {g.hint}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <LinkButton href="/onboarding" variant="primary" size="sm">
                  Finish setup
                  <ArrowRight className="h-3.5 w-3.5" />
                </LinkButton>
                <Link
                  href="/settings"
                  className="text-xs font-semibold text-ink-muted underline underline-offset-2 hover:text-ink"
                >
                  Or edit in Settings
                </Link>
              </div>
            </div>
          </div>
        </Panel>
      )}

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <Panel flush className="relative overflow-hidden animate-rise-in">
        <div className="grid-fade pointer-events-none absolute inset-0 opacity-70" aria-hidden="true" />
        <div className="relative flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-ink-subtle">{greeting},</p>
            <h1 className="mt-0.5 font-display text-[30px] font-bold leading-tight tracking-[-0.025em] text-ink">
              {firstName}
            </h1>
            {user?.headline && (
              <p className="mt-2 max-w-xl truncate text-sm text-ink-muted">{user.headline}</p>
            )}
          </div>

          <div className="flex flex-shrink-0 flex-col gap-3 lg:items-end">
            {/* Quota. Shown next to the button that spends it, not buried in a
                settings page the user never opens. */}
            <div className="w-full lg:w-64">
              <div className="flex items-baseline justify-between">
                <SectionLabel>Posts this cycle</SectionLabel>
                <p className="tabular text-xs font-semibold text-ink">
                  {unlimited ? (
                    "Unlimited"
                  ) : (
                    <>
                      {used}
                      <span className="text-ink-subtle"> / {postsLimit}</span>
                    </>
                  )}
                </p>
              </div>
              <Meter
                value={unlimited ? postsLimit : used}
                max={postsLimit}
                tone={unlimited ? "success" : limitReached ? "danger" : "accent"}
                className="mt-2"
              />
              <p className="mt-1.5 text-[11px] text-ink-subtle">
                {unlimited
                  ? "No cap on this account"
                  : cycleResetDate
                    ? `Resets ${fmt(new Date(cycleResetDate))}`
                    : `${postsRemaining} left`}
              </p>
            </div>

            {generating ? (
              <div className="flex items-center gap-2">
                <Button variant="soft" size="lg" onClick={() => showPipeline("posts")}>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating...
                </Button>
                <Button variant="ghost" size="lg" onClick={cancelGeneration}>
                  Cancel
                </Button>
              </div>
            ) : nextAction.href ? (
              <LinkButton href={nextAction.href} variant="primary" size="lg">
                <nextAction.icon className="h-4 w-4" />
                {nextAction.label}
              </LinkButton>
            ) : (
              <Button
                variant="primary"
                size="lg"
                onClick={nextAction.onClick}
                disabled={limitReached || isTrialExpired}
              >
                {limitReached ? <Lock className="h-4 w-4" /> : <nextAction.icon className="h-4 w-4" />}
                {limitReached ? "Monthly limit reached" : nextAction.label}
              </Button>
            )}
            <p className="text-[11px] text-ink-subtle lg:text-right">{nextAction.hint}</p>
          </div>
        </div>
      </Panel>

      {/* ── Generation error ─────────────────────────────────────────────── */}
      {generationError && !generating && (
        <Panel className="border-danger/30 bg-danger-soft">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Generation failed</p>
              <p className="mt-0.5 text-sm text-ink-muted">{generationError}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={onGenerateClick}>
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </Button>
          </div>
        </Panel>
      )}

      {/* ── Pipeline ─────────────────────────────────────────────────────── */}
      <Panel flush className="animate-rise-in" style={{ animationDelay: "60ms" }}>
        <div className="grid grid-cols-3 divide-x divide-line">
          {pipeline.map((stage) => (
            <Link
              key={stage.key}
              href={stage.href}
              className="group px-5 py-4 transition-colors hover:bg-surface-sunken focus-ring"
            >
              <div className="flex items-center gap-2">
                <stage.icon
                  className={cn(
                    "h-3.5 w-3.5",
                    stage.tone === "warning" && "text-warning",
                    stage.tone === "accent" && "text-accent",
                    stage.tone === "success" && "text-success"
                  )}
                />
                <SectionLabel>{stage.label}</SectionLabel>
                <ChevronRight className="ml-auto h-3.5 w-3.5 text-ink-subtle opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <p className="tabular mt-2 font-display text-[26px] font-bold leading-none tracking-[-0.02em] text-ink">
                {stage.value}
              </p>
              <p className="mt-1.5 text-[11px] text-ink-subtle">{stage.help}</p>
            </Link>
          ))}
        </div>
        {/* Proportion bar: one object, three parts - where the work is sitting. */}
        <div className="flex h-1.5 overflow-hidden rounded-b-panel">
          <div className="bg-warning transition-[width] duration-500" style={{ width: `${(stats.draftPosts / pipelineTotal) * 100}%` }} />
          <div className="bg-accent transition-[width] duration-500" style={{ width: `${(stats.readyPosts / pipelineTotal) * 100}%` }} />
          <div className="bg-success transition-[width] duration-500" style={{ width: `${(stats.publishedPosts / pipelineTotal) * 100}%` }} />
        </div>
      </Panel>

      {/* ── Up next + strategy ───────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1.65fr_1fr]">
        <Panel flush className="animate-rise-in" style={{ animationDelay: "120ms" }}>
          <PanelHeader
            title="Up next"
            subtitle={nextUp ? "Your schedule, soonest first" : undefined}
            icon={Calendar}
            action={
              <Link
                href="/calendar"
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
              >
                Calendar
                <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          {upcomingPosts.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Nothing scheduled yet"
              description="Generate a batch and your posts land on your posting days automatically."
              action={
                !blocked && !limitReached ? (
                  <Button variant="primary" size="sm" onClick={onGenerateClick} disabled={generating}>
                    <Sparkles className="h-3.5 w-3.5" />
                    Generate {postsPerBatch} posts
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="row-divide">
              {upcomingPosts.slice(0, 6).map((post) => {
                const when = post.scheduledAt ? new Date(post.scheduledAt) : null;
                return (
                  <Link
                    key={post.id}
                    href={`/posts/${post.id}`}
                    className="flex items-start gap-4 px-5 py-3.5 transition-colors hover:bg-surface-sunken focus-ring"
                  >
                    {/* Date rail: the column the eye scans, not another chip in
                        a row of chips. */}
                    <div className="w-11 flex-shrink-0 pt-0.5 text-center">
                      {when ? (
                        <>
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">
                            {when.toLocaleDateString("en-US", { month: "short" })}
                          </p>
                          <p className="tabular font-display text-lg font-bold leading-none text-ink">
                            {when.getDate()}
                          </p>
                        </>
                      ) : (
                        <p className="text-[10px] font-semibold text-ink-subtle">&mdash;</p>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold leading-snug text-ink">
                        {post.title}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {post.postedToLinkedIn || post.status === "published" ? (
                          <Pill tone="success" icon={CheckCircle2}>Published</Pill>
                        ) : post.status === "ready" ? (
                          <Pill tone="accent" icon={Send}>Ready</Pill>
                        ) : (
                          <Pill tone="warning" icon={PenLine}>Draft</Pill>
                        )}
                        {post.style && <Pill>{post.style}</Pill>}
                        {when && (
                          <span className="text-[11px] text-ink-subtle">
                            {when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-ink-subtle" />
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>

        <div className="space-y-6">
          {/* Next publish */}
          <Panel className="animate-rise-in" style={{ animationDelay: "160ms" }}>
            <SectionLabel>Next to publish</SectionLabel>
            {nextUp && nextUp.scheduledAt ? (
              <>
                <p className="mt-2.5 line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink">
                  {nextUp.title}
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-ink-muted">
                  <Clock className="h-3.5 w-3.5 text-accent" />
                  {new Date(nextUp.scheduledAt).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                  {" at "}
                  {new Date(nextUp.scheduledAt).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
                <LinkButton
                  href={`/posts/${nextUp.id}`}
                  variant="secondary"
                  size="sm"
                  className="mt-4 w-full"
                >
                  Open post
                  <ArrowRight className="h-3.5 w-3.5" />
                </LinkButton>
              </>
            ) : (
              <p className="mt-2.5 text-sm text-ink-subtle">
                Nothing queued. Mark a draft as ready and it publishes itself.
              </p>
            )}
          </Panel>

          {/* Strategy */}
          <Panel flush className="animate-rise-in" style={{ animationDelay: "200ms" }}>
            <PanelHeader
              title="Current strategy"
              subtitle={recentPlan ? `Starting ${fmt(new Date(recentPlan.weekStart))}` : undefined}
              icon={TrendingUp}
            />
            {strategy ? (
              <div className="space-y-4 p-5">
                <div>
                  <SectionLabel>Theme</SectionLabel>
                  <p className="mt-1.5 text-[13.5px] font-semibold leading-snug text-ink">
                    {strategy.weekTheme ?? "Untitled theme"}
                  </p>
                </div>
                {strategy.weekFocus && (
                  <p className="text-xs leading-relaxed text-ink-muted">{strategy.weekFocus}</p>
                )}
                {strategy.pillars && strategy.pillars.length > 0 && (
                  <div>
                    <SectionLabel>Pillars</SectionLabel>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {strategy.pillars.slice(0, 5).map((pillar, i) => {
                        const name =
                          typeof pillar === "string" ? pillar : pillar?.name ?? "";
                        if (!name) return null;
                        return <Pill key={`${name}-${i}`}>{name}</Pill>;
                      })}
                    </div>
                  </div>
                )}
                <Link
                  href="/settings"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
                >
                  Adjust your content setup
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <EmptyState
                icon={TrendingUp}
                title="No strategy yet"
                description="Your first generation builds one from your profile."
                className="py-10"
              />
            )}
          </Panel>
        </div>
      </div>

      {/* Generation progress log, when a run is live and the modal is closed. */}
      {generating && progress.length > 0 && (
        <Panel className="animate-rise-in">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
            <p className="flex-1 text-sm font-semibold text-ink">Working on your posts</p>
            <Button variant="ghost" size="xs" onClick={() => showPipeline("posts")}>
              View detail
            </Button>
          </div>
          <ul className="mt-3 space-y-1">
            {progress.slice(-4).map((line, i) => (
              <li key={i} className="text-xs text-ink-muted">
                {line}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {showStrategyConfirm && (
        <StrategyConfirmDialog
          strategyTheme={strategyTheme}
          weekStart={recentPlan?.weekStart ?? new Date()}
          onConfirm={confirmStrategy}
          onClose={() => setShowStrategyConfirm(false)}
        />
      )}
    </div>
  );
}
