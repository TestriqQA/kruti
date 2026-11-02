/**
 * Image style taxonomy - the single source of truth for the per-post image
 * style, chosen once by the posts model and honoured by every image path.
 *
 * The flow this serves: "generate 5 posts" asks the model to read the strategy
 * and all five bodies and pick, per post, the ONE style that fits that post.
 * The id lands on Post.imageStyle, and from then on it is the instruction -
 * single image, bulk and carousel alike draw in that style and nothing re-picks
 * it. Dependency-free so routes and client components can both import it.
 *
 * Each entry pins THREE things, because the style list deliberately mixes two
 * axes - some entries name a format ("infographic", "quote card") and some name
 * a rendering register ("photorealistic", "3D isometric"):
 *
 *   genApproach   - layout dispatch for the code-rendered fallback
 *   visualStyle   - the lib/image-styles.ts register this style MUST render in.
 *                   Before this existed the brief model re-picked the register
 *                   on every generation from a seeded slice, so a photographic
 *                   style could come back as a flat cartoon and nothing
 *                   reconciled the two.
 *   imageDirection- one line written straight into the IMAGE prompt. The
 *                   category used to reach only the text brief; buildArtImagePrompt
 *                   took a `formatLabel` it never interpolated, so the image
 *                   model was never told the post's format at all.
 */

export type RenderApproach =
  | "designed-infographic"
  | "diagram"
  | "comparison"
  | "text-card"
  | "banner"
  | "meme"
  | "realistic-scene";

export interface ImageCategory {
  /** Stable, persisted in Post.imageStyle - never rename once stored. */
  id: string;
  label: string;
  /** Grouping, used only to help the posts model spread its choices. */
  group: string;
  genApproach: RenderApproach;
  /** A lib/image-styles.ts id. Pinned, not re-chosen per generation. */
  visualStyle: string;
  /** One line for the text brief: what this format must contain. */
  briefGuidance: string;
  /** One line for the image prompt: what the picture must BE. */
  imageDirection: string;
  /** True = a representative scene with people, never a fabricated portrait. */
  personal?: boolean;
}

export const GROUP_PHOTO = "Photographic & Human";
export const GROUP_DATA = "Data & Structure";
export const GROUP_ILLUSTRATION = "Illustration & Sketch";
export const GROUP_CARD = "Cards & Product";

/**
 * Must stay an id that exists below. getImageCategory() asserts non-null on
 * this lookup, so dropping it turns every unknown id into a runtime crash
 * instead of a fallback.
 */
export const DEFAULT_IMAGE_CATEGORY = "infographic";

