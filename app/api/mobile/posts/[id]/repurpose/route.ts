/**
 * POST /api/mobile/posts/[id]/repurpose
 * Repurposes a post into other formats.
 * Adapted from app/api/generate/repurpose/route.ts — mobile Bearer auth.
 *
 * Place at: app/api/mobile/posts/[id]/repurpose/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTextWithConfig, parseJSON } from "@/lib/gemini";
import { buildRepurposePrompt, REPURPOSE_FORMAT_NAMES } from "@/lib/prompts";
import { buildProfileContext } from "@/lib/linkedin";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { getMobileUserId } from "@/lib/mobileAuth";

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

  const effectiveHumanMode =
    post.humanModeOverride !== null && post.humanModeOverride !== undefined
      ? post.humanModeOverride
      : (user.humanMode ?? true);

  const profileContext = buildProfileContext(user);
  const hashtags: string[] = post.hashtags ? JSON.parse(post.hashtags) : [];

  try {
    const repurposePromises = REPURPOSE_FORMAT_NAMES.map((format) => {
      const prompt = buildRepurposePrompt(
        profileContext,
        post.title,
        post.body,
        hashtags,
        format,
        effectiveHumanMode,
      );
      return generateTextWithConfig(prompt, { temperature: 0.8 }).then(
        (raw) => {
          const parsed = parseJSON(raw);
          return { format, type: format, content: parsed, body: (parsed as { body?: string })?.body };
        },
      );
    });

    const results = await Promise.all(repurposePromises);
    return NextResponse.json({ results });
  } catch (err) {
    console.error("[mobile repurpose] error:", err);
    return NextResponse.json(
      { error: "Failed to repurpose content" },
      { status: 500 },
    );
  }
}
