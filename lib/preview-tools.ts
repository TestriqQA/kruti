import { SITE_URL } from "@/lib/site-url";

/**
 * Whether preview-only developer UI may render.
 *
 * Today that is the generation pipeline view - the step-by-step modals behind
 * the "View pipeline" buttons, plus the live carousel progress modal. Useful
 * while watching a run on staging, and no business in front of a paying user.
 *
 * It governs the WIRE as well as the screen. A prompt runs to several KB and
 * is our own prompt engineering; streaming it to a production browser that
 * will never render it is both waste and disclosure, and anyone could read it
 * out of the network tab. See promptField() at the bottom of this file.
 *
 * ── Why this is a runtime gate and not a branch ──────────────────────────────
 *
 * The obvious idea is to keep the code on `staging` and leave it out of `main`.
 * Git does not work that way: merging staging into main takes the commits with
 * it, so the only way to hold the line would be to exclude these files from
 * every merge, forever, and the first person who forgets ships it. It also
 * makes staging stop being a faithful rehearsal of main, which is the one job
 * staging has.
 *
 * So the code ships everywhere and production simply refuses to render it.
 * Merges stay ordinary, and main is safe even when someone merges carelessly.
 *
 * ── Why the site URL and not VERCEL_ENV ──────────────────────────────────────
 *
 * VERCEL_ENV looks like the natural signal and is the wrong one. It reports
 * "production" for the production environment of WHICHEVER Vercel project is
 * building - so if staging is ever its own project rather than a branch deploy,
 * VERCEL_ENV is "production" on staging too and this gate would hide the
 * pipeline exactly where it is wanted. It is also only defined when the
 * project's "Automatically expose System Environment Variables" setting is on.
 *
 * NEXT_PUBLIC_SITE_URL is already set per environment because canonical tags,
 * og:url and sitemap.xml depend on it - verified live: kruti.io serves
 * <link rel="canonical" href="https://kruti.io"> and staging.kruti.io serves
 * its own host. It needs no new configuration anywhere, and it describes the
 * thing we actually care about: which site the visitor is looking at.
 *
 * SITE_URL falls back to the production host when the variable is unset, so an
 * unconfigured environment reads as production and the tooling stays hidden.
 * That is the safe direction to fail.
 *
 * Both inputs are inlined at build time and so are identical on the server and
 * in the browser - no hydration mismatch, which a server-only env var would
 * have caused in these client components.
 *
 * The one way to leak this onto production is to point production's
 * NEXT_PUBLIC_SITE_URL somewhere other than kruti.io, which would also break
 * every canonical tag on the site - a loud failure, not a silent one.
 */
const PRODUCTION_SITE = "https://kruti.io";

export const PREVIEW_TOOLS_ENABLED =
  // A local `next dev` box, where SITE_URL is often left at its default.
  process.env.NODE_ENV === "development" ||
  // Anything serving a host other than production: staging, previews, tunnels.
  SITE_URL.toLowerCase() !== PRODUCTION_SITE;

/**
 * Spread into a stream event to attach the model prompt only where something
 * will actually show it:
 *
 *   send({ type: "write", status: "start", ...promptField(prompt) });
 *
 * On production this contributes nothing, so the event goes out exactly as it
 * did before the pipeline existed.
 */
export function promptField(prompt: string | null | undefined): { prompt?: string } {
  return PREVIEW_TOOLS_ENABLED && prompt ? { prompt } : {};
}