export const IMAGE_CATEGORIES: ImageCategory[] = [
  // ── Photographic & Human ──────────────────────────────────────────────────
  {
    id: "photorealistic-photo",
    label: "Photorealistic Photo",
    group: GROUP_PHOTO,
    genApproach: "realistic-scene",
    visualStyle: "photoreal-documentary",
    personal: true,
    briefGuidance:
      "A real photographic moment - a professional at work, an office scene, a product staged on a desk. Minimal or no text; the photograph carries the idea.",
    imageDirection:
      "a genuine photograph, not an illustration: real optics, real depth of field, natural light with direction, true materials and contact shadows. People appear representative and candid - over-the-shoulder, hands, mid-gesture - never a posed portrait of an identifiable individual.",
  },
  {
    id: "meme-humor",
    label: "Meme / Relatable Humor",
    group: GROUP_PHOTO,
    genApproach: "meme",
    visualStyle: "flat-cartoon",
    briefGuidance:
      "One relatable single-panel visual gag with ONE short punchy caption line, light and funny; no chart, structure or node labels.",
    imageDirection:
      "a single-panel joke that reads in one second: one clear situation, one exaggerated reaction, one caption. Composition stays simple and uncluttered so the gag lands before anything is read.",
  },
  {
    id: "comic-strip",
    label: "Comic Strip / Editorial Cartoon",
    group: GROUP_PHOTO,
    genApproach: "meme",
    visualStyle: "flat-cartoon",
    briefGuidance:
      "A 2 to 3 panel comic or one editorial cartoon that makes a point through a small narrative beat; short speech lines only, no body copy.",
    imageDirection:
      "a comic laid out in clean rectangular panels with visible gutters, read left to right. Expressive characters, bold outlines, speech bubbles with short lines correctly spelled. An editorial cartoon instead uses one framed scene with a clear visual punchline.",
  },

  // ── Data & Structure ──────────────────────────────────────────────────────
  {
    id: "infographic",
    label: "Infographic / Cheat Sheet",
    group: GROUP_DATA,
    genApproach: "designed-infographic",
    visualStyle: "3d-icon-scene",
    briefGuidance:
      "A rich explainer graphic: a named information-design structure with icons, organised node labels, optional feature cards, and a prominent headline that teaches the whole post at a glance.",
    imageDirection:
      "a designed explainer page: a deliberate information structure with clear sections, icons that carry meaning, and a headline that teaches the point at a glance. Everything aligns to a grid; nothing floats.",
  },
  {
    id: "data-chart",
    label: "Data Chart / Statistical Visual",
    group: GROUP_DATA,
    genApproach: "text-card",
    visualStyle: "data-poster",
    briefGuidance:
      "A chart-led graphic built on ONE real figure or comparison from the post - bar, line, donut or a single dominant stat. Never invent a number the post does not contain.",
    imageDirection:
      "a data poster where the chart IS the composition: one bold, clean chart form - bars, a line, a donut, or one giant figure - drawn to scale with a sane baseline. Axis values and gridline numbers stay absent; the shape carries the story and only the labelled strings are readable.",
  },
  {
    id: "flowchart-framework",
    label: "Flowchart / Process / Framework",
    group: GROUP_DATA,
    genApproach: "diagram",
    visualStyle: "isometric-scene",
    briefGuidance:
      "A relationship or flow map - hub-and-spoke, funnel, matrix, or ordered stages connected by arrows - that shows how the parts relate or follow one another.",
    imageDirection:
      "a process or framework diagram: boxes and nodes joined by unmistakable directional arrows on a clear path, with a visible start and end. Structure and connectors come first; decoration comes last.",
  },
  {
    id: "mind-map",
    label: "Mind Map / Concept Map",
    group: GROUP_DATA,
    genApproach: "diagram",
    visualStyle: "flat-cartoon",
    briefGuidance:
      "One central idea with branches radiating to 3 to 6 related sub-ideas; the branching itself is the message, not a sequence.",
    imageDirection:
      "a mind map radiating from ONE central node: organic curved branches fanning outward to labelled sub-nodes, thicker near the centre and thinner at the tips. Balanced around the centre, never a straight-line list.",
  },
  {
    id: "before-after",
    label: "Comparison / Before & After",
    group: GROUP_DATA,
    genApproach: "comparison",
    visualStyle: "editorial-article",
    briefGuidance:
      "A two-side split on one shared axis - left is before, the problem or the myth; right is after, the fix or the fact - emphasising the difference between the sides.",
    imageDirection:
      "one frame split cleanly down the middle by a visible divider, the two halves sharing a subject and a camera angle so the difference reads instantly. Left muted or strained, right accented and resolved. Each side carries one short label and nothing else.",
  },

  // ── Illustration & Sketch ─────────────────────────────────────────────────
  {
    id: "vector-illustration",
    label: "Vector Illustration / Flat 2D",
    group: GROUP_ILLUSTRATION,
    genApproach: "designed-infographic",
    visualStyle: "flat-cartoon",
    briefGuidance:
      "A flat vector scene carrying the idea through simple characters and objects, with one headline and few or no labels.",
    imageDirection:
      "flat 2D vector art: solid fills, no gradients and no photographic texture, clean geometric shapes, a tight palette, and generous negative space. Looks drawn in a vector editor, not rendered or photographed.",
  },
  {
    id: "isometric-3d",
    label: "3D Isometric / Rendered",
    group: GROUP_ILLUSTRATION,
    genApproach: "designed-infographic",
    visualStyle: "isometric-scene",
    briefGuidance:
      "A small built world on an angled grid - objects, screens and figures arranged as a tidy three-dimensional scene that shows how the pieces sit together.",
    imageDirection:
      "an isometric 3D render on a consistent angled grid: every object shares one projection angle, soft studio lighting, believable materials and clean edges. A miniature diorama of the idea, not a flat drawing.",
  },
  {
    id: "handwritten-sketch",
    label: "Handwritten Note / Whiteboard",
    group: GROUP_ILLUSTRATION,
    genApproach: "diagram",
    visualStyle: "hand-drawn-sketch",
    briefGuidance:
      "A whiteboard, notebook page or sticky-note wall where the idea is sketched by hand - a few short hand-lettered phrases and rough arrows, not polished type.",
    imageDirection:
      "a hand-drawn surface: marker on a whiteboard, pen in a notebook, or sticky notes on a wall. Imperfect strokes, slight wobble, hand-lettering that is still perfectly legible and correctly spelled, rough arrows and underlines. Nothing in it should look typeset.",
  },

  // ── Cards & Product ───────────────────────────────────────────────────────
  {
    id: "quote-card",
    label: "Quote / Typography Card",
    group: GROUP_CARD,
    genApproach: "text-card",
    visualStyle: "editorial-article",
    briefGuidance:
      "One short quote or pull-line set LARGE as hero typography with optional attribution; the words are the design, no structure or nodes.",
    imageDirection:
      "a typography card where the type IS the artwork: one short line set very large with confident spacing and real hierarchy, on a clean colour field. Any imagery stays a quiet texture behind the words.",
  },
  {
    id: "social-screenshot",
    label: "Social Media Screenshot",
    group: GROUP_CARD,
    genApproach: "text-card",
    visualStyle: "device-mockup",
    briefGuidance:
      "A believable single social-post card - avatar, handle, body, meta row - reproducing the post's key line verbatim, correctly spelled, never a garbled fake.",
    imageDirection:
      "a convincing screenshot of one social post - X, LinkedIn or a Reddit thread: real UI chrome, an avatar circle, a handle row, a like and reply row, correct corner radii and spacing. It should look captured from a phone, not drawn.",
  },
  {
    id: "ui-mockup",
    label: "UI Mockup / Dashboard / Device",
    group: GROUP_CARD,
    genApproach: "text-card",
    visualStyle: "device-mockup",
    briefGuidance:
      "A product interface shown in a device frame - a dashboard, an app screen, a tool - with only the labels the post names. Never invent metric names or figures.",
    imageDirection:
      "a clean product interface inside a believable device frame - laptop, monitor or phone: a real layout with a sidebar, cards and controls, correct radii and shadow, screen glow against the surround. Charts inside it are abstract shapes carrying no invented numbers.",
  },
  {
    id: "playbook-cover",
    label: "Book / Playbook / Checklist Mockup",
    group: GROUP_CARD,
    genApproach: "text-card",
    visualStyle: "device-mockup",
    briefGuidance:
      "A tangible printed artefact - a book or playbook cover, or a checklist sheet of 3 to 6 short do/verify items with tick marks.",
    imageDirection:
      "a physical printed object staged as a product shot: a book or playbook cover with real spine and page thickness, or a printed checklist sheet lying on a surface. Paper texture, a soft cast shadow and a slight angle so it reads as an object you could pick up.",
  },
  {
    id: "event-banner",
    label: "Event / Webinar / Announcement",
    group: GROUP_CARD,
    genApproach: "banner",
    visualStyle: "dark-tech-poster",
    briefGuidance:
      "A promo banner for an event, webinar, launch or hiring push: a title, a date or detail line, and one CTA element. Dates and CTAs are load-bearing and must be spelled exactly.",
    imageDirection:
      "a promotional event banner: one confident title locked to the centre of the 1:1 safe area, a supporting detail line, and one clear call-to-action element shaped like a button or ribbon. Celebratory and brand-forward, with the title dominant.",
  },
];

