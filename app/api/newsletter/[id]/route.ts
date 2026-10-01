import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkActiveSubscription } from "@/lib/subscription-check";

// PATCH /api/newsletter/:id - schedule or update status
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sub = await checkActiveSubscription(session.user.id);
  if (!sub.allowed) {
    return NextResponse.json(
      { error: sub.reason, subscriptionRequired: true },
      { status: 403 }
    );
  }

  const newsletter = await prisma.newsletter.findUnique({
    where: { id: params.id },
  });

  if (!newsletter || newsletter.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const updateData: Record<string, unknown> = {};

  if ("scheduledAt" in body) {
    updateData.scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;
    // Update status based on whether we're scheduling or unscheduling
    if (body.scheduledAt) {
      updateData.status = "scheduled";
    } else if (newsletter.status === "scheduled") {
      updateData.status = "draft";
    }
  }

  if ("status" in body) {
    updateData.status = body.status;
  }

  // Allow updating title and body (newsletter content JSON)
  if ("title" in body && typeof body.title === "string") {
    updateData.title = body.title;
  }

  if ("body" in body && typeof body.body === "string") {
    // Validate it's valid JSON
    try {
      JSON.parse(body.body);
      updateData.body = body.body;
    } catch {
      return NextResponse.json({ error: "body must be valid JSON" }, { status: 400 });
    }
  }

  const updated = await prisma.newsletter.update({
    where: { id: params.id },
    data: updateData,
  });

  return NextResponse.json(updated);
}

// DELETE /api/newsletter/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sub = await checkActiveSubscription(session.user.id);
  if (!sub.allowed) {
    return NextResponse.json(
      { error: sub.reason, subscriptionRequired: true },
      { status: 403 }
    );
  }

  const newsletter = await prisma.newsletter.findUnique({
    where: { id: params.id },
  });

  if (!newsletter || newsletter.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.newsletter.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
