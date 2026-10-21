/**
 * Visual style palette for post images.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────────
 *
 * The renderer went through two wrong turns before this. First it asked a
 * diffusion model, in prose, to lay out type - which it cannot do reliably.
 * Then it over-corrected: the text moved into code and the "image" became a
 * headline over a stack of rounded rectangles, later a headline over a stock
 * photograph. Both were legible and both were lifeless.
 *
 * What a good LinkedIn graphic actually does is carry the whole idea VISUALLY -
 * a 3D scene, a product mockup, a character, a cross-section, a data poster -
 * with a short headline set INSIDE that artwork, not bolted on top of it. The
 * current image models do this well, and they do it best when the brief names a
 * concrete visual register instead of asking for "a professional image".
 *
 * So the model picks one style from this menu per post and gets that style's
 * `direction` verbatim in the prompt. The menu is deliberately wide - a meme, a
 * security teardown, a hiring post and a founder story should not look like
 * variations of one house template.
 *
 * `textLoad` is how much type the style can carry before it stops being art and
 * starts being a slide. Styles that score "low" get a headline only; "high"
 * styles can hold a headline plus a few labels. Keeping that honest is what
 * stops an image model being asked to spell a paragraph.
 */

export interface VisualStyle {
  id: string;
  name: string;
  /** When the model should reach for it, in its own terms. */
  when: string;
  /** How much on-image text it can carry well. */
  textLoad: "low" | "medium" | "high";
  /** Injected verbatim into the image prompt. Concrete, not adjectives. */
  direction: string;
}

