import { safeJsonParse } from "@/lib/utils";

/**
 * ─── The content-quality contract ────────────────────────────────────────────
 *
 * Every AI prompt in this app is assembled from `buildProfileContext()`, so the
 * ceiling on output quality is set here, not in the prompt. This module is the
 * SINGLE place that decides whether a profile carries enough real signal to
 * write personalised content from.
 *
 * It exists because the opposite used to be true. The LinkedIn OIDC scope this
 * app requests (`openid profile email w_member_social`) returns only sub, name,
 * email and picture - never headline, summary, skills or industry - so those
 * fields were blank unless the user typed them. `skills` was not collected
 * anywhere in onboarding at all, and `targetAudience` was generated from a
 * client-side template, which meant two users in the same industry with the same
 * positioning were handed byte-identical audience text. The prompt then filled
 * the gaps with "Not specified", and the model duly wrote generic posts.
 *
 * The thresholds below are deliberately about USABLE signal, not form-filling:
 * each one names the prompt behaviour it protects.
 *
 * Read by: the onboarding route (server-side validation), the profile route,
 * both generation preflights, the onboarding page's re-entry check, and the
 * dashboard banner. Change a rule here and every surface moves together.
 */

/** A headline shorter than this is a job title, not positioning. */
/**
 * Bumped BY HAND whenever onboarding starts asking for something new - a new
 * entry in ProfileGapKey, or a threshold raised far enough that profiles which
 * used to qualify no longer do.
 *
 * Gating never reads this. Every gate calls assessProfile() directly, so a new
 * requirement starts blocking generation, images and scheduling the moment it
 * ships. The version exists only so the "we need one more thing" email goes out
 * exactly once per requirement change: User.profileAlertVersion records which
 * version a given account has already been told about, and 0 (the default)
 * means every existing account gets told once.
 */
export const PROFILE_REQUIREMENTS_VERSION = 1;

export const MIN_HEADLINE_CHARS = 15;

/**
 * The summary is the single richest input the model gets - it is the only field
 * carrying this person's actual experience in their own words. Under roughly two
 * sentences it tells the model nothing the headline did not already say.
 */
export const MIN_SUMMARY_CHARS = 120;

/**
 * `buildStrategyPrompt` asks for content pillars drawn from "this person's
 * specific Skills, Industry and experience" so that "someone in a different
 * field could not reuse it". One or two skills cannot support a week of
 * distinct pillars.
 */
export const MIN_SKILLS = 3;

/** weekTheme, weeklyGoal and callToAction are all tied to the stated goals. */
export const MIN_CONTENT_GOALS = 1;

/**
 * `assignPostStyles()` spreads the selected styles across a 5-post batch, and
 * `buildPostsPrompt` then demands the batch "read as clearly DIFFERENT shapes".
 * With fewer than three styles the assignment repeats and all five posts come
 * back in the same shape - which is exactly the "every post looks the same"
 * complaint.
 */
export const MIN_CONTENT_STYLES = 3;

/**
 * Enough room for who they are, what they are stuck on, and what they want.
 * The strategy prompt asks for "concrete pains and outcomes, in the audience's
 * own words" - a one-line job title cannot answer that.
 */
export const MIN_AUDIENCE_CHARS = 60;

/** Generous ceiling. The column is @db.Text; this only guards the textareas. */
export const MAX_AUDIENCE_CHARS = 600;

// ── Upper bounds ─────────────────────────────────────────────────────────────
// The columns are @db.Text, so these exist to stop a crafted payload writing
// unbounded JSON, and to keep the assembled prompt inside a sane token budget -
// profile context is prepended to EVERY generation call.

export const MAX_HEADLINE_CHARS = 220;
export const MAX_SUMMARY_CHARS = 2600;
export const MAX_INDUSTRY_CHARS = 80;
export const MAX_POSITIONING_CHARS = 60;
export const MAX_SKILLS = 25;
export const MAX_SKILL_CHARS = 60;
export const MAX_LIST_ITEMS = 25;
export const MAX_LIST_ITEM_CHARS = 80;

/**
 * Normalise an incoming string array: strings only, trimmed, inner whitespace
 * collapsed, de-duplicated case-insensitively, each item capped in length and
 * the list capped in size.
 *
 * Shared by the onboarding route and the profile route so a value written by
 * one is always readable by the other.
 */
export function sanitizeStringList(
  raw: unknown,
  maxItems: number,
  maxChars: number
): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const v = item.trim().replace(/\s+/g, " ").slice(0, maxChars);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= maxItems) break;
  }
  return out;
}

/** Trim and cap a free-text profile field. Non-strings become "". */
export function sanitizeProfileText(raw: unknown, maxChars: number): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, maxChars);
}

