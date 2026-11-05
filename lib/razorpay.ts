import Razorpay from "razorpay";
import crypto from "crypto";

// ── SDK Instance (lazy to avoid crash at build time) ───────────────────────────
let _razorpay: InstanceType<typeof Razorpay> | null = null;
export function getRazorpay(): InstanceType<typeof Razorpay> {
  if (!_razorpay) {
    _razorpay = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }
  return _razorpay;
}
// Keep `razorpay` as a getter for backward compatibility
export const razorpay = new Proxy({} as InstanceType<typeof Razorpay>, {
  get(_target, prop, receiver) {
    return Reflect.get(getRazorpay(), prop, receiver);
  },
});

// ── Constants ───────────────────────────────────────────────────────────────────
export const TRIAL_DAYS = 7;

/** Return the correct Razorpay Plan ID based on currency */
export function getPlanId(currency: "INR" | "USD"): string {
  return currency === "USD"
    ? process.env.RAZORPAY_PLAN_ID_USD!
    : process.env.RAZORPAY_PLAN_ID_INR!;
}

/** Price label used in the UI */
export function priceLabel(currency: "INR" | "USD"): string {
  return currency === "USD" ? "$19/month" : "\u20B9999/month";
}

// ── Signature Verification ──────────────────────────────────────────────────────

/**
 * Verify the payment signature returned by Razorpay Checkout modal.
 * Razorpay signs `razorpay_payment_id|razorpay_subscription_id` with key_secret.
 */
export function verifyPaymentSignature({
  razorpay_subscription_id,
  razorpay_payment_id,
  razorpay_signature,
}: {
  razorpay_subscription_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): boolean {
  const body = `${razorpay_payment_id}|${razorpay_subscription_id}`;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest("hex");
  return timingSafeEqual(expected, razorpay_signature);
}

/**
 * Verify the webhook signature from Razorpay.
 * Razorpay signs the raw request body with the webhook secret.
 */
export function verifyWebhookSignature(
  body: string,
  signature: string
): boolean {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(body)
    .digest("hex");
  return timingSafeEqual(expected, signature);
}

/** Timing-safe string comparison to prevent timing attacks */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf-8"), Buffer.from(b, "utf-8"));
}

// ── Customer lookup ─────────────────────────────────────────────────────────

/** True for Razorpay's "Customer already exists for the merchant" rejection. */
function isDuplicateCustomer(err: unknown): boolean {
  const e = err as { error?: { description?: string } } | undefined;
  return /already exists/i.test(e?.error?.description ?? "");
}

/**
 * The Razorpay customer id for this user, creating one only if needed.
 *
 * Two things make this more than a `customers.create` call.
 *
 *   - `fail_existing` is documented as a STRING flag, so the number 0 the code
 *     used to send was ignored and Razorpay fell back to its default of
 *     failing. The guard the comment described had therefore never worked:
 *     anyone whose email already existed as a customer - a previous attempt, a
 *     restored database, a switch between test and live keys - hit
 *     "Customer already exists for the merchant" on every retry, with no way
 *     through.
 *
 *   - Even with the flag right, a duplicate can still surface, and Razorpay has
 *     no lookup-by-email endpoint. So the fallback pages through the customer
 *     list and matches the address. It is bounded: this is a recovery path, and
 *     a merchant with more customers than this has bigger lookups to build.
 */
export async function getOrCreateCustomerId(
  name: string,
  email: string | undefined,
  userId: string
): Promise<string> {
  try {
    const customer = await razorpay.customers.create({
      name,
      email,
      // A string, per Razorpay's own schema. 0 is silently ignored.
      fail_existing: "0",
      notes: { userId },
    } as unknown as Parameters<typeof razorpay.customers.create>[0]);
    return customer.id;
  } catch (err) {
    if (!isDuplicateCustomer(err) || !email) throw err;

    const wanted = email.toLowerCase();
    for (let skip = 0; skip < 400; skip += 100) {
      const page = (await razorpay.customers.all({ count: 100, skip })) as unknown as {
        items?: Array<{ id: string; email?: string }>;
      };
      const items = page.items ?? [];
      const hit = items.find((c) => c.email?.toLowerCase() === wanted);
      if (hit) return hit.id;
      if (items.length < 100) break;
    }
    throw err;
  }
}
