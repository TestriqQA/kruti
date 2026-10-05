import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import SupportClient from "@/components/SupportClient";
import { replyCutoff } from "@/lib/support";

export default async function SupportPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const cutoff = replyCutoff();

  const [user, tickets] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        image: true,
        timezone: true,
        subscription: { select: { status: true } },
      },
    }),
    prisma.supportTicket.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        description: true,
        screenshots: true,
        status: true,
        createdAt: true,
        replies: {
          // Filter by age as well as relying on the nightly sweep, so a reply
          // disappears the moment it turns 3 days old.
          where: { createdAt: { gte: cutoff } },
          orderBy: { createdAt: "asc" },
          select: { id: true, message: true, createdAt: true, readAt: true },
        },
      },
    }),
  ]);

  return (
    <SupportClient
      user={{
        name: user?.name ?? null,
        email: user?.email ?? null,
        image: user?.image ?? null,
        timezone: user?.timezone ?? null,
        plan: user?.subscription?.status ?? "none",
      }}
      tickets={tickets.map((t) => ({
        ...t,
        createdAt: t.createdAt.toISOString(),
        replies: t.replies.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
          readAt: r.readAt ? r.readAt.toISOString() : null,
        })),
      }))}
    />
  );
}
