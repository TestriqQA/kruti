import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";

/**
 * Crawler-facing files that must answer 200 to an anonymous request.
 *
 * These are checked explicitly rather than by file extension because the
 * extension allow-list below covers assets only - it has no .txt or .xml - so
 * /robots.txt would otherwise fall through to withAuth and be answered with a
 * 307 to the sign-in page. A search engine reading that never sees the rules.
 *
 * All three crawler files are now served: /robots.txt (D-01), /sitemap.xml (D-02)
 * and /llms.txt (D-23).
 */
const CRAWLER_FILES = ["/robots.txt", "/sitemap.xml", "/llms.txt"];

/**
 * Page routes that require a session (D-03).
 *
 * This list is a DENY-list, and that inversion is the whole point of D-03. The
 * old rule was an allow-list of public paths, with everything unmatched sent to
 * withAuth - so a URL that simply does not exist, /about-test say, was answered
 * with a 307 to the sign-in page instead of a 404. Crawlers read that as "this
 * URL exists and redirects", which is why unknown URLs never dropped out of the
 * index.
 *
 * Now only these prefixes are guarded. Everything else falls through to Next,
 * which renders app/not-found.tsx with a real 404 for anything it cannot route.
 *
 * Every entry is a real URL path, not a route-group folder: (dashboard)/posts is
 * served as /posts. Keep this list in step with the disallow list in
 * app/robots.ts - a route that needs auth should be in both.
 */
const APP_ROUTE_PREFIXES = [
  // (dashboard)
  "/dashboard",
  "/posts",
  "/calendar",
  "/analytics",
  "/newsletter",
  "/settings",
  "/support",
  // (admin)
  "/admin",
];

/**
 * API routes that carry their own auth, or are deliberately open. Unchanged
 * from before the D-03 inversion - these must keep answering for themselves
 * rather than being handed an HTML redirect.
 */
const PUBLIC_API_PREFIXES = [
  "/api/auth",
  "/api/webhooks",
  "/api/subscription",
  "/api/profile",
  "/api/cron",
  "/api/site-gate",
  "/api/onboarding",
  // D-19: a visitor hitting a dead link is usually signed out, and that is
  // precisely the 404 worth recording. Rate limited in the route itself.
  "/api/log-404",
];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** True when the request must go through the auth middleware. */
function requiresAuth(pathname: string): boolean {
  if (CRAWLER_FILES.includes(pathname)) return false;

  // Static assets from /public (images, fonts, etc.)
  if (/\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|css|js|map)$/i.test(pathname)) {
    return false;
  }

  if (matchesPrefix(pathname, APP_ROUTE_PREFIXES)) return true;

  // Any other API route is guarded; the listed prefixes guard themselves.
  if (pathname.startsWith("/api/")) {
    return !matchesPrefix(pathname, PUBLIC_API_PREFIXES);
  }

  // Public content, the sign-in/onboarding/billing funnel, and - crucially -
  // anything unrouted, which Next now turns into a 404.
  return false;
}

const authMiddleware = withAuth(
  async function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // Admin routes: require admin role
    if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
      if (!token || token.role !== "admin") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
      return NextResponse.next();
    }

    // For all dashboard routes, enforce onboarding and subscription gates
    if (token) {
      if (!token.onboardingCompleted) {
        return NextResponse.redirect(new URL("/onboarding", req.url));
      }

      // Super admins bypass all subscription checks - lifetime access
      if (token.role === "admin") {
        return NextResponse.next();
      }

      // Entitlement, from the cookie claims. These can lag the database, so this
      // is only the coarse routing rule - the dashboard layout re-checks against
      // the DB and is what actually decides whether to lock the UI.
      const status = token.subscriptionStatus as string | undefined;
      let entitled = status === "active" || status === "cancel_pending";
      if (status === "trialing") {
        // A trial with no end date is treated as running (matches the old rule).
        entitled = !token.trialEnd || new Date(token.trialEnd as string) > new Date();
      }

      // Not entitled: /dashboard still renders (it shows the paywall lock), but
      // every other page funnels back to it so there is nowhere to navigate.
      // API routes are deliberately excluded - they must answer with JSON from
      // their own guard, not an HTML redirect that would break fetch().
      // /support is exempt alongside /dashboard: a lapsed user still needs a way
      // to reach support. Exact match keeps any /support/* subroute closed.
      if (
        !entitled &&
        !pathname.startsWith("/api/") &&
        pathname !== "/dashboard" &&
        pathname !== "/support"
      ) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
);

// ── Main middleware: auth check (only for the app's own routes) ──
export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public content, crawler files, assets and unknown URLs: hand straight to
  // Next. An unknown URL reaching Next is what produces a 404 rather than a
  // redirect to sign-in.
  if (!requiresAuth(pathname)) {
    // D-19: the 404 page cannot see which URL was requested - Next gives
    // not-found.tsx no params - so the path is forwarded as a request header
    // for it to log. Set here rather than in the page because this is the only
    // place that still knows the original pathname.
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  return (authMiddleware as any)(req);
}

export const config = {
  matcher: [
    // Match all routes except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