export const IMAGE_CATEGORY_IDS = new Set(IMAGE_CATEGORIES.map((c) => c.id));

export const IMAGE_CATEGORY_GROUPS: { group: string; items: ImageCategory[] }[] = [
  GROUP_PHOTO,
  GROUP_DATA,
  GROUP_ILLUSTRATION,
  GROUP_CARD,
].map((group) => ({ group, items: IMAGE_CATEGORIES.filter((c) => c.group === group) }));

/**
 * Ids this taxonomy used to have, mapped to their nearest replacement.
 *
 * Post.imageStyle is already populated on every generated post, and the ids
 * below are gone from the list above. Without this map clampImageStyle() would
 * coerce every one of those rows to "infographic" - silently rewriting the
 * chosen format of the entire back catalogue, with no error anywhere to notice
 * it by. Keep an entry here for any id ever removed.
 */
const LEGACY_STYLE_MAP: Record<string, string> = {
  "workplace-meme": "meme-humor",
  "storytelling-scene": "photorealistic-photo",
  "behind-the-scenes": "photorealistic-photo",
  "desk-setup": "photorealistic-photo",
  "concept-metaphor": "photorealistic-photo",
  "framework-diagram": "flowchart-framework",
  "timeline-roadmap": "flowchart-framework",
  "checklist-card": "playbook-cover",
  "myth-vs-fact": "before-after",
  "document-carousel": "infographic",
  "x-screenshot": "social-screenshot",
  "announcement-card": "event-banner",
  "big-stat-hero": "data-chart",
};

