import { generateProText, generateTextWithConfig, parseJSON } from "@/lib/gemini";
import {
  buildImageBriefPrompt,
  buildDesignBriefPrompt,
  buildArtBriefPrompt,
  buildCarouselDesignPrompt,
  UserVisualProfile,
} from "@/lib/prompts";
import { usesCodeRender, type ImageCategory } from "@/lib/image-categories";
import { IMAGE_THEME_IDS, themeMenuBlock, themeIdsFor } from "@/lib/image-themes";
import {
  VISUAL_STYLE_IDS,
  visualStyleMenuBlock,
  visualStyleIdsFor,
  PAGE_LAYOUT_IDS,
  pageLayoutMenuBlock,
} from "@/lib/image-styles";
import { iconMenuBlock } from "@/lib/image-icons";

/**
 * Content-aware image briefs.
 *
 * The text model reads a post's real title + body and, acting as a senior marketing
 * designer, returns a brief for ONE rich, designed INFOGRAPHIC-style image that
 * explains the post at a glance: a named information-design STRUCTURE (roadmap,
 * hub-and-spoke, comparison, staircase, dashboard, pipeline, card grid) built from the
 * post, meaningful icons, organized informative labels (nodes + optional feature
 * cards), a prominent headline + subheadline, and a polished, content-matched look.
 */

/**
 * One brief, two very different shapes depending on how the image is produced.
 *
 * CODE-RENDERED formats (the twelve designed ones) only populate the text
 * fields plus `themeId` - they are laid out by lib/render-card.tsx, so there is
 * nothing for a prose art direction to do.
 *
 * PHOTOGRAPHIC formats (meme + realistic scenes) still populate `visual`,
 * `style` and `palette`, because those are what the image model consumes.
 *
 * Hence the optionality: the four art-direction fields used to be required, and
 * were being generated - at real token cost - for designed formats that then
 * threw them away.
 */
export interface ImageBrief {
  headline: string; // prominent bold headline (2-6 words, <=34 chars)
  subheadline: string; // one supporting subheadline line (<=70 chars), "" if none
  nodes: string[]; // short real labels from the post (steps / stages / comparison sides)
  /** Code-rendered only: one icon concept per node, same order and length. */
  icons?: string[];
  /** Code-rendered only: the icon concept representing the post as a whole. */
  heroIcon?: string;
  /** Hybrid only: art direction for the TEXT-FREE picture behind the graphic. */
  backgroundScene?: string;
  /** Art-directed only: the full composition the model should draw. */
  scene?: string;
  /** Art-directed only: the chosen register from lib/image-styles.ts. */
  visualStyle?: string;
  /** Art-directed only: the single focal object or character. */
  subject?: string;
  /** Art-directed only: real products the post names, drawn as genuine logos. */
  brands?: string[];
  /** Art-directed only: how the page is built. See PAGE_LAYOUTS. */
  layout?: string;
  /** Art-directed only: the one big figure, when the post turns on a number. */
  statLine?: string;
  /** Art-directed only: supporting line under the headline. */
  subhead?: string;
  /** Art-directed only: short benefit pills. */
  chips?: string[];
  /** True when the model was unavailable and this brief knows only the title. */
  degraded?: boolean;
  cards: string[]; // 0-4 optional short feature/benefit chips from the post
  bodyText?: string; // hero words for text-card formats (quote / stat / screenshot line)

  /** Code-rendered only: the chosen palette id from lib/image-themes.ts. */
  themeId?: string;

  /** Photographic only: art-director brief for the image model. */
  visual?: string;
  /** Photographic only: the aesthetic register. */
  style?: string;
  /** Photographic only: colour + light direction, in prose. */
  palette?: string;
  /** Photographic only: the named information-design layout. */
  structure?: string;
  /** Photographic only: per-post art-direction line. */
  theme?: string;
  /** Photographic only: one short caption line for a meme. */
  caption?: string;
}

export interface CarouselSlide {
  headline: string;
  subheadline?: string;
  icons?: string[];
  heroIcon?: string;
  /** Hybrid only: art direction for the TEXT-FREE picture behind this slide. */
  backgroundScene?: string;
  /** Short labels carrying the slide's detail; [] on the hook and takeaway slides. */
  nodes?: string[];

