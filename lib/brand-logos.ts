/**
 * Real brand marks, composited onto a finished image rather than drawn by the
 * model.
 *
 * ─── Why this exists ────────────────────────────────────────────────────────
 *
 * The art prompt has always asked for "genuine, instantly recognisable
 * real-world marks... in their true official colours and correct proportions".
 * Image models cannot do it. The shipped example is a post whose Next.js
 * wordmark came out with a broken N and whose Node mark read "n*dc". The
 * prompt's own escape hatch - leave it out rather than ship a mangled logo -
 * is why newer models often draw no marks at all.
 *
 * So the marks are not generated. They are fetched as real vector files and
 * laid onto the image after the model is done, which is the only way they come
 * out right every time.
 *
 * ─── Where the marks come from ──────────────────────────────────────────────
 *
 * Simple Icons, ~3,400 brands, resolved by name at generation time. No asset
 * library to curate: the model already names the products a post talks about
 * (`brief.brands`), and those names are looked up directly.
 *
 * Known gap, and it is theirs not ours: Simple Icons has removed a number of
 * large brands over trademark policy. AWS, Amazon and LinkedIn are all absent
 * as of this writing. An unresolved name is dropped silently - a missing mark
 * is a non-event, a wrong one is not.
 */

const INDEX_URL =
  "https://raw.githubusercontent.com/simple-icons/simple-icons/master/data/simple-icons.json";

/** `https://cdn.simpleicons.org/<slug>/<hex>` renders the mark in that colour. */
const CDN = "https://cdn.simpleicons.org";

type IconRecord = { title: string; hex: string; aliases?: { aka?: string[] } };

/** Resolved once per server instance. The index is ~460 KB and rarely changes. */
let indexPromise: Promise<Map<string, string>> | null = null;

/**
 * Simple Icons' documented slug rule: lowercase, spell out a few symbols, then
 * strip everything that is not a letter or a digit. "Next.js" -> "nextdotjs".
 */
function toSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\+/g, "plus")
    .replace(/\./g, "dot")
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/** Loose key for matching a post's wording against an icon title. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** name -> slug, including every alias the index declares. */
async function loadIndex(): Promise<Map<string, string>> {
  if (!indexPromise) {
    indexPromise = (async () => {
      const map = new Map<string, string>();
      try {
        const res = await fetch(INDEX_URL);
        if (!res.ok) throw new Error(`index HTTP ${res.status}`);
        const icons = (await res.json()) as IconRecord[];
        for (const icon of icons) {
          const slug = toSlug(icon.title);
          map.set(norm(icon.title), slug);
          for (const aka of icon.aliases?.aka ?? []) map.set(norm(aka), slug);
        }
        console.log(`[BrandLogos] index loaded, ${map.size} names`);
      } catch (err) {
        // Cached as an empty map on purpose: one failed fetch should not have
        // every image generation retry it.
        console.error("[BrandLogos] index failed:", (err as Error).message);
      }
      return map;
    })();
  }
  return indexPromise;
}

/** The slug for a brand as a post names it, or null if there is no such mark. */
export async function resolveBrandSlug(name: string): Promise<string | null> {
  const index = await loadIndex();
  if (index.size === 0) return null;
  const key = norm(name);
  if (index.has(key)) return index.get(key)!;
  // "Next.js framework" -> "nextjs": try the leading words too, longest first.
  const words = name.trim().split(/\s+/);
  for (let take = words.length - 1; take >= 1; take--) {
    const hit = index.get(norm(words.slice(0, take).join(" ")));
    if (hit) return hit;
  }
  return null;
}

export interface ResolvedLogo {
  name: string;
  slug: string;
  svg: Buffer;
}

/**
 * Fetch the marks for the brands a post names, in that order, dropping any
 * that cannot be resolved. Returns at most `limit` - a strip of six logos
 * reads as a sponsor banner, not a credit.
 */
