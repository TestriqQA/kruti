import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { TICKET_STATUSES, isTicketClosed, type TicketStatus } from "@/lib/support";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const status = body?.status as TicketStatus | undefined;

  if (!status || !TICKET_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `status must be one of: ${TICKET_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const existing = await prisma.supportTicket.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // "closed" is terminal. Whoever closed it - the user from /support or an
  // admin from here - the ticket stays closed, so there is no path back to
  // "open" or "in_progress". The client hides the status buttons on a closed
  // ticket; this is the guard for anything that calls the route directly.
  if (isTicketClosed(existing.status)) {
    return NextResponse.json(
      { error: "This ticket is closed and cannot be reopened." },
      { status: 409 }
    );
  }

  const ticket = await prisma.supportTicket.update({
    where: { id: params.id },
    data: { status },
    select: { id: true, status: true },
  });

  return NextResponse.json({ ticket });
}
