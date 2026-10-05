import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { put } from "@vercel/blob";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  SUPPORT_BLOB_PREFIX,
  MAX_ATTACHMENT_BYTES,
  SCREENSHOT_MIME_TYPES,
} from "@/lib/support";

export const maxDuration = 60;

/**
 * Uploads ONE screenshot and returns its blob URL.
 *
 * One file per request on purpose: Vercel caps a serverless request body at
 * ~4.5 MB, so posting all five screenshots together would be rejected at the
 * edge before this handler ever runs. The per-file cap below stays under that
 * ceiling; the 5 MB TOTAL is enforced when the ticket is created, by reading
 * the real blob sizes back (see app/api/support/route.ts).
 *
 * Deliberately no subscription check: a user whose trial lapsed is exactly the
 * user who needs to raise a ticket.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = checkRateLimit(session.user.id, "support-attachment", {
    maxRequests: 30,
    windowSecs: 3600,
  });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many uploads. Try again in ${rl.retryAfterSecs}s.` },
      { status: 429 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!SCREENSHOT_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PNG, JPG and WebP screenshots are allowed" },
        { status: 400 }
      );
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json(
        {
          error: `"${file.name}" is too large. Each screenshot must be under ${
            MAX_ATTACHMENT_BYTES / (1024 * 1024)
          } MB.`,
        },
        { status: 400 }
      );
    }

    // Same hardening the document upload uses on user-supplied names.
    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 120) || "screenshot.png";

    const blob = await put(
      `${SUPPORT_BLOB_PREFIX}${session.user.id}-${Date.now()}-${safeName}`,
      file,
      { access: "public", contentType: file.type }
    );

    return NextResponse.json({ url: blob.url, name: safeName, size: file.size });
  } catch (err) {
    console.error("Support attachment upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
