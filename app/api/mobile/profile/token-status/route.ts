/**
 * GET /api/mobile/profile/token-status
 * Returns the LinkedIn token health for the signed-in mobile user so Settings
 * can warn when the token has expired / is expiring (auto-publish depends on it).
 *
 * Mirrors the web app/api/profile/token-status route, but with Bearer auth.
 *
 * Place at: app/api/mobile/profile/token-status/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { getMobileUserId } from "@/lib/mobileAuth";
import { getTokenStatus } from "@/lib/linkedin-token";

export async function GET(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const status = await getTokenStatus(userId);
  return NextResponse.json(status);
}
