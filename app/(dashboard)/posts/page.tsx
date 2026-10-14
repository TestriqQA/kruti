import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PostsClient from "@/components/PostsClient";
import { format } from "date-fns";
import { postsRemainingInCycle } from "@/lib/post-quota";

export default async function PostsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const [plans, user, subscription] = await Promise.all([
    prisma.contentPlan.findMany({
      where: { userId: session.user.id },
      include: { posts: { orderBy: { scheduledAt: "asc" } } },
      orderBy: { weekStart: "desc" },
      take: 8,
    }),
    // Both needed by the "Generate Posts" button in the header.
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    }),
    prisma.subscription.findUnique({
      where: { userId: session.user.id },
      select: { postsGeneratedThisCycle: true, cyclePostsResetAt: true },
    }),
  ]);

  const allPosts = plans.flatMap((p) =>
    p.posts.map((post) => ({
      ...post,
      weekLabel: `Posts from ${format(new Date(p.weekStart), "MMM d, yyyy")}`,
    }))
  );

  // plans is sorted weekStart desc, so the first is the current strategy.
  const recentPlan = plans[0]
    ? { strategy: plans[0].strategy, weekStart: plans[0].weekStart }
    : null;

  return (
    <PostsClient
      posts={allPosts}
      recentPlan={recentPlan}
      postsRemaining={postsRemainingInCycle(user?.role, subscription)}
    />
  );
}