  /** Photographic-era fields, unused by the code renderer. */
  structure?: string;
  visual?: string;
  connectsFrom?: string;
  connectsTo?: string;
}

export interface CarouselPlan {
  /** The ONE palette id shared by every slide - what makes the set read as a set. */
  themeId?: string;
  slides: CarouselSlide[]; // exactly `count` entries, in carousel order (hook ... takeaway)

  /** Photographic-era fields, unused by the code renderer. */
  theme?: string;
  style?: string;
  palette?: string;
}

const DEFAULT_PALETTE =
  "warm directional light on rich neutral tones, deep charcoal shadows, one confident accent colour drawn from the subject.";

/** Collapse whitespace, strip wrapping quotes, hard-cap length. */
export function clampHeadline(raw: string, max = 40): string {
  const s = (raw || "")
    .replace(/\s+/g, " ")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  // Trim back to a word boundary so on-image text is never cut mid-word (unless the
  // first word itself is longer than max).
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim();
}

/** Subheadline: one clean line, capped so it stays a supporting line. */
export function clampSubhead(raw: unknown): string {
  return clampHeadline(String(raw ?? ""), 70);
}

/**
 * Normalise the chosen palette id.
 *
 * Returns undefined rather than the default for anything unrecognised, so
 * resolveTheme() seeds from the post id instead - an unknown id then still
 * yields a real, varied palette rather than collapsing every such post onto
 * the same one.
 */
export function clampThemeId(raw: unknown): string | undefined {
  const s = String(raw ?? "").trim().toLowerCase();
  return IMAGE_THEME_IDS.includes(s) ? s : undefined;
}

/** Hero body text for text-card formats (a quote, a big stat, a screenshot line). */
export function clampBodyText(raw: unknown): string {
  return clampHeadline(String(raw ?? ""), 200);
}

/** The named aesthetic register. Falls back to a safe marketing-infographic look. */
export function clampStyle(raw: unknown): string {
  const s = String(raw ?? "")
    .replace(/\s+/g, " ")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim()
    .slice(0, 90)
    .trim();
  return s || "clean modern marketing infographic";
}

/** The information-design layout. Falls back to a safe, common structure. */
export function clampStructure(raw: unknown): string {
  const s = String(raw ?? "")
    .replace(/\s+/g, " ")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .trim()
    .slice(0, 90)
    .trim();
  return s || "a clean labeled diagram of connected nodes";
}

/**
 * Normalise the on-image label list (nodes or cards): trim, strip quotes, dedupe,
 * hard-cap each label's length and the list length so the graphic stays readable and
 * never a wall of text. Any missing/garbage value safely becomes [].
 */
export function clampLabels(raw: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    // clampHeadline trims back to a word boundary; this did not, and a chip
    // one character over the cap shipped onto a real graphic reading
    // "Optimize Core Web Vita". A label cut mid-word is worse than a label
    // dropped, so cut at a space when there is a sensible one to cut at.
    const s = clampHeadline(String(item ?? ""), maxLen);
    const key = s.toLowerCase();
    if (s && !seen.has(key)) {
      seen.add(key);
      out.push(s);
      if (out.length === maxItems) break;
    }
  }
  return out;
}

/**
 * What gets stored in Post.imagePrompt for a code-rendered image.
 *
 * Deliberately the CONTENT, not a prompt: there is no prompt any more. Admin
 * analytics surfaces this field behind its privacy gate, and the words that were
 * actually set on the graphic are far more useful there than a paragraph of
 * art direction that no longer describes anything.
 */
export function describeDesignBrief(category: ImageCategory, brief: ImageBrief): string {
  const parts: string[] = [`[${category.label}]`, brief.headline || "(no headline)"];
  if (brief.subheadline) parts.push(`- ${brief.subheadline}`);
  if (brief.bodyText) parts.push(`| hero: ${brief.bodyText}`);
  if (brief.nodes.length > 0) parts.push(`| labels: ${brief.nodes.join(" / ")}`);
  if (brief.cards.length > 0) parts.push(`| chips: ${brief.cards.join(", ")}`);
  parts.push(`| theme: ${brief.themeId ?? "auto"}`);
  return parts.join(" ");
}

