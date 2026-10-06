/**
 * The static public pages that belong in the sitemap (D-02).
 *
 * Blog posts are NOT listed here - they come from lib/blog-data.ts, so a new
 * post appears in the sitemap with no edit to this file. This list exists only
 * for hand-built routes, because a serverless function cannot scan app/ at
 * request time to discover them.
 *
 * When D-12 adds /pricing, /features, /how-it-works, /faq, /about, /contact and
 * /security, add each one here. That is the single manual step; everything else
 * about the sitemap is derived.
 *
 * Anything behind sign-in must stay out. The disallow list in app/robots.ts is
 * the companion to this file: a route should never be in both.
 */
export interface PublicPage {
  path: string;
  /** Relative to every other page on the site, not an absolute importance. */
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  /**
   * YYYY-MM-DD of the last meaningful content change. Hand-maintained because
   * these are hand-written pages - a build timestamp would claim every page
   * changed on every deploy, which teaches crawlers to ignore the field.
   */
  lastModified: string;
}

export const PUBLIC_PAGES: PublicPage[] = [
  { path: "/", priority: 1.0, changeFrequency: "weekly", lastModified: "2026-10-06" },
  { path: "/blog", priority: 0.8, changeFrequency: "weekly", lastModified: "2026-10-06" },

  // (legal) - required pages, rarely touched. Dated from the Privacy Policy
  // revision referenced in the SEO handoff pack.
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly", lastModified: "2026-03-10" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly", lastModified: "2026-03-10" },
  { path: "/cookies", priority: 0.3, changeFrequency: "yearly", lastModified: "2026-03-10" },
  { path: "/refund", priority: 0.3, changeFrequency: "yearly", lastModified: "2026-03-10" },
  { path: "/disclaimer", priority: 0.3, changeFrequency: "yearly", lastModified: "2026-03-10" },
];
