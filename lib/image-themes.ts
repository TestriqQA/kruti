/**
 * Design tokens for code-rendered post images.
 *
 * ─── Why a fixed menu instead of model-chosen colours ────────────────────────
 *
 * The image brief used to carry `palette` as prose ("a dark ink ground with one
 * bright accent and light text"), which is the only form a diffusion model can
 * consume. Code rendering needs actual values, and letting the text model emit
 * raw hex is worse than it sounds: it happily returns accent-on-background pairs
 * that fail contrast, or three colours that clash.
 *
 * So the model picks a theme ID from this curated list and supplies only the
 * CONTENT. Every palette here is checked for legible text-on-background and
 * text-on-accent contrast, which means no generated image can come out
 * unreadable - the failure mode that no amount of prompt wording fixed.
 *
 * The spread intentionally mirrors the register the brief prompt already asks
 * for: light editorial, deep editorial, bold colour-block, muted minimal, warm,
 * earthy, and cool/technical. Five light and five dark, so two posts with
 * different moods genuinely look different.
 *
 * IDs are persisted in Post.imagePrompt text only, never in a column, so they
 * are safe to rename - but keep the list stable so repeat generations of the
 * same post stay recognisable.
 */

export interface ImageTheme {
  id: string;
  /** Short human name, used in the brief prompt so the model can choose on vibe. */
  name: string;
  /** When to pick it, in the model's terms. */
  when: string;
  mode: "light" | "dark";
  /**
   * Which family this palette belongs to.
   *
   * An image style names the families that suit it, and the palette is drawn
   * from those. That is what ties the colour to the post: the style was chosen
   * from the post's own content, so the colour follows the content instead of
   * being a hash with no relationship to the subject at all.
   */
  family: ThemeFamily;
  /** Page background. */
  bg: string;
  /** A slightly offset background for bands and alternating rows. */
  bgAlt: string;
  /** Card / panel fill. */
  surface: string;
  /** Card / panel hairline. */
  border: string;
  /** Primary text. */
  text: string;
  /** Secondary text - subheadlines, captions. */
  textMuted: string;
  /** The single accent. */
  accent: string;
  /** Text placed on top of `accent`. */
  onAccent: string;
  /**
   * The palette described in WORDS.
   *
   * The art-directed image prompt uses this instead of the hex values. Hex
   * codes handed to an image model get lettered onto the artwork - an early
   * version shipped a graphic with a row of colour swatches reading #0F172A,
   * #38BDF8 across the bottom, because any literal string in a prompt can end
   * up as design copy.
   */
  palettePhrase: string;
}

export type ThemeFamily = "neutral" | "warm" | "cool" | "natural" | "vivid";

export const THEME_FAMILIES: ThemeFamily[] = ["neutral", "warm", "cool", "natural", "vivid"];

