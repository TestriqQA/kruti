import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  assessProfile,
  resolveToneKey,
  sanitizeStringList,
  sanitizeProfileText,
  MAX_AUDIENCE_CHARS,
  MAX_HEADLINE_CHARS,
  MAX_SUMMARY_CHARS,
  MAX_INDUSTRY_CHARS,
  MAX_POSITIONING_CHARS,
  MAX_SKILLS,
  MAX_SKILL_CHARS,
  MAX_LIST_ITEMS,
  MAX_LIST_ITEM_CHARS,
  type ProfileInput,
} from "@/lib/profile-completeness";

/**
 * Completes onboarding.
 *
 * This route is the ONLY way `onboardingCompleted` is set to true, which makes
 * it the gate on content quality: everything the AI prompts know about a user
 * arrives here. It therefore validates against lib/profile-completeness.ts
 * server-side rather than trusting the wizard's own disabled-button logic - a
 * profile that gets past this with empty fields produces generic posts for the
 * life of the account, and `skills` in particular was simply not read here at
 * all before, so it was null for every single user.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));

    const headline = sanitizeProfileText(body.headline, MAX_HEADLINE_CHARS);
    const industry = sanitizeProfileText(body.industry, MAX_INDUSTRY_CHARS);
    const summary = sanitizeProfileText(body.summary, MAX_SUMMARY_CHARS);
    const positioning = sanitizeProfileText(body.positioning, MAX_POSITIONING_CHARS);
    const targetAudience = sanitizeProfileText(body.targetAudience, MAX_AUDIENCE_CHARS);
    const skills = sanitizeStringList(body.skills, MAX_SKILLS, MAX_SKILL_CHARS);
    const contentGoals = sanitizeStringList(body.contentGoals, MAX_LIST_ITEMS, MAX_LIST_ITEM_CHARS);
    const contentStyles = sanitizeStringList(body.contentStyles, MAX_LIST_ITEMS, MAX_LIST_ITEM_CHARS);
    // resolveToneKey accepts a bare key, a JSON-encoded key or an object shape,
    // so the raw value can go straight in.
    const toneKey = resolveToneKey(
      typeof body.tonePrefs === "string" ? body.tonePrefs : null
    );

    // Validate the payload with the same rule every other surface uses, so the
    // wizard, Settings, the generation preflights and the dashboard banner can
    // never disagree about what "complete" means.
    const candidate: ProfileInput = {
      headline,
      industry,
      summary,
      positioning,
      targetAudience,
      skills: JSON.stringify(skills),
      contentGoals: JSON.stringify(contentGoals),
      contentStyles: JSON.stringify(contentStyles),
      tonePrefs: toneKey ? JSON.stringify(toneKey) : null,
    };

    const { complete, gaps } = assessProfile(candidate);
    if (!complete) {
      return NextResponse.json(
        {
          error: "Your profile is missing some details we need to write good content.",
          gaps,
        },
        { status: 400 }
      );
    }

    // Timezone is validated rather than rejected - a bad IANA string is a
    // browser quirk, not a reason to fail the whole setup.
    let timezone = "Asia/Kolkata";
    if (typeof body.timezone === "string" && body.timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: body.timezone });
        timezone = body.timezone;
      } catch {
        // keep the default
      }
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        onboardingCompleted: true,
        headline,
        industry,
        summary,
        positioning,
        targetAudience,
        skills: JSON.stringify(skills),
        contentGoals: JSON.stringify(contentGoals),
        contentStyles: JSON.stringify(contentStyles),
        // Stored JSON-stringified to match how the profile route writes it and
        // how resolveTone() reads it back.
        tonePrefs: JSON.stringify(toneKey),
        timezone,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const err = error as { code?: string; message?: string };
    console.error("Onboarding API Error:", err);

    // "Record to update not found" - the session points at a deleted user.
    if (err.code === "P2025") {
      return NextResponse.json(
        { error: "User not found in database. Please log out and sign in again." },
        { status: 404 }
      );
    }

    return NextResponse.json({ error: "Could not save your profile. Please try again." }, { status: 500 });
  }
}
