/**
 * Mobile Onboarding Routes
 *
 * GET  /api/mobile/onboarding  — read current onboarding state + prefill
 * POST /api/mobile/onboarding  — submit the wizard, mark complete
 *
 * Authenticates via Bearer JWT instead of next-auth cookies. Everything after
 * authentication is lib/onboarding.ts, the same code the website route runs -
 * this file used to carry its own copy, which had drifted into skipping the
 * length caps, the timezone validation and the completeness check, and never
 * wrote skills or tonePrefs at all.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";
import { completeOnboarding } from "@/lib/onboarding";

/** JSON-string column -> array, for the client's state. */
function parseList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

// ── GET: prefill data for the mobile wizard ──
export async function GET(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        onboardingCompleted: true,
        name: true,
        headline: true,
        summary: true,
        industry: true,
        image: true,
        positioning: true,
        contentGoals: true,
        contentStyles: true,
        targetAudience: true,
        timezone: true,
        // Both are required for a profile to count as complete, so the wizard
        // needs to see what is already stored - otherwise it cannot tell
        // whether it has to ask for them.
        skills: true,
        tonePrefs: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found in database. Please log out and sign in again." },
        { status: 404 }
      );
    }

    let tonePrefs: string | null = null;
    try {
      tonePrefs = user.tonePrefs ? (JSON.parse(user.tonePrefs) as string) : null;
    } catch {
      tonePrefs = user.tonePrefs ?? null;
    }

    return NextResponse.json({
      onboardingCompleted: user.onboardingCompleted,
      name: user.name ?? "",
      headline: user.headline ?? "",
      summary: user.summary ?? "",
      industry: user.industry ?? "",
      image: user.image ?? null,
      positioning: user.positioning ?? "",
      contentGoals: parseList(user.contentGoals),
      contentStyles: parseList(user.contentStyles),
      targetAudience: user.targetAudience ?? "",
      timezone: user.timezone ?? "Asia/Kolkata",
      skills: parseList(user.skills),
      tonePrefs,
    });
  } catch (error) {
    // Without this a database error is a bare 500 with no body, which is
    // indistinguishable from any other failure on the client.
    console.error("[mobile/onboarding] GET failed for user", userId, error);
    return NextResponse.json(
      { error: "Could not load your profile. Please try again." },
      { status: 500 }
    );
  }
}

// ── POST: save the wizard answers, mark onboarding complete ──
export async function POST(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const outcome = await completeOnboarding(userId, body);

  if (!outcome.ok) {
    // `gaps` names each missing field and why, so the app can point at the
    // step that needs attention rather than showing a bare failure.
    return NextResponse.json(
      outcome.gaps ? { error: outcome.error, gaps: outcome.gaps } : { error: outcome.error },
      { status: outcome.status }
    );
  }

  // The app reads this back after submitting, so the response keeps its shape.
  const user = await prisma.user
    .findUnique({
      where: { id: userId },
      select: { id: true, name: true, onboardingCompleted: true },
    })
    .catch(() => null);

  return NextResponse.json({
    success: true,
    onboardingCompleted: true,
    user: user ?? { id: userId, name: null, onboardingCompleted: true },
  });
}
