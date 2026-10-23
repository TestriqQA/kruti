import { NextRequest, NextResponse } from "next/server";
import { getMobileUserId } from "@/lib/mobileAuth";
import { respondByAccept } from "@/lib/stream-mode";
import { runPostsGeneration } from "@/lib/generation/posts";

/**
 * POST /api/mobile/generate/posts
 * Body: { "planId": "..." }
 *
 * Runs the same pipeline as the website's /api/generate/posts - literally the
 * same function - so the two cannot drift apart again.
 *
 * Transport follows the Accept header:
 *   Accept: application/x-ndjson  -> streamed progress, gates as
 *                                    { "type": "error", ...flags } events
 *   anything else                 -> one JSON response, gates as HTTP
 *                                    403 / 429 with the same flags
 *
 * Either way a 401 is an HTTP status, never a stream event.
 *
 * maxDuration is 60 to match the website route. A buffered run has to finish
 * inside that window, where a streamed one is already sending by then; the app
 * sends the NDJSON header on this route for exactly that reason.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { planId?: string };

  return respondByAccept(
    req,
    (send) => runPostsGeneration(userId, body.planId, send),
    () => "Failed to generate posts",
  );
}
