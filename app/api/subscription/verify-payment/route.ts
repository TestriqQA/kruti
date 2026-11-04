import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { verifyPaymentSignature } from "@/lib/razorpay";
import { redeemPayment } from "@/lib/payment-ledger";
import { startOfCycle } from "@/lib/post-quota";

/**
 * Called by the client after Razorpay modal returns a successful payment.
 * Verifies the signature and activates the subscription.
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const {
    razorpay_subscription_id,
    razorpay_payment_id,
    razorpay_signature,
  } = await req.json();

  if (!razorpay_subscription_id || !razorpay_payment_id || !razorpay_signature) {
    return NextResponse.json(
      { error: "Missing payment verification fields" },
      { status: 400 }
    );
  }

  // Verify Razorpay signature
  const isValid = verifyPaymentSignature({
    razorpay_subscription_id,
    razorpay_payment_id,
    razorpay_signature,
  });

  if (!isValid) {
    console.error("Razorpay payment signature verification failed");
    return NextResponse.json(
      { error: "Invalid payment signature" },
      { status: 400 }
    );
  }

  // Activate subscription in DB
  const currentPeriodEnd = new Date();
  currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);

  // A payment works exactly once - see lib/payment-ledger. The claim and
  // everything below commit as one transaction, so a failure anywhere
  // releases the payment instead of burning it.
  //
  // The status guard inside stays as a second line: it is what still stops a
  // replay from handing the counter back if the ledger is ever unavailable,
  // and a renewal does not come through this route anyway - that arrives as
  // subscription.charged on the webhook, which has its own guard.
  const redemption = await redeemPayment(
    razorpay_payment_id,
    session.user.id,
    async (tx) => {
      const activated = await tx.subscription.updateMany({
        where: { userId: session.user.id, status: { not: "active" } },
        data: {
          razorpaySubscriptionId: razorpay_subscription_id,
          status: "active",
          trialEnd: null,
          currentPeriodEnd,
          // The paid month starts with its full allowance - see startOfCycle.
          ...startOfCycle(),
        },
      });

      if (activated.count === 0) {
        // Already active: the reference and period are still kept current,
        // exactly as before. Only the counter is left alone.
        await tx.subscription.update({
          where: { userId: session.user.id },
          data: {
            razorpaySubscriptionId: razorpay_subscription_id,
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
      { status: 409 }
    );
  }

  console.log(
    `Subscription activated for user ${session.user.id} via Razorpay (${redemption.outcome})`
  );
  return NextResponse.json({ success: true });
}
