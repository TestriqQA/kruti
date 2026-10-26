import { NextRequest, NextResponse } from "next/server";
import { getMobileUserId } from "@/lib/mobileAuth";
import { respondByAccept } from "@/lib/stream-mode";
import { runBulkImageGeneration } from "@/lib/generation/bulk-images";

/**
 * POST /api/mobile/posts/generate-images
 * Body: { "postIds": ["...", "..."] }   (at most 10)
 *
 * Runs the same pipeline as the website's /api/generate/image/bulk - the same
 * function - so the two cannot drift apart.
 *
 * Transport follows the Accept header:
 *   Accept: application/x-ndjson  -> streamed per-post progress
 *   anything else                 -> one JSON response when the run finishes
 *
 * A 401 is always an HTTP status, never a stream event. There is no 429 from
 * this pipeline: the cap of 10 posts per call plus sequential rendering is what
 * bounds it, so the app limits its bulk action to 10 selected posts instead.
 *
 * maxDuration is 300 rather than the website's 60. Rendering ten images in
 * sequence is slow, and a buffered caller gets nothing at all until the run
 * completes, where a streaming one has been receiving events throughout.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { postIds?: string[] };

  return respondByAccept(
    req,
    (send) => runBulkImageGeneration(userId, body.postIds, send),
    () => "Image generation failed",
  );
}