export const VISUAL_STYLES: VisualStyle[] = [
  {
    id: "3d-icon-scene",
    name: "Glossy 3D icon scene",
    when: "explaining a tool, a stack, a skill or a how-it-works idea",
    textLoad: "high",
    direction:
      "A polished 3D-rendered scene: softly lit glossy objects and rounded icon tiles floating on a clean brand-coloured field, with subtle connecting lines between them and soft contact shadows. Think a modern SaaS launch graphic - dimensional, bright, uncluttered, with real depth and a clear focal object at the centre.",
  },
  {
    id: "device-mockup",
    name: "Product / device mockup",
    when: "showing an app, a screen, a workflow or a product in use",
    textLoad: "high",
    direction:
      "A realistic device mockup as the hero - a phone or laptop shown at a slight three-quarter angle with a clean, believable interface on its screen - surrounded by a few floating rounded UI pills and small 3D objects that hint at the feature set. Soft gradient background, gentle shadows, crisp edges.",
  },
  {
    id: "dark-tech-poster",
    name: "Dark technical poster",
    when: "security, data, infrastructure, risk and anything with a hard number",
    textLoad: "high",
    direction:
      "A dark, high-contrast technical poster: near-black background, one cool accent colour glowing lightly, layered translucent panels or stacked numbered bars arranged with real perspective, a blurred laptop or workspace in the lower third, and small sharp icons. Cinematic, premium, editorial - the look of a serious security or engineering report cover.",
  },
  {
    id: "data-poster",
    name: "Bold data poster",
    when: "stages, breakdowns, comparisons of several items, or a day-in-the-life",
    textLoad: "high",
    direction:
      "A bold flat-design poster built from large colour blocks - two to four panels in confident, distinct colours - each carrying one clean line-art icon. Strong grid, generous margins, no gradients, no photographs. The look of a well-made editorial infographic poster.",
  },
  {
    id: "photoreal-concept",
    name: "Cinematic concept photograph",
    when: "a contrast, a trade-off, a before and after, or a big-picture metaphor",
    textLoad: "low",
    direction:
      "One cinematic, photorealistic conceptual image that carries the whole idea on its own and stops a thumb mid-scroll - a cutaway revealing what is underneath, two halves of a split frame set against each other, an object caught at the moment it gives way, a scale so exaggerated it reads instantly. Dramatic directional light, genuine materials and texture, deep focus, magazine-cover production value. It should explain the point before a single word is read, and be strange enough to be worth looking at twice.",
  },
  {
    id: "photoreal-documentary",
    name: "Documentary workplace photograph",
    when: "process, teamwork, culture and behind-the-scenes moments",
    textLoad: "low",
    direction:
      "A candid documentary photograph caught mid-MOMENT, not a picture of an office. Something is happening in the frame: a decision landing, someone leaning back from a screen, two people disagreeing over a diagram, a hand frozen mid-gesture, a room reacting. Shoot it like a photojournalist - a deliberate angle rather than eye-level centre: low from the desk, high looking down, through a doorway, past a foreground object, caught in a reflection. Hard directional light, deep shadow, real texture, shallow depth of field. Turn every monitor away from camera or catch it at a steep angle so it reads as glow and colour, never as an interface. No posed smiles, no flat overhead fluorescent, no stock-photo calm.",
  },
  {
    id: "pixar-character",
    name: "Pixar-style 3D character",
    when: "relatable, funny or human moments from working life",
    textLoad: "medium",
    direction:
      "A warm Pixar-style 3D character illustration - an expressive animal or person in a believable, detailed workplace, big friendly eyes, soft rounded forms, cinematic lighting and rich colour. Charming and funny rather than corporate, with small storytelling props in the scene.",
  },
  {
    id: "flat-cartoon",
    name: "Flat cartoon illustration",
    when: "a joke, a conversation, a relatable scenario or a light take",
    textLoad: "high",
    direction:
      "A clean 2D flat cartoon illustration with simple characters, soft pastel background and clear speech bubbles. Friendly, modern editorial-illustration style - flat shapes, minimal shading, bold readable lettering inside the bubbles.",
  },
  {
    id: "hand-drawn-sketch",
    name: "Hand-drawn sketch",
    when: "wry humour, a confession, a lesson learned the hard way",
    textLoad: "medium",
    direction:
      "A loose hand-drawn illustration on warm off-white paper - ink linework with a light wash of one or two accent colours, slightly imperfect strokes, handwritten-feeling captions. Charming, personal, like a smart doodle from a notebook.",
  },
  {
    id: "ghibli-illustration",
    name: "Painterly Ghibli-style scene",
    when: "a journey, a reflection, a quieter or more personal story",
    textLoad: "low",
    direction:
      "A soft painterly anime-style illustration in the spirit of hand-painted Studio Ghibli backgrounds - lush detail, warm atmospheric light, gentle colour grading, a lone figure or small scene set in a larger landscape. Nostalgic and calm, painted rather than rendered.",
  },
  {
    id: "isometric-scene",
    name: "Isometric illustration",
    when: "a system, an architecture, a pipeline or how parts connect",
    textLoad: "high",
    direction:
      "A clean isometric vector illustration: small 3D-looking blocks, servers, screens and figures arranged on an angled grid, connected by clear paths, in a restrained three-colour palette with flat shading. Technical and tidy, like a modern architecture diagram.",
  },
  {
    id: "editorial-article",
    name: "Editorial article card",
    when: "an opinion, an announcement or something framed as published commentary",
    textLoad: "high",
    direction:
      "A newspaper- or magazine-style article card: a masthead strip across the top, a serif headline, a byline line, and one illustrated or photographic image sitting below it inside the card. Clean print-editorial typography on a light paper field.",
  },
];

export const VISUAL_STYLE_IDS = VISUAL_STYLES.map((s) => s.id);

const BY_ID = new Map(VISUAL_STYLES.map((s) => [s.id, s]));

export const DEFAULT_VISUAL_STYLE = "3d-icon-scene";

/**
 * Resolve a style id.
 *
 * `seed` makes an unrecognised id fall back deterministically but variedly, so
 * a post keeps the same look across regenerations while two different posts do
 * not both collapse onto the default.
 */
