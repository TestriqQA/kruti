import { prisma } from "@/lib/prisma";
import AdminTicketsClient from "@/components/AdminTicketsClient";
import { replyCutoff } from "@/lib/support";

export default async function AdminTicketsPage() {
  const cutoff = replyCutoff();

  const [tickets, total, openCount] = await Promise.all([
    prisma.supportTicket.findMany({
      take: 50,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        description: true,
        screenshots: true,
        status: true,
        createdAt: true,
        // Drives the "Last updated" column. Prisma maintains it via @updatedAt,
        // so it moves on a status change or an admin reply without us setting it.
        updatedAt: true,
        user: { select: { name: true, email: true, image: true } },
        replies: {
          // Same age filter the user sees, so admins are not looking at a reply
          // the user no longer has.
          where: { createdAt: { gte: cutoff } },
          orderBy: { createdAt: "asc" },
          select: { id: true, message: true, createdAt: true, readAt: true, authorRole: true },
        },
      },
    }),
    prisma.supportTicket.count(),
    prisma.supportTicket.count({ where: { status: "open" } }),
  ]);

  return (
    <AdminTicketsClient
      initialTickets={tickets.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        replies: t.replies.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          readAt: r.readAt ? r.readAt.toISOString() : null,
        })),
      }))}
      total={total}
      openCount={openCount}
    />
  );
}
