import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { suggestProfile, MAX_PASTE_CHARS, EMPTY_SUGGESTION } from "@/lib/profile-suggest";

export const maxDuration = 60;

/**
 * POST /api/onboarding/suggest
 * Body: { "paste": "<text copied from their LinkedIn profile>" }
 *
 * Reads pasted profile text and returns onboarding suggestions. Writes nothing:
 * the wizard pre-fills its own fields from the response, and the existing
 * /api/onboarding POST remains the only thing that touches the User row. That
 * separation matters - a user who runs this and then abandons onboarding must
 * not end up with a half-filled profile they never agreed to.
 *
 * Deliberately NOT subscription-gated. Onboarding happens before anyone has
 * paid, and a trial that has lapsed mid-onboarding still needs finishing.
 *
 * Rate limited because each call spends a model call, and the paste box is a
 * button a frustrated user will press repeatedly. 10 an hour is far above one
 * honest run-through, including a few retries after editing the paste.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

    const rl = checkRateLimit(userId, "onboarding-suggest", {
      maxRequests: 10,
      windowSecs: 3600,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: `Too many attempts. Try again in ${rl.retryAfterSecs}s.`,
          rateLimited: true,
          retryAfterSecs: rl.retryAfterSecs,
        },
        { status: 429 },
      );
    }

    const body = (await req.json().catch(() => ({}))) as { paste?: unknown };
    const paste = typeof body.paste === "string" ? body.paste : "";

    if (paste.trim().length < 40) {
      return NextResponse.json(
        { error: "Paste a bit more of your profile - the headline and About section work best." },
        { status: 400 },
      );
    }
    if (paste.length > MAX_PASTE_CHARS) {
      return NextResponse.json(
        { error: `That is longer than a LinkedIn profile. Keep it under ${MAX_PASTE_CHARS} characters.` },
        { status: 400 },
      );
    }

    // Name and email come from the row, not the request: the email domain is a
    // hint about where they work, and a client-supplied one would let a caller
    // steer the industry guess at will.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });

    const suggestion = await suggestProfile({
      paste,
      name: user?.name ?? null,
      email: user?.email ?? null,
    });

    // An all-empty result is not an error - the text genuinely may not have
    // supported anything. Say so, so the wizard can tell the user that rather
    // than leaving them staring at an unchanged form wondering if it worked.
    const filled = Object.values(suggestion).filter((v) =>
      Array.isArray(v) ? v.length > 0 : String(v).length > 0,
    ).length;

    return NextResponse.json({ suggestion, filled });
  } catch (err) {
    console.error("[onboarding/suggest] failed:", err);
    // Degrade to an empty suggestion rather than an error banner: onboarding is
    // completable by hand, and a 500 here reads as "the app is broken".
    return NextResponse.json({ suggestion: EMPTY_SUGGESTION, filled: 0 });
  }
}
