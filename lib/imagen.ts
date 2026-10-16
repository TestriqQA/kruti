import { GoogleGenAI } from "@google/genai";
import { put } from "@vercel/blob";
import { getImageCategory, type ImageCategory } from "@/lib/image-categories";
import { renderDesignedImage, type DesignBrief } from "@/lib/render-card";
import { resolveVisualStyle, resolvePageLayout } from "@/lib/image-styles";
import { resolveTheme } from "@/lib/image-themes";
import {
  brandLogosEnabled,
  fetchBrandLogos,
  compositeLogoStrip,
} from "@/lib/brand-logos";
import {
  generateRecraftImageBuffer,
  getLastRecraftError,
  RECRAFT_MODELS,
  type RecraftModelKey,
  type RecraftStyle,
} from "@/lib/recraft";

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });
  }
  return _ai;
}

/**
 * Nano Banana 2 (Gemini 3.1 Flash Image) - Google's high-efficiency image model,
 * a fraction of Nano Banana Pro's per-image cost. Single stable model id (no
 * preview/GA split); if it is unavailable, generation returns no image rather
 * than silently degrading to a different model.
 */
/**
 * The Gemini image models this app can call, by the short name IMAGE_PROVIDER
 * uses. All three are on the same API key and the same generateContent method.
 *
 * Read the display names before judging the version numbers: the models API
 * reports gemini-3.1-flash-image as "Nano Banana 2" and gemini-nano-banana-2.1
 * as "Nano Banana 2.1", and both carry version 3.0. So 2.1 is the NEWER of the
 * two - the 2.x is the Nano Banana line, not the Gemini line. Google's docs
 * call 3.1-flash-image "the previous-generation high-efficiency workhorse
 * model" and recommend 2.1 for new projects.
 */
const GEMINI_IMAGE_MODELS = {
  // Nano Banana 2 - what this app has always used. Still the default.
  gemini: "gemini-3.1-flash-image",
  // Nano Banana 2.1 - newer, and documented at roughly half the price.
  "gemini-2.1": "gemini-nano-banana-2.1",
  // Nano Banana 2 Lite - documented as the fastest and cheapest, 1K only.
  "gemini-lite": "gemini-3.1-flash-lite-image",
} as const;

export type GeminiImageKey = keyof typeof GEMINI_IMAGE_MODELS;

const DEFAULT_GEMINI_IMAGE_MODEL = GEMINI_IMAGE_MODELS.gemini;

// Track last generation error (user-facing message). The raw technical error is
// always logged separately via console.error for debugging.
export let lastImageGenError: string | null = null;

/** Map a raw image-model error into a short, clear, user-facing message. */
function friendlyImageError(rawMessage: string): string {
  const m = (rawMessage || "").toLowerCase();
  if (
    m.includes("spending cap") ||
    m.includes("resource_exhausted") ||
    m.includes("quota") ||
    m.includes("exceeded") ||
    m.includes("429")
  ) {
    return "AI image generation is temporarily unavailable - the monthly image quota has been reached. Please try again later.";
  }
  if (m.includes("safety") || m.includes("blocked") || m.includes("prohibited")) {
    return "The image couldn't be generated for this content. Try editing the post text and generating again.";
  }
  if (
    m.includes("api key") ||
    m.includes("api_key") ||
    m.includes("permission") ||
    m.includes("unauthenticated") ||
    m.includes("401") ||
    m.includes("403")
  ) {
    return "The AI image service is temporarily unavailable. Please try again later or contact support.";
  }
  return "Image generation failed. Please try again in a moment.";
}

/**
 * Build a photoreal / editorial SCENE prompt for the realistic-scene and meme
 * categories (a believable real photograph, not a designed infographic). Personal
 * categories render a tasteful REPRESENTATIVE person, never a fabricated portrait.
 */
