/**
 * POST /api/mobile/posts/[id]/variants
 * Generates AI rewrite variants for a post.
 * Adapted from app/api/generate/variants/route.ts — mobile Bearer auth.
 *
 * Place at: app/api/mobile/posts/[id]/variants/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTextWithConfig, parseJSON } from "@/lib/gemini";
import { buildVariantPostPrompt, VARIANT_STYLE_NAMES } from "@/lib/prompts";
import { buildProfileContext } from "@/lib/linkedin";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getMobileUserId } from "@/lib/mobileAuth";

interface GeneratedVariant {
  title: string;
  body: string;
  hashtags: string[];
  imagePrompt: string;
}

const VARIANT_TEMPERATURES = [0.7, 0.9, 0.8];

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
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

  const post = await prisma.post.findFirst({
    where: { id: params.id, plan: { userId } },
    include: { plan: true },
  });
  if (!post)
    return NextResponse.json({ error: "Post not found" }, { status: 404 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const strategy = JSON.parse(post.plan.strategy) as {
    weekTheme?: string;
    weeks?: Array<{ weekNumber: number; theme: string }>;
  };
  const weekTheme =
    strategy.weekTheme ??
    strategy.weeks?.find((w) => w.weekNumber === post.weekNumber)?.theme ??
    "Professional Insights";

  const effectiveHumanMode =
    post.humanModeOverride !== null && post.humanModeOverride !== undefined
      ? post.humanModeOverride
      : (user.humanMode ?? true);

  const profileContext = buildProfileContext(user);

  try {
    const variantPromises = VARIANT_STYLE_NAMES.map((style, i) => {
      const prompt = buildVariantPostPrompt(
        profileContext,
        post.title,
        post.postType,
        weekTheme,
        style,
        effectiveHumanMode,
      );
      return generateTextWithConfig(prompt, {
        temperature: VARIANT_TEMPERATURES[i],
      }).then((raw) => {
        const parsed = parseJSON<GeneratedVariant>(raw);
        return { ...parsed, style };
      });
    });

    const variants = await Promise.all(variantPromises);
    return NextResponse.json({ variants });
  } catch (err) {
    console.error("[mobile variants] error:", err);
    return NextResponse.json(
      { error: "Failed to generate variants" },
      { status: 500 },
    );
  }
}
