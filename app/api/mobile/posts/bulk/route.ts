/**
 * POST /api/mobile/posts/bulk
 * Bulk actions on posts. Body:
 *   { action: "status" | "schedule-time" | "delete", postIds: string[],
 *     status?: string, time?: "HH:MM" }
 * Adapted from app/api/content/bulk/route.ts — mobile Bearer auth.
 *
 * Place at: app/api/mobile/posts/bulk/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

export async function POST(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { action, postIds, time, status } = body as {
    action: string;
    postIds: string[];
    time?: string;
    status?: string;
  };

  if (!action || !Array.isArray(postIds) || postIds.length === 0) {
    return NextResponse.json(
      { error: "action and postIds are required" },
      { status: 400 },
    );
  }

  const posts = await prisma.post.findMany({
    where: { id: { in: postIds }, plan: { userId } },
    select: { id: true, scheduledAt: true },
  });
  if (posts.length !== postIds.length) {
    return NextResponse.json(
      { error: "Some posts not found or unauthorized" },
      { status: 403 },
    );
  }
  const validIds = posts.map((p) => p.id);

  switch (action) {
    case "schedule-time": {
      if (!time || !/^\d{1,2}:\d{2}$/.test(time)) {
        return NextResponse.json(
          { error: "time is required (format HH:MM)" },
          { status: 400 },
        );
      }
      const [hours, minutes] = time.split(":").map(Number);
      await prisma.$transaction(
        posts.map((p) => {
          let next: Date;
          if (p.scheduledAt) {
            next = new Date(p.scheduledAt);
          } else {
            next = new Date();
            next.setDate(next.getDate() + 1);
          }
          next.setHours(hours, minutes, 0, 0);
          return prisma.post.update({
            where: { id: p.id },
            data: { scheduledAt: next, status: "ready" },
          });
        }),
      );
      return NextResponse.json({ updated: posts.length });
    }

    case "status":
    case "ready":
    case "draft": {
      const target = action === "status" ? status : action;
      const allowed = ["draft", "ready", "published"];
      if (!target || !allowed.includes(target)) {
        return NextResponse.json(
          { error: "status must be draft, ready, or published" },
          { status: 400 },
        );
      }
      await prisma.post.updateMany({
        where: { id: { in: validIds }, postedToLinkedIn: false },
        data: { status: target },
      });
      return NextResponse.json({ updated: validIds.length });
    }

    case "delete": {
      await prisma.post.deleteMany({
        where: { id: { in: validIds }, postedToLinkedIn: false },
      });
      return NextResponse.json({ deleted: validIds.length });
    }

    default:
      return NextResponse.json(
        { error: "Unknown action" },
        { status: 400 },
      );
  }
}