/**
 * Every field the gate checks - and therefore the denominator of the profile
 * completion percentage.
 *
 * ProfileGapKey is DERIVED from this array rather than declared beside it, so a
 * new required input cannot be added to the contract without landing here too.
 * That is what makes the completion ring self-maintaining: ship a tenth input
 * and every user who has not filled it in drops to 90% on their next page load,
 * with no arithmetic to update anywhere.
 */
export const PROFILE_GAP_KEYS = [
  "headline",
  "industry",
  "summary",
  "skills",
  "positioning",
  "contentGoals",
  "contentStyles",
  "targetAudience",
  "tone",
] as const;

export type ProfileGapKey = (typeof PROFILE_GAP_KEYS)[number];

export interface ProfileGap {
  key: ProfileGapKey;
  /** Field name as the user sees it. */
  label: string;
  /** What to do about it, in one sentence. */
  hint: string;
}

export interface ProfileAssessment {
  complete: boolean;
  gaps: ProfileGap[];
  /**
   * How much of the contract this profile satisfies, 0-100.
   *
   * Deliberately part of the assessment rather than a second function: a
   * separate calculation could drift from the gate, and then the ring would
   * promise 100% while a generate button still refused.
   */
  completion: number;
}

/** The shape every caller must select from the User row. */
export interface ProfileInput {
  headline?: string | null;
  industry?: string | null;
  summary?: string | null;
  /** JSON array string. */
  skills?: string | null;
  positioning?: string | null;
  /** JSON array string. */
  contentGoals?: string | null;
  /** JSON array string. */
  contentStyles?: string | null;
  targetAudience?: string | null;
  /** JSON string - either a bare tone key or an object. */
  tonePrefs?: string | null;
}

/**
 * Does this `targetAudience` look like the old auto-generated template rather
 * than something the user wrote?
 *
 * OnboardingWizard used to ship a "Generate from Profile" button that composed
 * the field client-side as:
 *
 *   `<Industry> professionals and decision-makers - especially <goal blurbs> -
 *    who value <positioning blurb>.`
 *
 * (and a shortened `<who> who value <value>.` when that overflowed 300 chars).
 *
 * Almost nobody edited it, so every account that onboarded before this check
 * carries a ~250-character string that two different users in the same industry
 * share byte for byte. It clears the length minimum comfortably, which means a
 * plain `length >= MIN` test would wave those users straight through with the
 * exact input that caused the generic output in the first place.
 *
 * Both signature phrases are required, because that pairing is the template's
 * shape and is unlikely in a description someone actually typed. A hand-written
 * line that does hit both is itself generic enough to be worth rewriting, and
 * the gap hint says so rather than failing silently.
 */
export function isTemplateAudience(value: string | null | undefined): boolean {
  const v = (value ?? "").toLowerCase();
  if (!v) return false;
  return v.includes("professionals and decision-makers") && v.includes("who value");
}

function len(v: string | null | undefined): number {
  return (v ?? "").trim().length;
}

function arrLen(json: string | null | undefined): number {
  const arr = safeJsonParse<unknown[]>(json, []);
  if (!Array.isArray(arr)) return 0;
  return arr.filter((v) => typeof v === "string" && v.trim().length > 0).length;
}

/**
 * Assess one profile against the contract above.
 *
 * Pure and side-effect free, so it is safe to call from a render path, a route
 * guard or a layout.
 */
