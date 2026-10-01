import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkActiveSubscription } from "@/lib/subscription-check";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
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

  const original = await prisma.post.findFirst({
    where: { id: params.id, plan: { userId: session.user.id } },
  });

  if (!original) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const duplicate = await prisma.post.create({
    data: {
      planId: original.planId,
      title: `${original.title} (copy)`,
      body: original.body,
      postType: original.postType,
      style: original.style,
      imageStyle: original.imageStyle,
      hashtags: original.hashtags,
      status: "draft",
      weekNumber: original.weekNumber,
      imagePrompt: original.imagePrompt,
      humanModeOverride: original.humanModeOverride,
      // Don't copy: scheduledAt, imageUrl, imageGenCount, postedToLinkedIn, linkedinPostId, postError
    },
  });

  return NextResponse.json(duplicate);
}
