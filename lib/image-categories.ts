/**
 * Image category taxonomy - the single source of truth for the per-post image
 * FORMAT (e.g. infographic, meme, quote card, before/after, realistic scene).
 *
 * The flash text model picks the best-fit category id per post during content
 * generation (stored on Post.imageStyle); the single-image generation then renders
 * a format-appropriate visual instead of always an infographic. Dependency-free so
 * both server routes and the client editor can import it.
 */

export type RenderApproach =
  | "designed-infographic"
  | "diagram"
  | "comparison"
  | "text-card"
  | "banner"
  | "meme"
  | "realistic-scene"
  | "carousel-hint";

export interface ImageCategory {
  id: string; // stable, persisted in Post.imageStyle - never rename once stored
  label: string; // shown in the editor dropdown
  group: string; // optgroup heading
  genApproach: RenderApproach;
  briefGuidance: string; // one line telling the brief/render how this format differs
  /** True = not rendered by the single-image button (just an editor hint). */
  hint?: boolean;
  /** True = a realistic representative scene, never a fabricated portrait of a person. */
  personal?: boolean;
}

export const GROUP_RELATABLE = "Relatable & Human";
export const GROUP_EDUCATIONAL = "Educational & Authority";
export const GROUP_BRANDED = "Branded & Quick-Hit";

export const DEFAULT_IMAGE_CATEGORY = "infographic";

export const IMAGE_CATEGORIES: ImageCategory[] = [
  // ── Relatable & Human ─────────────────────────────────────────────────────
  {
    id: "workplace-meme",
    label: "Workplace Meme",
    group: GROUP_RELATABLE,
    genApproach: "meme",
    briefGuidance:
      "One relatable single-panel visual gag with ONE short punchy caption line, light and funny; no chart, structure, or node labels.",
  },
  {
    id: "storytelling-scene",
    label: "Storytelling / Action Shot",
    group: GROUP_RELATABLE,
    genApproach: "realistic-scene",
    personal: true,
    briefGuidance:
      "Editorial, photoreal scene of a professional in the post's moment - a REPRESENTATIVE person shot over-the-shoulder or face-away, never a fabricated portrait of a specific individual; minimal or no text.",
  },
  {
    id: "behind-the-scenes",
    label: "Behind the Scenes",
    group: GROUP_RELATABLE,
    genApproach: "realistic-scene",
    personal: true,
    briefGuidance:
      "Candid, documentary-feel work-in-progress moment (whiteboard, hands on a keyboard, a team room); representative and anonymous, never a posed portrait; minimal text.",
  },
  {
    id: "desk-setup",
    label: "Desk / Setup",
    group: GROUP_RELATABLE,
    genApproach: "realistic-scene",
    personal: true,
    briefGuidance:
      "Tasteful flat-lay or three-quarter shot of a believable desk, workstation, and tools; photoreal, correctly-proportioned objects, no face needed; minimal text.",
  },
  {
    id: "concept-metaphor",
    label: "Conceptual Metaphor",
    group: GROUP_RELATABLE,
    genApproach: "realistic-scene",
    briefGuidance:
      "One striking focal metaphor (a lighthouse in fog, a bridge over a gap) carrying the idea with atmosphere and depth; not personal, text-light.",
  },

  // ── Educational & Authority ───────────────────────────────────────────────
  {
    id: "infographic",
    label: "Infographic / Cheat Sheet",
    group: GROUP_EDUCATIONAL,
    genApproach: "designed-infographic",
    briefGuidance:
      "A rich explainer graphic: a named information-design structure with icons, organized node labels, optional feature cards, and a prominent headline that teaches the whole post at a glance.",
  },
  {
    id: "framework-diagram",
    label: "Framework / Diagram",
    group: GROUP_EDUCATIONAL,
    genApproach: "diagram",
    briefGuidance:
      "A relationship or flow map (hub-and-spoke, matrix, funnel, connected nodes with connectors) that shows how the parts relate, structure-and-arrows first rather than a list.",
  },
  {
    id: "checklist-card",
    label: "Checklist Card",
    group: GROUP_EDUCATIONAL,
    genApproach: "text-card",
    briefGuidance:
      "A clean vertical checklist of 3 to 6 short do/verify items with tick marks; text-forward save-bait with one accent, no complex structure (the nodes ARE the checklist items).",
  },
  {
    id: "timeline-roadmap",
    label: "Timeline / Roadmap",
    group: GROUP_EDUCATIONAL,
    genApproach: "diagram",
    briefGuidance:
      "A sequential timeline or roadmap of ordered milestones/stages along one clear line or path, emphasising order and progression (the nodes are the milestones).",
  },
  {
    id: "myth-vs-fact",
    label: "Myth vs Fact",
    group: GROUP_EDUCATIONAL,
    genApproach: "comparison",
    briefGuidance:
      "A two-column debunk: a MYTH side (crossed/muted) versus a FACT side (accented), each with a short real line; contrast is the point, not a transformation.",
  },
  {
    id: "document-carousel",
    label: "Document Carousel (use Carousel button)",
    group: GROUP_EDUCATIONAL,
    genApproach: "carousel-hint",
    hint: true,
    briefGuidance:
      "This post is best made as a multi-slide carousel - use the separate Carousel button. On the single-image button it falls back to an infographic.",
  },

  // ── Branded & Quick-Hit ───────────────────────────────────────────────────
  {
    id: "quote-card",
    label: "Quote Card",
    group: GROUP_BRANDED,
    genApproach: "text-card",
    briefGuidance:
      "One short quote or pull-line set LARGE as hero typography with optional attribution, on a strong colour field; the words are the design, no structure or nodes.",
  },
  {
    id: "x-screenshot",
    label: "Social Post Screenshot",
    group: GROUP_BRANDED,
    genApproach: "text-card",
    briefGuidance:
      "A believable, clean single social-post card (avatar, handle, body, meta row) reproducing the post's key line verbatim, with realistic UI chrome, correctly spelled, never a garbled fake.",
  },
  {
    id: "event-banner",
    label: "Event / Webinar Banner",
    group: GROUP_BRANDED,
    genApproach: "banner",
    briefGuidance:
      "A promo banner with an event title, date/time, and one CTA element centred in the 1:1 safe area; the date and CTA are load-bearing text and must be spelled exactly.",
  },
  {
    id: "announcement-card",
    label: "Announcement / Hiring",
    group: GROUP_BRANDED,
    genApproach: "banner",
    briefGuidance:
      "A bold announcement card (launch, milestone, or We're Hiring) with one confident headline and a short supporting line; celebratory and brand-forward, minimal extra text.",
  },
  {
    id: "before-after",
    label: "Before & After / Teardown",
    group: GROUP_BRANDED,
    genApproach: "comparison",
    briefGuidance:
      "A two-panel split on one shared axis (left = before/problem, right = after/fixed) emphasising the transformation between the panels (the nodes are the two side labels).",
  },
  {
    id: "big-stat-hero",
    label: "Big Stat Hero",
    group: GROUP_BRANDED,
    genApproach: "text-card",
    briefGuidance:
      "ONE giant dominant figure or percentage as the hero with a short context line and a single supporting icon; use only when the post genuinely contains a real stat, never an invented number.",
  },
];