/**
 * Labels, normalised, pointing back at their id.
 *
 * The prompt asks for an id, but a model handed a list of "id: description"
 * lines will sometimes answer with the human label instead. Without this,
 * "Meme / Relatable Humor" fails every lookup and the post silently becomes an
 * infographic - the exact failure that is invisible until someone reads the DB.
 */
const LABEL_TO_ID = new Map(
  IMAGE_CATEGORIES.map((c) => [c.label.trim().toLowerCase(), c.id])
);

/** Current id, label, or legacy id mapped forward; else undefined. */
function canonicalId(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const text = String(raw).trim().toLowerCase();
  const id = text.replace(/\s+/g, "-");
  if (IMAGE_CATEGORY_IDS.has(id)) return id;
  if (LEGACY_STYLE_MAP[id]) return LEGACY_STYLE_MAP[id];
  return LABEL_TO_ID.get(text);
}

export function isImageCategoryId(v: unknown): v is string {
  return typeof v === "string" && IMAGE_CATEGORY_IDS.has(v);
}

/**
 * Kept for compatibility. Nothing branches on it any more: every style now
 * goes to the image model, and lib/render-card.tsx survives only as the
 * single-image failure fallback.
 */
export function usesCodeRender(category: ImageCategory): boolean {
  return category.genApproach !== "realistic-scene" && category.genApproach !== "meme";
}

/** Look up a style, mapping legacy ids forward, else the safe default. */
export function getImageCategory(id: string | null | undefined): ImageCategory {
  const canonical = canonicalId(id);
  return (
    IMAGE_CATEGORIES.find((c) => c.id === canonical) ||
    IMAGE_CATEGORIES.find((c) => c.id === DEFAULT_IMAGE_CATEGORY)!
  );
}

/**
 * The style the renderer should use. Every style in the list is renderable by
 * both the single-image and the carousel path now, so this is a straight
 * lookup - it stays a separate export because every image route calls it.
 */
export function resolveImageCategory(id: string | null | undefined): ImageCategory {
  return getImageCategory(id);
}

/** Normalise a model-supplied value to a valid style id, else the default. */
export function clampImageStyle(raw: unknown): string {
  return canonicalId(raw as string) ?? DEFAULT_IMAGE_CATEGORY;
}

export function getImageCategoryLabel(id: string | null | undefined): string {
  return getImageCategory(id).label;
}

/** Badge classes keyed on the group (do NOT reuse getPostTypeColor). */
export function getImageCategoryColor(id: string | null | undefined): string {
  const group = getImageCategory(id).group;
  if (group === GROUP_PHOTO)
    return "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300";
  if (group === GROUP_CARD)
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  if (group === GROUP_ILLUSTRATION)
    return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300";
  return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
}

/** Grouped "- id: guidance" block injected into the posts prompt so flash can choose. */
export function imageStyleTaxonomyBlock(): string {
  return IMAGE_CATEGORY_GROUPS.map(({ group, items }) => {
    const lines = items.map((c) => `- ${c.id}: ${c.briefGuidance}`).join("\n");
    return `${group}:\n${lines}`;
  }).join("\n\n");
}
