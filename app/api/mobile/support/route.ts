import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";
import { head, del } from "@vercel/blob";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  MAX_SCREENSHOTS,
  MAX_TOTAL_BYTES,
  MAX_DESCRIPTION_CHARS,
  SUPPORT_BLOB_PREFIX,
  DEFAULT_TICKET_CATEGORY,
  REPLY_TTL_DAYS,
  formatBytes,
  isTicketCategory,
  parseAttachments,
  replyCutoff,
  type TicketAttachment,
} from "@/lib/support";

export const maxDuration = 60;

/**
 * GET  /api/mobile/support  - the caller's tickets with their replies
 * POST /api/mobile/support  - raise a ticket
 *
 * Neither is subscription-gated, same as the website: a user whose trial has
 * lapsed is exactly the user who needs to reach support.
 *
 * The GET has no website counterpart - the /support page queries Prisma
 * directly in its server component - so this mirrors that query rather than
 * porting a route. Replies are filtered by age here as well as being swept
 * nightly, so one disappears the moment it turns REPLY_TTL_DAYS old instead of
 * waiting for the cron.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await getMobileUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tickets = await prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        description: true,
        category: true,
        status: true,
        screenshots: true,
        createdAt: true,
        updatedAt: true,
        replies: {
          where: { createdAt: { gte: replyCutoff() } },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            message: true,
            createdAt: true,
            readAt: true,
            authorRole: true,
          },
        },
      },
    });

    return NextResponse.json({
      // Lets the app show the same "replies disappear after N days" notice
      // without hard-coding the number on its side.
      replyTtlDays: REPLY_TTL_DAYS,
      tickets: tickets.map((t) => ({
        id: t.id,
        description: t.description,
        category: t.category,
        status: t.status,
        // Parsed rather than the raw JSON column, so the app does not have to
        // know how we store it.
        attachments: parseAttachments(t.screenshots),
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        replies: t.replies.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          readAt: r.readAt ? r.readAt.toISOString() : null,
        })),
      })),
    });
  } catch (err) {
    console.error("[mobile/support] list failed:", err);
    return NextResponse.json({ error: "Could not load tickets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getMobileUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(userId, "support-ticket", { maxRequests: 5, windowSecs: 3600 });
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: `You have raised several tickets already. Try again in ${rl.retryAfterSecs}s.`,
          rateLimited: true,
          retryAfterSecs: rl.retryAfterSecs,
        },
        { status: 429 },
      );
    }

    const body = await req.json().catch(() => null);
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const incoming = Array.isArray(body?.attachments) ? body.attachments : [];

    // Falls back rather than rejecting. An unrecognised or missing category is
    // not a good enough reason to stop someone reaching support.
    const category = isTicketCategory(body?.category) ? body.category : DEFAULT_TICKET_CATEGORY;

    if (description.length < 10) {
      return NextResponse.json(
        { error: "Please describe the problem in a little more detail." },
        { status: 400 },
      );
    }
    if (description.length > MAX_DESCRIPTION_CHARS) {
      return NextResponse.json(
        { error: `Description must be under ${MAX_DESCRIPTION_CHARS} characters.` },
        { status: 400 },
      );
    }
    if (incoming.length > MAX_SCREENSHOTS) {
      return NextResponse.json({ error: `At most ${MAX_SCREENSHOTS} screenshots.` }, { status: 400 });
    }

    // Only accept blobs this feature wrote. Without this a caller could attach
    // any URL - including another user's generated image - to their own ticket.
    const urls: string[] = incoming
      .map((a: TicketAttachment) => (typeof a?.url === "string" ? a.url : ""))
      .filter(Boolean);
    if (urls.some((u) => !u.includes(`/${SUPPORT_BLOB_PREFIX}`))) {
      return NextResponse.json({ error: "Unexpected attachment." }, { status: 400 });
    }

    // Sizes are read back from blob storage rather than trusted from the body:
    // the per-file cap is enforced at upload, but the total can only be
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
      console.error("[mobile/support] attachment verification failed:", err);
      return NextResponse.json(
        { error: "Could not verify the uploaded screenshots. Please try again." },
        { status: 400 },
      );
    }

    if (total > MAX_TOTAL_BYTES) {
      // Clean up rather than leave orphans nothing sweeps.
      await Promise.all(attachments.map((a) => del(a.url).catch(() => {})));
      return NextResponse.json(
        {
          error: `Screenshots total ${formatBytes(total)}, which is over the ${formatBytes(
            MAX_TOTAL_BYTES,
          )} limit.`,
        },
        { status: 400 },
      );
    }

    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        description,
        category,
        screenshots: attachments.length > 0 ? JSON.stringify(attachments) : null,
      },
      select: { id: true, status: true, category: true, createdAt: true },
    });

    return NextResponse.json({
      ticket: { ...ticket, createdAt: ticket.createdAt.toISOString() },
    });
  } catch (err) {
    console.error("[mobile/support] create failed:", err);
    return NextResponse.json({ error: "Could not raise ticket" }, { status: 500 });
  }
}
