"use client";

import { Sparkles, CheckCircle, RefreshCw } from "lucide-react";

interface Props {
  /** Theme of the current strategy, shown so the user knows what they're keeping. */
  strategyTheme: string | null;
  /** Start of the current plan - used to warn when the strategy is stale. */
  weekStart: Date | string;
  onConfirm: (reuseStrategy: boolean) => void;
  onClose: () => void;
}

/**
 * Asks whether to reuse the current content strategy or build a fresh one.
 * Shared by every entry point that can start a generation run (dashboard header,
 * posts page) so the wording and the stale-strategy warning stay identical.
 */
export default function StrategyConfirmDialog({
  strategyTheme,
  weekStart,
  onConfirm,
  onClose,
}: Props) {
  const isStale =
    Math.floor((Date.now() - new Date(weekStart).getTime()) / 86400000) >= 30;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={onClose}
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
        {isStale ? (
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
            onClick={() => onConfirm(true)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <CheckCircle className="h-4 w-4" /> Yes, generate posts
          </button>
          <button
            onClick={() => onConfirm(false)}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-200 dark:hover:bg-white/[0.1]"
          >
            <RefreshCw className="h-4 w-4" /> No, change strategy
          </button>
        </div>
        <button
          onClick={onClose}
          className="mt-3 w-full text-center text-xs text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
