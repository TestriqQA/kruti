import type { ProfileGap } from "@/lib/profile-completeness";

/**
 * Client half of the profile gate.
 *
 * The server side (lib/profile-guard.ts) decides and refuses; this decides what
 * the user SEES when it refuses. The two shapes a refusal arrives in are a 403
 * JSON body and an NDJSON `{ type: "error" }` event, and both carry
 * `profileIncomplete: true` plus the gaps.
 */

/**
 * Window event the profile popup listens for.
 *
 * A window event rather than a React context, deliberately: this has to be
 * raisable from ten unrelated fetch handlers spread across three component
 * trees, and threading a provider down to all of them would be far more churn
 * than the one line each of them actually needs.
 */
export const PROFILE_BLOCKED_EVENT = "kruti:profile-blocked";

/** Unwinds a streaming handler once the popup has been raised. */
export class ProfileGateError extends Error {
  constructor() {
    super("Profile incomplete");
    this.name = "ProfileGateError";
  }
}

export function isProfileGateError(err: unknown): boolean {
  return err instanceof Error && err.name === "ProfileGateError";
}

/**
 * Raises the "finish your profile" popup if `payload` is a profile-gate
 * refusal, and reports whether it did.
 *
 * Every generate and schedule call site runs its error payload through this
 * BEFORE showing anything red. A red toast reads as "something broke, try
 * again" - but this is not a fault, and retrying will never clear it. The user
 * has to see what is actually being asked of them, so they get the dialog with
 * the field list and the link to fill it in.
 *
 * It fires on EVERY click by design. The popup's session dismissal covers the
 * one that greets the user on load; an action they just tried to take is a
 * fresh question, and silently swallowing it would leave a dead button.
 */
export function raiseProfileGate(payload: unknown): boolean {
  if (typeof window === "undefined") return false;

  const p = payload as
    | { profileIncomplete?: boolean; gaps?: ProfileGap[] }
    | null
    | undefined;
  if (!p || p.profileIncomplete !== true) return false;

  window.dispatchEvent(
    new CustomEvent(PROFILE_BLOCKED_EVENT, {
      detail: { gaps: Array.isArray(p.gaps) ? p.gaps : [] },
    })
  );
  return true;
}
