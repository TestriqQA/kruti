/**
 * Recraft image generation, returning exactly what lib/imagen.ts already hands
 * its callers - so swapping providers touches one function and nothing else.
 *
 * Why this exists: gemini-3.1-flash-image costs $0.101 per 2K image. Recraft V3
 * is $0.04 and V4.1 Flash is $0.007 for the same job. Both are wired up so the
 * three can be compared on real posts rather than argued about.
 *
 * Model ids, the style enum and the size enum below are taken from Recraft's
 * own OpenAPI document (recraft.ai/docs/api-reference/openapi.json), not from
 * prose docs - a wrong string here is a 400, not a fallback.
 */

const RECRAFT_ENDPOINT = "https://external.api.recraft.ai/v1/images/generations";

/** The six values Recraft's `style` field accepts. Not the named presets
 *  ("Photorealism", "Studio photo") - those are substyles, a separate field. */
export type RecraftStyle =
  | "any"
  | "realistic_image"
  | "digital_illustration"
  | "vector_illustration"
  | "icon"
  | "logo_raster";

export type RecraftModelKey = "recraft-v3" | "recraft-v4.1-flash";

export const RECRAFT_MODELS: Record<
  RecraftModelKey,
  {
    /** The `model` value the API expects. */
    apiModel: string;
    label: string;
    /** USD per generated image, from Recraft's published API pricing. */
    usdPerImage: number;
    /**
     * Prompt ceiling. V3 rejects anything over 1,000 characters; V4 and later
     * allow 10,000. buildArtImagePrompt can run long, so this is enforced
     * rather than hoped for.
     */
    maxPromptChars: number;
  }
> = {
  "recraft-v3": {
    apiModel: "recraftv3",
    label: "Recraft V3",
    usdPerImage: 0.04,
    maxPromptChars: 1000,
  },
  "recraft-v4.1-flash": {
    apiModel: "recraftv4_1_flash",
    label: "Recraft V4.1 Flash",
    usdPerImage: 0.007,
    maxPromptChars: 10000,
  },
};

/**
 * Recraft sizes are explicit WxH, and 1:1 tops out at 1024x1024 on these
 * models - there is no 2K square. Single images therefore come back smaller
 * than the Gemini path's 2K, which is a real difference to weigh when
 * comparing output, not a bug to fix here.
 */
const SQUARE = "1024x1024";

let lastRecraftError: string | null = null;

export function getLastRecraftError(): string | null {
  return lastRecraftError;
}

/**
 * One image, as bytes. Returns null on any failure so the caller can fall back
 * - the same contract the Gemini path has always had.
 */
export async function generateRecraftImageBuffer(
  prompt: string,
  modelKey: RecraftModelKey,
  opts?: { style?: RecraftStyle; size?: string }
): Promise<{ buffer: Buffer; ext: string; contentType: string } | null> {
  lastRecraftError = null;

  const token = process.env.RECRAFT_API_TOKEN;
  if (!token) {
    lastRecraftError = "RECRAFT_API_TOKEN is not set.";
    console.error("[Recraft] no API token configured");
    return null;
  }

  const model = RECRAFT_MODELS[modelKey];
  // Truncated on a word boundary where possible: a prompt cut mid-word reads as
  // a typo to the model and shows up in the picture.
  let text = prompt.trim();
  if (text.length > model.maxPromptChars) {
    const cut = text.slice(0, model.maxPromptChars);
    const lastSpace = cut.lastIndexOf(" ");
    text = lastSpace > model.maxPromptChars * 0.8 ? cut.slice(0, lastSpace) : cut;
    console.warn(
      `[Recraft] prompt trimmed ${prompt.length} -> ${text.length} chars for ${model.apiModel}`
    );
  }

  try {
    const res = await fetch(RECRAFT_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: text,
        model: model.apiModel,
        style: opts?.style ?? "realistic_image",
        size: opts?.size ?? SQUARE,
        // Bytes inline rather than a URL: Recraft's hosted URLs expire in about
        // 24 hours, and everything here is re-uploaded to Blob anyway, so
        // fetching a second time would only add a failure mode.
        response_format: "b64_json",
        image_format: "png",
        n: 1,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      lastRecraftError = friendlyRecraftError(res.status, body);
      console.error(`[Recraft] ${model.apiModel} HTTP ${res.status}:`, body.slice(0, 400));
      return null;
    }

    const json = (await res.json()) as {
      credits?: number;
      data?: Array<{ b64_json?: string; url?: string }>;
    };

    const b64 = json.data?.[0]?.b64_json;
    if (!b64) {
      lastRecraftError = "Recraft returned no image data.";
      console.warn(`[Recraft] ${model.apiModel} returned no b64_json`);
      return null;
    }

    console.log(
      `[Recraft] ${model.apiModel} ok, ${json.credits ?? "?"} units ($${model.usdPerImage})`
    );
    return {
      buffer: Buffer.from(b64, "base64"),
      ext: "png",
      contentType: "image/png",
    };
  } catch (err) {
    lastRecraftError = "Couldn't reach the image service. Please try again.";
    console.error(`[Recraft] ${model.apiModel} failed:`, (err as Error).message);
    return null;
  }
}

/** The user-facing half of a failure. The raw body stays in the server log. */
function friendlyRecraftError(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return "The image service rejected our credentials.";
  }
  if (status === 402 || /insufficient|balance|credit/i.test(body)) {
    return "The image service account is out of credit.";
  }
  if (status === 429) {
    return "The image service is rate limiting us. Please try again shortly.";
  }
  if (status >= 500) {
    return "The image service is having trouble. Please try again shortly.";
  }
  return "Couldn't generate the image for this post. Please try again.";
}
