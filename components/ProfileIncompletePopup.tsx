"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowRight, X } from "lucide-react";
import type { ProfileGap } from "@/lib/profile-completeness";
import { PROFILE_BLOCKED_EVENT } from "@/lib/profile-gate";

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
 * It comes up two ways, and they behave differently on purpose:
 *
 *  - On load, from `serverGaps`. This one is dismissible and the dismissal
 *    sticks for the tab session, keyed on the gap set: fix some fields but not
 *    all, or ship another new input, and the signature changes so it returns.
 *
 *  - On a blocked action, from the PROFILE_BLOCKED_EVENT that every generate
 *    and schedule handler raises instead of a red toast. This one ignores the
 *    dismissal entirely and fires on every click. A dismissed dialog must not
 *    turn the Generate button into a button that silently does nothing.
 *
 * Deliberately NOT a hard lock like SubscriptionLock: the fix lives behind the
 * sidebar - /onboarding and /settings - so trapping the page would trap the user
 * away from the one thing they need to do.
 */
export default function ProfileIncompletePopup({
  gaps: serverGaps,
}: {
  gaps: ProfileGap[];
}) {
  const [open, setOpen] = useState(false);
  const [gaps, setGaps] = useState<ProfileGap[]>(serverGaps);

  // Which gaps the session dismissal was for. Order-independent so a reordered
  // assessProfile() does not look like a new requirement.
  const serverSignature = serverGaps
    .map((g) => g.key)
    .sort()
    .join(",");

  // Keep the dialog honest after a navigation that fixed some of the gaps -
  // the layout re-renders with a fresh list.
  useEffect(() => {
    setGaps(serverGaps);
  }, [serverGaps]);

  useEffect(() => {
    if (serverGaps.length === 0) return;
    // Read on mount only - rendering straight from sessionStorage would mismatch
    // the server-rendered HTML.
    try {
      if (sessionStorage.getItem(DISMISS_KEY) !== serverSignature) setOpen(true);
    } catch {
      setOpen(true); // storage blocked - just show it
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverSignature]);

  // A request was just refused. Show what that request needed, whatever this
  // page was rendered with, and ignore any dismissal.
  useEffect(() => {
    function onBlocked(e: Event) {
      const detail = (e as CustomEvent<{ gaps?: ProfileGap[] }>).detail;
      const fresh = detail?.gaps ?? [];
      setGaps(fresh.length > 0 ? fresh : serverGaps);
      setOpen(true);
    }
    window.addEventListener(PROFILE_BLOCKED_EVENT, onBlocked);
    return () => window.removeEventListener(PROFILE_BLOCKED_EVENT, onBlocked);
  }, [serverGaps]);

  function dismiss() {
    try {
      sessionStorage.setItem(DISMISS_KEY, serverSignature);
    } catch {
      /* ignore - dismissal just won't persist */
    }
    setOpen(false);
  }

  if (!open || gaps.length === 0) return null;

  return (
    <div
      // Above the pipeline/variant modals (z-50) and TrialEndingPopup (z-150),
      // below SubscriptionLock (z-200): this outranks the other nudges because
      // it is blocking a click the user just made, but a lapsed subscription
      // still outranks it.
      className="fixed inset-0 z-[160] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-gaps-title"
      onClick={dismiss}
    >
      <div
        className="my-auto w-full max-w-md rounded-card border border-edge bg-white p-6 shadow-lift-lg dark:bg-[#0D131F]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-control bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            <AlertCircle className="h-5 w-5" />
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="rounded-control p-2 text-text-3 transition-colors hover:bg-slate-100 hover:text-text-2 dark:hover:text-text-3"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2
          id="profile-gaps-title"
          className="mt-4 font-display text-xl font-bold text-text"
        >
          We need a bit more from your profile
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-text-2">
          Your posts are written from your profile, and we have started asking for
          a few more details. Until these are filled in, the following stay
          paused on your account:
        </p>

        <ul className="mt-3 space-y-1.5 rounded-control bg-slate-50 px-4 py-3">
          {PAUSED.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-sm text-text-2"
            >
              <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" />
              {item}
            </li>
          ))}
        </ul>

        <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-text-3">
          Still needed
        </p>
        <ul className="mt-2 space-y-2">
          {gaps.map((g) => (
            <li key={g.key} className="text-sm text-text-2">
              <span className="font-semibold text-text">
                {g.label}
              </span>
              <span className="block text-xs leading-relaxed text-text-2">
                {g.hint}
              </span>
            </li>
          ))}
        </ul>

        <Link
          href="/onboarding"
          onClick={dismiss}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-control bg-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          Finish my profile
          <ArrowRight className="h-4 w-4" />
        </Link>

        <p className="mt-3 text-center text-xs text-text-3">
          Takes about two minutes. Everything switches back on the moment you
          save &mdash; free trial or paid plan.
        </p>

        <div className="mt-3 flex items-center justify-center gap-4">
          <Link
            href="/settings"
            onClick={dismiss}
            className="text-xs font-medium text-text-2 underline underline-offset-2 transition-colors hover:text-text dark:hover:text-slate-200"
          >
            Or edit in Settings
          </Link>
          <button
            onClick={dismiss}
            className="text-xs text-text-3 transition-colors hover:text-text-2 dark:hover:text-text-3"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
