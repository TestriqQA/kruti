// ─── lib/usage-analytics.ts ───────────────────────────────────────────────────
// Derives admin usage analytics (images + content generated, posts by status, and
// estimated INR cost) purely from existing Post / ContentPlan data. The app stores
// no per-event timestamps for images, so image dates are recovered from the epoch-ms
// timestamp embedded in Vercel Blob filenames. All buckets are by IST (Asia/Kolkata)
// calendar day. Costs are ESTIMATES from lib/pricing.ts (counts x unit price).

import { parseImageHistory } from "./image-history";
import {
  IMAGE_COST_INR,
  RENDERED_IMAGE_COST_INR,
  CONTENT_COST_PER_POST_INR,
  STRATEGY_COST_INR,
} from "./pricing";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+05:30, no DST

/** Minimal Post shape this module needs (subset of the Prisma Post). */
export interface UsagePostInput {
  id: string;
  postType: string;
  status: string;
  imageUrl: string | null;
  carouselImages: string | null;
  imageHistory: string | null;
  imagePrompt: string | null;
  createdAt: Date | string;
}

export interface UsagePlanInput {
  createdAt: Date | string;
}

export interface DailyRecord {
  date: string; // IST day "YYYY-MM-DD"
  images: number;
  /** Of `images`, how many were laid out in code (free bar the text brief). */
  renderedImages: number;
  content: number; // posts created
  draft: number;
  ready: number;
  published: number;
  strategies: number;
  imageCostInr: number;
  contentCostInr: number;
  totalCostInr: number;
}

export interface PromptRow {
  postId: string;
  date: string; // IST day of the latest in-range generated image
  postType: string;
  status: string;
  prompt: string;
  imageUrl: string | null;
  isCarousel: boolean;
  images: number; // generated images for this post within the range
}

export interface UsageTotals {
  images: number;
  renderedImages: number;
  content: number;
  draft: number;
  ready: number;
  published: number;
  strategies: number;
  imageCostInr: number;
  contentCostInr: number;
  totalCostInr: number;
  days: number;
}

export interface UsageReport {
  start: string; // IST day key
  end: string; // IST day key
  totals: UsageTotals;
  daily: DailyRecord[];
  prompts: PromptRow[];
  // Privacy gate - set by the admin route/page, not by buildUsageReport. When the
  // reveal toggle is off, `prompts` is emptied and promptsRevealed is false.
  promptsRevealed?: boolean;
  promptsRevealUntil?: string | null;
}

