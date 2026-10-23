import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

/**
 * POST /api/mobile/support/tickets/[id]/read
 *
 * Marks every admin reply on one of the caller's tickets as read.
 *
 * Ownership is checked through the ticket, so one user cannot mark another
 * user's replies as read.
 *
 * ADMIN replies only: readAt means "read by the other party", so a user
 * marking their own messages read would clear the admin's "new reply from
 * user" signal from the wrong side of the conversation.
 *
 * No subscription check: a lapsed user must still be able to read support.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getMobileUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: { id: params.id, userId },
      select: { id: true },
    });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const { count } = await prisma.supportReply.updateMany({
      where: { ticketId: ticket.id, readAt: null, authorRole: "admin" },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ marked: count });
  } catch (err) {
    console.error("[mobile/support/read] failed:", err);
    return NextResponse.json({ error: "Could not mark replies read" }, { status: 500 });
  }
}