export function buildRealisticImagePrompt(
  brief: { style?: string; visual: string; headline?: string; caption?: string; palette: string; theme?: string },
  category: ImageCategory
): string {
  const clean = (s?: string) => (s || "").replace(/\s+/g, " ").trim();
  const caption = clean(brief.caption);
  const headline = clean(brief.headline);
  const theme = clean(brief.theme);
  const captionLine =
    category.genApproach === "meme" && caption
      ? `Add ONE short meme caption in clean, bold, perfectly-spelled type, large enough to read on a phone: "${caption}".\n`
      : headline
      ? `If a short label genuinely helps, set it small, clean, and perfectly spelled: "${headline}".\n`
      : "";
  const personalLine = category.personal
    ? `Show a tasteful REPRESENTATIVE person (over-the-shoulder, hands-only, a side or back angle, or no face) or just the real objects and workspace - NEVER a fabricated portrait of a specific real individual.\n`
    : "";
  const themeLine = theme ? `ART DIRECTION: ${theme}.\n` : "";

  return `Create ONE premium, believable, photoREAL square (1:1) image for a LinkedIn feed in this format: ${category.label} - ${category.briefGuidance}. It should look like a real, professionally shot photograph or editorial scene - NOT a designed infographic and NOT an obvious AI render.

${themeLine}WHAT TO SHOW: ${brief.visual}
${personalLine}${captionLine}REALISM: correct proportions, genuine materials and surface texture, natural believable light and real depth, true-to-life colour, so every object looks authentically real. NO neon glow, NO plastic AI sheen, NO garbled text, NO warped hands or extra limbs.
REAL BRANDS: only ever show a brand, product, or logo the post actually names, in its genuine form and true official colours; never invent or recolour one.
COLOUR AND LIGHT: ${brief.palette}

Keep any on-image words minimal, real, and correctly spelled, and add no text beyond the caption or label named above. Square 1:1, FULL-BLEED: the photo fills the whole frame to every edge with NO drawn border, frame, or panel; keep the key subject and any text a comfortable margin in from the edges so nothing important is clipped. Crisp, high-resolution, genuinely premium, and unique to THIS post.`;
}

/**
 * Build the image-model prompt for a post's chosen image category.
 *
 * Photographic categories only (meme and the realistic scenes). The designed
 * formats used to dispatch to a branded-infographic builder from here; they are
 * laid out in code now, so that builder and this branch are both gone.
 */
export function buildCategoryImagePrompt(
  category: ImageCategory,
  // Every field is optional because they are optional on ImageBrief - only the
  // photographic path populates them, and the fallback brief can leave gaps. The
  // defaults below keep the prompt coherent either way.
  brief: {
    headline: string;
    style?: string;
    visual?: string;
    palette?: string;
    theme?: string;
    caption?: string;
  }
): string {
  const visual = brief.visual || "A clean, believable editorial scene representing the post's core idea.";
  const palette = brief.palette || "natural daylight, real materials, soft true-to-life colour.";
  const style = brief.style || "editorial photoreal, natural light";

  // Only the photographic categories reach this now. The designed formats are
  // laid out in code by lib/render-card.tsx, so there is no second branch left
  // to pick - see usesCodeRender() in lib/image-categories.ts.
  return buildRealisticImagePrompt(
    {
      style,
      visual,
      headline: brief.headline,
      caption: brief.caption,
      palette,
      theme: brief.theme,
    },
    category
  );
}

// ─── Code-rendered images (the designed formats) ─────────────────────────────

/**
 * Lay a designed format out in code and store it, returning the Blob URL.
 *
 * Replaces a 10-20s diffusion call that cost $0.101 and could not be trusted to
 * spell a label, with a ~200ms deterministic render that costs nothing. See the
 * header of lib/render-card.tsx for why, and usesCodeRender() in
 * lib/image-categories.ts for which formats come here.
 *
 * Returns null on failure and sets `lastImageGenError`, matching
 * generatePostImage() so callers need no new error path.
 */
/**
 * The prompt for the TEXT-FREE picture that sits behind a designed graphic.
 *
 * Every instruction here exists because the text layer is composited on top in
 * code: any word the model draws would collide with real type, and a busy frame
 * makes that type unreadable. This is the one job diffusion is genuinely good
 * at - atmosphere - so it is asked for atmosphere and nothing else.
 */
