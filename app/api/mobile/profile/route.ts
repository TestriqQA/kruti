/**
 * GET   /api/mobile/profile  — load the user's profile/settings
 * PATCH /api/mobile/profile  — save settings from the mobile Settings screen
 *
 * The mobile Settings screen sends friendly field names; this route maps
 * them onto the DB columns used by the web app.
 *
 * Place at: app/api/mobile/profile/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

export async function GET(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      headline: true,
      summary: true,
      skills: true,
      industry: true,
      tonePrefs: true,
      positioning: true,
      contentGoals: true,
      contentStyles: true,
      humanMode: true,
      postSignature: true,
      targetAudience: true,
      postingSchedule: true,
      timezone: true,
      subscription: {
        select: {
          status: true,
          trialEnd: true,
          currentPeriodEnd: true,
          // Drives the price on the plan badge — without it USD subscribers
          // were always shown the INR price.
          currency: true,
        },
      },
    },
  });
  if (!user)
    return NextResponse.json({ error: "User not found" }, { status: 404 });

  const parseArr = (v: string | null): string[] => {
    if (!v) return [];
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return v.split(",").map((s) => s.trim()).filter(Boolean);
    }
  };

  let postingDays: string[] = [];
  let postingTime = "09:00";
  if (user.postingSchedule) {
    try {
      const s = JSON.parse(user.postingSchedule);
      postingDays = Array.isArray(s.days) ? s.days : [];
      postingTime = s.time || "09:00";
    } catch {
      /* ignore */
    }
  }

  // Map DB -> mobile-friendly shape
  const tone = (() => {
    const t = parseArr(user.tonePrefs);
    return t[0] || "Professional";
  })();

  return NextResponse.json({
    profile: {
      name: user.name,
      email: user.email,
      image: user.image,
      headline: user.headline || "",
      bio: user.summary || "",
      tone,
      voiceDescription: parseArr(user.tonePrefs).slice(1).join(", "),
      industry: user.industry || "",
      skills: parseArr(user.skills),
      targetAudience: user.targetAudience || "",
      goals: parseArr(user.contentGoals),
      contentPillars: user.positioning || "",
      positioningRoles: (user.positioning || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      contentStyles: parseArr(user.contentStyles),
      humanMode: user.humanMode === true,
      postSignature: user.postSignature || "",
      postingDays,
      postingTime,
      timezone: user.timezone || "Asia/Kolkata",
    },
    subscription: user.subscription,
  });
}

export async function PATCH(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {};

  if ("name" in body) data.name = body.name ?? null;
  if ("headline" in body) data.headline = body.headline ?? null;
  if ("bio" in body) data.summary = body.bio ?? null;
  if ("industry" in body) data.industry = body.industry ?? null;
  if ("targetAudience" in body)
    data.targetAudience = body.targetAudience ?? null;

  // contentPillars + positioningRoles both map to the `positioning` column.
  // Roles (multi-select) take priority; free-text pillars used as fallback.
  if ("positioningRoles" in body) {
    data.positioning = Array.isArray(body.positioningRoles)
      ? body.positioningRoles.join(", ")
      : (body.positioningRoles ?? null);
  } else if ("contentPillars" in body) {
    data.positioning = body.contentPillars ?? null;
  }

  if ("contentStyles" in body) {
    data.contentStyles = body.contentStyles
      ? JSON.stringify(body.contentStyles)
      : null;
  }

  if ("humanMode" in body) {
    data.humanMode = body.humanMode === true;
  }

  if ("postSignature" in body) {
    data.postSignature = body.postSignature ?? null;
  }

  if ("skills" in body) {
    data.skills = body.skills ? JSON.stringify(body.skills) : null;
  }
  if ("goals" in body) {
    data.contentGoals = body.goals ? JSON.stringify(body.goals) : null;
  }

  // tone + voiceDescription -> tonePrefs JSON array
  if ("tone" in body || "voiceDescription" in body) {
    const arr: string[] = [];
    if (body.tone) arr.push(body.tone);
    if (body.voiceDescription) arr.push(body.voiceDescription);
    data.tonePrefs = arr.length ? JSON.stringify(arr) : null;
  }

  // postingDays + postingTime -> postingSchedule JSON
  if ("postingDays" in body || "postingTime" in body) {
    data.postingSchedule = JSON.stringify({
      days: body.postingDays || [],
      time: body.postingTime || "09:00",
    });
  }

  if ("timezone" in body) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: body.timezone });
      data.timezone = body.timezone;
    } catch {
      data.timezone = "Asia/Kolkata";
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
  });

  return NextResponse.json({ success: true, profile: updated });
}