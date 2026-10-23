/**
 * GET /api/mobile/subscription
 *
 * Returns the current user's subscription status, mirroring the web
 * /api/subscription route but authenticating via Bearer JWT (mobile)
 * instead of next-auth cookies.
 *
 * Also returns the Razorpay public key so the mobile app can hand it
 * straight to the checkout flow without a second round trip.
 *
 * PRIVILEGED DOMAINS: users on @testriq.com / @cinutedigital.com get
 * unlimited access automatically (internal team accounts) — no payment,
 * no trial gating. They still see the "Post by Kruti.io" badge (the app
 * decides that from the email, not from this status).
 *
 * Place at: app/api/mobile/subscription/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

// Internal team domains that get unlimited access.
const PRIVILEGED_DOMAINS = ["testriq.com", "cinutedigital.com"];

function isPrivilegedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = email.split("@")[1]?.toLowerCase().trim();
  return !!domain && PRIVILEGED_DOMAINS.includes(domain);
}

export async function GET(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? null;

  // ── Privileged (internal) accounts → unlimited access ──
  // Checked BEFORE the subscription row so it works even if they never
  // started a trial or paid.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (isPrivilegedEmail(user?.email)) {
    return NextResponse.json({
      status: "active",
      unlimited: true, // flag for the app (e.g. to label as "Team / Unlimited")
      trialEnd: null,
      currentPeriodEnd: null, // null = never expires
      daysRemaining: 0,
      currency: "INR",
      razorpayKeyId: keyId,
      trialActive: false,
      hasAccess: true,
      canActivateTrial: false,
    });
  }

  const sub = await prisma.subscription.findUnique({
    where: { userId },
  });

  if (!sub) {
    return NextResponse.json({
      status: "none",
      daysRemaining: 0,
      trialEnd: null,
      currentPeriodEnd: null,
      currency: "INR",
      razorpayKeyId: keyId,
      trialActive: false,
      hasAccess: false,
      // Trial never started yet — user CAN activate it (one-time).
      canActivateTrial: true,
    });
  }

  const now = new Date();

  // Trial day count (web parity).
  let daysRemaining = 0;
  if (sub.status === "trialing" && sub.trialEnd) {
    daysRemaining = Math.max(
      0,
      Math.ceil((sub.trialEnd.getTime() - now.getTime()) / 86400000),
    );
  }

  const trialActive =
    sub.status === "trialing" &&
    !!sub.trialEnd &&
    sub.trialEnd.getTime() > now.getTime();

  const paidActive =
    (sub.status === "active" || sub.status === "cancel_pending") &&
    (!sub.currentPeriodEnd || sub.currentPeriodEnd.getTime() > now.getTime());

  const hasAccess = trialActive || paidActive;

  // Trial is a one-time grant. Once trialEnd is set (active OR expired),
  // it can never be activated again — user must pay.
  const canActivateTrial = sub.trialEnd === null;

  return NextResponse.json({
    status: sub.status,
    trialEnd: sub.trialEnd?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    daysRemaining,
    razorpayCustomerId: sub.razorpayCustomerId ?? null,
    razorpaySubscriptionId: sub.razorpaySubscriptionId ?? null,
    currency: sub.currency ?? "INR",
    razorpayKeyId: keyId,
    trialActive,
    hasAccess,
    canActivateTrial,
  });
}