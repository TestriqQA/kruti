"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Loader2, X, Check, Sparkles } from "lucide-react";
import { useCheckout, PRICE, type Currency } from "@/hooks/useCheckout";
import { cn } from "@/lib/utils";

const INCLUDED = [
  "30 AI-written posts every month",
  "Professional images for every post",
  "Scheduling and auto-publishing to LinkedIn",
  "Monthly newsletters",
];

/**
 * Attribute that opts an element out of the lock. Anything inside a node marked
 * with it still works normally - used for the sign-out control and for this
 * dialog's own buttons.
 */
export const ALLOW_WHEN_LOCKED = "data-allow-when-locked";

const INTERACTIVE = 'a, button, input, select, textarea, [role="button"], [role="link"]';

/**
 * Paywall for users whose trial ran out (or whose subscription lapsed).
 *
 * The dashboard stays visible and scrollable - the user can look at what they
 * built - but it is inert in practice: clicking any link or button is swallowed
 * and this dialog comes up instead. Closing it returns to the dashboard, and the
 * next interaction brings it straight back.
 *
 * Signing out is deliberately exempt (see ALLOW_WHEN_LOCKED on the sidebar
 * button), so the user is never trapped.
 *
 * This is UX, not security: the listener can be removed from devtools, so every
 * route that writes checks the subscription server-side too.
 */
export default function SubscriptionLock({ reason }: { reason: string }) {
  const { loading, currency, setCurrency, subscribe } = useCheckout();
  const [open, setOpen] = useState(false);

  const block = useCallback((e: Event) => {
    const target = e.target as Element | null;
    if (!target || typeof target.closest !== "function") return;

    // Explicitly allowed (sign out, this dialog) - let it through untouched.
    if (target.closest(`[${ALLOW_WHEN_LOCKED}]`)) return;

    // Only intercept things the user can actually act on; plain text is harmless.
    if (e.type === "click" && !target.closest(INTERACTIVE)) return;

    e.preventDefault();
    // Capture-phase on window runs BEFORE the document-level listeners (notably
    // NavigationProgress), so stopping here also prevents the loading bar firing
    // for a navigation that is never going to happen.
    e.stopPropagation();
    setOpen(true);
  }, []);

  useEffect(() => {
    window.addEventListener("click", block, true);
    window.addEventListener("submit", block, true);
    return () => {
      window.removeEventListener("click", block, true);
      window.removeEventListener("submit", block, true);
    };
  }, [block]);

  // Only lock scrolling while the dialog is actually up.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      {...{ [ALLOW_WHEN_LOCKED]: "" }}
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paywall-title"
      onClick={() => setOpen(false)}
    >
      <div
        className="my-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#0D131F]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
            <Lock className="h-5 w-5" />
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.06] dark:hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2
          id="paywall-title"
          className="mt-4 font-display text-xl font-bold text-slate-900 dark:text-white"
        >
          Subscribe to continue
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          {reason}
        </p>

        <div className="mt-5 inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-white/10">
          {(["INR", "USD"] as Currency[]).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                currency === c
                  ? "bg-blue-600 text-white"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              )}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-baseline gap-1.5">
          <span className="font-display text-3xl font-bold text-slate-900 dark:text-white">
            {PRICE[currency].symbol}
            {PRICE[currency].amount}
          </span>
          <span className="text-sm text-slate-500 dark:text-slate-400">/month</span>
        </div>

        <ul className="mt-4 space-y-2">
          {INCLUDED.map((item) => (
            <li
              key={item}
              className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300"
            >
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
              {item}
            </li>
          ))}
        </ul>

        <button
          onClick={subscribe}
          disabled={loading}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {loading ? "Opening payment..." : "Subscribe now"}
        </button>

        <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
          Secure payment via Razorpay. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
