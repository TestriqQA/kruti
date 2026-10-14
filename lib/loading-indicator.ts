/**
 * Imperative control for the global loader in components/NavigationProgress.
 *
 * That component detects navigations on its own - anchor clicks, popstate and
 * the patched History API - which covers every <Link> and router.push in the
 * app. It cannot see three things:
 *
 *   - a fetch that blocks the UI without changing the route,
 *   - `window.location.href = ...`, which is a hard navigation the History API
 *     never hears about,
 *   - a React transition that is slow because the work itself is slow.
 *
 * Those are exactly the waits the onboarding wizard has, and they were the ones
 * with no feedback at all. Raising the same loader through a window event keeps
 * one loader in the app rather than a second, slightly different spinner.
 *
 * There is no minimum display time anywhere in this path. The loader lives for
 * precisely as long as the caller says the work lasts.
 */

export const LOADING_START_EVENT = "kruti:loading-start";
export const LOADING_END_EVENT = "kruti:loading-end";

/** Raise the global loader. Safe to call twice; the second call is a no-op. */
export function startGlobalLoading(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(LOADING_START_EVENT));
}

/** Drop the global loader. Safe to call when it is not showing. */
export function stopGlobalLoading(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(LOADING_END_EVENT));
}
