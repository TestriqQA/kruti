import { NextRequest, NextResponse } from "next/server";
import { getMobileUserId } from "@/lib/mobileAuth";
import { respondByAccept } from "@/lib/stream-mode";
import { runCarouselGeneration } from "@/lib/generation/carousel";

/**
 * POST /api/mobile/posts/[id]/generate-carousel
 *
 * Runs the same pipeline as the website's /api/generate/carousel - the same
 * function - so the two cannot drift apart.
 *
 * The post is identified by the URL here, where the website route takes it in
 * the body. The pipeline validates it either way, because Prisma silently drops
 * an `undefined` id filter and would otherwise load an arbitrary post the user
 * happens to own.
 *
 * Transport follows the Accept header:
 *   Accept: application/x-ndjson  -> streamed per-slide progress
 *   anything else                 -> one JSON response when the run finishes
 *
 * The app does not send the NDJSON header on this route, so in practice it gets
 * the buffered form; both are supported so progress can be turned on later
 * without a server change.
 *
 * maxDuration is 300 rather than the website's 60. Four images is slow, and a
 * buffered caller receives nothing until the run completes, where a streaming
 * one has been getting a slide at a time.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return respondByAccept(
    req,
    (send) => runCarouselGeneration(userId, params.id, send),
    (err) => (err as Error)?.message || "Carousel generation failed",
  );
}
