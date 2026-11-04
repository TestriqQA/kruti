import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { startOfCycle } from "@/lib/post-quota";

// Auto-detect dev mode: bypasses payment only when Razorpay keys are missing
const DEV_MODE =
  !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
  !process.env.RAZORPAY_KEY_SECRET ||
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID === "rzp_test_REPLACE_ME";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse optional currency from body (default INR)
  let currency: "INR" | "USD" = "INR";
  try {
    const body = await req.json();
    if (body.currency === "USD") currency = "USD";
  } catch {
    // no body → default INR
  }

  // ── DEV BYPASS ─────────────────────────────────────────────────────────────
  // When Razorpay keys are not configured, immediately activate the subscription
  // so the full app flow can be tested without a real payment gateway.
  if (DEV_MODE) {
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setFullYear(currentPeriodEnd.getFullYear() + 1);

    await prisma.subscription.upsert({
      where: { userId: session.user.id },
      update: {
        status: "active",
        trialEnd: null,
        currentPeriodEnd,
        currency,
        ...startOfCycle(),
      },
      create: {
        userId: session.user.id,
        status: "active",
        currentPeriodEnd,
        currency,
        ...startOfCycle(),
      },
    });

    console.log(`[DEV] Subscription activated for user ${session.user.id}`);
    return NextResponse.json({
      dev: true,
      redirectUrl: `${process.env.NEXTAUTH_URL ?? "http://localhost:3002"}/dashboard?subscribed=true`,
    });
  }
  // ── END DEV BYPASS ─────────────────────────────────────────────────────────

  try {
    const { razorpay, getPlanId } = await import("@/lib/razorpay");

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { subscription: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create or retrieve Razorpay Customer
    let customerId = user.subscription?.razorpayCustomerId;
    if (!customerId) {
      // fail_existing: 0 → if a Razorpay customer with this email already
      // exists (e.g. from a previous checkout attempt), reuse it instead of
      // throwing "Customer already exists" and failing every retry.
      const customer = await razorpay.customers.create({
        name: user.name ?? "User",
        email: user.email ?? undefined,
        fail_existing: 0,
        notes: { userId: session.user.id },
      } as Parameters<typeof razorpay.customers.create>[0]);
      customerId = customer.id;

      // Upsert subscription row with customer ID
      if (user.subscription) {
        await prisma.subscription.update({
          where: { userId: session.user.id },
          data: { razorpayCustomerId: customerId, currency },
        });
      } else {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 7);
        await prisma.subscription.create({
          data: {
            userId: session.user.id,
            razorpayCustomerId: customerId,
            status: "trialing",
            trialEnd,
            currency,
          },
        });
      }
    }

    // Create Razorpay Subscription
    const planId = getPlanId(currency);
    console.log(`[Checkout] Creating subscription with planId=${planId}, customerId=${customerId}, currency=${currency}`);

    // customer_id is NOT a valid input to subscriptions.create - Razorpay links the
    // customer when the payer authorises in the checkout modal (it is auto-populated
    // on the subscription afterwards). total_count 120 (10y) is within Razorpay's
    // monthly cap of 1200, so it is fine as-is.
    const subscription = await razorpay.subscriptions.create({
      plan_id: planId,
      total_count: 120, // 10 years of monthly billing (Razorpay monthly cap: 1200)
      customer_notify: 1,
      notes: { userId: session.user.id, currency },
    } as Parameters<typeof razorpay.subscriptions.create>[0]);

    // Store the subscription + plan info. If this DB write fails we must NOT fail the
    // request: the Razorpay subscription already exists, so still return its id and let
    // verify-payment / the webhook reconcile the record. Otherwise a DB hiccup would
    // 500 the route and the checkout modal would never open.
    try {
      await prisma.subscription.update({
        where: { userId: session.user.id },
        data: {
          razorpaySubscriptionId: subscription.id,
          razorpayPlanId: planId,
          currency,
        },
      });
    } catch (dbErr) {
      console.error("[Checkout] Could not persist subscription id (continuing):", dbErr);
    }

    return NextResponse.json({
      subscriptionId: subscription.id,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (err: any) {
    console.error("[Checkout] Razorpay error:", err?.message ?? err, JSON.stringify(err?.error ?? {}));
    return NextResponse.json(
      { error: err?.message ?? "Payment checkout failed", details: err?.error?.description ?? null },
      { status: 500 }
    );
  }
}