export const IMAGE_THEMES: ImageTheme[] = [
  {
    id: "paper",
    family: "neutral",
    palettePhrase: "a warm off-white paper field, charcoal type, and a single burnt-amber accent",
    name: "Light editorial",
    when: "measured, credible, analytical posts",
    mode: "light",
    bg: "#FAF7F2",
    bgAlt: "#F2EDE4",
    surface: "#FFFFFF",
    border: "#E7DFD3",
    text: "#1C1917",
    textMuted: "#6B6560",
    accent: "#B45309",
    onAccent: "#FFFFFF",
  },
  {
    id: "ink",
    family: "neutral",
    palettePhrase: "a near-black ink field, light type, and one warm amber accent",
    name: "Deep editorial",
    when: "bold, declarative, thought-leadership posts",
    mode: "dark",
    bg: "#0E1014",
    bgAlt: "#15181F",
    surface: "#1A1F28",
    border: "#2A313D",
    text: "#F3F4F6",
    textMuted: "#9AA1AC",
    accent: "#F59E0B",
    onAccent: "#1C1917",
  },
  {
    id: "slate",
    family: "cool",
    palettePhrase: "a deep navy-slate field, pale type, and one bright sky-blue accent",
    name: "Cool technical",
    when: "engineering, data, and systems posts",
    mode: "dark",
    bg: "#0F172A",
    bgAlt: "#162136",
    surface: "#1B2436",
    border: "#2C3850",
    text: "#E8EDF5",
    textMuted: "#94A3B8",
    accent: "#38BDF8",
    onAccent: "#062033",
  },
  {
    id: "sage",
    family: "natural",
    palettePhrase: "a soft pale-green field, deep forest-green type, and a muted sage accent",
    name: "Earthy natural",
    when: "grounded, human, people-and-culture posts",
    mode: "light",
    bg: "#F1F4EF",
    bgAlt: "#E5EBE1",
    surface: "#FFFFFF",
    border: "#D5DED0",
    text: "#1F2A20",
    textMuted: "#5F6F60",
    accent: "#4F7A52",
    onAccent: "#FFFFFF",
  },
  {
    id: "clay",
    family: "warm",
    palettePhrase: "a warm cream field, dark brown type, and a terracotta accent",
    name: "Warm craft",
    when: "personal stories and lessons learned",
    mode: "light",
    bg: "#FBF3EC",
    bgAlt: "#F3E6DA",
    surface: "#FFFFFF",
    border: "#E8D5C4",
    text: "#2B1E17",
    textMuted: "#7A6354",
    accent: "#C2563B",
    onAccent: "#FFFFFF",
  },
  {
    id: "mono",
    family: "neutral",
    palettePhrase: "a clean white field, near-black type, and a single crimson accent",
    name: "High contrast mono",
    when: "sharp, contrarian, single-point posts",
    mode: "light",
    bg: "#FFFFFF",
    bgAlt: "#F4F4F5",
    surface: "#FAFAFA",
    border: "#E4E4E7",
    text: "#09090B",
    textMuted: "#52525B",
    accent: "#E11D48",
    onAccent: "#FFFFFF",
  },
  {
    id: "teal",
    family: "natural",
    palettePhrase: "a pale mint field, deep teal type, and a strong teal accent",
    name: "Crisp clinical",
    when: "process, operations, and how-to posts",
    mode: "light",
    bg: "#F0FAF9",
    bgAlt: "#DFF2F0",
    surface: "#FFFFFF",
    border: "#C7E5E1",
    text: "#0F2E2B",
    textMuted: "#4E7A75",
    accent: "#0D7E74",
    onAccent: "#FFFFFF",
  },
  {
    id: "indigo",
    family: "vivid",
    palettePhrase: "a deep indigo field, pale lilac type, and a bright lime accent",
    name: "Bold statement",
    when: "launches, wins, and celebratory posts",
    mode: "dark",
    bg: "#1E1B4B",
    bgAlt: "#282363",
    surface: "#2A2566",
    border: "#3F3885",
    text: "#EEF0FF",
    textMuted: "#A9ADDD",
    accent: "#A3E635",
    onAccent: "#1A2E05",
  },
  {
    id: "block",
    family: "natural",
    palettePhrase: "a rich dark-teal field, mint type, and a warm apricot accent",
    name: "Colour block",
    when: "energetic, opinionated, high-contrast posts",
    mode: "dark",
    bg: "#134E4A",
    bgAlt: "#10433F",
    surface: "#0F3F3C",
    border: "#1F6460",
    text: "#ECFDF5",
    textMuted: "#99D6CC",
    accent: "#FDBA74",
    onAccent: "#431407",
  },
  {
    id: "plum",
    family: "vivid",
    palettePhrase: "a dark plum field, pale lavender type, and a soft violet accent",
    name: "Muted minimal",
    when: "reflective, nuanced, quieter posts",
    mode: "dark",
    bg: "#1A1324",
    bgAlt: "#221A30",
    surface: "#251B33",
    border: "#382A4C",
    text: "#F2EBFA",
    textMuted: "#AFA1C2",
    accent: "#C4B5FD",
    onAccent: "#2E1065",
  },
  {
    id: "sand",
    family: "neutral",
    palettePhrase: "a warm sand field, espresso-brown type, and a rust accent",
    name: "Warm sand",
    when: "grounded, practical, hands-on posts",
    mode: "light",
    bg: "#F7F1E6",
    bgAlt: "#EDE4D3",
    surface: "#FFFDF8",
    border: "#DFD2BC",
    text: "#2B2117",
    textMuted: "#776A58",
    accent: "#A8502A",
    onAccent: "#FFFFFF",
  },
  {
    id: "ember",
    family: "warm",
    palettePhrase: "a soft ivory field, deep maroon type, and a burnt-orange accent",
    name: "Ember",
    when: "urgent, high-stakes or cautionary posts",
    mode: "light",
    bg: "#FDF6F0",
    bgAlt: "#F7E8DC",
    surface: "#FFFFFF",
    border: "#EBD3C1",
    text: "#4A1D1D",
    textMuted: "#8A5A4C",
    accent: "#C2410C",
    onAccent: "#FFFFFF",
  },
  {
    id: "rose",
    family: "warm",
    palettePhrase: "a pale blush field, deep plum type, and a dusty-rose accent",
    name: "Blush",
    when: "human, empathetic, culture and people posts",
    mode: "light",
    bg: "#FDF2F4",
    bgAlt: "#F8E3E8",
    surface: "#FFFFFF",
    border: "#EFCDD5",
    text: "#3F1D2B",
    textMuted: "#8A5E6C",
    accent: "#BE4A6E",
    onAccent: "#FFFFFF",
  },
  {
    id: "bronze",
    family: "warm",
    palettePhrase: "a dark bronze-brown field, warm cream type, and an antique-gold accent",
    name: "Bronze",
    when: "craft, mastery and long-game posts",
    mode: "dark",
    bg: "#1F1711",
    bgAlt: "#2A1F17",
    surface: "#2E2219",
    border: "#453326",
    text: "#F6EDE1",
    textMuted: "#B6A28B",
    accent: "#D9A441",
    onAccent: "#1F1711",
  },
  {
    id: "steel",
    family: "cool",
    palettePhrase: "a cool grey-blue field, ink-navy type, and an electric-blue accent",
    name: "Steel",
    when: "engineering, infrastructure and systems posts",
    mode: "light",
    bg: "#F1F4F8",
    bgAlt: "#E3E9F1",
    surface: "#FFFFFF",
    border: "#CFD8E4",
    text: "#162032",
    textMuted: "#5D6B80",
    accent: "#1D4ED8",
    onAccent: "#FFFFFF",
  },
  {
    id: "arctic",
    family: "cool",
    palettePhrase: "an icy white-blue field, deep slate type, and a bright cyan accent",
    name: "Arctic",
    when: "clean, precise, data and tooling posts",
    mode: "light",
    bg: "#F2F9FC",
    bgAlt: "#E2F1F8",
    surface: "#FFFFFF",
    border: "#C7E0EC",
    text: "#13303C",
    textMuted: "#5B7C89",
    accent: "#0891B2",
    onAccent: "#FFFFFF",
  },
  {
    id: "midnight",
    family: "cool",
    palettePhrase: "a near-black navy field, ice-blue type, and a warm coral accent",
    name: "Midnight",
    when: "serious, after-hours, incident and risk posts",
    mode: "dark",
    bg: "#0B1120",
    bgAlt: "#121A2C",
    surface: "#161F33",
    border: "#243049",
    text: "#E6EEFB",
    textMuted: "#95A6C2",
    accent: "#FB7185",
    onAccent: "#0B1120",
  },
  {
    id: "forest",
    family: "natural",
    palettePhrase: "a deep forest field, pale sage type, and a warm amber accent",
    name: "Deep forest",
    when: "sustainable, steady, long-term growth posts",
    mode: "dark",
    bg: "#0F1C16",
    bgAlt: "#16271E",
    surface: "#1A2D23",
    border: "#264035",
    text: "#E4F0E8",
    textMuted: "#9BB5A6",
    accent: "#E0A33C",
    onAccent: "#0F1C16",
  },
  {
    id: "citrus",
    family: "vivid",
    palettePhrase: "a warm white field, charcoal type, and a vivid orange accent",
    name: "Citrus",
    when: "energetic, launch and momentum posts",
    mode: "light",
    bg: "#FFFBF4",
    bgAlt: "#FFF1DC",
    surface: "#FFFFFF",
    border: "#F2DCBC",
    text: "#1F1A14",
    textMuted: "#776C5C",
    accent: "#EA580C",
    onAccent: "#FFFFFF",
  },
  {
    id: "berry",
    family: "vivid",
    palettePhrase: "a deep wine field, blush-pink type, and a hot-magenta accent",
    name: "Berry",
    when: "bold, contrarian, attention-grabbing posts",
    mode: "dark",
    bg: "#1E0B18",
    bgAlt: "#2A1123",
    surface: "#2F1427",
    border: "#452037",
    text: "#F9E6F1",
    textMuted: "#C093AF",
    accent: "#EC4899",
    onAccent: "#1E0B18",
  },
];

