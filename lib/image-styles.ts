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
      "One cinematic, photorealistic conceptual image that carries the whole idea on its own - a real scene, a cross-section, or two halves of a split frame compared side by side. Dramatic natural light, genuine materials and texture, deep focus, magazine-cover production value. The picture should explain the point before any words are read.",
  },
  {
    id: "photoreal-documentary",
    name: "Documentary workplace photograph",
    when: "process, teamwork, culture and behind-the-scenes moments",
    textLoad: "low",
    direction:
      "A candid, natural-light documentary photograph of real people at work - a whiteboard session, hands on a keyboard, a team mid-discussion - shot over the shoulder or from the side. Authentic office textures, no posed stock-photo smiles, shallow depth of field.",
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
export function visualStyleMenuBlock(): string {
  return VISUAL_STYLES.map(
    (s) => `- "${s.id}" (${s.name}, carries ${s.textLoad} text): ${s.when}`
  ).join("\n");
}
