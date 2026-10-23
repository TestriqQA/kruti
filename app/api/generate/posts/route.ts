import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ndjsonResponse } from "@/lib/ndjson";
import { runPostsGeneration } from "@/lib/generation/posts";

/**
 * Streaming route: emits step-by-step NDJSON progress so the client can show
 * the whole pipeline (preflight -> research -> writing -> scheduling -> save).
 *
 * The pipeline itself lives in lib/generation/posts.ts, so this route and
 * /api/mobile/generate/posts run the same code. Keeping two copies is what let
 * the mobile API drift 237 commits behind and then break.
 *
 * Auth is answered with a status rather than a stream event. There is nothing
 * to stream to someone we have not identified, and it lets a client tell a
 * genuine 401 from a run that failed partway.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as { planId?: string };

  return ndjsonResponse(
    (send) => runPostsGeneration(userId, body.planId, send),
    () => "Failed to generate posts",
  );
}
