import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { head, del } from "@vercel/blob";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  MAX_SCREENSHOTS,
  MAX_TOTAL_BYTES,
  MAX_DESCRIPTION_CHARS,
  SUPPORT_BLOB_PREFIX,
  formatBytes,
  type TicketAttachment,
} from "@/lib/support";

export const maxDuration = 60;

/**
 * Creates a support ticket from the description plus the screenshots that were
 * already uploaded by /api/support/attachment.
 *
 * Deliberately no subscription check - a lapsed user still needs support.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const rl = checkRateLimit(userId, "support-ticket", { maxRequests: 5, windowSecs: 3600 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `You have raised several tickets already. Try again in ${rl.retryAfterSecs}s.` },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const incoming = Array.isArray(body?.attachments) ? body.attachments : [];

  if (description.length < 10) {
    return NextResponse.json(
      { error: "Please describe the problem in a little more detail." },
      { status: 400 }
    );
  }
  if (description.length > MAX_DESCRIPTION_CHARS) {
    return NextResponse.json(
      { error: `Description must be under ${MAX_DESCRIPTION_CHARS} characters.` },
      { status: 400 }
    );
  }
  if (incoming.length > MAX_SCREENSHOTS) {
    return NextResponse.json(
      { error: `At most ${MAX_SCREENSHOTS} screenshots.` },
      { status: 400 }
    );
  }

  // Only accept blobs this feature wrote. Without this a caller could attach any
  // URL - including another user's generated image - to their own ticket.
  const urls: string[] = incoming
    .map((a: TicketAttachment) => (typeof a?.url === "string" ? a.url : ""))
    .filter(Boolean);
  if (urls.some((u) => !u.includes(`/${SUPPORT_BLOB_PREFIX}`))) {
    return NextResponse.json({ error: "Unexpected attachment." }, { status: 400 });
  }

  // Read the real sizes back from blob storage rather than trusting the body:
  // the per-file cap is enforced at upload time, but the 5 MB TOTAL can only be
  // guaranteed here, and a client could otherwise understate it.
  const attachments: TicketAttachment[] = [];
  let total = 0;
  try {
    for (const url of urls) {
      const meta = await head(url);
      total += meta.size;
      attachments.push({
        url,
        name: meta.pathname.split("/").pop() || "screenshot",
        size: meta.size,
      });
    }
  } catch (err) {
    console.error("Support attachment verification failed:", err);
    return NextResponse.json(
      { error: "Could not verify the uploaded screenshots. Please try again." },
      { status: 400 }
    );
  }

  if (total > MAX_TOTAL_BYTES) {
    // Clean up rather than leave orphans nothing sweeps.
    await Promise.all(attachments.map((a) => del(a.url).catch(() => {})));
    return NextResponse.json(
      {
        error: `Screenshots total ${formatBytes(total)}, which is over the ${formatBytes(
          MAX_TOTAL_BYTES
        )} limit.`,
      },
      { status: 400 }
    );
  }

  const ticket = await prisma.supportTicket.create({
    data: {
      userId,
      description,
      screenshots: attachments.length > 0 ? JSON.stringify(attachments) : null,
    },
    select: { id: true, status: true, createdAt: true },
  });

  return NextResponse.json({ ticket });
}
