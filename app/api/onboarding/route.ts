import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { completeOnboarding } from "@/lib/onboarding";

/**
 * Completes onboarding for the website.
 *
 * The work itself lives in lib/onboarding.ts so that this route and
 * /api/mobile/onboarding cannot disagree about what a complete profile is -
 * they used to, and the mobile copy was the looser of the two.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const outcome = await completeOnboarding(session.user.id, body);

  if (!outcome.ok) {
    return NextResponse.json(
      outcome.gaps ? { error: outcome.error, gaps: outcome.gaps } : { error: outcome.error },
      { status: outcome.status }
    );
  }

  return NextResponse.json({ success: true });
}