export function resolveVisualStyle(id: string | null | undefined, seed = ""): VisualStyle {
  const hit = id ? BY_ID.get(id.trim().toLowerCase()) : undefined;
  if (hit) return hit;
  if (seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    return VISUAL_STYLES[Math.abs(h) % VISUAL_STYLES.length];
  }
  return BY_ID.get(DEFAULT_VISUAL_STYLE) ?? VISUAL_STYLES[0];
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
 * The menu, formatted for the brief prompt.
 *
 * With a seed, each post sees a different two thirds of the list. Measured
 * before this: isometric-scene took 4 of 11 posts and the images all looked
 * alike. The prompt's own "vary this across posts" line cannot do the job on
 * its own, because each brief is a separate call with no sight of the others.
 */
export function visualStyleMenuBlock(seed?: string): string {
  return seededSlice(VISUAL_STYLES, seed, 0.66)
    .map((s) => `- "${s.id}" (${s.name}, carries ${s.textLoad} text): ${s.when}`)
    .join("\n");
}

/** The ids on offer for this seed - must match what the menu shows. */
export function visualStyleIdsFor(seed?: string): string[] {
  return seededSlice(VISUAL_STYLES, seed, 0.66).map((s) => s.id);
}

/**
 * Page layouts.
 *
 * ─── Why this exists ─────────────────────────────────────────────────────────
 *
 * The brief asked for a "scene" and a headline, and got exactly that: an
 * illustration with type bolted on afterwards, floating with no structure. Set
 * beside a graphic briefed by hand, the gap was not the illustration or the
 * model - it was that one had a LAYOUT and the other did not. A LinkedIn graphic
 * is a designed page: a text zone, an art zone, and a type hierarchy that reads
 * as one statement. Naming the layout up front is what produces that.
 */
export interface PageLayout {
  id: string;
  when: string;
  direction: string;
}

export const PAGE_LAYOUTS: PageLayout[] = [
  {
    id: "split-text-left",
    when: "a claim with a few supporting points, and an illustration that earns real space",
    direction:
      "Divide the frame vertically. The left 40 percent is a text column, flush left on a clean field: the stat line at the top if there is one, then the headline, then the subhead, then the chips in a row at its foot. The right 60 percent is the artwork, running to the edge. Keep a clear gutter between them and never let artwork intrude into the text column.",
  },
  {
    id: "split-text-right",
    when: "the same, when the artwork reads better entering from the left",
    direction:
      "Divide the frame vertically. The right 40 percent is a text column, flush left on a clean field: the stat line at the top if there is one, then the headline, then the subhead, then the chips at its foot. The left 60 percent is the artwork, running to the edge. Keep a clear gutter between them.",
  },
  {
    id: "headline-top",
    when: "a single strong statement over a scene or diagram",
    direction:
      "Headline across the top third as flat graphic type on a clean band of background, with the subhead directly beneath it. The artwork fills the remaining two thirds edge to edge. Chips, if any, sit in a single row along the very bottom.",
  },
  {
    id: "hero-stat",
    when: "one number that IS the post",
    direction:
      "One figure dominates the centre of the frame at enormous size - it is the subject, not a caption. The headline sits beneath it, smaller, continuing the sentence the figure starts rather than repeating it. Supporting artwork frames the figure on one or both sides without crowding it. Chips, if any, run along the bottom.",
  },
  {
    id: "full-bleed-art",
    when: "a photograph or a scene strong enough to carry the post alone",
    direction:
      "The artwork fills the entire frame. The headline sits in one deliberately uncluttered corner or band of that artwork, as flat graphic type with enough contrast behind it to stay readable. No chips, no subhead - let the picture do the work.",
  },
];

export const PAGE_LAYOUT_IDS = PAGE_LAYOUTS.map((l) => l.id);

const LAYOUT_BY_ID = new Map(PAGE_LAYOUTS.map((l) => [l.id, l]));

export function resolvePageLayout(id: string | null | undefined, seed = ""): PageLayout {
  const hit = id ? LAYOUT_BY_ID.get(id.trim().toLowerCase()) : undefined;
  if (hit) return hit;
  if (seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    return PAGE_LAYOUTS[Math.abs(h) % PAGE_LAYOUTS.length];
  }
  return PAGE_LAYOUTS[0];
}

export function pageLayoutMenuBlock(): string {
  return PAGE_LAYOUTS.map((l) => `- "${l.id}": ${l.when}`).join("\n");
}
