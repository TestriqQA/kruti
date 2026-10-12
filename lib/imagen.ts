import { GoogleGenAI } from "@google/genai";
import { put } from "@vercel/blob";
import { getImageCategory, type ImageCategory } from "@/lib/image-categories";
import { renderDesignedImage, type DesignBrief } from "@/lib/render-card";

let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });
  }
  return _ai;
}

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
export async function renderAndStoreDesignedImage(
  category: ImageCategory,
  brief: DesignBrief,
  postId: string,
  opts?: {
    author?: { name?: string | null; headline?: string | null };
    slide?: { index: number; total: number };
  }
): Promise<string | null> {
  lastImageGenError = null;
  try {
    const buffer = await renderDesignedImage({
      category,
      brief,
      seed: postId,
      author: opts?.author,
      slide: opts?.slide,
    });

    // Filename shape is load-bearing twice over. lib/usage-analytics.ts recovers
    // an image's generation DATE from the 13-digit epoch embedded here (there is
    // no event table), and it tells code-rendered images from model-generated
    // ones by this "card-" prefix - which is the only way the admin cost figure
    // can know these were free. Keep `generated/card-<id>-<ts>.png`.
    const filename = `card-${postId}-${Date.now()}.png`;
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

  for (let i = 0; i < total; i++) {
    onSlideEvent?.({ index: i, status: "start" });
    const url = await renderAndStoreDesignedImage(
      category,
      // The plan's theme wins over anything a slide carries: one palette across
      // the set is the whole point.
      { ...plan.slides[i], themeId: plan.themeId },
      `${postId}-c${i}`,
      { slide: { index: i, total } }
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

  // Nano Banana 2 (Gemini 3.1 Flash Image) - Google's high-efficiency image model:
  // strong at on-image text rendering, optimized for speed and high-volume use, at a
  // much lower per-image cost than Nano Banana Pro. Single stable model id (no
  // preview/GA split); if it is unavailable, generation returns no image rather than
  // silently degrading to a different model.
  const imageModels = [
    "gemini-3.1-flash-image",
  ];

  for (const model of imageModels) {
    try {
      console.log(`[Imagen] Trying ${model}...`);
      const response = await getAI().models.generateContent({
        model,
        contents: prompt,
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          // Square LinkedIn format. Single images default to 2K; carousels pass 1K (still
          // crisp at LinkedIn's ~1080px display). 1K stays legible because the prompt sizes
          // the headline at ~12-18% of image height and caps labels per slide - do NOT raise
          // carousels to 2K to "fix" small text (2K timed out the 60s limit); text size is
          // prompt-controlled, not pixel-controlled.
          imageConfig: { aspectRatio: "1:1", imageSize },
        },
      });

      const parts = response.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.mimeType?.startsWith("image/") && part.inlineData.data) {
          const buffer = Buffer.from(part.inlineData.data, "base64");
          const ext = part.inlineData.mimeType === "image/jpeg" ? "jpg" : "png";
          const contentType = part.inlineData.mimeType === "image/jpeg" ? "image/jpeg" : "image/png";
          const filename = `post-${postId}-${Date.now()}.${ext}`;
          const blob = await put(`generated/${filename}`, buffer, {
            access: "public",
            contentType,
          });
          console.log(`[Imagen] Generated via ${model}:`, blob.url);
          return blob.url;
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
