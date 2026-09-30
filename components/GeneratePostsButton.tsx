"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { useGeneration } from "@/components/GenerationProvider";
import StrategyConfirmDialog from "@/components/StrategyConfirmDialog";
import { POSTS_PER_BATCH } from "@/lib/posting-schedule";
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

  const limitReached = postsRemaining < POSTS_PER_BATCH;

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
            : `Generate your next ${POSTS_PER_BATCH} posts`
        }
        className={cn(
          "flex flex-shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-md shadow-blue-200 transition-opacity hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70 dark:shadow-blue-900/30",
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
          : `Generate ${POSTS_PER_BATCH} Posts`}
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
