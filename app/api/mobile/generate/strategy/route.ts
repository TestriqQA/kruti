import { NextRequest, NextResponse } from "next/server";
import { getMobileUserId } from "@/lib/mobileAuth";
import { respondByAccept } from "@/lib/stream-mode";
import {
  runStrategyGeneration,
  strategyErrorMessage,
  type StrategyRequest,
} from "@/lib/generation/strategy";

/**
 * POST /api/mobile/generate/strategy
 * Body (optional): { "weekStart": "...", "reuseStrategy": true }
 *
 * Runs the same pipeline as the website's /api/generate/strategy - the same
 * function - so the two cannot drift apart.
 *
 * Transport follows the Accept header:
 *   Accept: application/x-ndjson  -> streamed progress
 *   anything else                 -> one JSON response when the run finishes
 *
 * The app does not send the NDJSON header on this route, so in practice it gets
 * the buffered form; both are supported so progress can be turned on later
 * without a server change.
 *
 * A 401 is always an HTTP status, never a stream event.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as StrategyRequest;

  return respondByAccept(
    req,
    (send) => runStrategyGeneration(userId, body, send),
    strategyErrorMessage,
  );
}
