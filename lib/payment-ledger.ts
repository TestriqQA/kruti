import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * One payment, one activation.
 *
 * Razorpay hands the client three values as proof of payment - an order id, a
 * payment id and a signature - and the verification routes check that the
 * signature is genuine before activating the subscription. What they never did
 * was record that a payment had been used, so a valid payload stayed valid
 * forever: anyone who kept those three values could send them again next month
 * and get another paid month, and (once activation began resetting the post
 * counter) another 30 posts with it.
 *
 * This is the missing half. A payment id is claimed in a row whose key is the
 * table's PRIMARY KEY, so the second claim is refused by Postgres rather than
 * by application logic - two simultaneous replays cannot both win.
 *
 * Two details matter more than the claim itself.
 *
 *   - The claim and the activation commit TOGETHER. If the row were written
 *     first and the activation then failed, the payment would be burnt with
 *     nothing to show for it and the retry would be refused - a paying customer
 *     locked out, which is worse than the replay this prevents. Inside one
 *     transaction a failure rolls the claim back and the retry works.
 *
 *   - A repeat by the SAME user is success, not an error. A flaky network, a
 *     double tap on the payment sheet or an app retry all arrive as a second
 *     call with the same payment id, and the honest answer to those is "you are
 *     already subscribed". Only a repeat by a DIFFERENT account is refused.
 *
 * The rows live in AppSetting, which is already a keyed string store (one
 * feature flag uses it today) and already exists in every environment, so
 * closing this needed no schema change and no migration against a shared
 * database. It is a pragmatic home rather than a textbook one: the key prefix
 * keeps the rows obvious, and moving them to a dedicated table later is a small
 * change that can be planned on its own instead of riding along with a fix.
 */

const KEY_PREFIX = "redeemed:payment:";

/** The AppSetting key a payment is claimed under. */
export function redeemedPaymentKey(paymentId: string): string {
  return `${KEY_PREFIX}${paymentId}`;
}

export type Redemption =
  /** Claimed just now, and the activation committed with it. */
  | { outcome: "claimed" }
  /** This same user already redeemed it: a retry. The caller should succeed. */
  | { outcome: "already-redeemed" }
  /** A different account redeemed it. The caller must refuse. */
  | { outcome: "taken" }
  /**
   * The ledger table was not there, so nothing could be recorded. The
   * activation still ran - a missing table must never cost a paying customer
   * their subscription - and the route's own guards are what protect it.
   */
  | { outcome: "unrecorded" };

/** Prisma error codes arrive on the error object; read it without instanceof. */
function errorCode(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null || !("code" in err)) return undefined;
  const code = (err as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Claim `paymentId` for `userId` and run `activate` in the same transaction.
 *
 * `activate` receives the transaction client and must do all of its writes
 * through it, so that a failure anywhere unwinds the claim as well.
 */
export async function redeemPayment(
  paymentId: string,
  userId: string,
  activate: (tx: Prisma.TransactionClient) => Promise<void>
): Promise<Redemption> {
  const key = redeemedPaymentKey(paymentId);

  try {
    return await prisma.$transaction(async (tx) => {
      // First, because it is the cheap test. On a repeat this throws and the
      // activation below never runs.
      await tx.appSetting.create({ data: { key, value: userId } });
      await activate(tx);
      return { outcome: "claimed" as const };
    });
  } catch (err) {
    const code = errorCode(err);

    // P2002 - the key is taken, so this payment has been redeemed before.
    // Whether that is a retry or a replay depends on who holds it.
    if (code === "P2002") {
      const held = await prisma.appSetting.findUnique({ where: { key } });
      if (held?.value === userId) return { outcome: "already-redeemed" };
      console.error(
        `[payments] payment ${paymentId} was redeemed by another account; refused for user ${userId}`
      );
      return { outcome: "taken" };
    }

    // P2021 - the table does not exist in this environment. Refusing every
    // activation over a bookkeeping table would turn a hardened route into an
    // outage, so the activation runs and the gap is logged loudly instead.
    if (code === "P2021") {
      console.error(
        "[payments] AppSetting table is missing: payments cannot be recorded as " +
          "redeemed and replay protection is OFF in this environment. Activation " +
          "proceeded so the customer is not left unpaid-for."
      );
      await prisma.$transaction(async (tx) => {
        await activate(tx);
      });
      return { outcome: "unrecorded" };
    }

    // Anything else is a real failure. Nothing was committed; let it 500 so the
    // client retries rather than quietly leaving the user unactivated.
    throw err;
  }
}