export function buildBackgroundPrompt(scene: string): string {
  return `Create ONE premium, believable, photoREAL square (1:1) editorial photograph for a LinkedIn graphic.

WHAT TO SHOW: ${scene}

This picture is a BACKGROUND. Headlines and labels will be laid over it afterwards, so:
- It must contain ZERO text of any kind - no words, letters, numbers, captions, labels, watermarks, signage, logos, charts, graphs, diagrams, or screens showing readable interface. Not one character.
- Keep the composition calm and uncluttered, with generous areas of even tone, soft focus or open space where type can sit. One clear subject, not a busy collage.
- No heavy vignettes, no borders, no frames, no text placeholders or lorem-ipsum shapes.

QUALITY: a real photograph taken by a professional - correct proportions, genuine materials and surface texture, natural directional light, true-to-life colour, real depth of field. NO neon glow, NO plastic AI sheen, NO circuit-board or digital-grid cliche, NO warped hands or extra limbs, NO fabricated portrait of a specific real person (a representative person shot over-the-shoulder, hands-only or from behind is fine).

Square 1:1, full-bleed edge to edge, high resolution.`;
}

export async function renderAndStoreDesignedImage(
  category: ImageCategory,
  brief: DesignBrief,
  postId: string,
  opts?: {
    author?: { name?: string | null; headline?: string | null };
    slide?: { index: number; total: number };
    /** Pre-generated background, for callers that fetch them in parallel. */
    background?: Buffer | null;
  }
): Promise<string | null> {
  lastImageGenError = null;
  try {
    // Hybrid: a generated picture underneath, exact type on top. If the model
    // fails - quota, safety, a timeout - the layout still renders on a solid
    // field, so a missing picture costs atmosphere rather than the whole image.
    let background = opts?.background ?? undefined;
    if (!background && brief.backgroundScene) {
      const bg = await generateImageBuffer(buildBackgroundPrompt(brief.backgroundScene), "2K");
      if (bg) background = bg.buffer;
      else console.warn(`[RenderCard] ${category.id}: no background, rendering on a solid field`);
    }

    const buffer = await renderDesignedImage({
      category,
      brief,
      seed: postId,
      author: opts?.author,
      slide: opts?.slide,
      background,
    });

    // A failed background must not surface as an error when the image itself
    // came out fine.
    lastImageGenError = null;

    // Filename shape is load-bearing twice over. lib/usage-analytics.ts recovers
    // an image's generation DATE from the 13-digit epoch embedded here (there is
    // no event table), and it tells paid from free images by the prefix: a
    // hybrid called the image model, so it is costed like one ("post-"), while
    // a pure code render costs nothing ("card-"). Keep both shapes intact.
    const filename = `${background ? "post" : "card"}-${postId}-${Date.now()}.png`;
    const blob = await put(`generated/${filename}`, buffer, {
      access: "public",
      contentType: "image/png",
    });
    console.log(`[RenderCard] ${category.id} rendered:`, blob.url);
    return blob.url;
  } catch (err) {
    const raw = (err as Error).message;
    console.error(`[RenderCard] ${category.id} failed:`, raw);
    lastImageGenError =
      "Couldn't build the image for this post. Please try again in a moment.";
    return null;
  }
}

export type CarouselRenderEvent = {
  index: number;
  status: "start" | "done" | "error";
  url?: string;
  message?: string;
};

/**
 * Render a cohesive carousel from a plan: one code-rendered slide per entry,
 * every one on the plan's single shared theme, each carrying a position
 * indicator so the set visibly belongs together.
 *
 * Sequential rather than parallel. The old diffusion path had to fire all four
 * slides at once to fit inside the 60s function limit - which is also why
 * carousels were pinned to 1K while single images got 2K. A slide now takes
 * about 200ms, so the whole set finishes well inside a second; doing them in
 * order keeps memory flat and lets the progress events arrive in slide order.
 */
