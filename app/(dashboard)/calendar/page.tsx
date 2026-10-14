import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CalendarClient from "@/components/CalendarClient";

export default async function CalendarPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  // Fetch user timezone
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true },
  });

  // Load the last 8 weeks of plans (covers ~2 months for the calendar)
  const plans = await prisma.contentPlan.findMany({
    where: { userId: session.user.id },
    include: { posts: { orderBy: { scheduledAt: "asc" } } },
    orderBy: { weekStart: "desc" },
    take: 8,
  });

  // Flatten all posts from all plans
  const allPosts = plans.flatMap((p) =>
    p.posts.map((post) => ({
      ...post,
      weekStart: p.weekStart,
    }))
  );

  return <CalendarClient posts={allPosts} userTimezone={user?.timezone ?? "Asia/Kolkata"} />;
}
