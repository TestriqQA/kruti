import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkActiveSubscription } from "@/lib/subscription-check";

// POST /api/content/bulk
// Body: { action: "schedule-time" | "status" | "delete", postIds: string[], time?: string, status?: string }
// "schedule-time": time = "HH:MM", keeps each post's existing date, updates time only
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const { action, postIds, time, status } = body as {
    action: string;
    postIds: string[];
    time?: string;      // "HH:MM" for schedule-time
    status?: string;
  };

  if (!action || !Array.isArray(postIds) || postIds.length === 0) {
    return NextResponse.json({ error: "action and postIds are required" }, { status: 400 });
  }

  // Verify all posts belong to this user
  const posts = await prisma.post.findMany({
    where: {
      id: { in: postIds },
      plan: { userId: session.user.id },
    },
    select: { id: true, scheduledAt: true },
  });

  if (posts.length !== postIds.length) {
    return NextResponse.json({ error: "Some posts not found or unauthorized" }, { status: 403 });
  }

  const validIds = posts.map((p) => p.id);

  // The subscription gate is applied PER ACTION rather than to the whole route.
  //
  // "delete" is deliberately exempt: it used to 403 for a lapsed user, meaning
  // they could not remove their own posts - a direct defect under DPDP s.12(3)
  // (right to erasure). A paywall may stop someone creating or scheduling more
  // content; it must not stop them deleting what is already theirs.
  if (action !== "delete") {
    const sub = await checkActiveSubscription(session.user.id);
    if (!sub.allowed) {
      return NextResponse.json(
        { error: sub.reason, subscriptionRequired: true },
        { status: 403 }
      );
    }
  }

  switch (action) {
    case "schedule-time": {
      if (!time || !/^\d{1,2}:\d{2}$/.test(time)) {
        return NextResponse.json({ error: "time is required (format HH:MM)" }, { status: 400 });
      }
      const [hours, minutes] = time.split(":").map(Number);

      // Update each post individually to preserve its existing date
      await prisma.$transaction(
        posts.map((p) => {
          let newScheduledAt: Date;
          if (p.scheduledAt) {
            // Keep existing date, update time
            newScheduledAt = new Date(p.scheduledAt);
          } else {
            // No existing date - use tomorrow
            newScheduledAt = new Date();
            newScheduledAt.setDate(newScheduledAt.getDate() + 1);
          }
          newScheduledAt.setHours(hours, minutes, 0, 0);
          return prisma.post.update({
            where: { id: p.id },
            data: { scheduledAt: newScheduledAt, status: "ready" },
          });
        })
      );
      return NextResponse.json({ updated: posts.length });
    }

    case "status": {
      const allowed = ["draft", "ready", "published"];
      if (!status || !allowed.includes(status)) {
        return NextResponse.json({ error: "status must be draft, ready, or published" }, { status: 400 });
      }
      await prisma.post.updateMany({
        where: {
          id: { in: validIds },
          postedToLinkedIn: false,
        },
        data: { status },
      });
      return NextResponse.json({ updated: validIds.length });
    }

    case "delete": {
      await prisma.post.deleteMany({
        where: {
          id: { in: validIds },
          postedToLinkedIn: false,
        },
      });
      return NextResponse.json({ deleted: validIds.length });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
