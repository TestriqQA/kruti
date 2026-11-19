/**
 * POST /api/mobile/subscription/verify
 *
 * Verifies a Razorpay ORDER payment (not a subscription payment).
 * Razorpay signs `${order_id}|${payment_id}` with the key secret;
 * we recompute that HMAC and compare. If it matches, we activate the
 * user's DB subscription for one month.
 *
 * Body:
 *   razorpay_order_id     — required
 *   razorpay_payment_id   — required
 *   razorpay_signature    — required
 *
 *   (We also accept razorpay_subscription_id as an alias for
 *   razorpay_order_id, so older clients don't break during rollout.)
 *
 * Auth: Bearer JWT (mobile).
 *
 * Place at: app/api/mobile/subscription/verify/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getMobileUserId } from "@/lib/mobileAuth";
import { redeemPayment } from "@/lib/payment-ledger";
import { startOfCycle } from "@/lib/post-quota";

export async function POST(req: NextRequest) {
  const userId = await getMobileUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const razorpay_order_id: string =
    body?.razorpay_order_id || body?.razorpay_subscription_id || "";
  const razorpay_payment_id: string = body?.razorpay_payment_id || "";
  const razorpay_signature: string = body?.razorpay_signature || "";

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json(
      { error: "Missing payment verification fields" },
      { status: 400 },
    );
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) {
    console.error("[mobile/verify] RAZORPAY_KEY_SECRET missing");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  }

  // Razorpay order signature = HMAC_SHA256(order_id|payment_id, secret).
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  // Timing-safe compare.
  const a = Buffer.from(expected, "utf-8");
  const b = Buffer.from(razorpay_signature, "utf-8");
  const isValid =
    a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!isValid) {
    console.error(
      "[mobile/verify] signature mismatch for user",
      userId,
      "order",
      razorpay_order_id,
    );
    return NextResponse.json(
      { error: "Invalid payment signature" },
      { status: 400 },
    );
  }

  // Activate. One billing cycle = +1 month. After that the user has to
  // come back and pay again (no auto-charge — that's the product call).
  const currentPeriodEnd = new Date();
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

  // A payment works exactly once - see lib/payment-ledger. The claim and
  // everything below commit as one transaction, so a failure anywhere
  // releases the payment instead of burning it.
  //
  // The status guard inside stays as a second line, for the case where the
  // ledger is unavailable. It does not get in the way of a real second
  // month: create-order writes status "none" before each new payment.
  const redemption = await redeemPayment(
    razorpay_payment_id,
    userId,
    async (tx) => {
      const activated = await tx.subscription.updateMany({
        where: { userId, status: { not: "active" } },
        data: {
          razorpaySubscriptionId: razorpay_order_id, // store order id here
          status: "active",
          trialEnd: null,
          currentPeriodEnd,
          // Mobile is one order per month, so every payment that reaches here
          // buys a new cycle and gets a full allowance - not only the first.
          ...startOfCycle(),
        },
      });

      if (activated.count === 0) {
        // Already active: the order reference and period are still kept
        // current, exactly as before. Only the counter is left alone.
        await tx.subscription.update({
          where: { userId },
          data: {
            razorpaySubscriptionId: razorpay_order_id,
            status: "active",
            trialEnd: null,
            currentPeriodEnd,
          },
        });
      }
    }
  );

  // Only a DIFFERENT account reusing this payment is refused. The same user
  // sending it twice is a retry, and they are already subscribed.
  if (redemption.outcome === "taken") {
    return NextResponse.json(
      { error: "This payment has already been used on another account." },
      { status: 409 },
    );
  }

  console.log(
    `[mobile/verify] activated user=${userId} order=${razorpay_order_id} until=${currentPeriodEnd.toISOString()} (${redemption.outcome})`,
  );
  return NextResponse.json({
    success: true,
    currentPeriodEnd: currentPeriodEnd.toISOString(),
  });
}