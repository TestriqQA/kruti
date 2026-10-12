import fs from "node:fs";
import path from "node:path";

/**
 * Fonts for the code-rendered post images (lib/render-card.tsx).
 *
 * ─── Why the files are vendored rather than fetched ──────────────────────────
 *
 * Satori has no bundled fallback face: hand it no font and it throws. So the
 * font cannot be a runtime dependency on an external CDN - a slow or unreachable
 * fonts.googleapis.com would mean no image at all, not a slightly worse one.
 *
 * The three weights therefore live in lib/fonts and are read from disk once per
 * instance. They came from Google Fonts' css2 endpoint, which serves WOFF;
 * Satori reads ttf, otf and woff (but NOT woff2), so woff is correct here - do
 * not "upgrade" these files to woff2.
 *
 * lib/fonts rather than public/fonts on purpose. Files under public/ are served
 * by the CDN and are not guaranteed to exist on a serverless function's own
 * filesystem, so a read at request time can fail in production while working
 * perfectly in dev. These are server-only assets, and next.config.mjs pins them
 * into the function bundle with outputFileTracingIncludes - if you move them,
 * move that entry too.
 *
 * Satori converts every glyph to an SVG <path>, so the rasteriser afterwards
 * needs no font support at all. That is what lets sharp - already a dependency
 * for image cropping - do the PNG step, instead of adding a second native module.
 */

export interface RenderFont {
  name: string;
  data: Buffer;
  weight: 400 | 600 | 800;
  style: "normal";
}

/** Must match the `fontFamily` the layouts set. */
export const FONT_FAMILY = "Inter";

const WEIGHTS: Array<400 | 600 | 800> = [400, 600, 800];

let cached: RenderFont[] | null = null;

/**
 * The font set for Satori.
 *
 * Deliberately throws if a file is missing rather than degrading: a render with
 * no font produces a blank image, and a loud failure at the first image is far
 * easier to diagnose than silently empty graphics. The caller
 * (renderAndStoreDesignedImage) already turns a throw into a clean user-facing
 * error.
 */
export function getRenderFonts(): RenderFont[] {
  if (cached) return cached;

  const dir = path.join(process.cwd(), "lib", "fonts");
  cached = WEIGHTS.map((weight) => ({
    name: FONT_FAMILY,
    data: fs.readFileSync(path.join(dir, `Inter-${weight}.woff`)),
    weight,
    style: "normal" as const,
  }));
  return cached;
}
