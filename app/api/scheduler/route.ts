import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  runAutoPost,
  runNewsletterSend,
  runTrialReminders,
  runImageCleanup,
  runTokenRefresh,
  runProfileAlerts,
} from "@/lib/scheduler";

/**
 * Manual trigger endpoint for all scheduler jobs.
 * On Vercel, individual jobs run via /api/cron/* routes.
 * This endpoint is kept as a fallback / manual "run all" trigger.
 * Must be called with Authorization: Bearer CRON_SECRET header.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Timing-safe comparison to prevent timing attacks
  const secretBuf = Buffer.from(secret, "utf-8");
  const expectedBuf = Buffer.from(cronSecret, "utf-8");
  if (secretBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(secretBuf, expectedBuf)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = {
    autoPost: await runAutoPost(),
    newsletter: await runNewsletterSend(),
    trialReminders: await runTrialReminders(),
    imageCleanup: await runImageCleanup(),
    tokenRefresh: await runTokenRefresh(),
    profileAlerts: await runProfileAlerts(),
  };

  return NextResponse.json({ ok: true, results });
}

