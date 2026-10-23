/**
 * GET /api/mobile/me
 *
 * The signed-in user plus their subscription summary. Lives here rather than
 * /api/auth/me to avoid colliding with NextAuth's catch-all on Vercel.
 *
 * Two things were fixed when this moved onto the website's branch:
 *
 *  - It decoded the Bearer token inline, so a malformed token threw out of
 *    `decode()` and landed in the generic catch as a 500 instead of a 401.
 *    getMobileUserId() swallows a bad token and returns null, which is what
 *    every other mobile route already relied on.
 *
 *  - It queried with `include`, which makes Prisma name EVERY column of the
 *    model in its SELECT. That is why it started 500ing once the database no
 *    longer had the mobile branch's own columns. An explicit `select` asks
 *    only for what this response actually uses, so the route cannot break on
 *    a column it never reads.
 *
 * `goals`, `styles` and `audience` are kept as response keys because the app
 * reads them, but they now carry real values - they were wired to columns
 * named `goals`/`styles`/`audience`, which have never existed. The columns are
 * contentGoals, contentStyles and targetAudience.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

export async function GET(req: NextRequest) {
  try {
    const userId = await getMobileUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        role: true,
        headline: true,
        industry: true,
        summary: true,
        positioning: true,
        contentGoals: true,
        contentStyles: true,
        targetAudience: true,
        timezone: true,
        onboardingCompleted: true,
        subscription: { select: { status: true, trialEnd: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      headline: user.headline,
      industry: user.industry,
      summary: user.summary,
      positioning: user.positioning,
      goals: user.contentGoals,
      styles: user.contentStyles,
      audience: user.targetAudience,
      timezone: user.timezone,
      // Both spellings: the app reads one, older builds read the other.
      onboardingComplete: user.onboardingCompleted,
      onboardingCompleted: user.onboardingCompleted,
      role: user.role,
      subscriptionStatus: user.subscription?.status ?? "none",
      trialEnd: user.subscription?.trialEnd?.toISOString() ?? null,
    });
  } catch (err) {
    console.error("[mobile/me] error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
