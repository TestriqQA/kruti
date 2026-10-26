/**
 * POST /api/mobile/newsletters/[id]/send — send newsletter to email now
 *
 * Mobile (Bearer-auth) version of app/api/newsletter/[id]/send/route.ts.
 *
 * Place at: app/api/mobile/newsletters/[id]/send/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendNewsletterEmail, type NewsletterContent } from "@/lib/email";
import { getMobileUserId } from "@/lib/mobileAuth";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const newsletter = await prisma.newsletter.findUnique({
    where: { id: params.id },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!newsletter || newsletter.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (newsletter.status === "sent") {
    return NextResponse.json({ error: "Already sent" }, { status: 400 });
  }

  const toEmail = newsletter.user.email;
  if (!toEmail) {
    return NextResponse.json(
      { error: "No email address on file" },
      { status: 400 },
    );
  }

  let content: NewsletterContent;
  try {
    content = JSON.parse(newsletter.body) as NewsletterContent;
  } catch {
    return NextResponse.json(
      { error: "Invalid newsletter content" },
      { status: 400 },
    );
  }

  const result = await sendNewsletterEmail({
    to: toEmail,
    authorName: newsletter.user.name ?? "Your Name",
    content,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? "Email failed" },
      { status: 500 },
    );
  }

  const updated = await prisma.newsletter.update({
    where: { id: params.id },
    data: { status: "sent", scheduledAt: null },
  });

  return NextResponse.json({ success: true, newsletter: updated });
}