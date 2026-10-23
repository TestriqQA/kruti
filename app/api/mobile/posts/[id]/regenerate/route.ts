/**
 * POST /api/mobile/posts/[id]/regenerate
 * Body (optional): { humanMode?: boolean }
 *
 * The app's "Regen" button. Rewrites the post's BODY from its existing topic,
 * using the same prompt builder as the website's "Regenerate Post" button
 * (buildSinglePostPrompt), so the two produce comparable output.
 *
 * Deliberately narrower than the website's version in two ways, both agreed
 * with the app side:
 *   - the title is left alone, because the app keeps showing the one it has;
 *   - the hashtags are left alone. The website replaces them on regenerate,
 *     but the topic has not changed here, so the existing tags are still the
 *     right ones and replacing them would silently drift the app's cached copy.
 *
 * `humanMode` is sticky: an explicit true/false is persisted as the post's
 * humanModeOverride, so a later call with no body reuses it. Omitted, it falls
 * back to the post's override, then the user's Settings default.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";
import { generateText, parseJSON } from "@/lib/gemini";
import { buildSinglePostPrompt } from "@/lib/prompts";
import { buildProfileContext } from "@/lib/linkedin";
import { formatPostBody } from "@/lib/format";
import { checkActiveSubscription } from "@/lib/subscription-check";
import { checkProfileReady } from "@/lib/profile-guard";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const userId = await getMobileUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Same three gates, same flags, as the website's AI routes - the app
    // branches on subscriptionRequired / profileIncomplete / rateLimited.
    const sub = await checkActiveSubscription(userId);
    if (!sub.allowed) {
      return NextResponse.json(
        { error: sub.reason, subscriptionRequired: true },
        { status: 403 },
      );
    }

    const profile = await checkProfileReady(userId);
    if (!profile.ready) {
      return NextResponse.json(
        { error: profile.message, profileIncomplete: true, gaps: profile.gaps },
        { status: 403 },
      );
    }

    const rl = checkRateLimit(userId, "generate", RATE_LIMITS.generation);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: `Too many requests. Try again in ${rl.retryAfterSecs}s.`,
          rateLimited: true,
          retryAfterSecs: rl.retryAfterSecs,
        },
        { status: 429 },
      );
    }

    // Explicit select rather than include: a query that asks for every column
    // breaks the moment the client and the database disagree about one, which
    // is exactly how /api/mobile/me and /api/mobile/posts started 500ing.
    const post = await prisma.post.findFirst({
      where: { id: params.id, plan: { userId } },
      select: {
        id: true,
        title: true,
        postType: true,
        weekNumber: true,
        humanModeOverride: true,
        plan: { select: { strategy: true } },
      },
    });
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Sticky mode: body wins and is persisted, else the post's override, else
    // the user's Settings default.
    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const requested =
      body && typeof body.humanMode === "boolean" ? body.humanMode : null;
    const mode =
      requested ??
      post.humanModeOverride ??
      user.humanMode ??
      true;

    // Week theme, derived the same way the website's regenerate does.
    let weekTheme = "Professional Insights";
    try {
      const strategy = JSON.parse(post.plan.strategy) as {
        weekTheme?: string;
        weeks?: Array<{ weekNumber: number; theme: string }>;
      };
      weekTheme =
        strategy.weekTheme ??
        strategy.weeks?.find((w) => w.weekNumber === post.weekNumber)?.theme ??
        weekTheme;
    } catch {
      // A plan with unparseable strategy JSON still regenerates, just without
      // a theme - better than failing the request over a cosmetic input.
    }

    const prompt = buildSinglePostPrompt(
      buildProfileContext(user),
      post.title,
      post.postType,
      weekTheme,
      mode,
    );

    const raw = await generateText(prompt);

    let generated: { body?: string };
    try {
      generated = parseJSON(raw);
    } catch {
      console.error("[mobile/regenerate] JSON parse failed. Raw:", raw);
      return NextResponse.json(
        { error: "AI returned invalid JSON - please try again" },
        { status: 502 },
      );
    }

    if (!generated?.body) {
      return NextResponse.json(
        { error: "AI returned an empty post - please try again" },
        { status: 502 },
      );
    }

    // One write, not two: persisting the mode separately left a window where
    // the override had moved but the body had not.
    const updated = await prisma.post.update({
      where: { id: post.id },
      data: {
        body: formatPostBody(generated.body),
        ...(requested !== null ? { humanModeOverride: requested } : {}),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    // Generic to the client, detail to the log. This route used to return
    // err.message, which handed internal errors to unauthenticated callers.
    console.error("[mobile/posts/[id]/regenerate] error:", err);
    return NextResponse.json(
      { error: "Failed to regenerate post" },
      { status: 500 },
    );
  }
}
