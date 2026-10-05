import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { MAX_REPLY_CHARS, isTicketClosed } from "@/lib/support";

/** Admin writes a reply the user will see on their support page. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (message.length < 2) {
    return NextResponse.json({ error: "Reply cannot be empty" }, { status: 400 });
  }
  if (message.length > MAX_REPLY_CHARS) {
    return NextResponse.json(
      { error: `Reply must be under ${MAX_REPLY_CHARS} characters` },
      { status: 400 }
    );
  }

  const ticket = await prisma.supportTicket.findUnique({
    where: { id: params.id },
    select: { id: true, status: true },
  });
  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // A closed ticket is read-only. Replying to one would hand the user a message
  // they cannot answer on a thread they cannot reopen, so the whole exchange is
  // locked and they raise a fresh ticket instead.
  if (isTicketClosed(ticket.status)) {
    return NextResponse.json(
      { error: "This ticket is closed. Replies are locked." },
      { status: 409 }
    );
  }

  const reply = await prisma.supportReply.create({
    data: { ticketId: ticket.id, message },
    select: { id: true, message: true, createdAt: true, readAt: true },
  });

  // Replying on an untouched ticket moves it along, so the queue reflects reality.
  if (ticket.status === "open") {
    await prisma.supportTicket.update({
      where: { id: ticket.id },
      data: { status: "in_progress" },
    });
  }

  return NextResponse.json({
    reply: { ...reply, createdAt: reply.createdAt.toISOString() },
    status: ticket.status === "open" ? "in_progress" : ticket.status,
  });
}