export async function renderCarouselFromPlan(
  plan: { themeId?: string; slides: DesignBrief[] },
  postId: string,
  onSlideEvent?: (e: CarouselRenderEvent) => void
): Promise<string[]> {
  // Every slide is information design, so they all use the infographic layout.
  // A slide with no labels renders as a clean statement slide, which is exactly
  // what the plan asks for on the hook and the takeaway.
  const category = getImageCategory("infographic");
  const total = plan.slides.length;
  const urls: string[] = [];

  // Backgrounds first, and in PARALLEL. Each image call takes 10-20s, so four in
  // sequence would run past the 60s function limit on its own; the renders that
  // follow are about 200ms each, so they stay sequential for ordered progress
  // events and flat memory. A slide whose picture fails simply renders on the
  // solid field.
  plan.slides.forEach((_, i) => onSlideEvent?.({ index: i, status: "start" }));
  const backgrounds = await Promise.all(
    plan.slides.map(async (s) => {
      if (!s.backgroundScene) return null;
      try {
        const bg = await generateImageBuffer(buildBackgroundPrompt(s.backgroundScene), "2K");
        return bg?.buffer ?? null;
      } catch {
        return null;
      }
    })
  );

  for (let i = 0; i < total; i++) {
    const url = await renderAndStoreDesignedImage(
      category,
      // The plan's theme wins over anything a slide carries: one palette across
      // the set is the whole point.
      { ...plan.slides[i], themeId: plan.themeId },
      `${postId}-c${i}`,
      { slide: { index: i, total }, background: backgrounds[i] }
    );
    if (url) {
      urls.push(url);
      onSlideEvent?.({ index: i, status: "done", url });
    } else {
      onSlideEvent?.({
        index: i,
        status: "error",
        message: lastImageGenError || "Slide could not be built",
      });
    }
  }

  return urls;
}

// ─── Image Generation ────────────────────────────────────────────────────────

export async function generatePostImage(
  imagePrompt: string,
  postId: string,
  industry?: string,
  allowText = false,
  imageSize: "1K" | "2K" = "2K"
): Promise<string | null> {
  lastImageGenError = null;

  let prompt: string;
  if (allowText) {
    // The caller passed a complete, built prompt (from buildRealisticImagePrompt)
    // that intentionally renders a short headline. Send it as-is - do NOT append the
    // no-text wrapper or it would forbid the headline we want.
    prompt = imagePrompt || "Professional abstract business concept";
  } else {
    // Legacy path: ONLY use the imagePrompt (scene/metaphor description) - never pass
    // post title or body text, as image models will attempt to render any text they see.
    const sceneDescription = imagePrompt || "Professional abstract business concept";
    prompt = `${sceneDescription}

Style: Professional, polished, visually compelling. Cinematic composition, natural lighting, professional color grading.
Industry context: ${industry || "business"}.
The image must contain ZERO text - no words, letters, numbers, labels, captions, watermarks, or typography of any kind.
Square format (1:1), filling the entire frame edge to edge with no blank border, frame, or margin on any side. High quality, suitable for LinkedIn.`;
  }

  console.log(`[Imagen] Prompt: ${prompt.slice(0, 80)}...`);


  const result = await generateImageBuffer(prompt, imageSize);
  if (!result) return null;

  const filename = `post-${postId}-${Date.now()}.${result.ext}`;
  const blob = await put(`generated/${filename}`, result.buffer, {
    access: "public",
    contentType: result.contentType,
  });
  console.log(`[Imagen] Generated:`, blob.url);
  return blob.url;
}

/**
 * Call the image model and return the raw bytes, without storing anything.
 *
 * Split out from generatePostImage so the hybrid renderer can take the picture
 * as a buffer, composite the text layer onto it, and upload once - rather than
 * uploading a background nobody will ever see and then fetching it back.
 */
/**
 * Which provider draws the pictures.
 *
 * Set IMAGE_PROVIDER to "recraft-v3" or "recraft-v4.1-flash" to switch; absent
 * or anything unrecognised means Gemini, so an empty environment behaves
 * exactly as it did before this existed.
 *
 * Read per call rather than cached at module load, so flipping the variable
 * takes effect on the next request instead of the next deploy.
 */
export type ImageProvider = GeminiImageKey | RecraftModelKey;

export function resolveImageProvider(): ImageProvider {
  const raw = (process.env.IMAGE_PROVIDER ?? "").trim();
  if (raw in RECRAFT_MODELS) return raw as RecraftModelKey;
  if (raw in GEMINI_IMAGE_MODELS) return raw as GeminiImageKey;
  return "gemini";
}

