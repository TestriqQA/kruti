import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_URL } from "@/lib/site-url";

/**
 * Serves /robots.txt (D-01).
 *
 * Next's metadata route is used instead of a file in public/ for two reasons: it
 * guarantees a 200 with Content-Type: text/plain, and it lets the Sitemap
 * directive be built from SITE_URL rather than hard-coded per environment.
 *
 * NOTE: middleware.ts must keep /robots.txt in CRAWLER_FILES. Without that the
 * auth middleware answers an anonymous request with a 307 to the sign-in page,
 * which is exactly the bug this task fixes - a route handler alone is not enough.
 *
 * Rules are S-04's, which decided: allow every search and AI bot on the public
 * pages, block only the app, admin, login and checkout routes. Nothing is blocked
 * to protect secrets - robots.txt cannot do that, and these routes all sit behind
 * sign-in anyway - it is blocked because it is not content worth indexing.
 *
 * The list is split in two. The first group is S-04's six literal Disallow lines
 * in its own order, so the file can be diffed against the spec. The second group
 * is the work S-04 explicitly handed over: "route groups in brackets do not
 * appear in URLs... compare each line against the actual routes, and add any
 * others that sit behind sign-in". Those were taken from the real page routes in
 * app/, so (dashboard)/posts becomes /posts and so on.
 *
 * Everything under (blog) and (legal), plus the homepage, stays crawlable.
 */
/**
 * True only on the real kruti.io production deploy.
 *
 * Two independent checks, because either can be absent depending on how the
 * Vercel project is set up: VERCEL_ENV is "preview" on every preview deploy,
 * and a dedicated staging project sets NEXT_PUBLIC_SITE_URL to its own host.
 * Anything that is not demonstrably production is treated as not-production.
 */
function isCanonicalProductionHost(): boolean {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv && vercelEnv !== "production") return false;
  return SITE_URL === "https://kruti.io";
}

export default function robots(): MetadataRoute.Robots {
  // Staging and preview deploys serve a full copy of the site. Left crawlable
  // they would be indexed as duplicates of production and compete with it, so
  // they are closed off entirely. This is the one case where blocking in
  // robots.txt is the right tool: the content is not secret, it just must not
  // be indexed.
  if (!isCanonicalProductionHost()) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          // ── S-04, verbatim and in its order ──────────────────────────────
          "/api/",
          "/login",
          "/dashboard",
          "/admin",
          "/onboarding",
          "/subscribe",

          // ── Added per S-04's "add any others that sit behind sign-in" ────
          // The remaining (dashboard) pages, which S-04 could not name because
          // route-group folders are invisible in URLs.
          "/posts",
          "/calendar",
          "/analytics",
          "/newsletter",
          "/settings",
          "/support",
          // S-04 names the site-gate page explicitly.
          "/site-gate",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
