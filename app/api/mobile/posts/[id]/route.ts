/**
 * GET    /api/mobile/posts/[id]  — single post
 * PATCH  /api/mobile/posts/[id]  — update a post (title/body/status/humanMode/...)
 * DELETE /api/mobile/posts/[id]  — delete a post
 *
 * Place at: app/api/mobile/posts/[id]/route.ts
 * (Delete the stray app/api/mobile/posts/[id]/route.ts.ts — it's a duplicate.)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const post = await prisma.post.findFirst({
    where: { id: params.id, plan: { userId } },
    include: { plan: true },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(post);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  const VALID_STATUSES = ["draft", "ready", "published"];
  if ("status" in body && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
  }

  const existing = await prisma.post.findFirst({
    where: { id: params.id, plan: { userId } },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // hashtags may arrive as array or space-joined string → store JSON array string.
  let hashtagsValue: string | null | undefined = undefined;
  if ("hashtags" in body) {
    if (body.hashtags == null) {
      hashtagsValue = null;
    } else if (Array.isArray(body.hashtags)) {
      hashtagsValue = JSON.stringify(
        body.hashtags.map((h: string) => h.replace(/^#/, "")),
      );
    } else if (typeof body.hashtags === "string") {
      const arr = body.hashtags
        .split(/[\s,]+/)
        .map((h: string) => h.replace(/^#/, "").trim())
        .filter(Boolean);
      hashtagsValue = JSON.stringify(arr);
    }
  }

  // Per-post Human Mode override: true | false | null (null = inherit user default).
  let humanOverride: boolean | null | undefined = undefined;
  if ("humanModeOverride" in body) {
    humanOverride =
      body.humanModeOverride === null ? null : !!body.humanModeOverride;
  }

  const updated = await prisma.post.update({
    where: { id: params.id },
    data: {
      ...("title" in body && { title: body.title }),
      ...("body" in body && { body: body.body }),
      ...(hashtagsValue !== undefined && { hashtags: hashtagsValue }),
      ...("status" in body && { status: body.status }),
      ...("scheduledAt" in body && {
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      }),
      ...("imageUrl" in body && { imageUrl: body.imageUrl }),
      ...("customSignature" in body && {
        customSignature: body.customSignature,
      }),
      ...("imagePrompt" in body && { imagePrompt: body.imagePrompt }),
      ...(humanOverride !== undefined && { humanModeOverride: humanOverride }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.post.findFirst({
    where: { id: params.id, plan: { userId } },
  });
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.post.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}