function isRecraft(p: ImageProvider): p is RecraftModelKey {
  return p in RECRAFT_MODELS;
}

/**
 * Call the image model and return the raw bytes, without storing anything.
 *
 * The single seam every image in this app passes through - single images,
 * carousel slide backgrounds and art-directed graphics alike - which is why
 * the provider is chosen here and nowhere else.
 *
 * A Recraft failure falls back to Gemini rather than returning nothing: a
 * picture from the wrong provider beats no picture, and during a comparison a
 * silent hole would read as "Recraft is worse" when it only means the token
 * expired.
 */
export async function generateImageBuffer(
  prompt: string,
  imageSize: "1K" | "2K" = "2K",
  opts?: { style?: RecraftStyle }
): Promise<{ buffer: Buffer; ext: string; contentType: string } | null> {
  const provider = resolveImageProvider();

  if (isRecraft(provider)) {
    const out = await generateRecraftImageBuffer(prompt, provider, { style: opts?.style });
    if (out) return out;
    lastImageGenError = getLastRecraftError();
    console.warn(`[Imagen] ${provider} failed, falling back to Gemini`);
    return generateGeminiImageBuffer(prompt, imageSize, DEFAULT_GEMINI_IMAGE_MODEL);
  }

  return generateGeminiImageBuffer(prompt, imageSize, GEMINI_IMAGE_MODELS[provider]);
}

/** The Gemini path, unchanged - still the default, and the fallback. */
async function generateGeminiImageBuffer(
  prompt: string,
  imageSize: "1K" | "2K" = "2K",
  preferred: string = DEFAULT_GEMINI_IMAGE_MODEL
): Promise<{ buffer: Buffer; ext: string; contentType: string } | null> {
  // The chosen model first, then the long-standing default behind it. A model
  // that is new to this app should not be able to take image generation down.
  const chain =
    preferred === DEFAULT_GEMINI_IMAGE_MODEL
      ? [DEFAULT_GEMINI_IMAGE_MODEL]
      : [preferred, DEFAULT_GEMINI_IMAGE_MODEL];

  for (const model of chain) {
    try {
      console.log(`[Imagen] Trying ${model}...`);
      const response = await getAI().models.generateContent({
        model,
        contents: prompt,
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          imageConfig: { aspectRatio: "1:1", imageSize },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith("image/") && part.inlineData.data) {
          const jpeg = part.inlineData.mimeType === "image/jpeg";
          return {
            buffer: Buffer.from(part.inlineData.data, "base64"),
            ext: jpeg ? "jpg" : "png",
            contentType: jpeg ? "image/jpeg" : "image/png",
          };
        }
      }
      console.warn(`[Imagen] ${model} returned no image data, trying next model`);
    } catch (err) {
      const raw = (err as Error).message;
      lastImageGenError = friendlyImageError(raw);
      // Keep the full technical reason in the server logs for debugging.
      console.error(`[Imagen] ${model} failed:`, raw);
    }
  }

  if (!lastImageGenError) {
    lastImageGenError = "Image generation didn't return an image. Please try again in a moment.";
  }
  return null;
}

// ─── Art-directed generation (the whole image, from the model) ───────────────

/**
 * Assemble the final image prompt for a fully art-directed graphic.
 *
 * The structure matters as much as the words. Current image models letter short
 * strings reliably when they are quoted verbatim and the total is kept small,
 * and they drift when a prompt describes text in the abstract ("a prominent
 * headline stating the core point"). So the exact strings go in, with an
 * explicit instruction that nothing else may appear - which is also what keeps
 * stray lorem-ipsum and invented sub-captions out of the frame.
 */
