/**
 * POST /api/mobile/subscription/activate-trial
 *
 * Explicit one-time trial activation. Called when the user taps
 * "Activate 7-Day Trial" on the plan-selection screen.
 *
 * Rules:
 *   • The trial can be activated AT MOST ONCE per user (tracked by
 *     subscription.trialEnd — once set, never resettable).
 *   • If a subscription row already exists and trialEnd is set → 400.
 *   • Otherwise create-or-update the row with status "trialing" and
 *     trialEnd = now + 7 days.
 *
 * Place at: app/api/mobile/subscription/activate-trial/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

const TRIAL_DAYS = 7;

export async function POST(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The token's user may no longer exist (e.g. the row was deleted). Creating
  // a Subscription for a missing user violates the FK — so reject cleanly and
  // tell the client to re-authenticate.
  const userExists = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (!userExists) {
    return NextResponse.json(
      { error: "Session expired. Please sign in again.", code: "USER_NOT_FOUND" },
      { status: 401 },
    );
  }

  const existing = await prisma.subscription.findUnique({
    where: { userId },
  });

  // Trial already used (active OR expired) — reject.
  if (existing?.trialEnd) {
    return NextResponse.json(
      {
        error: "Trial already used",
        code: "TRIAL_ALREADY_USED",
      },
      { status: 400 },
    );
  }

  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

  try {
    if (existing) {
      // Subscription row exists (e.g. razorpayCustomerId was set during a
      // prior incomplete checkout) but trial was never used. Upgrade it
      // to a trialing state.
      await prisma.subscription.update({
        where: { userId },
        data: {
          status: "trialing",
          trialEnd,
          currency: existing.currency ?? "INR",
        },
      });
    } else {
      await prisma.subscription.create({
        data: {
          userId,
          status: "trialing",
          trialEnd,
          currency: "INR",
        },
      });
    }

    console.log(
      `[mobile/activate-trial] user ${userId} trial activated until ${trialEnd.toISOString()}`,
    );

    return NextResponse.json({
      success: true,
      status: "trialing",
      trialEnd: trialEnd.toISOString(),
      daysRemaining: TRIAL_DAYS,
    });
  } catch (err: any) {
    console.error("[mobile/activate-trial] failed:", err);
    return NextResponse.json(
      // Generic to the client, detail to the log: err.message can carry
      // internal or Prisma text.
      { error: "Could not activate trial" },
      { status: 500 },
    );
  }
}