import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runSingleImageGeneration } from "@/lib/generation/single-image";
import { respondByAccept } from "@/lib/stream-mode";

/**
 * Single-post image generation.
 *
 * The pipeline lives in lib/generation/single-image.ts, shared with
 * /api/mobile/posts/[id]/generate-image.
 *
 * The editor asks for NDJSON so it can draw the live pipeline; anything that
 * does not gets the single JSON body this route has always returned.
 *
 * maxDuration matches the sibling website routes (bulk images, carousel),
 * which do the same kind of work. This route previously set none and
 * inherited the platform default, which is shorter than an image model
 * usually needs - and holding a stream open makes that bite.
 */
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Previously an unparsable body threw out of req.json() and became a 500.
  // It now falls through to the pipeline's own postId check, which answers 400.
  const body = (await req.json().catch(() => ({}))) as {
    postId?: unknown;
    customPrompt?: unknown;
  };

  // Captured before the closure so TypeScript keeps the narrowing from the
  // session check above.
  const userId = session.user.id;
  return respondByAccept(req, (send, signal) =>
    runSingleImageGeneration(userId, body.postId, body.customPrompt, send, signal)
  );
}
