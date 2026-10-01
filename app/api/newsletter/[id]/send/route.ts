import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { sendNewsletterEmail, type NewsletterContent } from "@/lib/email";

// POST /api/newsletter/:id/send - send newsletter immediately
export async function POST(
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
    include: { user: { select: { name: true, email: true } } },
  });

  if (!newsletter || newsletter.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (newsletter.status === "sent") {
    return NextResponse.json({ error: "Already sent" }, { status: 400 });
  }

  const toEmail = newsletter.user.email;
  if (!toEmail) {
    return NextResponse.json({ error: "No email address on file" }, { status: 400 });
  }

  let content: NewsletterContent;
  try {
    content = JSON.parse(newsletter.body) as NewsletterContent;
  } catch {
    return NextResponse.json({ error: "Invalid newsletter content" }, { status: 400 });
  }

  const result = await sendNewsletterEmail({
    to: toEmail,
    authorName: newsletter.user.name ?? "Your Name",
    content,
  });

  if (!result.success) {
    return NextResponse.json({ error: result.error ?? "Email failed" }, { status: 500 });
  }

  const updated = await prisma.newsletter.update({
    where: { id: params.id },
    data: { status: "sent", scheduledAt: null },
  });

  return NextResponse.json({ success: true, newsletter: updated });
}
