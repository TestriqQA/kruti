import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Marks every reply on one of the caller's tickets as read.
 *
 * No subscription check: a lapsed user must still be able to read support.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ownership is checked through the ticket, so one user cannot mark another
  // user's replies as read.
  const ticket = await prisma.supportTicket.findFirst({
    where: { id: params.id, userId: session.user.id },
    select: { id: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const { count } = await prisma.supportReply.updateMany({
    where: { ticketId: ticket.id, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ marked: count });
}
