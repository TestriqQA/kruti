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

export const IMAGE_THEMES: ImageTheme[] = [
  {
    id: "paper",
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
