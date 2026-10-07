import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

/**
 * Marks a ticket's USER replies as read by an admin.
 *
 * The mirror of /api/support/tickets/[id]/read. Now the conversation runs both
 * ways, readAt means "read by the other party", so each side only ever clears
 * the other side's messages. Without this the admin queue would show a
 * permanent "new reply" marker on every ticket a user ever answered.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: params.id },
    select: { id: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const { count } = await prisma.supportReply.updateMany({
    where: { ticketId: ticket.id, readAt: null, authorRole: "user" },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ marked: count });
}