export const DEFAULT_THEME_ID = "paper";

const THEME_BY_ID = new Map(IMAGE_THEMES.map((t) => [t.id, t]));

export const IMAGE_THEME_IDS = IMAGE_THEMES.map((t) => t.id);

/**
 * Resolve a theme id to tokens.
 *
 * `seed` makes the fallback DETERMINISTIC but still varied: when the model
 * returns an unknown id, a post always lands on the same theme rather than a
 * different one on every regeneration, and different posts still get different
 * themes instead of everything collapsing onto "paper".
 */
export function resolveTheme(id: string | null | undefined, seed?: string): ImageTheme {
  const hit = id ? THEME_BY_ID.get(id.trim().toLowerCase()) : undefined;
  if (hit) return hit;
  if (seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    return IMAGE_THEMES[Math.abs(h) % IMAGE_THEMES.length];
  }
  return THEME_BY_ID.get(DEFAULT_THEME_ID) ?? IMAGE_THEMES[0];
}

/**
 * A well-mixed 32-bit hash of a string.
 *
 * The avalanche tail is the point. Plain FNV-1a leaves structure in its LOW
 * bits, and `% IMAGE_THEMES.length` reads exactly those - so without it,
 * similarly-shaped seeds (cuids, which is what post ids are) clump onto a
 * handful of palettes and the spread this module promises never happens.
 */
