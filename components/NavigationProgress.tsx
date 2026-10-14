"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { LOADING_START_EVENT, LOADING_END_EVENT } from "@/lib/loading-indicator";

/**
 * Global navigation loader.
 *
 * Two stages (industry-standard "delayed loader" pattern):
 *  1. A slim brand-gradient progress bar with a moving glint appears the
 *     instant a navigation starts - immediate feedback on every click.
 *  2. If the navigation takes longer than OVERLAY_DELAY_MS, a branded
 *     Kruti overlay fades in: a speech-bubble mark with typing dots
 *     (content being written) inside a spinning gradient ring on a
 *     frosted-glass card. Fast navigations never see it, so there is
 *     no flicker; slow ones get a clear "we're working" signal that also
 *     absorbs repeat clicks.
 *
 * Covers <Link>/<a> clicks, router.push/replace (History API) and browser
 * back/forward. External links, new-tab/modifier clicks, downloads and
 * same-page hash anchors are ignored.
 */

const OVERLAY_DELAY_MS = 450;
const EXIT_MS = 350;
const SAFETY_MS = 10000;

export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? "";

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [overlay, setOverlay] = useState(false);
  const [closing, setClosing] = useState(false);

  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const overlayTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const safety = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = useRef(false);
  // Last real route (path + query, ignoring the hash) so a hash-only back/forward
  // - e.g. landing-page anchor links - is not mistaken for a navigation.
  const lastLoc = useRef("");

  const stopTimers = useCallback(() => {
    if (trickle.current) {
      clearInterval(trickle.current);
      trickle.current = null;
    }
    if (overlayTimer.current) {
      clearTimeout(overlayTimer.current);
      overlayTimer.current = null;
    }
    if (safety.current) {
      clearTimeout(safety.current);
      safety.current = null;
    }
  }, []);

  const done = useCallback(() => {
    if (!active.current) return;
    active.current = false;
    stopTimers();
    setProgress(100);
    setClosing(true);
    hideTimer.current = setTimeout(() => {
      setVisible(false);
      setOverlay(false);
      setClosing(false);
      setProgress(0);
    }, EXIT_MS);
  }, [stopTimers]);

  const start = useCallback(() => {
    if (active.current) return;
    active.current = true;
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    setClosing(false);
    setOverlay(false);
    setVisible(true);
    setProgress(12);
    // Trickle towards 90% so the bar always feels alive while we wait.
    trickle.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        const step = p < 40 ? 9 : p < 70 ? 4 : 1.5;
        return Math.min(90, p + Math.random() * step);
      });
    }, 240);
    // Branded overlay only for genuinely slow navigations - no flicker.
    overlayTimer.current = setTimeout(() => setOverlay(true), OVERLAY_DELAY_MS);
    // Safety net: never let the loader get stuck if a navigation is aborted.
    safety.current = setTimeout(() => done(), SAFETY_MS);
  }, [done]);

  // Complete whenever the route (path or query string) actually changes.
  useEffect(() => {
    if (typeof window !== "undefined") {
      lastLoc.current = window.location.pathname + window.location.search;
    }
    done();
    // We intentionally react only to route changes here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  // Work that is not a navigation, driven by the code doing the work.
  //
  // The detectors below only see route changes. A blocking fetch, a hard
  // `window.location.href` assignment, or a slow React transition are all
  // invisible to them, so the caller raises the loader itself. Same two stages,
  // same timings - the onboarding wizard must not get a different loader from
  // the rest of the app.
  useEffect(() => {
    const onStart = () => start();
    const onEnd = () => done();
    window.addEventListener(LOADING_START_EVENT, onStart);
    window.addEventListener(LOADING_END_EVENT, onEnd);
    return () => {
      window.removeEventListener(LOADING_START_EVENT, onStart);
      window.removeEventListener(LOADING_END_EVENT, onEnd);
    };
  }, [start, done]);

  // Detect the start of a navigation.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as Element | null)?.closest?.("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      const target = anchor.getAttribute("target");
      if (!href) return;
      if (target && target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (/^(mailto:|tel:|sms:|blob:|javascript:)/i.test(href)) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Same page (e.g. hash-only link) is not a navigation.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }
      start();
    };

    const onPopState = () => {
      // Back/forward (or a router-emitted popstate from an anchor) that only changes
      // the hash - same path + query - is not a real navigation, so skip the loader.
      const cur = window.location.pathname + window.location.search;
      if (cur === lastLoc.current) return;
      start();
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);

    // Patch the History API so router.push()/replace() also trigger the loader.
    const originalPush = window.history.pushState;
    window.history.pushState = function (
      this: History,
      ...args: Parameters<History["pushState"]>
    ) {
      const nextUrl = args[2];
      if (nextUrl != null) {
        try {
          const u = new URL(String(nextUrl), window.location.href);
          if (
            u.pathname !== window.location.pathname ||
            u.search !== window.location.search
          ) {
            start();
          }
        } catch {
          /* ignore malformed URLs */
        }
      }
      return originalPush.apply(this, args);
    };

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.history.pushState = originalPush;
    };
  }, [start]);

  // Clean up any pending timers on unmount.
  useEffect(() => {
    return () => {
      stopTimers();
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [stopTimers]);

  if (!visible) return null;

  return (
    <>
      {/* Stage 1: instant top progress bar */}
      <div
        className={`pointer-events-none fixed inset-x-0 top-0 z-[9999] ${
          closing ? "kruti-loader-fade-out" : ""
        }`}
        role="status"
        aria-live="polite"
        aria-label="Page loading"
      >
        <div className="kruti-nav-bar h-[3px]" style={{ width: `${progress}%` }}>
          <span className="kruti-nav-bar-glint" />
        </div>
      </div>

      {/* Stage 2: branded overlay, only for slow navigations */}
      {overlay && (
        <div
          aria-hidden="true"
          className={`fixed inset-0 z-[9998] flex cursor-wait items-center justify-center bg-white/55 backdrop-blur-[6px] dark:bg-gray-950/60 ${
            closing ? "kruti-loader-fade-out" : "kruti-loader-fade-in"
          }`}
        >
          <div className="kruti-loader-card flex flex-col items-center gap-4 rounded-3xl border border-white/60 bg-white/85 px-10 py-8 shadow-2xl shadow-[#0A66C2]/25 backdrop-blur-xl dark:border-white/10 dark:bg-gray-900/85">
            {/* Animated Kruti mark: glow + spinning ring + speech bubble with typing dots */}
            <div className="relative h-20 w-20">
              <div className="kruti-loader-glow absolute inset-1 rounded-full bg-[#0A66C2]/30 blur-xl" />
              <svg
                className="kruti-loader-ring absolute inset-0 h-full w-full"
                viewBox="0 0 80 80"
                fill="none"
              >
                <defs>
                  <linearGradient
                    id="kruti-ring-grad"
                    x1="0"
                    y1="0"
                    x2="80"
                    y2="80"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#0A66C2" />
                    <stop offset="0.55" stopColor="#4da3ff" />
                    <stop offset="1" stopColor="#0A66C2" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="url(#kruti-ring-grad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="170 56"
                />
              </svg>
              <svg
                className="kruti-loader-bubble absolute inset-0 m-auto h-11 w-11"
                viewBox="0 0 64 64"
                fill="none"
              >
                <defs>
                  <linearGradient
                    id="kruti-bubble-grad"
                    x1="8"
                    y1="8"
                    x2="56"
                    y2="56"
                    gradientUnits="userSpaceOnUse"
                  >
                    <stop stopColor="#0A66C2" />
                    <stop offset="1" stopColor="#004182" />
                  </linearGradient>
                </defs>
                <path
                  d="M20 8 H44 C50.627 8 56 13.373 56 20 V34 C56 40.627 50.627 46 44 46 H30 L20 56 V46 C13.373 46 8 40.627 8 34 V20 C8 13.373 13.373 8 20 8 Z"
                  fill="url(#kruti-bubble-grad)"
                />
                <circle className="kruti-typing-dot" cx="22" cy="27" r="3.6" fill="#fff" />
                <circle className="kruti-typing-dot kruti-typing-dot-2" cx="32" cy="27" r="3.6" fill="#fff" />
                <circle className="kruti-typing-dot kruti-typing-dot-3" cx="42" cy="27" r="3.6" fill="#fff" />
              </svg>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="font-display text-sm font-bold tracking-wide text-gray-900 dark:text-white">
                Kruti<span className="text-[#0A66C2]">.io</span>
              </span>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                Just a moment…
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