/** A 2-6 word headline derived from the post title, used when the model fails. */
function headlineFromTitle(title: string): string {
  const words = (title || "Key insight").trim().split(/\s+/).slice(0, 6).join(" ");
  return clampHeadline(words, 34) || "Key insight";
}

/** Content-only fallback for a code-rendered format, when the model is down. */
function fallbackDesignBrief(
  post: { title: string; postType: string },
  category: ImageCategory
): ImageBrief {
  return {
    headline: headlineFromTitle(post.title),
    subheadline: "",
    nodes: [],
    cards: [],
    bodyText: category.genApproach === "text-card" ? clampBodyText(post.title) : "",
    // Left undefined on purpose: resolveTheme() then picks deterministically
    // from the post id, so a fallback image still gets a real palette and two
    // different posts do not both come out in the default one.
    themeId: undefined,
  };
}

/** Scene brief for the photographic formats, when the model is down. */
function fallbackSceneBrief(
  post: { title: string; postType: string },
  category: ImageCategory,
  headline?: string
): ImageBrief {
  const role = (headline || "").trim() || "professional";
  const isMeme = category.genApproach === "meme";
  return {
    style: "editorial photoreal, natural light",
    structure: "",
    headline: isMeme ? headlineFromTitle(post.title) : "",
    subheadline: "",
    visual: `A tasteful, realistic editorial scene representing "${post.title}" for the world of a ${role} - believable real objects and natural light; ${category.briefGuidance}`,
    nodes: [],
    cards: [],
    palette: "natural daylight, real materials, soft true-to-life colour.",
    caption: isMeme ? headlineFromTitle(post.title) : "",
  };
}

/**
 * Brief for a CODE-RENDERED format: the words on the graphic, plus a theme id.
 *
 * Uses the flash model, not the pro planner. The pro tier was there to write a
 * rich art-direction paragraph for a diffusion model; this asks for a headline,
 * a supporting line and a handful of labels drawn from the post, which flash
 * does just as well for a fraction of the cost. The temperature is kept up so
 * two similar posts still choose different themes.
 */
async function getDesignBrief(
  post: { title: string; body: string; postType: string },
  category: ImageCategory,
  userProfile?: UserVisualProfile
): Promise<ImageBrief> {
  const prompt = buildDesignBriefPrompt(
    post.title,
    post.body,
    post.postType,
    category,
    themeMenuBlock(),
    IMAGE_THEME_IDS.join("|"),
    iconMenuBlock(),
    userProfile
  );

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await generateTextWithConfig(prompt, { temperature: 1.1 });
      const parsed = parseJSON<Partial<ImageBrief>>(raw);
      const headline = clampHeadline(parsed.headline || "", 34);
      // A headline is the only hard requirement - every layout is built to
      // degrade gracefully when nodes, cards or bodyText are missing.
      if (headline) {
        return {
          headline,
          subheadline: clampSubhead(parsed.subheadline),
          nodes: clampLabels(parsed.nodes, 5, 28),
          cards: clampLabels(parsed.cards, 4, 22),
          bodyText: clampBodyText(parsed.bodyText),
          themeId: clampThemeId(parsed.themeId),
          icons: clampLabels(parsed.icons, 5, 24),
          heroIcon: clampHeadline(String(parsed.heroIcon ?? ""), 24),
          backgroundScene: clampHeadline(String(parsed.backgroundScene ?? ""), 400),
        };
      }
    } catch (err) {
      console.error(`[DesignBrief] attempt ${attempt + 1} failed:`, (err as Error).message);
    }
  }
  return fallbackDesignBrief(post, category);
}

