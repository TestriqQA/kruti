import { withAuth } from "next-auth/middleware";
import { NextRequest, NextResponse } from "next/server";

// Routes that NEVER need the auth middleware (public pages, APIs with own auth)
function isPublicRoute(pathname: string): boolean {
  // Static assets from /public (images, fonts, etc.)
  if (/\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot|css|js|map)$/i.test(pathname)) {
    return true;
  }

  // Public pages
  const publicPaths = ["/", "/login", "/subscribe", "/onboarding", "/blog"];
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return true;
  }

  // Static/legal pages
  if (["/privacy", "/terms", "/cookies", "/disclaimer", "/refund"].includes(pathname)) {
    return true;
  }

  // API routes that have their own auth or are public
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/subscription") ||
    pathname.startsWith("/api/profile") ||
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/site-gate") ||
    pathname.startsWith("/api/onboarding")
  ) {
    return true;
  }

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
      if (!entitled && !pathname.startsWith("/api/") && pathname !== "/dashboard") {
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

// ── Main middleware: auth check (only for protected routes) ──────
export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 2. Public routes: skip auth middleware entirely
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // 3. Protected routes: run auth middleware
  return (authMiddleware as any)(req);
}

export const config = {
  matcher: [
    // Match all routes except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