export const IMAGE_CATEGORY_IDS = new Set(IMAGE_CATEGORIES.map((c) => c.id));

export const IMAGE_CATEGORY_GROUPS: { group: string; items: ImageCategory[] }[] = [
  GROUP_RELATABLE,
  GROUP_EDUCATIONAL,
  GROUP_BRANDED,
].map((group) => ({ group, items: IMAGE_CATEGORIES.filter((c) => c.group === group) }));

export function isImageCategoryId(v: unknown): v is string {
  return typeof v === "string" && IMAGE_CATEGORY_IDS.has(v);
}

/**
 * Is this format laid out in code, or sent to the image model?
 *
 * Information design (a headline, labels, a structure) is laid out in code via
 * lib/render-card.tsx: the text comes out correctly spelled and correctly sized
 * every time, the palette is applied from tokens, and it costs nothing. A
 * diffusion model cannot be instructed to do any of that reliably.
 *
 * The photographic formats - one meme and four realistic scenes - still go to
 * the image model, because a believable scene is exactly what it IS good at and
 * what code cannot produce.
 *
 * This is the single place the split is decided; every image route branches on it.
 */
export function usesCodeRender(category: ImageCategory): boolean {
  return category.genApproach !== "realistic-scene" && category.genApproach !== "meme";
}

/** Look up a category, falling back to the safe default (infographic). */
export function getImageCategory(id: string | null | undefined): ImageCategory {
  return (
    IMAGE_CATEGORIES.find((c) => c.id === id) ||
    IMAGE_CATEGORIES.find((c) => c.id === DEFAULT_IMAGE_CATEGORY)!
  );
}

/**
 * Resolve the category that the single-image renderer should actually use: a
 * carousel-hint category renders as the default infographic (the single-image
 * button never invokes the carousel pipeline).
 */
export function resolveImageCategory(id: string | null | undefined): ImageCategory {
  const cat = getImageCategory(id);
  return cat.genApproach === "carousel-hint" ? getImageCategory(DEFAULT_IMAGE_CATEGORY) : cat;
}

/** Normalise a model-supplied value to a valid category id, else the default. */
export function clampImageStyle(raw: unknown): string {
  const id = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-");
  return IMAGE_CATEGORY_IDS.has(id) ? id : DEFAULT_IMAGE_CATEGORY;
}

export function getImageCategoryLabel(id: string | null | undefined): string {
  return getImageCategory(id).label;
}

/** Badge classes keyed on the group (do NOT reuse getPostTypeColor). */
export function getImageCategoryColor(id: string | null | undefined): string {
  const group = getImageCategory(id).group;
  if (group === GROUP_RELATABLE)
    return "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300";
  if (group === GROUP_BRANDED)
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
}

/** Grouped "- id: guidance" block injected into the posts prompt so flash can choose. */
export function imageStyleTaxonomyBlock(): string {
  return IMAGE_CATEGORY_GROUPS.map(({ group, items }) => {
    const lines = items.map((c) => `- ${c.id}: ${c.briefGuidance}`).join("\n");
    return `${group}:\n${lines}`;
  }).join("\n\n");
}
