import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ndjsonResponse } from "@/lib/ndjson";
import { runBulkImageGeneration } from "@/lib/generation/bulk-images";

/**
 * Streaming route: emits step-by-step NDJSON progress so the client can show
 * the whole pipeline (preflight -> per-post brief/render/save -> summary).
 *
 * The pipeline lives in lib/generation/bulk-images.ts, shared with
 * /api/mobile/posts/generate-images.
 *
 * Auth is answered with a status rather than a stream event, so a client can
 * tell a genuine 401 from a run that failed partway.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as { postIds?: string[] };

  return ndjsonResponse(
    (send) => runBulkImageGeneration(userId, body.postIds, send),
    () => "Image generation failed",
  );
}
