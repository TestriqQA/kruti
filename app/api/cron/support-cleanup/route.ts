import { NextRequest, NextResponse } from "next/server";
import { runSupportReplyCleanup } from "@/lib/scheduler";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSupportReplyCleanup();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[Cron:support-cleanup] Error:", err);
    return NextResponse.json({ error: "Support cleanup job failed" }, { status: 500 });
  }
}
