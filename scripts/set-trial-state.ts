/**
 * Flip a user's subscription into a given state, to exercise the paywall.
 *
 *   npx dotenv -e .env.local -- node scripts/set-trial-state.ts <email> <state>
 *
 * States:
 *   expired   - trialing, trialEnd yesterday      -> dashboard locked
 *   lastday   - trialing, trialEnd in 12 hours    -> final-day popup
 *   trial     - trialing, trialEnd in 7 days      -> normal trial
 *   soon      - trialing, trialEnd in 3 days      -> amber banner
 *   canceled  - status canceled                   -> dashboard locked
 *   past_due  - status past_due                   -> dashboard locked
 *   pending   - status cancel_pending             -> NOT locked (paid period)
 *   active    - status active                     -> normal paid access
 *
 * NOTE: users on a lifetime-free email domain (testriq.com, cinutedigital.com)
 * and users with role "admin" bypass every check, so the paywall will not appear
 * for them no matter what this script sets. Use a different test account.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type State =
  | "expired"
  | "lastday"
  | "trial"
  | "soon"
  | "canceled"
  | "past_due"
  | "pending"
  | "active";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function dataFor(state: State) {
  const now = Date.now();
  switch (state) {
    case "expired":
      return { status: "trialing", trialEnd: new Date(now - DAY) };
    case "lastday":
      return { status: "trialing", trialEnd: new Date(now + 12 * HOUR) };
    case "trial":
      return { status: "trialing", trialEnd: new Date(now + 7 * DAY) };
    case "soon":
      return { status: "trialing", trialEnd: new Date(now + 3 * DAY) };
    case "canceled":
      return { status: "canceled", trialEnd: new Date(now - DAY) };
    case "past_due":
      return { status: "past_due", trialEnd: null };
    case "pending":
      return { status: "cancel_pending", trialEnd: null };
    case "active":
      return { status: "active", trialEnd: null };
  }
}

async function main() {
  const [email, state] = process.argv.slice(2) as [string, State];

  if (!email || !state || !dataFor(state)) {
    console.error(
      "Usage: node scripts/set-trial-state.ts <email> <expired|lastday|trial|soon|canceled|past_due|pending|active>"
    );
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });
  if (!user) {
    console.error(`User ${email} not found (they must have signed in at least once).`);
    process.exit(1);
  }

  const domain = email.split("@")[1]?.toLowerCase();
  if (user.role === "admin" || ["testriq.com", "cinutedigital.com"].includes(domain ?? "")) {
    console.warn(
      `WARNING: ${email} is ${user.role === "admin" ? "an admin" : "on a lifetime-free domain"} - ` +
        "it bypasses all subscription checks, so the paywall will NOT appear."
    );
  }

  const data = dataFor(state);
  const sub = await prisma.subscription.upsert({
    where: { userId: user.id },
    update: data,
    create: { userId: user.id, currency: "INR", ...data },
  });

  console.log(`${email} -> status=${sub.status} trialEnd=${sub.trialEnd?.toISOString() ?? "null"}`);
  console.log("Reload /dashboard to see the effect.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
