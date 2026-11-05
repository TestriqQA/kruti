"use client";

import { useEffect, useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useGeneration } from "@/components/GenerationProvider";
import StrategyConfirmDialog from "@/components/StrategyConfirmDialog";
import { nextBatchSize } from "@/lib/posting-schedule";
import { PREVIEW_TOOLS_ENABLED } from "@/lib/preview-tools";
import { cn } from "@/lib/utils";

interface Props {
  /** Most recent plan, if any - its presence decides whether we ask about the strategy. */
  recentPlan: { strategy: string; weekStart: Date | string } | null;
  postsRemaining: number;
  className?: string;
}

/**
 * Self-contained "generate a batch" entry point, so the user doesn't have to go
 * back to the dashboard to start a run. The run itself is owned by
 * GenerationProvider, so it keeps going after this button's page unmounts and
 * the completion toast finds the user wherever they are.
 */
export default function GeneratePostsButton({ recentPlan, postsRemaining, className }: Props) {
  const { generating, startGeneration } = useGeneration();
  const [showConfirm, setShowConfirm] = useState(false);

  // See DashboardClient: the batch shrinks to the remaining allowance, so
  // only a spent allowance disables this.
  const limitReached = postsRemaining <= 0;

  // What this click will ACTUALLY produce, not the nominal batch size.
  const batch = nextBatchSize(postsRemaining);
  const posts = `${batch} post${batch === 1 ? "" : "s"}`;

  // See DashboardClient: the allowance has no on-screen home, so it is
  // logged on preview builds only, never production.
  useEffect(() => {
    if (!PREVIEW_TOOLS_ENABLED) return;
    console.log(`[quota] posts page: ${postsRemaining} posts left this cycle, next batch ${batch}`);
  }, [postsRemaining, batch]);

  const strategyTheme = recentPlan
    ? (() => {
        try {
          return (JSON.parse(recentPlan.strategy) as { weekTheme?: string }).weekTheme ?? null;
        } catch {
          return null;
        }
      })()
    : null;

  function handleClick() {
    if (generating || limitReached) return;
    if (recentPlan) {
      setShowConfirm(true); // ask: keep this strategy or build a fresh one?
    } else {
      startGeneration(false); // nothing to reuse yet
    }
  }

  function confirm(reuse: boolean) {
    setShowConfirm(false);
    startGeneration(reuse);
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={generating || limitReached}
        title={
          limitReached
            ? "You've used all the posts in this billing cycle"
            : `Generate your next ${posts}`
        }
        className={cn(
          "flex flex-shrink-0 items-center gap-2 rounded-control bg-brand px-4 py-2.5 text-sm font-medium text-white shadow-lift shadow-blue-200 transition-opacity hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-70 dark:shadow-blue-900/30",
          className
        )}
      >
        {generating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        {generating
          ? "Generating..."
          : limitReached
          ? "Post Limit Reached"
          : `Generate ${batch} Post${batch === 1 ? "" : "s"}`}
      </button>

      {showConfirm && recentPlan && (
        <StrategyConfirmDialog
          strategyTheme={strategyTheme}
          weekStart={recentPlan.weekStart}
          onConfirm={confirm}
          onClose={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}
