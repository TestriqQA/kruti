// ─── lib/pricing.ts ───────────────────────────────────────────────────────────
// Single source of truth for Gemini API cost ESTIMATION, in USD, converted to INR.
//
// The app does not store token usage or billed amounts anywhere, so every figure
// here is an ESTIMATE: (activity counts) x (published Gemini unit pricing). Real
// billing lives in the Google Cloud / Gemini billing console. Pricing verified
// against https://ai.google.dev/gemini-api/docs/pricing (June 2026). Token rule of
// thumb: ~4 characters per token.
//
// Models in use:
//   - Images: Nano Banana 2 = gemini-3.1-flash-image (see lib/imagen.ts).
//   - Text:   gemini-2.5-flash (posts, strategy, image briefs) + Google Search grounding.

/** USD -> INR. Override via env (e.g. for live FX) without code changes. */
export const USD_TO_INR = Number(process.env.USD_TO_INR ?? 85);

// ── Gemini 2.5 Flash (all text) — USD per 1M tokens ──
export const FLASH_INPUT_USD_PER_M = 0.3;
export const FLASH_OUTPUT_USD_PER_M = 2.5;

// ── Google Search grounding tool (gemini-2.5-flash tier) — USD per grounded prompt ──
export const GROUNDING_USD_PER_CALL = 35 / 1000; // $35 / 1,000 prompts = 0.035

// ── Images: Nano Banana 2 = gemini-3.1-flash-image — USD per generated image ──
//
// This block used to price Nano Banana PRO (gemini-3-pro-image) at $120 per 1M
// image-output tokens x 1120 tokens = $0.134 an image, while lib/imagen.ts has
// only ever called gemini-3.1-flash-image. Admin analytics therefore overstated
// every image by roughly a third, and understated nothing - so the dashboard was
// reporting a spend the account was never charged.
//
// Priced per image rather than per output token because the Flash tier's rate
// genuinely differs by resolution: unlike Pro, 1K and 2K are NOT the same price,
// which matters here because carousels render at 1K and single images at 2K.
export const IMAGE_USD_1K = 0.067;
export const IMAGE_USD_2K = 0.101;
export const IMAGE_USD_4K = 0.15;

/**
 * Nano Banana Pro, for reference only - nothing calls it today. If lib/imagen.ts
 * is ever pointed back at gemini-3-pro-image, swap these into imageCostUsd().
 */
export const PRO_IMAGE_USD_1K_2K = 0.134;
export const PRO_IMAGE_USD_4K = 0.24;

export const toInr = (usd: number): number => usd * USD_TO_INR;

export function flashTextCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1e6) * FLASH_INPUT_USD_PER_M + (outputTokens / 1e6) * FLASH_OUTPUT_USD_PER_M;
}

// ── Images: Recraft, when IMAGE_PROVIDER points at it ──
//
// Flat per image - Recraft bills per generation, not per resolution, so unlike
// the Gemini tier there is nothing to vary by size. Figures are Recraft's
// published API pricing and are duplicated in lib/recraft.ts next to the model
// ids they belong to; change both together.
export const RECRAFT_V3_USD = 0.04;
export const RECRAFT_V41_FLASH_USD = 0.007;

/**
 * Cost (USD) of generating one image at the given resolution.
 *
 * Resolution only moves the price on the Gemini tier. Pass the provider when
 * the caller knows it - otherwise this reports the Gemini rate, which is what
 * every image generated before the provider switch existed actually cost.
 */
export function imageCostUsd(
  resolution: "1K" | "2K" | "4K" = "2K",
  provider: "gemini" | "recraft-v3" | "recraft-v4.1-flash" = "gemini"
): number {
  if (provider === "recraft-v3") return RECRAFT_V3_USD;
  if (provider === "recraft-v4.1-flash") return RECRAFT_V41_FLASH_USD;
  if (resolution === "1K") return IMAGE_USD_1K;
  if (resolution === "4K") return IMAGE_USD_4K;
  return IMAGE_USD_2K;
}

/** One grounded research call: flash text + N grounding queries. */
export function groundedCallCostUsd(inputTokens: number, outputTokens: number, groundingQueries = 1): number {
  return flashTextCostUsd(inputTokens, outputTokens) + groundingQueries * GROUNDING_USD_PER_CALL;
}

// ── Workload token estimates (tuned to lib/prompts.ts) ──
const EST = {
  research: { input: 3000, output: 500 }, // buildResearchPrompt (grounded)
  postsWrite: { input: 3500, perPostOutput: 460 }, // buildPostsPrompt
  strategy: { input: 3000, output: 1200 }, // buildStrategyPrompt
  imageBrief: { input: 1500, output: 250 }, // photographic scene brief (image model)
  // buildDesignBriefPrompt - markedly smaller than the old art-direction brief it
  // replaced, because a code-rendered image needs only the words, not a visual.
  designBrief: { input: 1200, output: 150 },
} as const;

/** Full /api/generate/posts batch: grounded research + writing N posts (USD). */
export function postsBatchCostUsd(postCount = 5): number {
  const research = groundedCallCostUsd(EST.research.input, EST.research.output, 1);
  const write = flashTextCostUsd(EST.postsWrite.input, EST.postsWrite.perPostOutput * postCount);
  return research + write;
}

export function strategyCostUsd(): number {
  return flashTextCostUsd(EST.strategy.input, EST.strategy.output);
}

// ── Per-unit INR rates the analytics dashboard multiplies by activity counts ──

/**
 * Per generated image (Nano Banana 2 @ 2K), incl. its small text brief.
 *
 * A single blended rate on purpose: analytics recovers images from Blob
 * filenames and cannot tell a single image from a carousel slide, so every image
 * is costed at the 2K rate. Carousel slides actually render at 1K
 * (IMAGE_USD_1K), so an account that leans on carousels is costed slightly HIGH
 * here - the opposite direction to the old Pro-rate bug, and a much smaller gap.
 */
export const IMAGE_COST_INR = toInr(
  imageCostUsd("2K") + flashTextCostUsd(EST.imageBrief.input, EST.imageBrief.output)
); // ~INR 8.68

/**
 * Per post created. A posts batch (~5 posts) costs one grounded research call plus
 * one writing call; the grounding fee dominates and is fixed per batch, so we
 * amortise the typical 5-post batch across its posts.
 */
export const CONTENT_COST_PER_POST_INR = toInr(postsBatchCostUsd(5) / 5); // ~INR 0.75

/**
 * Per CODE-RENDERED image (lib/render-card.tsx) - no image-model call at all,
 * so the only cost is the small flash brief that writes the on-image text.
 *
 * This is what the twelve designed formats and every carousel slide now cost,
 * which is roughly 1/140th of IMAGE_COST_INR above. Analytics tells the two
 * apart by the "card-" blob prefix; see classifyImageUrl in lib/usage-analytics.ts.
 */
export const RENDERED_IMAGE_COST_INR = toInr(
  flashTextCostUsd(EST.designBrief.input, EST.designBrief.output)
); // ~INR 0.06

/** Per strategy (ContentPlan) generation. */
export const STRATEGY_COST_INR = toInr(strategyCostUsd()); // ~INR 0.33

/** Assumed batch size used when amortising per-post content cost (for transparency). */
export const ASSUMED_POSTS_PER_BATCH = 5;

/** Format a number as Indian Rupees, e.g. 11.39 -> "₹11.39". */
export function formatInr(amount: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits,
  }).format(Number.isFinite(amount) ? amount : 0);
}
