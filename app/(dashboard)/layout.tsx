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
import Topbar from "@/components/shell/Topbar";
import CommandPalette from "@/components/shell/CommandPalette";
import ProfileIncompletePopup from "@/components/ProfileIncompletePopup";
import { checkProfileReady } from "@/lib/profile-guard";
import type { ProfileGap } from "@/lib/profile-completeness";

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
  //
  // Guarded on purpose. This runs in the layout shared by EVERY page in the
  // (dashboard) group, so an unhandled throw here does not break a badge - it
  // 500s /dashboard, /posts, /calendar, /analytics, /newsletter, /settings and
  // /support all at once. That is exactly what happened on the first production
  // deploy, where the SupportReply table had been pushed to staging but not to
  // production and Prisma raised P2021.
  //
  // A badge is not worth that blast radius: on failure it degrades to 0 and the
  // user simply sees no count until the next render.
  let supportUnread = 0;
  try {
    supportUnread = await prisma.supportReply.count({
      where: {
        readAt: null,
        // Admin replies only. Counting the user's own replies here would badge
        // their sidebar for messages they wrote themselves.
        authorRole: "admin",
        createdAt: { gte: replyCutoff() },
        ticket: { userId: session.user.id },
      },
    });
  } catch (err) {
    console.error("[dashboard-layout] support unread count failed:", err);
  }

  // Profile gate, surfaced in the UI.
  //
  // The real block is server-side - every generation, image and scheduling
  // route calls checkProfileReady() - so this only explains WHY those buttons
  // stopped working. Without it, a user whose profile fell behind a newly added
  // onboarding input just collects 403s with no idea what changed.
  //
  // Guarded for the same reason as the badge above: this layout is shared by
  // every page in the (dashboard) group, so a failed query must degrade to "no
  // popup", never to seven 500s. The gates still hold if this goes quiet.
  let profileGaps: ProfileGap[] = [];
  // Optimistic default: if the check below fails we show a full ring rather
  // than scaring the user with 0%. The server gates are what actually hold.
  let profileCompletion = 100;
  try {
    const profile = await checkProfileReady(session.user.id);
    profileGaps = profile.gaps;
    profileCompletion = profile.completion;
  } catch (err) {
    console.error("[dashboard-layout] profile readiness check failed:", err);
  }

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
        className="flex h-screen bg-app text-ink antialiased"
      >
        <Sidebar
          user={session.user}
          supportUnread={supportUnread}
          profileCompletion={profileCompletion}
        />
        <main className="flex flex-1 flex-col overflow-y-auto scroll-gutter-stable">
          <Topbar supportUnread={supportUnread} />
          {showTrialBanner && (
            <div className="flex flex-shrink-0 items-center justify-between border-b border-warning/25 bg-warning-soft px-7 py-2.5">
              <p className="text-sm text-warning">
                Your free trial ends in{" "}
                <strong>{state.daysLeft} day{state.daysLeft !== 1 ? "s" : ""}</strong>.
                Don&apos;t lose your content!
              </p>
              <Link
                href="/subscribe"
                className="ml-4 flex-shrink-0 text-sm font-semibold text-warning underline underline-offset-2 hover:opacity-80"
              >
                Subscribe now
              </Link>
            </div>
          )}
          {/* max-w-7xl, matching the admin shell. The dashboard was capped a
              size narrower at 6xl, which left visible dead space either side on
              any normal laptop screen. */}
          <div className="mx-auto w-full max-w-7xl flex-1 px-7 py-7">{children}</div>
          <footer className="flex-shrink-0 border-t border-line px-7 py-3">
            <nav className="flex justify-center gap-4">
              <Link href="/privacy" className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Privacy</Link>
              <Link href="/terms" className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Terms</Link>
              <Link href="/refund" className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Refunds</Link>
              <Link href="/cookies" className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Cookies</Link>
            </nav>
          </footer>
        </main>
      </div>

      {/* Cmd/Ctrl+K from anywhere in the dashboard. */}
      <CommandPalette />

      {/* Trial over, or subscription lapsed: nothing behind this is clickable. */}
      {state.locked && <SubscriptionLock reason={lockReason(state.status)} />}

      {/* Final 24 hours of the trial: dismissible nudge, access unaffected. */}
      {!state.locked && state.isLastDay && <TrialEndingPopup hoursLeft={hoursLeft} />}

      {/* Onboarding asks for something this account does not have yet: post
          writing, images and scheduling are paused server-side until it is
          filled in. Suppressed behind the paywall, which is the bigger problem
          and already tells the user what to do. */}
      {!state.locked && <ProfileIncompletePopup gaps={profileGaps} />}
    </>
  );
}