export function buildArtImagePrompt(opts: {
  scene: string;
  /** The one big figure, when the post turns on a number. */
  statLine?: string;
  headline: string;
  subhead?: string;
  /** Short benefit pills. */
  chips?: string[];
  /** How the page is built - see PAGE_LAYOUTS. */
  layoutDirection: string;
  labels: string[];
  subject?: string;
  /** Real products, tools or platforms the post itself names. */
  brands?: string[];
  /** Real marks are being composited, so draw none. */
  suppressBrandMarks?: boolean;
  styleDirection: string;
  styleName: string;
  textLoad: "low" | "medium" | "high";
  palette: { phrase: string; mode: "light" | "dark" };
  formatLabel: string;
}): string {
  const { palette: p } = opts;
  const labels = opts.labels.filter(Boolean);
  const brands = (opts.brands ?? []).filter(Boolean);
  const chips = (opts.chips ?? []).filter(Boolean);
  const stat = (opts.statLine ?? "").trim();
  const sub = (opts.subhead ?? "").trim();
  const pieces =
    (stat ? 1 : 0) + (opts.headline ? 1 : 0) + (sub ? 1 : 0) + chips.length + labels.length;

  const textBlock =
    opts.textLoad === "low" && labels.length === 0 && !opts.headline
      ? `TEXT: this image carries NO text at all. Not one letter, number, caption, watermark or sign.`
      : [
          // Guillemets, and no shouty instruction words anywhere near the
          // strings. An earlier version opened with "letter EXACTLY these
          // words" and the model dutifully lettered "EXACTLY:" onto the
          // artwork - instruction vocabulary set in caps reads as design copy.
          // Plain quotes, no shouty instruction words, and nothing in this block
          // that would look like design copy. Two earlier versions leaked
          // straight onto the artwork: one opened with "letter EXACTLY these
          // words" and the model lettered "EXACTLY:" into the headline, and a
          // guillemet-delimited version lettered the guillemets themselves.
          // Any literal string in a prompt can end up as rendered type.
          `Words to letter onto the image, and no others anywhere in the frame:`,
          stat ? `  the single largest thing on the page reads "${stat}"` : null,
          opts.headline ? `  the headline reads "${opts.headline}"` : null,
          sub ? `  the supporting line beneath it reads "${sub}"` : null,
          ...chips.map((c) => `  one small pill reads "${c}"`),
          ...labels.map((l) => `  one element in the artwork is labelled "${l}"`),
          `That is ${pieces} piece${pieces === 1 ? "" : "s"} of text in the entire image, and there must be no others. Count them as you compose. No string may appear twice - if the figure above already says it, the headline must not say it again.`,
          `Letter the words inside the quote marks and not the quote marks themselves, and do not letter any wording from these instructions. Each string appears once and only once - never repeat a label, never echo the headline a second time, and never invent an extra caption to fill a gap.`,
          // Invented text is where this falls down. Asked for a monitor, a
          // whiteboard or a code editor, the model fills it with words of its
          // own - and those come out as nonsense: real images shipped with
          // "FID Coractionts" on a dashboard and a whiteboard reading "Lrade to
          // use architecturity".
          //
          // Forbidding all surface text was the first attempt and it costs too
          // much: an office scene with a blank whiteboard looks staged, and
          // office scenes are exactly what many of these posts need. The model
          // garbles words it INVENTS, not words it is given - short labels it
          // has been handed come out clean. So surfaces may carry text, drawn
          // only from the list above.
          `Screens, whiteboards, monitors, documents and code editors may appear, but any writing on them must come ONLY from the list above, set large - never a sentence, heading, metric name, axis value, percentage, line of code or paragraph of your own invention, at any size. Where you would otherwise write something, draw bold blocks, bars, boxes, arrows and shapes instead. Fine print is the giveaway: if a viewer has to zoom to tell whether it is real writing, it should not be there at all.`,
          // The last fix let surfaces carry the listed labels, which worked for
          // the labels - and the model then filled the REST of a whiteboard with
          // pseudo-handwriting that garbles on inspection. Office scenes have to
          // stay, so the surfaces stay too; they are just composed so their
          // content reads as texture rather than as words.
          `Compose any large writing surface - a whiteboard, a wall of notes, a full monitor - so its content reads as texture, not as words: turn it to a steep angle, crop it at the frame edge, push it behind the focal subject, or throw it softly out of focus. Never fill one edge to edge with handwriting or body copy. Small real things in sharp focus are fine; large legible blocks of invented writing are what ruin these images.`,
          // Code editors are the worst offender for this audience, and they
          // need their own rule: told only "no invented text", the model still
          // writes code, and it comes out as "import React from 'nextt'" and
          // "<mekease>". Giving it the idiom designers actually use - coloured
          // bars - replaces the behaviour instead of just forbidding it.
          `A code editor, terminal or IDE in the scene is drawn as syntax-coloured BARS, never as characters: short rounded rectangles in editor colours - purple, blue, green, amber - laid out in indented lines of varying length, with a gutter of plain dots or dashes where line numbers would be, and a sidebar of small blank icons. No letterforms anywhere in it - no keywords, no tags, no brackets, no quotes, no file names beyond the ones listed above. This is how a designer depicts code in a graphic: it reads as code instantly without a single readable character, and it cannot misspell anything.`,
          `If a word is hard to letter cleanly, set it larger rather than adding more words.`,
        ]
          .filter(Boolean)
          .join("\n");

  return `Create ONE premium, square (1:1) graphic for a LinkedIn feed. A person scrolling past should understand the idea from the picture alone, before reading anything.

LAYOUT - this is a designed page, not a picture with words dropped onto it. Build it on this structure: ${opts.layoutDirection} Hold a generous, even margin on all four sides, align everything to that structure, and leave one clear area to breathe rather than filling every corner.

VISUAL STYLE - ${opts.styleName}: ${opts.styleDirection}

THE SCENE: ${opts.scene}
FOCAL SUBJECT: ${opts.subject || "the single most important object in the scene"}

${textBlock}

OBJECTS: build the scene from real, tangible, dimensional things - actual devices, actual tools, actual surfaces, with weight, material and contact shadows - not a sprinkle of flat generic symbols. Where an idea needs an emblem, prefer a believable physical object over a pictogram: a real stopwatch rather than a clock glyph, a real stack of servers rather than a database icon. Objects should look like they could be photographed or held.
${
    opts.suppressBrandMarks
      ? `REAL PRODUCTS: this post names ${brands.join(
          ", "
        )}, and their real marks are being added to the finished image separately. Draw NO logo, wordmark, brand glyph or company name anywhere - not on a screen, a box, a badge or a sign. Show the products as plain unbranded objects. A drawn mark here would sit next to the real one and only look broken by comparison. RESERVED FOOT: keep the bottom 15% of the frame as clean, uncluttered background - no text, no chips, no objects, no focal detail. The real marks are laid into that band, and anything drawn there will be covered.`
      : brands.length > 0
      ? `REAL PRODUCTS: this post names ${brands.join(
          ", "
        )}. Show them as their genuine, instantly recognisable real-world marks and products, in their true official colours and correct proportions - not invented substitutes, not recoloured to match the palette, not distorted. If a mark cannot be drawn cleanly and accurately, show the product itself or leave it out entirely rather than shipping a mangled logo. Add no brand beyond these.`
      : `REAL PRODUCTS: this post names none, so show no brand marks, logos or wordmarks of any company at all.`
  }

TYPOGRAPHY: set the headline large, bold and perfectly legible on a phone screen - it should occupy a confident share of the frame and sit INSIDE the composition as a designed element, never as a plain bar pasted over the artwork. Set it as flat graphic type laid over the artwork - never written onto an object inside the scene, never on a phone screen, a monitor, a page or a sign, where it ends up tilted and unreadable. Clean modern sans-serif. Correct spacing, correct kerning, no broken or duplicated letterforms.

COLOUR: ${p.phrase}. ${
    p.mode === "dark" ? "Dark, rich and high contrast." : "Light, clean and airy."
  } Keep to that family - one accent, used sparingly, is what makes a graphic look designed rather than generated. Describe colour only through the artwork; never letter a colour name, hex code or swatch row onto the image.

QUALITY BAR: this must look like it came from a senior designer at a top studio - deliberate composition, real depth, believable materials and light, generous margins, nothing crowded against the edges. Full-bleed square, artwork running to every edge, with NO drawn border, frame or outer keyline.

SCREENS, CHARTS AND DIALS: draw them as clean abstract shapes - lines, bars, curves, segments, blocks - carrying NO numbers, axis values, percentages or interface wording of any kind. A model asked for a dashboard fills it with invented half-legible figures, and tiny garbled numbers inside a screen undo an otherwise good graphic. Only the headline and the labels listed above may be readable; a chart shows its shape, never its data.

NEVER: garbled or misspelled lettering, duplicated words, random glyphs, invented statistics, neon glow, circuit-board cliche, plastic AI sheen, warped hands or extra limbs, a fabricated portrait of a real identifiable person, stock-photo cheesiness, or any brand logo the post did not name.`;
}

