import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * Records a 404 with its referrer (D-19).
 *
 * Deliberately unauthenticated - a visitor hitting a dead link is usually not
 * signed in, and that is exactly the 404 worth knowing about. The trade-off is
 * that anyone can POST here, so the endpoint is rate limited per IP and both
 * fields are clamped before they reach the log. It writes a line and nothing
 * else: no database, no response body worth scraping.
 *
 * Output goes to stdout, which on Vercel is a queryable runtime log. Search for
 * "[404]" to pull the week's list.
 */

const MAX_FIELD_CHARS = 512;

/** Strips control characters so a crafted value cannot forge extra log lines. */
function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const flat = value.replace(/[\r\n\t]/g, " ").trim();
  if (!flat) return null;
  return flat.slice(0, MAX_FIELD_CHARS);
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  // 30 an hour per IP. A real visitor trips a handful; a flooder is cut off
  // without ever being told why.
  const { allowed } = checkRateLimit(ip, "log-404", { maxRequests: 30, windowSecs: 3600 });
  if (!allowed) return new NextResponse(null, { status: 204 });

  const body = await req.json().catch(() => null);
  const path = clean(body?.path);
  if (!path) return new NextResponse(null, { status: 204 });

  const referrer = clean(body?.referrer);
  console.warn(`[404] path=${path} referrer=${referrer ?? "none"}`);

  return new NextResponse(null, { status: 204 });
}
