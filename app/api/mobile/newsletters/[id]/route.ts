/**
 * PATCH  /api/mobile/newsletters/[id]  — schedule / status / edit content
 * DELETE /api/mobile/newsletters/[id]  — delete a newsletter
 *
 * Mobile (Bearer-auth) version of app/api/newsletter/[id]/route.ts.
 * Content is stored in Newsletter.body as a JSON string — identical to web,
 * so edits made on mobile show up on web (and email send) in real time.
 *
 * Place at: app/api/mobile/newsletters/[id]/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const newsletter = await prisma.newsletter.findUnique({
    where: { id: params.id },
  });
  if (!newsletter || newsletter.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const updateData: Record<string, unknown> = {};

  if ("scheduledAt" in body) {
    updateData.scheduledAt = body.scheduledAt
      ? new Date(body.scheduledAt)
      : null;
    if (body.scheduledAt) {
      updateData.status = "scheduled";
    } else if (newsletter.status === "scheduled") {
      updateData.status = "draft";
    }
  }

  if ("status" in body) {
    updateData.status = body.status;
  }

  if ("title" in body && typeof body.title === "string") {
    updateData.title = body.title;
  }

  // Newsletter content JSON (same column the web edit + email send use).
  if ("body" in body && typeof body.body === "string") {
    try {
      JSON.parse(body.body);
      updateData.body = body.body;
    } catch {
      return NextResponse.json(
        { error: "body must be valid JSON" },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.newsletter.update({
    where: { id: params.id },
    data: updateData,
  });

  return NextResponse.json({ success: true, newsletter: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const newsletter = await prisma.newsletter.findUnique({
    where: { id: params.id },
  });
  if (!newsletter || newsletter.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.newsletter.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}