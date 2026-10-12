import { prisma } from "@/lib/prisma";
import { safeJsonParse } from "@/lib/utils";
import { resolveToneKey } from "@/lib/profile-completeness";

export interface LinkedInProfile {
  sub: string;
  name: string;
  given_name: string;
  family_name: string;
  picture?: string;
  email?: string;
  headline?: string;
  summary?: string;
  industry?: string;
  skills?: string[];
}

export async function syncLinkedInProfile(
  userId: string,
  accessToken: string
): Promise<void> {
  try {
    // Fetch basic profile via OpenID userinfo endpoint
    const profileRes = await fetch("https://api.linkedin.com/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) return;
    const profile = await profileRes.json();

    // ── What LinkedIn actually gives us, and what it does not ────────────────
    //
    // /v2/userinfo is an OpenID endpoint, and the scope this app requests
    // (`openid profile email w_member_social`, see lib/auth.ts) returns exactly:
    // sub, name, given_name, family_name, picture, email, email_verified, locale.
    //
    // It does NOT return headline, summary, industry or skills. Those live
    // behind r_basicprofile / r_liteprofile, which require LinkedIn Marketing
    // Developer Platform approval and are not in our scope.
    //
    // There used to be a second call here to
    //   /v2/me?projection=(id,localizedHeadline,industryName)
    // wrapped in `try { } catch { }` with an empty handler. With our scope that
    // call can only ever answer 403, so it was a guaranteed-failing network
    // round-trip on every single sign-in that silently resolved to "no
    // headline, no industry" - and because it failed quietly, it read like the
    // app was populating those fields when nothing ever did.
    //
    // headline / industry / summary / skills are therefore USER-OWNED: collected
    // in onboarding and editable in Settings. Do not re-add a profile fetch for
    // them unless the LinkedIn app is actually granted r_basicprofile, and if it
    // ever is, surface the failure instead of swallowing it.

    // Check if another user already owns this linkedinId
    const existingWithSub = await prisma.user.findUnique({
      where: { linkedinId: profile.sub },
      select: { id: true },
    });
    const canSetLinkedinId = !existingWithSub || existingWithSub.id === userId;

    // Only identity fields are synced. headline/industry/summary/skills are
    // user-owned (see the note above) and must never be touched here - writing
    // them would blank out what the user typed in onboarding.
    const profileUpdate: Record<string, unknown> = {
      ...(canSetLinkedinId ? { linkedinId: profile.sub } : {}),
      profileUrl: `https://www.linkedin.com/in/${profile.sub}`,
    };
    // Refresh the avatar URL on every login - LinkedIn picture URLs are signed and
    // expire, so re-storing the fresh one keeps avatars from breaking over time.
    if (profile.picture) profileUpdate.image = profile.picture;

    // ENRICHMENT ONLY - this must never create a User.
    //
    // On a first-time web sign-in NextAuth runs the signIn callback (which calls this)
    // BEFORE the Prisma adapter creates the User row, and the id it passes is the
    // LinkedIn `sub`, not the cuid the adapter will mint. An upsert therefore took the
    // create branch and inserted a junk row with no name and no email - one per new
    // signup - which also claimed the unique linkedinId and so permanently blocked the
    // real user from ever having it set. updateMany is a no-op when nothing matches,
    // so the first login simply skips the sync; the second login (and the backfill in
    // lib/linkedin-post.ts) fill these fields in against the real row.
    await prisma.user.updateMany({
      where: { id: userId },
      data: profileUpdate,
    });
  } catch (err) {
    console.error("syncLinkedInProfile error:", err);
  }
}

// ─── Tone direction (turns the stored tone preference into voice guidance) ─────

const TONE_DIRECTION: Record<string, string> = {
  professional: "Professional and credible - precise, expert, substantive. Confident without hype. Plain professional language; contractions are fine, slang and corporate filler are not.",
  conversational: "Friendly, approachable, and relatable. Write like talking to a respected peer over coffee. Warm and direct, lightly informal.",
  inspirational: "Motivating, story-driven, and uplifting. Lead with meaning and momentum. Confident and energizing, but earned, never cheesy.",
  educational: "Teaching-first and clear. Explain step by step, break down the why, make the complex feel simple. Patient, structured, generous with insight.",
  formal: "Polished, precise, and reserved. Measured sentences, professional distance, zero slang.",
  casual: "Relaxed and human. Contractions, plain words, an easy rhythm like a quick note to a colleague.",
};

/**
 * Resolves tonePrefs (a JSON string of either a bare string or an object) into a
 * readable tone label plus concrete voice direction. Safe against bad data and
 * double-encoded rows (e.g. a value that parses to a still-quoted string).
 */
function resolveTone(tonePrefs: string | null | undefined): { label: string; direction: string } {
  // Key normalisation (bare string, object, double-encoded) lives in
  // lib/profile-completeness.ts so the completeness check and the prompt agree
  // on what counts as a set tone.
  const key = resolveToneKey(tonePrefs);

  // A tone stored as an object may also carry free-text voice notes. Those are
  // not a known key but are still real user direction, so they stand in as the
  // voice guidance when no key matches.
  let extra = "";
  const parsed = safeJsonParse<unknown>(tonePrefs, tonePrefs ?? null);
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    const notes = [obj.voice, obj.style, obj.notes, obj.description]
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    if (notes.length > 0) extra = notes.join("; ");
  }

  const direction =
    (key ? TONE_DIRECTION[key] : "") ||
    extra ||
    "Professional, clear, and authentic - the natural voice of a real expert in this field.";
  const label = key
    ? key.charAt(0).toUpperCase() + key.slice(1)
    : extra
    ? "Custom"
    : "Professional";
  return { label, direction };
}

