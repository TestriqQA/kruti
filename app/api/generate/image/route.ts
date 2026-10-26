import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runSingleImageGeneration } from "@/lib/generation/single-image";

/**
 * Single-post image generation.
 *
 * The pipeline lives in lib/generation/single-image.ts, shared with
 * /api/mobile/posts/[id]/generate-image.
 */
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

  return runSingleImageGeneration(session.user.id, body.postId, body.customPrompt);
}
