import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  assessProfile,
  resolveToneKey,
  isTemplateAudience,
  sanitizeStringList,
  sanitizeProfileText,
  MIN_HEADLINE_CHARS,
  MIN_SUMMARY_CHARS,
  MIN_AUDIENCE_CHARS,
  MIN_SKILLS,
  MIN_CONTENT_STYLES,
  MAX_AUDIENCE_CHARS,
  MAX_HEADLINE_CHARS,
  MAX_SUMMARY_CHARS,
  MAX_INDUSTRY_CHARS,
  MAX_POSITIONING_CHARS,
  MAX_SKILLS,
  MAX_SKILL_CHARS,
  MAX_LIST_ITEMS,
  MAX_LIST_ITEM_CHARS,
} from "@/lib/profile-completeness";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      headline: true,
      summary: true,
      skills: true,
      industry: true,
      profileUrl: true,
      tonePrefs: true,
      positioning: true,
      contentGoals: true,
      contentStyles: true,
      targetAudience: true,
      humanMode: true,
      postingSchedule: true,
      postSignature: true,
      timezone: true,
      createdAt: true,
      subscription: {
        select: { status: true, trialEnd: true, currentPeriodEnd: true },
      },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json(user);
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  // Use "field" in body pattern to allow explicit null clears
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  /**
   * Field-level problems, keyed by field name.
   *
   * Validation here is deliberately NARROWER than the onboarding route's. This
   * is a partial update - Settings may PATCH only `postSignature` - so rejecting
   * the whole request because an untouched field is thin would make the page
   * unusable. Instead each content-critical field is checked only when it is
   * actually being written, and CLEARING one (empty string / null) stays
   * allowed: the user may want to redo it, and the generation preflight will
   * stop them publishing generic content in the meantime.
   */
  const fieldErrors: Record<string, string> = {};

  if ("headline" in body) {
    const v = sanitizeProfileText(body.headline, MAX_HEADLINE_CHARS);
    if (v && v.length < MIN_HEADLINE_CHARS) {
      fieldErrors.headline = `Use at least ${MIN_HEADLINE_CHARS} characters - say what you do and who for.`;
    }
    updateData.headline = v || null;
  }

  if ("summary" in body) {
    const v = sanitizeProfileText(body.summary, MAX_SUMMARY_CHARS);
    if (v && v.length < MIN_SUMMARY_CHARS) {
      fieldErrors.summary = `Use at least ${MIN_SUMMARY_CHARS} characters. This is the biggest driver of how personal your posts read.`;
    }
    updateData.summary = v || null;
  }

  if ("industry" in body) {
    updateData.industry = sanitizeProfileText(body.industry, MAX_INDUSTRY_CHARS) || null;
  }

  if ("positioning" in body) {
    updateData.positioning = sanitizeProfileText(body.positioning, MAX_POSITIONING_CHARS) || null;
  }

  if ("targetAudience" in body) {
    const v = sanitizeProfileText(body.targetAudience, MAX_AUDIENCE_CHARS);
    if (v && v.length < MIN_AUDIENCE_CHARS) {
      fieldErrors.targetAudience = `Use at least ${MIN_AUDIENCE_CHARS} characters - who they are, what they are stuck on, and what they want.`;
    } else if (v && isTemplateAudience(v)) {
      fieldErrors.targetAudience =
        "This is the auto-generated description, which is identical for everyone in your industry. Rewrite it in your own words.";
    }
    updateData.targetAudience = v || null;
  }

  if ("skills" in body) {
    const v = sanitizeStringList(body.skills, MAX_SKILLS, MAX_SKILL_CHARS);
    if (v.length > 0 && v.length < MIN_SKILLS) {
      fieldErrors.skills = `Add at least ${MIN_SKILLS} skills - they become your weekly content pillars.`;
    }
    updateData.skills = v.length > 0 ? JSON.stringify(v) : null;
  }

  if ("contentGoals" in body) {
    const v = sanitizeStringList(body.contentGoals, MAX_LIST_ITEMS, MAX_LIST_ITEM_CHARS);
    updateData.contentGoals = v.length > 0 ? JSON.stringify(v) : null;
  }

  if ("contentStyles" in body) {
    const v = sanitizeStringList(body.contentStyles, MAX_LIST_ITEMS, MAX_LIST_ITEM_CHARS);
    if (v.length > 0 && v.length < MIN_CONTENT_STYLES) {
      fieldErrors.contentStyles = `Choose at least ${MIN_CONTENT_STYLES} styles, otherwise every post in a batch reads the same.`;
    }
    updateData.contentStyles = v.length > 0 ? JSON.stringify(v) : null;
  }

  if ("tonePrefs" in body) {
    // Normalise to a known key so resolveTone() in lib/linkedin.ts can turn it
    // into voice guidance. An unrecognised tone silently fell back to a flat
    // generic voice before, which is indistinguishable from having no tone.
    const key = resolveToneKey(typeof body.tonePrefs === "string" ? body.tonePrefs : null);
    if (body.tonePrefs && !key) {
      fieldErrors.tonePrefs = "Pick one of the listed tones.";
    }
    updateData.tonePrefs = key ? JSON.stringify(key) : null;
  }

  if ("humanMode" in body) updateData.humanMode = Boolean(body.humanMode);
  if ("postingSchedule" in body) {
    updateData.postingSchedule = body.postingSchedule ? JSON.stringify(body.postingSchedule) : null;
  }
  if ("postSignature" in body) {
    updateData.postSignature = typeof body.postSignature === "string" ? body.postSignature : null;
  }
  if ("timezone" in body) {
    // Validate IANA timezone string
    try {
      Intl.DateTimeFormat(undefined, { timeZone: body.timezone });
      updateData.timezone = body.timezone;
    } catch {
      updateData.timezone = "Asia/Kolkata";
    }
  }

  if (Object.keys(fieldErrors).length > 0) {
    return NextResponse.json(
      { error: "Some details need fixing before we can save them.", fieldErrors },
      { status: 400 }
    );
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
  });

  // Hand back the completeness verdict for the SAVED row so Settings can tell
  // the user straight away that generation is still blocked, instead of them
  // finding out on the next Generate click.
  return NextResponse.json({ ...updated, profile: assessProfile(updated) });
}