/** Brief for a PHOTOGRAPHIC format: an art direction the image model consumes. */
async function getSceneBrief(
  post: { title: string; body: string; postType: string },
  category: ImageCategory,
  userProfile?: UserVisualProfile
): Promise<ImageBrief> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Pro-tier planner here: a believable scene brief genuinely benefits from
      // it, and these are now a minority of images.
      const { text: raw } = await generateProText(
        buildImageBriefPrompt(post.title, post.body, post.postType, category, userProfile),
        { temperature: 1.1, topP: 0.95 }
      );
      const parsed = parseJSON<Partial<ImageBrief>>(raw);
      if (parsed.visual) {
        return {
          style: clampStyle(parsed.style),
          structure: clampStructure(parsed.structure),
          headline: clampHeadline(parsed.headline || "", 34),
          subheadline: clampSubhead(parsed.subheadline),
          visual: String(parsed.visual),
          nodes: clampLabels(parsed.nodes, 5, 28),
          cards: clampLabels(parsed.cards, 4, 22),
          palette: parsed.palette ? String(parsed.palette) : DEFAULT_PALETTE,
          theme: clampHeadline(String(parsed.theme ?? ""), 120),
          bodyText: clampBodyText(parsed.bodyText),
          caption: clampHeadline(String(parsed.caption ?? ""), 120),
        };
      }
    } catch (err) {
      console.error(`[SceneBrief] attempt ${attempt + 1} failed:`, (err as Error).message);
    }
  }
  return fallbackSceneBrief(post, category, userProfile?.headline ?? undefined);
}

/**
 * Build a content-aware brief for one image, routed by how that format is
 * produced. Never returns null - both paths fall back to a title-derived brief
 * so the image stays related to the post even when the model call fails.
 */
export async function getImageBrief(
  post: { title: string; body: string; postType: string },
  category: ImageCategory,
  userProfile?: UserVisualProfile
): Promise<ImageBrief> {
  // Every category is art-directed now. getDesignBrief / getSceneBrief remain
  // for the code-render fallback path and are no longer the primary route.
  return getArtBrief(post, category, userProfile);
}

/**
 * Last-resort carousel: a hook slide from the title and a close.
 *
 * Thin, but legible and free - which is the right trade when the planner is
 * down. The previous fallback fired four abstract diffusion images carrying no
 * text at all, which cost real money to say nothing.
 */
function fallbackCarouselPlan(post: { title: string }, count: number): CarouselPlan {
  const slides: CarouselSlide[] = [
    { headline: headlineFromTitle(post.title), subheadline: "", nodes: [] },
  ];
  while (slides.length < Math.max(2, count - 1)) {
    slides.push({ headline: `Point ${slides.length}`, subheadline: "", nodes: [] });
  }
  slides.push({ headline: "The Takeaway", subheadline: "", nodes: [] });
  return { themeId: undefined, slides: slides.slice(0, count) };
}

/**
 * Plan a cohesive multi-slide carousel from a post.
 *
 * Always returns a plan. It used to return null so the route could fall back to
 * the legacy diffusion carousel; there is no diffusion carousel any more - every
 * slide was always specified as a designed infographic - so a failed plan now
 * degrades to a thin code-rendered one instead of an expensive wordless one.
 *
 * Flash rather than the pro planner: the job is a narrative arc in short
 * strings, not a four-part art direction.
 */
export async function getCarouselPlan(
  post: { title: string; body: string; postType: string },
  count: number,
  userProfile?: UserVisualProfile
): Promise<CarouselPlan> {
  const prompt = buildCarouselDesignPrompt(
    post.title,
    post.body,
    post.postType,
    count,
    themeMenuBlock(),
    IMAGE_THEME_IDS.join("|"),
    iconMenuBlock(),
    userProfile
  );

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // A deliberate temperature so two similar-tone posts diverge; two retries
      // plus clamping absorb the occasional off sample.
      const raw = await generateTextWithConfig(prompt, { temperature: 1.1 });
      const parsed = parseJSON<Partial<CarouselPlan>>(raw);
      const slides = Array.isArray(parsed.slides)
        ? parsed.slides
            .filter((s): s is CarouselSlide => !!s && !!s.headline)
            .map((s) => ({
              headline: clampHeadline(s.headline, 34),
              subheadline: clampSubhead((s as { subheadline?: unknown }).subheadline),
              nodes: clampLabels((s as { nodes?: unknown }).nodes, 4, 28),
              icons: clampLabels((s as { icons?: unknown }).icons, 4, 24),
              heroIcon: clampHeadline(String((s as { heroIcon?: unknown }).heroIcon ?? ""), 24),
              backgroundScene: clampHeadline(String((s as { backgroundScene?: unknown }).backgroundScene ?? ""), 400),
            }))
            .filter((s) => !!s.headline)
            .slice(0, count)
        : [];
      if (slides.length >= 2) {
        return { themeId: clampThemeId(parsed.themeId), slides };
      }
    } catch (err) {
      console.error(`[CarouselPlan] attempt ${attempt + 1} failed:`, (err as Error).message);
    }
  }
  return fallbackCarouselPlan(post, count);
}