export function assessProfile(user: ProfileInput | null | undefined): ProfileAssessment {
  const gaps: ProfileGap[] = [];
  if (!user) {
    return {
      complete: false,
      completion: 0,
      gaps: [
        {
          key: "headline",
          label: "Your profile",
          hint: "We could not load your profile. Sign out and back in, then try again.",
        },
      ],
    };
  }

  if (len(user.headline) < MIN_HEADLINE_CHARS) {
    gaps.push({
      key: "headline",
      label: "Professional headline",
      hint: `Say what you do and who you do it for - at least ${MIN_HEADLINE_CHARS} characters.`,
    });
  }

  if (len(user.industry) === 0) {
    gaps.push({
      key: "industry",
      label: "Industry",
      hint: "Pick the field you work in so the research step searches the right ground.",
    });
  }

  if (len(user.summary) < MIN_SUMMARY_CHARS) {
    gaps.push({
      key: "summary",
      label: "Professional summary",
      hint: `Describe your experience in your own words - at least ${MIN_SUMMARY_CHARS} characters. This is the single biggest driver of how personal your posts read.`,
    });
  }

  if (arrLen(user.skills) < MIN_SKILLS) {
    gaps.push({
      key: "skills",
      label: "Skills and expertise",
      hint: `Add at least ${MIN_SKILLS} topics you can speak on with authority - these become your weekly content pillars.`,
    });
  }

  if (len(user.positioning) === 0) {
    gaps.push({
      key: "positioning",
      label: "Content positioning",
      hint: "Choose how you want to come across - it sets the writing stance for every post.",
    });
  }

  if (arrLen(user.contentGoals) < MIN_CONTENT_GOALS) {
    gaps.push({
      key: "contentGoals",
      label: "LinkedIn goals",
      hint: "Pick at least one goal so the weekly theme and call-to-action aim at something.",
    });
  }

  if (arrLen(user.contentStyles) < MIN_CONTENT_STYLES) {
    gaps.push({
      key: "contentStyles",
      label: "Content styles",
      hint: `Choose at least ${MIN_CONTENT_STYLES} styles. Each post in a batch is written in a different one, so fewer than ${MIN_CONTENT_STYLES} makes every post read the same.`,
    });
  }

  if (len(user.targetAudience) < MIN_AUDIENCE_CHARS) {
    gaps.push({
      key: "targetAudience",
      label: "Target audience",
      hint: `Describe who you are writing for, what they are stuck on, and what they want - at least ${MIN_AUDIENCE_CHARS} characters.`,
    });
  } else if (isTemplateAudience(user.targetAudience)) {
    gaps.push({
      key: "targetAudience",
      label: "Target audience",
      hint: "This is still the auto-generated description, which is identical for everyone in your industry. Rewrite it in your own words - who they are, what they are stuck on, and what they want.",
    });
  }

  if (resolveToneKey(user.tonePrefs) === null) {
    gaps.push({
      key: "tone",
      label: "Tone and voice",
      hint: "Pick the voice your posts should be written in.",
    });
  }

  // Counted by KEY, not by gap: a field can fail for more than one reason
  // (targetAudience is missing, or is still the old template) and must never
  // cost the user twice.
  const missing = new Set(gaps.map((g) => g.key)).size;
  const completion = Math.round(
    ((PROFILE_GAP_KEYS.length - missing) / PROFILE_GAP_KEYS.length) * 100
  );

  return { complete: gaps.length === 0, gaps, completion };
}

/**
 * The tone keys `TONE_DIRECTION` in lib/linkedin.ts knows how to turn into voice
 * guidance. A value outside this set falls back to a flat generic voice, so it
 * counts as unset.
 */
export const TONE_KEYS = [
  "professional",
  "conversational",
  "inspirational",
  "educational",
  "formal",
  "casual",
] as const;

/**
 * Normalise a stored tonePrefs value to a known key, or null when it is missing
 * or unrecognised. Handles the bare-string, object and double-encoded shapes
 * that exist in the table.
 */
export function resolveToneKey(tonePrefs: string | null | undefined): string | null {
  const parsed = safeJsonParse<unknown>(tonePrefs, tonePrefs ?? null);

  let key = "";
  if (typeof parsed === "string") {
    key = parsed;
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    key = String(obj.tone ?? obj.voice ?? obj.style ?? obj.value ?? "");
  }

  key = key.replace(/^"+|"+$/g, "").trim().toLowerCase();
  return (TONE_KEYS as readonly string[]).includes(key) ? key : null;
}

/**
 * Build the `targetAudience` string from the three guided answers the onboarding
 * wizard asks for.
 *
 * Guided fields rather than one free textarea on purpose: the field used to be
 * filled by a template button, and almost nobody edited it. Asking separately
 * for who / what hurts / what they want is what produces the "concrete pains and
 * outcomes" the strategy prompt is written to consume.
 */
export function composeTargetAudience(
  who: string,
  pain: string,
  outcome: string
): string {
  const clean = (s: string) => s.trim().replace(/\s+/g, " ").replace(/[.\s]+$/, "");
  const parts: string[] = [];

  const w = clean(who);
  const p = clean(pain);
  const o = clean(outcome);

  if (w) parts.push(`${w}.`);
  if (p) parts.push(`Their biggest challenge right now: ${p}.`);
  if (o) parts.push(`What they actually want: ${o}.`);

  return parts.join(" ").slice(0, MAX_AUDIENCE_CHARS);
}

/**
 * One-line reason for a blocked action, naming the fields that are missing.
 * Used by the generation preflights so the pipeline modal shows something the
 * user can act on rather than "generation failed".
 */
export function profileGapMessage(gaps: ProfileGap[]): string {
  if (gaps.length === 0) return "";
  const names = gaps.map((g) => g.label.toLowerCase());
  const list =
    names.length === 1
      ? names[0]
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `Your profile is missing ${list}. Content written without it reads generic, so finish your profile first - it takes about two minutes.`;
}
