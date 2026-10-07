import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { isImageCategoryId } from "@/lib/image-categories";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const post = await prisma.post.findFirst({
    where: { id: params.id, plan: { userId: session.user.id } },
    include: { plan: true },
  });

  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(post);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sub = await checkActiveSubscription(session.user.id);
  if (!sub.allowed) {
    return NextResponse.json(
      { error: sub.reason, subscriptionRequired: true },
      { status: 403 }
    );
  }

  const body = await req.json();

  // Validate status if provided
  const VALID_STATUSES = ["draft", "ready", "published"];
  if ("status" in body && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
  }

  // Validate hashtags if provided
  if ("hashtags" in body && body.hashtags !== null) {
    if (!Array.isArray(body.hashtags) || !body.hashtags.every((h: unknown) => typeof h === "string")) {
      return NextResponse.json({ error: "Hashtags must be an array of strings" }, { status: 400 });
    }
  }

  // Validate imageStyle (image category id) if provided
  if ("imageStyle" in body && body.imageStyle !== null && !isImageCategoryId(body.imageStyle)) {
    return NextResponse.json({ error: "Invalid image style" }, { status: 400 });
  }

  const existing = await prisma.post.findFirst({
    where: { id: params.id, plan: { userId: session.user.id } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.post.update({
    where: { id: params.id },
    data: {
      ...("title" in body && { title: body.title }),
      ...("body" in body && { body: body.body }),
      ...("hashtags" in body && {
        hashtags: body.hashtags ? JSON.stringify(body.hashtags) : null,
      }),
      ...("status" in body && { status: body.status }),
      ...("scheduledAt" in body && {
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
      }),
      ...("imageUrl" in body && { imageUrl: body.imageUrl }),
      ...("carouselImages" in body && {
        carouselImages: Array.isArray(body.carouselImages)
          ? JSON.stringify(body.carouselImages)
          : null,
      }),
      ...("documentUrl" in body && { documentUrl: body.documentUrl ?? null }),
      ...("documentName" in body && { documentName: body.documentName ?? null }),
      ...("humanModeOverride" in body && { humanModeOverride: body.humanModeOverride }),
      ...("customSignature" in body && { customSignature: body.customSignature }),
      ...("imagePrompt" in body && { imagePrompt: body.imagePrompt }),
      ...("imageStyle" in body && { imageStyle: body.imageStyle ?? null }),
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Deliberately NOT subscription-gated.
  //
  // This used to call checkActiveSubscription and 403 before deleting, which
  // meant a user whose trial had lapsed could not delete their own posts. That
  // is a direct defect under DPDP s.12(3) (right to erasure) - a lapsed
  // subscription cannot be a reason to hold someone's data hostage - and it is
  // user-hostile regardless of the law. The paywall belongs on CREATING
  // content, not on removing it. Ownership is still enforced below.

  const existing = await prisma.post.findFirst({
    where: { id: params.id, plan: { userId: session.user.id } },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.post.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
