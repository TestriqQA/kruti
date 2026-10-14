"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, X } from "lucide-react";
import type { ProfileGap } from "@/lib/profile-completeness";

/**
 * What an incomplete profile actually costs the user, in their words. Kept in
 * sync with the routes that call checkProfileReady() - if this list and those
 * gates ever disagree, this list is the lie.
 */
const PAUSED = [
  "Writing new posts",
  "Generating images and carousels",
  "Scheduling and auto-publishing to LinkedIn",
];

const DISMISS_KEY = "profileGapsDismissed";

/**
 * Shown when onboarding asks for something this account does not have yet -
 * typically because a NEW required input shipped after the user signed up.
 *
 * The real block is server-side: every generation, image and scheduling route
 * calls checkProfileReady(). This dialog exists so the user understands WHY
 * their buttons stopped working, instead of collecting 403s.
 *
 * Deliberately NOT a hard lock like SubscriptionLock. The fix lives behind the
 * sidebar - /onboarding and /settings - so trapping the page would trap the user
 * away from the one thing they need to do. It is dismissible, remembered for the
 * tab session only, and keyed on the gap set: fix some fields but not all, or
 * ship another new input, and the signature changes so it comes straight back.
 */
export default function ProfileIncompletePopup({ gaps }: { gaps: ProfileGap[] }) {
  const [open, setOpen] = useState(false);

  // Which gaps this is about. Order-independent so a reordered assessProfile()
  // does not look like a new requirement.
  const signature = gaps
    .map((g) => g.key)
    .sort()
    .join(",");

  useEffect(() => {
    // Read on mount only - rendering straight from sessionStorage would mismatch
    // the server-rendered HTML.
    try {
      if (sessionStorage.getItem(DISMISS_KEY) !== signature) setOpen(true);
    } catch {
      setOpen(true); // storage blocked - just show it
    }
  }, [signature]);

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, signature);
    } catch {
      /* ignore - dismissal just won't persist */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      // Above TrialEndingPopup (z-150), below SubscriptionLock (z-200): this is
      // the harder blocker of the two nudges, but a lapsed subscription still
      // outranks it.
      className="fixed inset-0 z-[160] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-gaps-title"
      onClick={dismiss}
    >
      <div
        className="my-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0D131F]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            <AlertCircle className="h-5 w-5" />
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.06] dark:hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2
          id="profile-gaps-title"
          className="mt-4 font-display text-xl font-bold text-slate-900 dark:text-white"
        >
          We need a bit more from your profile
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Your posts are written from your profile, and we have started asking for
          a few more details. Until these are filled in, the following stay
          paused on your account:
        </p>

        <ul className="mt-3 space-y-1.5 rounded-xl bg-slate-50 px-4 py-3 dark:bg-white/[0.03]">
          {PAUSED.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
            >
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
              {item}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Still needed
        </p>
        <ul className="mt-2 space-y-2">
          {gaps.map((g) => (
            <li key={g.key} className="text-sm text-slate-600 dark:text-slate-300">
              <span className="font-semibold text-slate-900 dark:text-white">
                {g.label}
              </span>
              <span className="block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {g.hint}
              </span>
            </li>
          ))}
        </ul>

        <Link
          href="/onboarding"
          onClick={dismiss}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
        >
          Finish my profile
          <ArrowRight className="h-4 w-4" />
        </Link>

        <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
          Takes about two minutes. Everything switches back on the moment you
          save &mdash; free trial or paid plan.
        </p>

        <div className="mt-3 flex items-center justify-center gap-4">
          <Link
            href="/settings"
            onClick={dismiss}
            className="text-xs font-medium text-slate-500 underline underline-offset-2 transition-colors hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Or edit in Settings
          </Link>
          <button
            onClick={dismiss}
            className="text-xs text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
