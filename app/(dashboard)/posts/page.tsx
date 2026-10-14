import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import PostsClient from "@/components/PostsClient";
import { format } from "date-fns";
import { postsRemainingInCycle, POST_LIMIT_PER_CYCLE } from "@/lib/post-quota";
import { parseStrategy } from "@/lib/dashboard-overview";

export default async function PostsPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
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

  // Each post carries its plan's identity, so the list can group by the week it
  // was briefed for and show that week's theme - the archive's real grain is the
  // batch, not the row. parseStrategy is server-side, so no JSON.parse reaches
  // the client.
  const allPosts = plans.flatMap((p) => {
    const theme = parseStrategy(p.strategy).weekTheme;
    const weekStartIso = new Date(p.weekStart).toISOString();
    return p.posts.map((post) => ({
      ...post,
      weekLabel: `Posts from ${format(new Date(p.weekStart), "MMM d, yyyy")}`,
      planId: p.id,
      weekStartIso,
      weekLabelShort: format(new Date(p.weekStart), "d MMM"),
      weekTheme: theme,
    }));
  });

  // plans is sorted weekStart desc, so the first is the current strategy.
  const recentPlan = plans[0]
    ? { strategy: plans[0].strategy, weekStart: plans[0].weekStart }
    : null;

  return (
    <PostsClient
      posts={allPosts}
      recentPlan={recentPlan}
      postsRemaining={postsRemainingInCycle(user?.role, subscription)}
      postsLimit={POST_LIMIT_PER_CYCLE}
      initialStatus={searchParams?.status ?? null}
    />
  );
}
