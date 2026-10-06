/**
 * The one canonical, absolute origin for this site.
 *
 * Needed by anything that has to emit a full URL rather than a path: robots.txt's
 * Sitemap directive, sitemap.xml entries, canonical tags and og:url. NEXTAUTH_URL
 * is deliberately NOT reused - it points at localhost in development and at the
 * Vercel preview host on preview deploys, and a canonical tag pointing to a
 * preview host is how duplicate-content problems start.
 *
 * Set NEXT_PUBLIC_SITE_URL on the production project to override the default.
 * It must be the scheme + host with no trailing slash, e.g. "https://kruti.io".
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://kruti.io").replace(
  /\/+$/,
  ""
);

/** Joins a path onto SITE_URL, e.g. absoluteUrl("/blog") -> "https://kruti.io/blog". */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Default share image, used for og:image and twitter:image (D-04).
 *
 * KNOWN LIMITATION: logo.png is 2048x842, a 2.43:1 ratio. summary_large_image
 * and Open Graph both want 1200x630 (1.91:1), so this gets letterboxed or
 * centre-cropped depending on the platform. It is declared as 1200x630 because
 * that is the box it will be rendered into.
 *
 * D-21 is the task that generates proper per-post 1200x630 images; replace this
 * with a purpose-built default at the same time.
 */
export const OG_IMAGE_PATH = "/logo.png";