export async function fetchBrandLogos(
  names: string[],
  opts?: { colour?: string; limit?: number }
): Promise<ResolvedLogo[]> {
  const limit = opts?.limit ?? 4;
  const colour = (opts?.colour ?? "ffffff").replace(/^#/, "");
  const out: ResolvedLogo[] = [];

  for (const name of names) {
    if (out.length >= limit) break;
    const slug = await resolveBrandSlug(name);
    if (!slug) {
      console.log(`[BrandLogos] no mark for "${name}" - skipped`);
      continue;
    }
    if (out.some((l) => l.slug === slug)) continue;
    try {
      const res = await fetch(`${CDN}/${slug}/${colour}`);
      if (!res.ok) {
        console.warn(`[BrandLogos] ${slug} HTTP ${res.status}`);
        continue;
      }
      out.push({ name, slug, svg: Buffer.from(await res.arrayBuffer()) });
    } catch (err) {
      console.warn(`[BrandLogos] ${slug} failed:`, (err as Error).message);
    }
  }

  if (out.length > 0) {
    console.log(`[BrandLogos] ${out.map((l) => l.slug).join(", ")}`);
  }
  return out;
}

/** Whether compositing is switched on. Off reverts to model-drawn marks. */
export function brandLogosEnabled(): boolean {
  return (process.env.BRAND_LOGOS ?? "on").trim().toLowerCase() !== "off";
}

/**
 * Lay the marks along the foot of a finished image.
 *
 * A strip rather than placement inside the scene: the model composed the
 * artwork and nothing here knows what is where, so dropping a logo into it
 * would land on a face as often as on a free surface. A credit bar at the foot
 * is a shape readers already know, and it is correct every single time.
 *
 * Returns the original buffer untouched if there is nothing to add or anything
 * goes wrong - an image with no marks beats no image.
 */
export async function compositeLogoStrip(
  image: Buffer,
  logos: ResolvedLogo[],
  opts?: { barAlpha?: number }
): Promise<Buffer> {
  if (logos.length === 0) return image;

  try {
    const sharp = (await import("sharp")).default;
    const base = sharp(image);
    const { width = 0, height = 0 } = await base.metadata();
    if (!width || !height) return image;

    const barH = Math.round(height * 0.14);
    const logoH = Math.round(barH * 0.52);
    const gap = Math.round(barH * 0.46);
    const barTop = height - barH;

    // Rasterise each mark at the target height, then measure it - wordmarks
    // and glyph marks have wildly different aspect ratios, so a fixed width
    // would squash half of them.
    const rendered = await Promise.all(
      logos.map(async (l) => {
        const buf = await sharp(l.svg, { density: 384 })
          .resize({ height: logoH, fit: "inside" })
          .png()
          .toBuffer();
        const meta = await sharp(buf).metadata();
        return { buf, w: meta.width ?? logoH, h: meta.height ?? logoH };
      })
    );

    const totalW = rendered.reduce((n, r) => n + r.w, 0) + gap * (rendered.length - 1);
    if (totalW > width * 0.9) return image; // would crowd the edges - skip it

    // Opaque, not a wash. The model is told to keep this band clear, but a
    // translucent bar over anything it did put there reads as a mistake rather
    // than a design - the mark ends up sitting in someone else's text.
    const alpha = opts?.barAlpha ?? 1;
    const bar = Buffer.from(
      `<svg width="${width}" height="${barH}">` +
        `<rect width="${width}" height="${barH}" fill="rgba(13,17,26,${alpha})"/>` +
        `<rect width="${width}" height="1" fill="rgba(255,255,255,0.10)"/>` +
        `</svg>`
    );

    let x = Math.round((width - totalW) / 2);
    const layers: { input: Buffer; top: number; left: number }[] = [
      { input: bar, top: barTop, left: 0 },
    ];
    for (const r of rendered) {
      layers.push({ input: r.buf, top: barTop + Math.round((barH - r.h) / 2), left: x });
      x += r.w + gap;
    }

    return await base.composite(layers).jpeg({ quality: 95, chromaSubsampling: "4:4:4" }).toBuffer();
  } catch (err) {
    console.error("[BrandLogos] composite failed:", (err as Error).message);
    return image;
  }
}
