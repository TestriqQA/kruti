/**
 * POST /api/mobile/newsletters/generate
 * Generates a new monthly newsletter.
 * Adapted from app/api/generate/newsletter/route.ts — mobile Bearer auth.
 *
 * Place at: app/api/mobile/newsletters/generate/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateText, parseJSON } from "@/lib/gemini";
import { buildNewsletterPrompt } from "@/lib/prompts";
import { buildProfileContext } from "@/lib/linkedin";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getMobileUserId } from "@/lib/mobileAuth";

export async function POST(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed, reason } = await checkActiveSubscription(userId);
  if (!allowed) {
    return NextResponse.json(
      { error: reason, subscriptionRequired: true },
      { status: 403 },
    );
  }

  const rl = checkRateLimit(userId, "generate", RATE_LIMITS.generation);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${rl.retryAfterSecs}s.` },
      { status: 429 },
    );
  }

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const plan = await prisma.contentPlan.findFirst({
    where: { userId },
    orderBy: { weekStart: "desc" },
  });

  const pillars = plan
    ? (JSON.parse(plan.strategy) as { pillars: object[] }).pillars
    : [
        {
          name: "Industry Insights",
          description: "Expert analysis and trends",
        },
        {
          name: "Professional Growth",
          description: "Career development tips",
        },
        {
          name: "Personal Stories",
          description: "Authentic experiences",
        },
      ];

  const profileContext = buildProfileContext(user);
  const prompt = buildNewsletterPrompt(profileContext, pillars, month, year);

  try {
    const raw = await generateText(prompt);
    const newsletter = parseJSON<{
      title: string;
      subject: string;
      intro: { hook: string; preview: string };
      sections: Array<{
        heading: string;
        content: string;
        keyTakeaway: string;
      }>;
      featuredInsight: { quote: string; context: string };
      cta: { heading: string; text: string; action: string };
      signoff: string;
    }>(raw);

    const created = await prisma.newsletter.create({
      data: {
        userId,
        title: newsletter.title,
        subject: newsletter.subject,
        body: JSON.stringify(newsletter),
        pillars: JSON.stringify(pillars),
        status: "draft",
      },
    });

    return NextResponse.json({ newsletter: created, content: newsletter });
  } catch (err) {
    console.error("[mobile newsletter] generation error:", err);
    return NextResponse.json(
      { error: "Failed to generate newsletter" },
      { status: 500 },
    );
  }
}
