import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";
import { checkRateLimit } from "@/lib/rate-limit";
import { MAX_REPLY_CHARS, isTicketClosed } from "@/lib/support";

/**
 * POST /api/mobile/support/tickets/[id]/reply
 * Body: { "message": "..." }
 *
 * A user replies on their own ticket. Mirrors the website route, including its
 * three deliberate rules:
 *
 *  1. Ownership is scoped to the caller, so one user cannot post on another
 *     user's ticket. A bare findUnique by id would not do that.
 *  2. No subscription check - a lapsed user is exactly who needs support.
 *  3. A user reply does NOT change the ticket status. Only an admin reply moves
 *     open -> in_progress; letting a user flip the queue state would let them
 *     mark their own ticket as being worked on.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getMobileUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generous enough for a real back-and-forth, tight enough that a stuck
    // client cannot fill the table.
    const { allowed, retryAfterSecs } = checkRateLimit(userId, "support-reply", {
      maxRequests: 20,
      windowSecs: 3600,
    });
    if (!allowed) {
      return NextResponse.json(
        {
          error: `Too many replies. Try again in ${Math.ceil((retryAfterSecs ?? 60) / 60)} minutes.`,
          rateLimited: true,
          retryAfterSecs,
        },
        { status: 429 },
      );
    }

    const body = await req.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (message.length < 2) {
      return NextResponse.json({ error: "Reply cannot be empty" }, { status: 400 });
    }
    if (message.length > MAX_REPLY_CHARS) {
      return NextResponse.json(
        { error: `Reply must be under ${MAX_REPLY_CHARS} characters` },
        { status: 400 },
      );
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: { id: params.id, userId },
      select: { id: true, status: true },
    });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Same rule as the admin side: a closed ticket is read-only for everyone.
    if (isTicketClosed(ticket.status)) {
      return NextResponse.json(
        { error: "This ticket is closed. Raise a new one if you still need help." },
        { status: 409 },
      );
    }

    const reply = await prisma.supportReply.create({
      data: { ticketId: ticket.id, message, authorRole: "user" },
      select: { id: true, message: true, createdAt: true, readAt: true, authorRole: true },
    });

    // Touch the ticket so it rises in the admin queue's "Last updated" column -
    // otherwise a user reply is invisible to anyone sorting by recency.
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      reply: {
        ...reply,
        createdAt: reply.createdAt.toISOString(),
        readAt: reply.readAt ? reply.readAt.toISOString() : null,
      },
    });
  } catch (err) {
    console.error("[mobile/support/reply] failed:", err);
    return NextResponse.json({ error: "Could not post reply" }, { status: 500 });
  }
}