function hash32(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  h ^= h >>> 15;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Pick this image's palette IN CODE. The model is not asked any more.
 *
 * It used to choose, from a seeded slice of the menu, and the result was that
 * every image came out green. Three reasons, all of them measured:
 *
 *  1. The carousel and code-render paths called themeMenuBlock() with NO seed,
 *     and seededSlice() returns the whole list unrotated when the seed is
 *     missing - so those paths saw the same ten options in the same order on
 *     every post, for every user, and never had any variety mechanism at all.
 *  2. Even where the seed WAS passed, the slice keeps 6 of 10 and the three
 *     green-ish palettes sit at indices 3, 6 and 8 - so all ten rotations
 *     leave at least one of them on the menu. Checked: 10/10 rotations, and
 *     14/14 real posts were offered a green.
 *  3. The choice was then the model's, and it has a strong content-correlated
 *     colour prior - growth, hiring, people and sustainability posts all pull
 *     it to green. A per-call "vary this across posts" line cannot fix that,
 *     because each brief is a separate call that has never seen the others.
 *
 * So the menu is gone and the palette is assigned here, evenly over the whole
 * list. Deterministic on the seed, so a given post keeps its look instead of
 * reshuffling on every regeneration; `offset` is there for callers that want
 * to step a post deliberately onto the next palette.
 */
/**
 * Pick a palette from the families that suit this post's image style.
 *
 * assignTheme() spreads evenly over all twenty, which is varied but says
 * nothing about the post. The style was chosen by the model from the post's
 * own content, so letting the style name its families is what makes the
 * colour follow the subject - a hiring story and an incident teardown stop
 * drawing from the same pool.
 *
 * Falls back to the whole list if a style names no family, so a missing
 * mapping degrades to the old even spread rather than to nothing.
 */
export function assignThemeFrom(
  families: readonly ThemeFamily[] | undefined,
  seed: string,
  offset = 0
): ImageTheme {
  const pool = families?.length
    ? IMAGE_THEMES.filter((t) => families.includes(t.family))
    : [];
  const list = pool.length > 0 ? pool : IMAGE_THEMES;
  return list[(hash32(seed || "") + offset) % list.length];
}

export function assignTheme(seed: string, offset = 0): ImageTheme {
  const i = (hash32(seed || "") + offset) % IMAGE_THEMES.length;
  return IMAGE_THEMES[i];
}

/**
 * `#rrggbb` -> `rgba(r, g, b, a)`.
 *
 * The hybrid renderer lays the text over a generated picture, and the scrim that
 * keeps that text readable has to be the theme's own background colour at a
 * partial alpha - otherwise a light theme over a bright photo is unreadable and
 * a dark theme over a dark photo disappears. Satori has no colour functions, so
 * the conversion happens here.
 */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

/** The menu, formatted for the brief prompt. */

/**
 * A stable number from a string, so the same post always gets the same slice
 * and a regenerate does not reshuffle the look.
 */
function seedHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Rotate the list by the seed and drop a slice of it.
 *
 * Rotating alone is not enough - the model reads the whole menu, so order
 * barely moves its choice. Removing options does. `keep` stays generous so
 * there is always a sensible fit for any subject; it only stops one option
 * winning on every post.
 */
function seededSlice<T>(items: readonly T[], seed: string | undefined, keepRatio: number): readonly T[] {
  if (!seed || items.length < 4) return items;
  const h = seedHash(seed);
  const rotated = [...items.slice(h % items.length), ...items.slice(0, h % items.length)];
  const keep = Math.max(3, Math.round(items.length * keepRatio));
  return rotated.slice(0, keep);
}

/**
 * The palette menu for the brief prompt.
 *
 * Seeded the same way the style menu is, and for the same reason: every image
 * was arriving in the same dark blue because the model, seeing one post at a
 * time, had no way to know it had already used that palette.
 */
export function themeMenuBlock(seed?: string): string {
  return seededSlice(IMAGE_THEMES, seed, 0.6)
    .map((t) => `- "${t.id}" (${t.name}, ${t.mode}): ${t.when}`)
    .join("\n");
}

/** The ids on offer for this seed - must match what the menu shows. */
export function themeIdsFor(seed?: string): string[] {
  return seededSlice(IMAGE_THEMES, seed, 0.6).map((t) => t.id);
}
