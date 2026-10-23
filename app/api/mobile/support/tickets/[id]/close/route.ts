import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";
import { CLOSED_STATUS, isTicketClosed } from "@/lib/support";

/**
 * POST /api/mobile/support/tickets/[id]/close
 *
 * Closes one of the caller's own tickets. Closing is final: nothing in the
 * product moves a ticket out of "closed" again, for the user or for an admin.
 * The admin status route and the admin reply route refuse to touch a closed
 * ticket for the same reason.
 *
 * Scoping the lookup to the caller is what stops one user closing another
 * user's ticket - a bare findUnique by id would not.
 *
 * No subscription check: a lapsed user must still be able to manage support.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await getMobileUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ticket = await prisma.supportTicket.findFirst({
      where: { id: params.id, userId },
      select: { id: true, status: true },
    });
    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    if (isTicketClosed(ticket.status)) {
      return NextResponse.json({ error: "This ticket is already closed." }, { status: 409 });
    }

    const updated = await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: CLOSED_STATUS },
      select: { id: true, status: true },
    });

    return NextResponse.json({ success: true, ticket: updated });
  } catch (err) {
    console.error("[mobile/support/close] failed:", err);
    return NextResponse.json({ error: "Could not close ticket" }, { status: 500 });
  }
}
