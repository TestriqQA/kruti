"use client";

import { useEffect, useState } from "react";
import { Clock, Loader2, X, Check, Sparkles } from "lucide-react";
import { useCheckout, PRICE, type Currency } from "@/hooks/useCheckout";
import { cn } from "@/lib/utils";

const INCLUDED = [
  "30 AI-written posts every month",
  "Professional images for every post",
  "Scheduling and auto-publishing to LinkedIn",
];

const DISMISS_KEY = "trialEndingDismissed";

/**
 * Final-day nudge: shown once the trial has under 24 hours left.
 *
 * Unlike SubscriptionLock this is dismissible - the user is still entitled and
 * must be able to keep working. Dismissal is remembered for the calendar day so
 * it does not reappear on every navigation, but it does come back tomorrow (by
 * which point the hard lock has usually taken over anyway).
 */
export default function TrialEndingPopup({ hoursLeft }: { hoursLeft: number }) {
  const { loading, currency, setCurrency, subscribe } = useCheckout();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Read on mount only - rendering straight from localStorage would mismatch
    // the server-rendered HTML.
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem(DISMISS_KEY) !== today) setOpen(true);
    } catch {
      setOpen(true); // storage blocked - just show it
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, new Date().toISOString().slice(0, 10));
    } catch {
      /* ignore - dismissal just won't persist */
    }
    setOpen(false);
  }

  if (!open) return null;

  const timeLabel =
    hoursLeft <= 1 ? "less than an hour" : `about ${Math.round(hoursLeft)} hours`;

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trial-ending-title"
      onClick={dismiss}
    >
      <div
        className="my-auto w-full max-w-md rounded-card border border-edge bg-white p-6 shadow-lift-lg dark:bg-[#0D131F]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-control bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
            <Clock className="h-5 w-5" />
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
          id="trial-ending-title"
          className="mt-4 font-display text-xl font-bold text-text"
        >
          Your free trial ends today
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-text-2">
          You have {timeLabel} left. Subscribe now to keep generating posts and
          publishing to LinkedIn without interruption.
        </p>

        <div className="mt-5 inline-flex rounded-control border border-edge p-0.5">
          {(["INR", "USD"] as Currency[]).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                currency === c
                  ? "bg-brand text-white"
                  : "text-text-2 hover:text-text  dark:hover:text-slate-200"
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-baseline gap-1.5">
          <span className="font-display text-3xl font-bold text-text">
            {PRICE[currency].symbol}
            {PRICE[currency].amount}
          </span>
          <span className="text-sm text-text-2">/month</span>
        </div>

        <ul className="mt-4 space-y-2">
          {INCLUDED.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-sm text-text-2"
            >
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
              {item}
            </li>
          ))}
        </ul>

        <button
          onClick={subscribe}
          disabled={loading}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-control bg-brand px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Opening payment..." : "Subscribe now"}
        </button>

        <button
          onClick={dismiss}
          className="mt-3 w-full text-center text-xs text-text-3 transition-colors hover:text-text-2 dark:hover:text-text-3"
        >
          Remind me later
        </button>
      </div>
    </div>
  );
}
