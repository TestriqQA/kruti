/**
 * Mobile Onboarding Routes
 *
 * GET  /api/mobile/onboarding  — read current onboarding state + prefill
 * POST /api/mobile/onboarding  — submit the wizard, mark complete
 *
 * Mirrors the web /api/onboarding logic but authenticates via Bearer JWT
 * (mobile) instead of next-auth cookies.
 *
 * Place at: app/api/mobile/onboarding/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

// ── GET: prefill data for the mobile wizard ──
export async function GET(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Parse the JSON-string arrays stored in the DB into real arrays so the
  // mobile client can hand them straight to its state.
  const parseList = (raw: string | null): string[] => {
    if (!raw) return [];
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  };

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
  });
}

// ── POST: save the wizard answers, mark onboarding complete ──
export async function POST(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const {
    positioning,
    contentGoals,
    contentStyles,
    targetAudience,
    headline,
    summary,
    industry,
    timezone,
  } = body;

  // Same validation the web flow applies (none, really — fields optional).
  // We do require positioning + at least one content goal + audience, since
  // those are what the AI strategy actually needs. Adjust if your wizard
  // makes them optional.
  if (!positioning || !Array.isArray(contentGoals) || contentGoals.length === 0) {
    return NextResponse.json(
      { error: "positioning and at least one contentGoal are required" },
      { status: 400 },
    );
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      positioning: positioning || null,
      contentGoals: contentGoals ? JSON.stringify(contentGoals) : null,
      contentStyles: contentStyles ? JSON.stringify(contentStyles) : null,
      targetAudience: targetAudience || null,
      headline: headline || undefined,
      summary: summary || undefined,
      industry: industry || undefined,
      timezone: timezone || undefined,
      onboardingCompleted: true,
    },
  });

  return NextResponse.json({
    success: true,
    onboardingCompleted: true,
    user: {
      id: updated.id,
      name: updated.name,
      onboardingCompleted: updated.onboardingCompleted,
    },
  });
}