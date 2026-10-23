import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ndjsonResponse } from "@/lib/ndjson";
import {
  runStrategyGeneration,
  strategyErrorMessage,
  type StrategyRequest,
} from "@/lib/generation/strategy";

/**
 * Streaming route: emits step-by-step NDJSON progress so the client can show
 * the whole pipeline (preflight -> start date -> history -> strategy -> save).
 *
 * The pipeline lives in lib/generation/strategy.ts, shared with
 * /api/mobile/generate/strategy.
 *
 * Auth is answered with a status rather than a stream event, so a client can
 * tell a genuine 401 from a run that failed partway.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as StrategyRequest;

  return ndjsonResponse(
    (send) => runStrategyGeneration(userId, body, send),
    strategyErrorMessage,
  );
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const weekStartParam = searchParams.get("weekStart");

  if (weekStartParam) {
    const weekStart = new Date(weekStartParam);
    weekStart.setHours(0, 0, 0, 0);
    const plan = await prisma.contentPlan.findFirst({
      where: { userId: session.user.id, weekStart },
      include: { posts: { orderBy: { scheduledAt: "asc" } } },
    });
    return NextResponse.json(plan);
  }

  // Return most recent plan
  const plan = await prisma.contentPlan.findFirst({
    where: { userId: session.user.id },
    orderBy: { weekStart: "desc" },
    include: { posts: { orderBy: { scheduledAt: "asc" } } },
  });
  return NextResponse.json(plan);
}
