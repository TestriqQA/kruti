import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import { getSubscriptionState } from "@/lib/subscription-check";
import { prisma } from "@/lib/prisma";
import { replyCutoff } from "@/lib/support";
import SubscriptionLock from "@/components/SubscriptionLock";
import TrialEndingPopup from "@/components/TrialEndingPopup";

/** What the paywall says, depending on how the user lost access. */
function lockReason(status: string): string {
  switch (status) {
    case "trialing":
      return "Your 7-day free trial has ended. Subscribe to get back to your posts, images and scheduling.";
    case "canceled":
      return "Your subscription was cancelled. Resubscribe to pick up where you left off.";
    case "past_due":
    case "unpaid":
      return "We couldn't process your last payment. Renew your subscription to continue.";
    default:
      return "You need an active subscription to use Kruti.io.";
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // Authoritative entitlement check, straight from the database. Middleware only
  // sees the cookie claims, which can lag behind; this is what actually decides
  // whether the UI gets locked.
  const state = await getSubscriptionState(session.user.id);

  // Unread admin replies that have not expired yet - drives the sidebar badge so
  // the user notices a reply without having to open /support.
  const supportUnread = await prisma.supportReply.count({
    where: {
      readAt: null,
      createdAt: { gte: replyCutoff() },
      ticket: { userId: session.user.id },
    },
  });

  const showTrialBanner =
    state.status === "trialing" &&
    !state.locked &&
    !state.isLastDay &&
    state.daysLeft !== null &&
    state.daysLeft <= 3;

  const hoursLeft = state.trialEnd
    ? Math.max(0, (state.trialEnd.getTime() - Date.now()) / 3600000)
    : 0;

  return (
    <>
      {/* id is how SubscriptionLock marks everything behind it inert */}
      <div
        id="app-shell"
        className="flex h-screen bg-[#F6F8FB] text-slate-900 antialiased dark:bg-[#0A0E14] dark:text-slate-100"
      >
        <Sidebar user={session.user} supportUnread={supportUnread} />
        <main className="flex-1 overflow-y-auto scroll-gutter-stable flex flex-col">
          {showTrialBanner && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50 px-6 py-2.5 flex items-center justify-between flex-shrink-0">
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Your free trial ends in{" "}
                <strong>{state.daysLeft} day{state.daysLeft !== 1 ? "s" : ""}</strong>.
                Don&apos;t lose your content!
              </p>
              <Link
                href="/subscribe"
                className="text-sm font-semibold text-amber-900 dark:text-amber-200 underline hover:text-amber-700 dark:hover:text-amber-100 ml-4 flex-shrink-0"
              >
                Subscribe now
              </Link>
            </div>
          )}
          <div className="flex-1 max-w-6xl mx-auto w-full p-6">{children}</div>
          <footer className="flex-shrink-0 border-t border-slate-200 dark:border-white/10 px-6 py-3">
            <nav className="flex justify-center gap-4">
              <Link href="/privacy" className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Privacy</Link>
              <Link href="/terms" className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Terms</Link>
              <Link href="/refund" className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Refunds</Link>
              <Link href="/cookies" className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Cookies</Link>
            </nav>
          </footer>
        </main>
      </div>

      {/* Trial over, or subscription lapsed: nothing behind this is clickable. */}
      {state.locked && <SubscriptionLock reason={lockReason(state.status)} />}

      {/* Final 24 hours of the trial: dismissible nudge, access unaffected. */}
      {!state.locked && state.isLastDay && <TrialEndingPopup hoursLeft={hoursLeft} />}
    </>
  );
}
