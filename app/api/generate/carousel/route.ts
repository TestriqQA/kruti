import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ndjsonResponse } from "@/lib/ndjson";
import { runCarouselGeneration } from "@/lib/generation/carousel";

/**
 * Streaming route: emits step-by-step NDJSON progress so the client popup can
 * show the whole background pipeline (preflight -> plan -> per-slide render ->
 * save).
 *
 * The pipeline lives in lib/generation/carousel.ts, shared with
 * /api/mobile/posts/[id]/generate-carousel.
 *
 * This route already answered auth with a status rather than a stream event,
 * which is now what all four generation routes do.
 */
export const runtime = "nodejs";
// Generating 4 images can take longer than the default serverless limit.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as { postId?: string };

  return ndjsonResponse(
    (send) => runCarouselGeneration(userId, body.postId, send),
    (err) => (err as Error)?.message || "Carousel generation failed",
  );
}
