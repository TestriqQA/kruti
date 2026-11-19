import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * A username-and-password lock over an entire non-production deployment.
 *
 * This is HTTP Basic authentication, which is why the visitor sees the
 * browser's own credentials prompt rather than a page we render: the server
 * answers 401 with a WWW-Authenticate header, and the browser puts up its
 * native dialog. Nothing of the site is sent until the credentials are right,
 * so there is no page to read, no flash of content, and nothing to click past.
 *
 * It is switched on purely by the presence of STAGING_GATE_USER and
 * STAGING_GATE_PASSWORD. Set them on the pre-production environments and
 * staging is locked; leave them unset everywhere else and this costs one
 * undefined check per request.
 *
 */

/** Hosts that must never be locked, whatever the environment says. */
const PRODUCTION_HOSTS = new Set(["kruti.io", "www.kruti.io"]);

/**
 * Paths that have no way to present credentials.
 *
 * Razorpay signs its webhook and posts it from its own servers; it has nowhere
 * to put a username and password. Gating this would not merely inconvenience
 * anyone - it would silently stop subscription activations and renewals being
 * recorded on staging, which is the one thing that must keep working while the
 * site is locked. The route verifies its own signature, so it is not open.
 *
 * The mobile app is here for a sharper reason: a request carries exactly ONE
 * Authorization header, and the app has to spend it on `Bearer <jwt>` or the
 * API cannot tell who is calling. It can never also send `Basic`. So gating
 * these paths does not ask the app for a password - it makes the app
 * impossible to use against staging at all, with no configuration that fixes
 * it. Every route under /api/mobile verifies its own token and answers 401
 * without a valid one, so they are exactly as protected as they were before
 * this gate existed; they are simply not behind the second lock. The website -
 * every page a person can actually look at - stays gated.
 */
function isExempt(pathname: string): boolean {
  return pathname.startsWith("/api/webhooks/") || pathname.startsWith("/api/mobile/");
}

/**
 * Compare without leaking the answer through timing.
 *
 * crypto.timingSafeEqual is Node-only and middleware runs on the Edge, so this
 * is done by hand: every character is folded into the accumulator and the
 * length difference with it, instead of returning early on the first mismatch.
 * The loop still runs for as long as the longer string, which is not perfectly
 * constant-time, but it removes the per-character oracle that `===` gives away.
 */
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** The 401 that makes the browser ask. */
function challenge(): NextResponse {
  return new NextResponse("Authentication required.\n", {
    status: 401,
    headers: {
      // Without this header the browser shows a bare error page instead of
      // its credentials prompt. The realm is displayed in that prompt.
      "WWW-Authenticate": 'Basic realm="Kruti - staging", charset="UTF-8"',
      "Content-Type": "text/plain; charset=utf-8",
      // A cached 401 would keep asking after the credentials were accepted.
      "Cache-Control": "no-store",
      // Belt and braces: a locked deployment must never be indexed.
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/**
 * Returns a 401 challenge when the request may not pass, or null to continue.
 */
export function checkStagingGate(req: NextRequest): NextResponse | null {
  const expectedUser = process.env.STAGING_GATE_USER;
  const expectedPassword = process.env.STAGING_GATE_PASSWORD;

  // Unset: the gate does not exist here. This is how production and local
  // development stay open without needing to know anything about hostnames.
  if (!expectedUser || !expectedPassword) return null;

  // A deliberate floor. If these variables are ever set on the production
  // environment by mistake, the public site still must not be locked - that
  // would be an outage, and no staging convenience is worth it.
  if (PRODUCTION_HOSTS.has(req.nextUrl.hostname.toLowerCase())) return null;

  if (isExempt(req.nextUrl.pathname)) return null;

  const header = req.headers.get("authorization") ?? "";
  const space = header.indexOf(" ");
  const scheme = space === -1 ? "" : header.slice(0, space);
  const encoded = space === -1 ? "" : header.slice(space + 1).trim();
  if (!encoded || scheme.toLowerCase() !== "basic") return challenge();

  let decoded: string;
  try {
    // Basic credentials are base64 of "user:password". atob decodes latin1,
    // which is why the password this ships with is ASCII.
    decoded = atob(encoded);
  } catch {
    return challenge();
  }

  // The FIRST colon separates them: a password may legitimately contain one.
  const sep = decoded.indexOf(":");
  if (sep === -1) return challenge();

  // Both halves are always compared, even when the first has already failed,
  // so the reply cannot be used to work out which one was wrong.
  const userOk = safeEqual(decoded.slice(0, sep), expectedUser);
  const passwordOk = safeEqual(decoded.slice(sep + 1), expectedPassword);

  return userOk && passwordOk ? null : challenge();
}
