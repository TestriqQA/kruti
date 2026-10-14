import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CalendarClient from "@/components/CalendarClient";
import { parsePostingSchedule } from "@/lib/posting-schedule";

export default async function CalendarPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  // Fetch user timezone
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { timezone: true, postingSchedule: true },
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

  // The user's own posting days, so the grid can show which columns are theirs
  // rather than drawing a generic seven-day month.
  const schedule = parsePostingSchedule(user?.postingSchedule);

  return (
    <CalendarClient
      posts={allPosts}
      userTimezone={user?.timezone ?? "Asia/Kolkata"}
      postingDays={schedule.days}
      postingTime={schedule.time}
    />
  );
}
