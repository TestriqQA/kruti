import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUserId } from "@/lib/mobileAuth";
import { razorpay } from "@/lib/razorpay";

/**
 * GET /api/mobile/subscription/invoices
 *
 * Payment history from Razorpay, shaped the same way the website's
 * /api/subscription/invoices shapes it.
 *
 * Every failure path returns an empty list rather than an error: a billing
 * history screen that cannot reach Razorpay should show "no invoices yet", not
 * break. The detail goes to the log.
 */

const DEV_MODE =
  !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
  !process.env.RAZORPAY_KEY_SECRET ||
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID === "rzp_test_REPLACE_ME";

export async function GET(req: NextRequest) {
  try {
    const userId = await getMobileUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sub = await prisma.subscription.findUnique({
      where: { userId },
      select: { razorpaySubscriptionId: true },
    });

    if (!sub?.razorpaySubscriptionId || DEV_MODE) {
      return NextResponse.json({ invoices: [] });
    }

    const payments = await (razorpay.payments as any).all({
      subscription_id: sub.razorpaySubscriptionId,
      count: 50,
    });

    const invoices = (payments.items || []).map((p: any) => ({
      id: p.id,
      date: p.created_at ? new Date(p.created_at * 1000).toISOString() : null,
      amount: p.amount ? p.amount / 100 : 0,
      currency: p.currency || "INR",
      status: p.status,
      method: p.method,
      invoiceId: p.invoice_id,
    }));

    return NextResponse.json({ invoices });
  } catch (err) {
    console.error("[mobile/subscription/invoices] failed:", err);
    return NextResponse.json({ invoices: [] });
  }
}
