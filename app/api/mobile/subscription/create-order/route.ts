/**
 * POST /api/mobile/subscription/create-order
 *
 * Creates a Razorpay ONE-TIME ORDER (not a recurring Subscription) for
 * ₹999 / $19. The user pays once. The verify route then activates the
 * DB subscription for 1 month. After that month, the user must come
 * back and pay again manually — there is NO auto-charge. This matches
 * the product decision: "user khudse renew karega, auto cut nahi hai".
 *
 * Why orders, not subscriptions:
 *   - Razorpay Subscriptions require eMandate / recurring-card setup,
 *     which our test-mode account isn't enabled for and (per product
 *     decision) we don't actually want.
 *   - Razorpay Orders work out of the box on every account, with every
 *     test card, in both test and live mode. No activation needed.
 *
 * Auth: Bearer JWT (mobile).
 *
 * Place at: app/api/mobile/subscription/create-order/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

// Amounts in paise — Razorpay's smallest currency unit.
const AMOUNT_INR_PAISE = 99900; //  ₹999.00
const AMOUNT_USD_CENTS = 1900; //  $19.00

const DEV_MODE =
  !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
  !process.env.RAZORPAY_KEY_SECRET ||
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID === "rzp_test_REPLACE_ME";

export async function POST(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Optional currency in body, default INR.
  let currency: "INR" | "USD" = "INR";
  try {
    const body = await req.json();
    if (body?.currency === "USD") currency = "USD";
  } catch {
    /* no body — default INR */
  }

  // ── DEV BYPASS (only when keys are placeholders) ──
  if (DEV_MODE) {
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);

    await prisma.subscription.upsert({
      where: { userId },
      update: {
        status: "active",
        trialEnd: null,
        currentPeriodEnd,
        currency,
      },
      create: {
        userId,
        status: "active",
        currentPeriodEnd,
        currency,
      },
    });

    console.log(`[mobile/create-order DEV] activated for user ${userId}`);
    return NextResponse.json({ dev: true, success: true });
  }

  try {
    const { razorpay } = await import("@/lib/razorpay");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      // Stale token (user deleted) — tell the client to re-authenticate.
      return NextResponse.json(
        { error: "Session expired. Please sign in again.", code: "USER_NOT_FOUND" },
        { status: 401 },
      );
    }

    const amount = currency === "USD" ? AMOUNT_USD_CENTS : AMOUNT_INR_PAISE;

    // ── Create a one-time Razorpay Order ──
    // Orders API doesn't need a customer record, doesn't need a plan,
    // doesn't need eMandate. Razorpay just takes a one-shot payment for
    // the amount + currency. This is what makes it work everywhere.
    const order = await razorpay.orders.create({
      amount,
      currency,
      receipt: `kruti_${userId}_${Date.now()}`.slice(0, 40),
      notes: { userId, source: "mobile", purpose: "content_pro_monthly" },
    } as Parameters<typeof razorpay.orders.create>[0]);

    console.log(
      `[mobile/create-order] order=${order.id} amount=${amount} ${currency} user=${userId}`,
    );

    // Persist the order id so the verify route can sanity-check it.
    // We store it in razorpaySubscriptionId because the existing schema
    // doesn't have a dedicated razorpayOrderId column — the field is
    // just an opaque Razorpay reference either way.
    await prisma.subscription.upsert({
      where: { userId },
      update: {
        razorpaySubscriptionId: order.id,
        currency,
        status: "none", // verify-route flips to "active" on payment.
      },
      create: {
        userId,
        razorpaySubscriptionId: order.id,
        currency,
        status: "none",
      },
    });

    return NextResponse.json({
      orderId: order.id,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount,
      currency,
      name: user.name ?? "User",
      email: user.email ?? "",
    });
  } catch (err: any) {
    console.error(
      "[mobile/create-order] Razorpay error:",
      err?.message ?? err,
      JSON.stringify(err?.error ?? {}),
    );
    return NextResponse.json(
      {
        // Generic to the client. "details" below is Razorpay's own
        // user-facing description, which is safe and useful; err.message
        // is not, so it stays in the log only.
        error: "Payment checkout failed",
        details: err?.error?.description ?? null,
      },
      { status: 500 },
    );
  }
}