/**
 * Generate the full image from the model and store it.
 *
 * Returns null on failure, with `lastImageGenError` set, so the caller can fall
 * back to the code renderer rather than leaving the user with nothing.
 */
export async function generateAndStoreArtImage(
  brief: {
    scene?: string;
    headline?: string;
    nodes?: string[];
    subject?: string;
    brands?: string[];
    visualStyle?: string;
    themeId?: string;
    layout?: string;
    statLine?: string;
    subhead?: string;
    chips?: string[];
  },
  postId: string,
  category: ImageCategory
): Promise<string | null> {
  lastImageGenError = null;

  const style = resolveVisualStyle(brief.visualStyle, postId);
  const theme = resolveTheme(brief.themeId, postId);
  const layout = resolvePageLayout(brief.layout, postId);

  // Real marks are composited below, so the model must not attempt its own.
  // Both halves read this one value - they cannot disagree.
  const useRealLogos = brandLogosEnabled() && (brief.brands?.length ?? 0) > 0;

  const prompt = buildArtImagePrompt({
    scene: brief.scene || `A clear, concrete scene representing: ${brief.headline ?? category.label}`,
    headline: brief.headline ?? "",
    // The art brief reuses `nodes` for the short labels that sit on elements in
    // the scene. A low-text style gets none, whatever the brief returned.
    labels: style.textLoad === "low" ? [] : brief.nodes ?? [],
    statLine: brief.statLine,
    subhead: brief.subhead,
    // Asking the model to keep the foot clear does not hold - tested, it put
    // its chip row there anyway and the bar sliced it in half. The chips are
    // the only thing it reliably places down there, so when the bar is coming
    // they are simply not offered.
    chips: useRealLogos ? [] : brief.chips,
    layoutDirection: layout.direction,
    subject: brief.subject,
    brands: brief.brands,
    styleDirection: style.direction,
    styleName: style.name,
    textLoad: style.textLoad,
    palette: { phrase: theme.palettePhrase, mode: theme.mode },
    formatLabel: category.label,
    suppressBrandMarks: useRealLogos,
  });

  console.log(`[ArtImage] ${category.id} / ${style.id} / ${theme.id}`);
  // A designed graphic with type on it, so Recraft is told to illustrate
  // rather than photograph. Ignored by the Gemini path.
  //
  // IMAGE_SIZE exists so Gemini can be tried at 1K without a code change:
  // Recraft tops out at 1024 on a square, so comparing its output against
  // Gemini at 2K judges resolution rather than the model. 1K also costs
  // $0.067 against 2K's $0.101, which may be the whole answer on its own.
  const size = process.env.IMAGE_SIZE === "1K" ? "1K" : "2K";
  const result = await generateImageBuffer(prompt, size, { style: "digital_illustration" });
  if (!result) return null;

  // Real marks go on after the model is done. The prompt above has already
  // told it to draw none, so there is nothing here to collide with.
  let buffer = result.buffer;
  let ext = result.ext;
  let contentType = result.contentType;
  if (useRealLogos) {
    const logos = await fetchBrandLogos(brief.brands ?? []);
    if (logos.length > 0) {
      const composited = await compositeLogoStrip(buffer, logos);
      if (composited !== buffer) {
        buffer = composited;
        ext = "jpg";
        contentType = "image/jpeg";
      }
    }
  }

  const filename = `post-${postId}-${Date.now()}.${ext}`;
  const blob = await put(`generated/${filename}`, buffer, {
    access: "public",
    contentType,
  });
  console.log(`[ArtImage] stored:`, blob.url);
  return blob.url;
}
