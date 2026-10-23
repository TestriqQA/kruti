import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";

/**
 * POST /api/mobile/subscription/cancel
 *
 * Cancels at the end of the current billing cycle, exactly as the website's
 * /api/subscription/cancel does - the user keeps access until the period ends,
 * and the status only becomes "cancelled" when Razorpay's webhook fires.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getMobileUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sub = await prisma.subscription.findUnique({
      where: { userId },
      select: { razorpaySubscriptionId: true },
    });

    if (!sub?.razorpaySubscriptionId) {
      return NextResponse.json(
        { error: "No active Razorpay subscription found" },
        { status: 400 },
      );
    }

    const hasKeys =
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID &&
      process.env.RAZORPAY_KEY_SECRET &&
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID !== "rzp_test_REPLACE_ME";

    if (hasKeys) {
      try {
        const { razorpay } = await import("@/lib/razorpay");
        // Second argument is cancel_at_cycle_end.
        await razorpay.subscriptions.cancel(sub.razorpaySubscriptionId, true);
      } catch (err) {
        console.error("[mobile/subscription/cancel] Razorpay error:", err);
        return NextResponse.json(
          { error: "Failed to cancel subscription with Razorpay" },
          { status: 500 },
        );
      }
    }

    // cancel_pending, not cancelled: the real transition happens on the webhook
    // when the cycle ends, and the user retains access until then.
    await prisma.subscription.update({
      where: { userId },
      data: { status: "cancel_pending" },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[mobile/subscription/cancel] failed:", err);
    return NextResponse.json({ error: "Could not cancel subscription" }, { status: 500 });
  }
}
