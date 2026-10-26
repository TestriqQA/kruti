import { NextRequest, NextResponse } from "next/server";
import { getMobileUserId } from "@/lib/mobileAuth";
import { runSingleImageGeneration } from "@/lib/generation/single-image";

/**
 * POST /api/mobile/posts/[id]/generate-image
 * Body (optional): { "customPrompt": "..." }
 *
 * Generates or REGENERATES the image on one post. The app editor's
 * "regenerate image" button.
 *
 * This exists because the bulk pipeline cannot do it: /posts/generate-images
 * filters on imageUrl: null, so it only ever adds a first image and silently
 * skips any post that already has one. Same function as the website's
 * /api/generate/image, so the two cannot drift.
 *
 * Returns { imageUrl, remaining, limit }. Two different 429s are possible and
 * they mean different things: the rate limit carries rateLimited and
 * retryAfterSecs, while the per-post cap carries remaining and limit and is not
 * worth retrying - that post has used its allowance and needs an upload
 * instead.
 *
 * maxDuration matches the other image routes. The website route sets none and
 * inherits the platform default, which is tighter than an image model usually
 * needs; not changing that here, but this route should not inherit it.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { customPrompt?: unknown };

  // The post comes from the URL here rather than the body, so it is always
  // present - but the pipeline validates it anyway, for the website's sake.
  return runSingleImageGeneration(userId, params.id, body.customPrompt);
}
