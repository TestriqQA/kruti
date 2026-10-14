import { NextRequest, NextResponse } from "next/server";
import { runProfileAlerts } from "@/lib/scheduler";

export const maxDuration = 60; // A batch of 50 emails plus one write each

export async function GET(req: NextRequest) {
  // Verify Vercel Cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runProfileAlerts();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[Cron:profile-alerts] Error:", err);
    return NextResponse.json({ error: "Profile alert job failed" }, { status: 500 });
  }
}