/** IST calendar-day key ("YYYY-MM-DD") for an epoch-ms instant. */
export function istDayKey(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Start-of-day (00:00:00 IST) epoch ms for a "YYYY-MM-DD" IST day string. */
export function istDayStartMs(dayKey: string): number {
  return new Date(`${dayKey}T00:00:00.000+05:30`).getTime();
}

/** End-of-day (23:59:59.999 IST) epoch ms for a "YYYY-MM-DD" IST day string. */
export function istDayEndMs(dayKey: string): number {
  return new Date(`${dayKey}T23:59:59.999+05:30`).getTime();
}

/**
 * Extract the epoch-ms timestamp embedded in a generated blob filename. Vercel Blob
 * appends a random suffix (post-<id>-<ts>-<random>.ext), so the timestamp is not
 * necessarily right before the extension - match the 13-digit epoch run anywhere in
 * the basename (postId/cuid and the random suffix contain no 13-digit runs).
 */
export function tsFromBlobUrl(url: string): number | null {
  const base = url.split("/").pop() ?? "";
  const matches = base.match(/\d{13}/g);
  if (!matches) return null;
  const ms = matches.map(Number).reduce((a, b) => Math.max(a, b), 0);
  return ms > 0 ? ms : null;
}

type ImageKind = "generated" | "rendered" | "cropped" | "uploaded" | "other";

/** Classify a blob URL by its filename prefix / path. */
export function classifyImageUrl(url: string): ImageKind {
  if (!url) return "other";
  const base = (url.split("/").pop() ?? "").toLowerCase();
  if (base.startsWith("cropped-")) return "cropped"; // re-encode of an existing image, not a new model call
  // Laid out in code by lib/render-card.tsx - no image-model call, so it costs
  // only its small text brief. Distinguishing these is the only way the cost
  // figure below can stay honest now that most images are rendered this way.
  if (base.startsWith("card-")) return "rendered";
  if (base.startsWith("post-")) return "generated"; // model-generated (single or carousel slide)
  if (base.startsWith("upload-") || url.includes("/uploads/")) return "uploaded";
  return "other";
}

/**
 * Every model-generated image URL for a post (deduped), with its generation ts.
 * Counts both "generated" (post-*) and "cropped" (cropped-*) URLs: cropping re-encodes
 * a prior generation and REPLACES the original post-* URL everywhere it lived
 * (imageUrl, carouselImages, and imageHistory), so the cropped-* URL is the only
 * surviving evidence of that paid generation - excluding it would undercount real
 * image spend for every cropped post. User uploads (upload-*) are excluded.
 */
function collectGeneratedImages(
  post: UsagePostInput
): { url: string; ts: number; rendered: boolean }[] {
  const urls = new Set<string>();
  if (post.imageUrl) urls.add(post.imageUrl);
  if (post.carouselImages) {
    try {
      const arr = JSON.parse(post.carouselImages);
      if (Array.isArray(arr)) for (const u of arr) if (typeof u === "string") urls.add(u);
    } catch {
      /* ignore malformed JSON */
    }
  }
  for (const group of parseImageHistory(post.imageHistory)) for (const u of group) urls.add(u);

  const out: { url: string; ts: number; rendered: boolean }[] = [];
  for (const url of Array.from(urls)) {
    const kind = classifyImageUrl(url);
    // "rendered" counts as an image produced, but is costed separately below.
    if (kind !== "generated" && kind !== "cropped" && kind !== "rendered") continue;
    const ts = tsFromBlobUrl(url);
    if (ts === null) continue;
    out.push({ url, ts, rendered: kind === "rendered" });
  }
  return out;
}

function emptyDaily(date: string): DailyRecord {
  return {
    date,
    images: 0,
    renderedImages: 0,
    content: 0,
    draft: 0,
    ready: 0,
    published: 0,
    strategies: 0,
    imageCostInr: 0,
    contentCostInr: 0,
    totalCostInr: 0,
  };
}

/**
 * Build the full usage report for the IST day range [startKey, endKey] (inclusive),
 * zero-filling every day in between. Pass ALL posts/plans (not pre-filtered) so
 * images generated in-range on older posts are still counted.
 */
export function buildUsageReport(
  posts: UsagePostInput[],
  plans: UsagePlanInput[],
  startKey: string,
  endKey: string
): UsageReport {
  const startMs = istDayStartMs(startKey);
  const endMs = istDayEndMs(endKey);
  const inRange = (ms: number) => ms >= startMs && ms <= endMs;

  // Zero-fill every IST day in the range.
  const days = new Map<string, DailyRecord>();
  for (let d = startMs; d <= endMs; d += 24 * 60 * 60 * 1000) {
    const key = istDayKey(d);
    days.set(key, emptyDaily(key));
  }
  const ensure = (key: string) => {
    let r = days.get(key);
    if (!r) {
      r = emptyDaily(key);
      days.set(key, r);
    }
    return r;
  };

  const prompts: PromptRow[] = [];

  for (const post of posts) {
    // Images generated in-range (dated by blob filename ts).
    const gen = collectGeneratedImages(post).filter((g) => inRange(g.ts));
    if (gen.length > 0) {
      let latestTs = 0;
      for (const g of gen) {
        const rec = ensure(istDayKey(g.ts));
        rec.images += 1;
        if (g.rendered) rec.renderedImages += 1;
        if (g.ts > latestTs) latestTs = g.ts;
      }
      // One row per post that generated images in range (even if no prompt was
      // stored), so the prompt gallery reconciles with the image count.
      let isCarousel = false;
      try {
        const arr = post.carouselImages ? JSON.parse(post.carouselImages) : null;
        isCarousel = Array.isArray(arr) && arr.length > 1;
      } catch {
        /* ignore */
      }
      prompts.push({
        postId: post.id,
        date: istDayKey(latestTs),
        postType: post.postType,
        status: post.status,
        prompt: post.imagePrompt ?? "",
        imageUrl: post.imageUrl,
        isCarousel,
        images: gen.length,
      });
    }

    // Content (posts) created in-range, split by current status.
    const createdMs = new Date(post.createdAt).getTime();
    if (Number.isFinite(createdMs) && inRange(createdMs)) {
      const rec = ensure(istDayKey(createdMs));
      rec.content += 1;
      if (post.status === "published") rec.published += 1;
      else if (post.status === "ready") rec.ready += 1;
      else rec.draft += 1; // default / draft
    }
  }

  // Strategies (ContentPlan) created in-range.
  for (const plan of plans) {
    const ms = new Date(plan.createdAt).getTime();
    if (Number.isFinite(ms) && inRange(ms)) ensure(istDayKey(ms)).strategies += 1;
  }

  // Per-day costs + totals.
  const daily = Array.from(days.values()).sort((a, b) => a.date.localeCompare(b.date));
  const totals: UsageTotals = {
    images: 0,
    renderedImages: 0,
    content: 0,
    draft: 0,
    ready: 0,
    published: 0,
    strategies: 0,
    imageCostInr: 0,
    contentCostInr: 0,
    totalCostInr: 0,
    days: daily.length,
  };
  for (const r of daily) {
    // Code-rendered images cost only their small text brief; only the ones that
    // actually hit the image model carry the per-image price.
    r.imageCostInr =
      (r.images - r.renderedImages) * IMAGE_COST_INR + r.renderedImages * RENDERED_IMAGE_COST_INR;
    r.contentCostInr = r.content * CONTENT_COST_PER_POST_INR + r.strategies * STRATEGY_COST_INR;
    r.totalCostInr = r.imageCostInr + r.contentCostInr;
    totals.images += r.images;
    totals.renderedImages += r.renderedImages;
    totals.content += r.content;
    totals.draft += r.draft;
    totals.ready += r.ready;
    totals.published += r.published;
    totals.strategies += r.strategies;
    totals.imageCostInr += r.imageCostInr;
    totals.contentCostInr += r.contentCostInr;
    totals.totalCostInr += r.totalCostInr;
  }

  prompts.sort((a, b) => b.date.localeCompare(a.date));

  return { start: startKey, end: endKey, totals, daily, prompts };
}