// Turns the user's chosen positioning into a binding WRITING stance (not just an
// image direction). This is what makes a Contrarian actually sound contrarian and an
// Educator teach - it augments the tone direction, it never replaces it.
const POSITIONING_VOICE: Record<string, string> = {
  "thought leader": "lead with a clear point of view and a stance worth following",
  "industry expert": "argue from credibility, proof, and precise analysis",
  storyteller: "teach through a narrative arc and concrete moments",
  educator: "teach step by step, break down the why, make the complex simple",
  entertainer: "be vivid and memorable; land the insight with personality and a light touch",
  contrarian: "challenge the consensus; lead with the counter-take and defend it",
  practitioner: "speak from hands-on, in-the-trenches experience and tactical detail",
  "community builder": "write to convene and invite participation; frame ideas as shared conversation",
};

export function buildProfileContext(user: {
  name?: string | null;
  headline?: string | null;
  summary?: string | null;
  skills?: string | null;
  industry?: string | null;
  tonePrefs?: string | null;
  positioning?: string | null;
  contentGoals?: string | null;
  contentStyles?: string | null;
  targetAudience?: string | null;
}): string {
  const skills = safeJsonParse<string[]>(user.skills, []);
  const goals = safeJsonParse<string[]>(user.contentGoals, []);
  const styles = safeJsonParse<string[]>(user.contentStyles, []);
  const tone = resolveTone(user.tonePrefs);
  const posKey = (user.positioning || "").trim().toLowerCase();
  const posStance = POSITIONING_VOICE[posKey] || "";

  // ── Missing fields are OMITTED, never padded ─────────────────────────────
  //
  // Every line here used to carry a fallback: "Industry: Not specified",
  // "About / Summary: Not provided", "Core expertise and skills: Not
  // specified", plus invented defaults like positioning "Industry Expert" and
  // audience "LinkedIn professionals in my industry".
  //
  // That was actively harmful in two ways. The invented defaults told the model
  // things the user never said, and the "Not specified" padding taught it, four
  // lines in a row, that this was a generic profile with nothing specific to
  // say - so it wrote generic posts, exactly as instructed.
  //
  // Now an absent field simply is not in the prompt, and the unknowns are named
  // once at the end with an explicit instruction not to invent them. Routes
  // guard on lib/profile-completeness.ts before generating, so in practice a
  // real generation never reaches here with important fields empty.
  /** Fields with no value, described the way the prompt should refer to them. */
  const unknown: string[] = [];

  /** `Label: value` when there is a value; otherwise records the gap and skips. */
  function field(
    label: string,
    value: string | null | undefined,
    describeIfMissing?: string
  ): string | null {
    const v = (value ?? "").trim();
    if (v) return `${label}: ${v}`;
    if (describeIfMissing) unknown.push(describeIfMissing);
    return null;
  }

  /** `Label: a, b, c` when the list has entries; otherwise records the gap. */
  function listField(
    label: string,
    values: string[],
    describeIfMissing?: string
  ): string | null {
    const clean = values.filter((v) => typeof v === "string" && v.trim());
    if (clean.length > 0) return `${label}: ${clean.join(", ")}`;
    if (describeIfMissing) unknown.push(describeIfMissing);
    return null;
  }

  const identity = [
    field("Name", user.name),
    field("Headline", user.headline, "their headline"),
    field("Industry", user.industry, "their industry"),
    field("About / Summary", user.summary, "their background and experience"),
    listField("Core expertise and skills", skills, "their specific areas of expertise"),
  ].filter((l): l is string => l !== null);

  const presence = [
    field("Content positioning", user.positioning, "how they want to be positioned"),
    listField("LinkedIn goals", goals),
    listField("Preferred content styles", styles),
  ].filter((l): l is string => l !== null);

  const voice = [
    "VOICE AND TONE (write every post in this voice - this is non-negotiable)",
    `Tone preference: ${tone.label}`,
    `Voice direction: ${tone.direction}`,
    posStance ? `Positioning stance (how this person must come across): ${posStance}.` : null,
  ].filter((l): l is string => l !== null);

  const audience = (user.targetAudience ?? "").trim();
  if (!audience) unknown.push("who their audience is");

  const sections: string[] = [`WHO THIS PERSON IS\n${identity.join("\n")}`];

  if (presence.length > 0) {
    sections.push(`HOW THEY SHOW UP ON LINKEDIN\n${presence.join("\n")}`);
  }

  sections.push(voice.join("\n"));

  if (audience) {
    sections.push(`WHO THEY ARE WRITING FOR\n${audience}`);
  }

  if (unknown.length > 0) {
    sections.push(
      "NOT PROVIDED - do NOT invent any of this. Write only from what is stated above, and never imply " +
        "experience, credentials, employers, results, or an audience that is not given here. Unknown: " +
        `${unknown.join("; ")}.`
    );
  }

  const industry = (user.industry ?? "").trim();
  sections.push(
    "Write as THIS person, in THIS voice, for THIS audience. " +
      (industry
        ? `The reader should believe a real expert in ${industry} wrote it personally.`
        : "The reader should believe a real, practising expert wrote it personally.")
  );

  return sections.join("\n\n").trim();
}
