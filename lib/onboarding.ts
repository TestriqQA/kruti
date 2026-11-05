import { prisma } from "@/lib/prisma";
import {
  assessProfile,
  resolveToneKey,
  sanitizeProfileText,
  sanitizeStringList,
  MAX_AUDIENCE_CHARS,
  MAX_HEADLINE_CHARS,
  MAX_INDUSTRY_CHARS,
  MAX_LIST_ITEMS,
  MAX_LIST_ITEM_CHARS,
  MAX_POSITIONING_CHARS,
  MAX_SKILLS,
  MAX_SKILL_CHARS,
  MAX_SUMMARY_CHARS,
  type ProfileGap,
  type ProfileInput,
} from "@/lib/profile-completeness";

/**
 * Completing onboarding, for every client.
 *
 * This is the ONLY way `onboardingCompleted` becomes true, which makes it the
 * gate on content quality: everything the AI prompts know about a user arrives
 * here. The web route and the mobile route both call it, so there is one
 * definition of what "complete" means rather than two that drift - the mobile
 * copy had already drifted far enough to skip the length caps, skip timezone
 * validation, skip the completeness check, and never write skills or tonePrefs
 * at all, which left every mobile user's profile incomplete on their first
 * Generate.
 */

export type OnboardingOutcome =
  | { ok: true }
  | { ok: false; status: number; error: string; gaps?: ProfileGap[] };

/** The fields this accepts. Anything else in the payload is ignored. */
const TEXT_FIELDS = {
  headline: MAX_HEADLINE_CHARS,
  industry: MAX_INDUSTRY_CHARS,
  summary: MAX_SUMMARY_CHARS,
  positioning: MAX_POSITIONING_CHARS,
  targetAudience: MAX_AUDIENCE_CHARS,
} as const;

/**
 * A field counts as "sent" only when the key is actually present and not null.
 *
 * The distinction matters. A client that OMITS a field is saying nothing about
 * it, and the value already stored should stand - that is what lets the mobile
 * wizard, which has no skills or tone step, complete for a user whose LinkedIn
 * sync already filled those in. A client that sends an EMPTY value is saying
 * "clear this", and must be held to the completeness rules like anyone else.
 */
function sent(body: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(body, key) && body[key] != null;
}

export async function completeOnboarding(
  userId: string,
  rawBody: unknown
): Promise<OnboardingOutcome> {
  const body = (rawBody ?? {}) as Record<string, unknown>;

  try {
    // Read first: the stored profile is both the existence check and the
    // fallback for fields this client does not collect.
    const existing = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        headline: true,
        industry: true,
        summary: true,
        positioning: true,
        targetAudience: true,
        skills: true,
        contentGoals: true,
        contentStyles: true,
        tonePrefs: true,
        timezone: true,
      },
    });

    if (!existing) {
      return {
        ok: false,
        status: 404,
        error: "User not found in database. Please log out and sign in again.",
      };
    }

    // ── Text fields ─────────────────────────────────────────────────────────
    const text: Record<string, string> = {};
    for (const [field, max] of Object.entries(TEXT_FIELDS)) {
      text[field] = sent(body, field)
        ? sanitizeProfileText(body[field], max)
        : (existing[field as keyof typeof existing] as string | null) ?? "";
    }

    // ── Lists, stored as JSON strings ───────────────────────────────────────
    const skills = sent(body, "skills")
      ? JSON.stringify(sanitizeStringList(body.skills, MAX_SKILLS, MAX_SKILL_CHARS))
      : existing.skills ?? JSON.stringify([]);
    const contentGoals = sent(body, "contentGoals")
      ? JSON.stringify(sanitizeStringList(body.contentGoals, MAX_LIST_ITEMS, MAX_LIST_ITEM_CHARS))
      : existing.contentGoals ?? JSON.stringify([]);
    const contentStyles = sent(body, "contentStyles")
      ? JSON.stringify(sanitizeStringList(body.contentStyles, MAX_LIST_ITEMS, MAX_LIST_ITEM_CHARS))
      : existing.contentStyles ?? JSON.stringify([]);

    // resolveToneKey takes a bare key, a JSON-encoded key or an object shape,
    // so a stored value round-trips through it unchanged.
    const toneKey = sent(body, "tonePrefs")
      ? resolveToneKey(typeof body.tonePrefs === "string" ? body.tonePrefs : null)
      : resolveToneKey(existing.tonePrefs);
    const tonePrefs = toneKey ? JSON.stringify(toneKey) : null;

    // ── One definition of "complete", for every surface ─────────────────────
    const candidate: ProfileInput = {
      headline: text.headline,
      industry: text.industry,
      summary: text.summary,
      positioning: text.positioning,
      targetAudience: text.targetAudience,
      skills,
      contentGoals,
      contentStyles,
      tonePrefs,
    };

    const { complete, gaps } = assessProfile(candidate);
    if (!complete) {
      return {
        ok: false,
        status: 400,
        error: "Your profile is missing some details we need to write good content.",
        gaps,
      };
    }

    // Timezone is validated, not rejected: a bad IANA string is a client quirk,
    // not a reason to fail the whole setup. Without this check an unknown zone
    // from a phone goes straight into a non-null column.
    let timezone = existing.timezone || "Asia/Kolkata";
    if (typeof body.timezone === "string" && body.timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: body.timezone });
        timezone = body.timezone;
      } catch {
        // keep what we had
      }
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        onboardingCompleted: true,
        headline: text.headline,
        industry: text.industry,
        summary: text.summary,
        positioning: text.positioning,
        targetAudience: text.targetAudience,
        skills,
        contentGoals,
        contentStyles,
        // JSON-stringified to match how the profile route writes it and how
        // resolveTone() reads it back.
        tonePrefs,
        timezone,
      },
    });

    return { ok: true };
  } catch (error) {
    const err = error as { code?: string; message?: string };
    console.error("[onboarding] failed for user", userId, err?.code ?? "", err?.message ?? err);

    // The caller's identity points at a row that is no longer there. The read
    // above normally catches this; this covers the row being deleted between
    // the read and the write.
    if (err.code === "P2025") {
      return {
        ok: false,
        status: 404,
        error: "User not found in database. Please log out and sign in again.",
      };
    }

    return {
      ok: false,
      status: 500,
      error: "Could not save your profile. Please try again.",
    };
  }
}