/**
 * Brief for a FULLY ART-DIRECTED image - the model draws the whole graphic,
 * lettering included.
 *
 * This supersedes the content-only design brief for every category. The code
 * renderer is still here, but only as the fallback for when the image model
 * fails: an image with plain type beats no image, and it is a long way from
 * what a good LinkedIn graphic looks like.
 */
async function getArtBrief(
  post: { title: string; body: string; postType: string },
  category: ImageCategory,
  userProfile?: UserVisualProfile
): Promise<ImageBrief> {
  // Seeded on the post's own hook so each post is offered a different slice of
  // the style and palette menus. Every brief is a separate call that sees one
  // post, so the prompt's "vary this across posts" line had nothing to work
  // with - measured, isometric-scene was taking 4 of 11 posts and every image
  // looked like the last. The hook is stable, so regenerating a post keeps its
  // look rather than reshuffling it.
  const seed = post.title;

  const prompt = buildArtBriefPrompt(
    post.title,
    post.body,
    post.postType,
    category,
    visualStyleMenuBlock(seed),
    visualStyleIdsFor(seed).join("|"),
    pageLayoutMenuBlock(),
    PAGE_LAYOUT_IDS.join("|"),
    themeMenuBlock(seed),
    themeIdsFor(seed).join("|"),
    userProfile
  );

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await generateTextWithConfig(prompt, { temperature: 1.15 });
      const parsed = parseJSON<Record<string, unknown>>(raw);
      const scene = String(parsed.scene ?? "").trim();
      const headline = clampHeadline(String(parsed.headline ?? ""), 48);
      // The scene is the one thing the image cannot be built without.
      if (scene.length > 20) {
        return {
          headline,
          subheadline: "",
          // `nodes` carries the short labels that sit on elements in the scene,
          // so the code-render fallback can still use them as a list.
          nodes: clampLabels(parsed.labels, 4, 18),
          cards: [],
          scene,
          subject: clampHeadline(String(parsed.subject ?? ""), 40),
          brands: clampLabels(parsed.brands, 4, 30),
          layout: String(parsed.layout ?? "").trim().toLowerCase() || undefined,
          statLine: clampHeadline(String(parsed.statLine ?? ""), 10),
          subhead: clampHeadline(String(parsed.subhead ?? ""), 60),
          chips: clampLabels(parsed.chips, 3, 22),
          visualStyle: String(parsed.visualStyle ?? "").trim().toLowerCase() || undefined,
          themeId: clampThemeId(parsed.themeId),
          heroIcon: "",
        };
      }
    } catch (err) {
      console.error(`[ArtBrief] attempt ${attempt + 1} failed:`, (err as Error).message);
    }
  }

  // Marked degraded on purpose. When the model is unavailable - a quota cap,
  // an outage - this fallback knows nothing about the post beyond its title, and
  // an image built from it is exactly the generic, unrelated picture users
  // complain about. The route refuses to ship one and reports the real reason
  // instead; a clear error costs the user a retry, a bad image costs their trust.
  return {
    degraded: true,
    headline: headlineFromTitle(post.title),
    subheadline: "",
    nodes: [],
    cards: [],
    scene: `A clear, concrete scene representing "${post.title}" in the world of a ${
      userProfile?.headline ?? "professional"
    }, with one unmistakable focal subject and real depth.`,
  };
}
