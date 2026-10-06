/**
 * The redirect map (D-19).
 *
 * Plain .mjs, not .ts, because next.config.mjs imports this at build time and
 * the Next config is not run through the TypeScript compiler.
 *
 * Every entry is a URL that used to work and must keep working. When a slug
 * changes, the old path goes here in the same commit as the rename - a 301 is
 * what carries the accumulated ranking of the old URL to the new one, and a
 * 404 throws it away.
 *
 * Rules:
 *   - `from` must be a path that no longer has a page, or Next's own route wins.
 *   - Use 301 (permanent). `permanent: true` in Next emits 308, which Google
 *     honours but which D-19 does not ask for, so the status is set explicitly.
 *   - Never chain: if A was redirected to B and B later moves to C, repoint A
 *     straight at C. Chains lose link equity at every hop.
 */
export const REDIRECT_MAP = [
  // Nothing has been renamed yet. Example of the shape to add:
  // { from: "/blog/old-slug", to: "/blog/new-slug" },
];

/** Shapes REDIRECT_MAP into the objects next.config.mjs expects. */
export function buildRedirects() {
  return REDIRECT_MAP.map(({ from, to }) => ({
    source: from,
    destination: to,
    statusCode: 301,
  }));
}

/**
 * Sends www.<host> to the bare host with a 301, preserving path and query (D-10).
 *
 * http -> https is NOT handled here on purpose. Vercel terminates TLS and issues
 * that redirect at the edge before any application code runs, and a second
 * redirect in the app - which only sees x-forwarded-proto - risks a loop when a
 * proxy sits in front. The Strict-Transport-Security header in next.config.mjs
 * is what stops a browser trying http again after its first visit.
 */
export function buildCanonicalHostRedirect() {
  const host = (process.env.NEXT_PUBLIC_SITE_URL || "https://kruti.io")
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");

  // A bare-host deployment preview has no www variant to redirect.
  if (!host || host.startsWith("localhost")) return [];

  return [
    {
      source: "/:path*",
      has: [{ type: "host", value: `www.${host}` }],
      destination: `https://${host}/:path*`,
      statusCode: 301,
    },
  ];
}
