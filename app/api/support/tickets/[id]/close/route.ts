import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CLOSED_STATUS, isTicketClosed } from "@/lib/support";

/**
 * Closes one of the caller's own tickets.
 *
 * Closing is final: nothing in the product moves a ticket out of "closed"
 * again, for the user or for an admin. The admin status route and the admin
 * reply route refuse to touch a closed ticket for the same reason.
 *
 * No subscription check: a lapsed user must still be able to manage support.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Scoping the lookup to the session user is what stops one user closing
  // another user's ticket - a bare findUnique by id would not.
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: params.id, userId: session.user.id },
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

  return NextResponse.json({ ticket: updated });
}
