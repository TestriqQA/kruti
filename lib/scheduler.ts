import { prisma } from "@/lib/prisma";
import { postToLinkedIn } from "@/lib/linkedin-post";
import { getTokenStatus, refreshAccessToken } from "@/lib/linkedin-token";
import {
  sendNewsletterEmail,
  sendTrialReminderEmail,
  sendProfileUpdateEmail,
  type NewsletterContent,
} from "@/lib/email";
import { cleanupOldImages } from "@/lib/image-cleanup";
import { replyCutoff } from "@/lib/support";
import { assessProfile, PROFILE_REQUIREMENTS_VERSION } from "@/lib/profile-completeness";
import { PROFILE_SELECT } from "@/lib/profile-guard";
// The window below and what the UI calls "missed" have to be the same number,
// or a surface would promise a publish the cron has already given up on.
import { AUTO_POST_STALE_MS } from "@/lib/post-schedule";
// One rule for "may a job act for this account", shared with the request-time
// check. Spelling the status list out in each job is what hid an admin's posts.
import { ENTITLED_USER_FILTER } from "@/lib/subscription-check";

// ─── Auto-Post Job ──────────────────────────────────────────────────────────
// Publishes posts with status "ready" whose time has come. Run every minute by
// Vercel Cron, and it never publishes before the time the user set - together
// that keeps "Auto-Publish Date & Time" honest to about a minute.
//
// One post per run, on purpose, so two never land on a feed together; a backlog
// therefore drains at one a minute. Posts more than 72 hours past their time are
// skipped for good - see AUTO_POST_STALE_MS in lib/post-schedule.ts, which is
// also what the UI calls "Missed".
// How many due posts to consider in one run. Only ever ONE is published; the
// rest are candidates in case the first few are held back by the profile gate.
const AUTO_POST_CANDIDATES = 20;

export async function runAutoPost(): Promise<{
  posted: number;
  failed: number;
  skippedStale: number;
  skippedIncompleteProfile: number;
}> {
  let posted = 0;
  let failed = 0;
  let skippedStale = 0;
  let skippedIncompleteProfile = 0;

  const now = new Date();
  // No look-ahead. It used to be now + 5 minutes, to match a cron that only ran
  // every 5 minutes - which meant a post set for 15:40 could go out at 15:35.
  // The editor calls this field "Auto-Publish Date & Time", so publishing BEFORE
  // it is worse than publishing a little after. The cron runs every minute now,
  // so "a little after" is at most about a minute.
  const staleThreshold = new Date(now.getTime() - AUTO_POST_STALE_MS);

  // Over-fetched on purpose. The profile gate below runs in JS - completeness
  // is not expressible as a Prisma filter - so fetching a single row would let
  // one user whose profile fell behind a newly added onboarding input wedge the
  // whole queue: their post would be skipped and nobody else's would go out.
  const candidates = await prisma.post.findMany({
    where: {
      status: "ready",
      postedToLinkedIn: false,
      scheduledAt: {
        gte: staleThreshold, // Skip posts older than 72 hours
        lte: now,            // Due now or overdue - never before its time
      },
      plan: {
        user: ENTITLED_USER_FILTER,
      },
    },
    include: { plan: { include: { user: { select: PROFILE_SELECT } } } },
    orderBy: { scheduledAt: "asc" },
    take: AUTO_POST_CANDIDATES,
  });

  // Profile gate, the same rule the generation and scheduling routes apply.
  //
  // A post can be armed under one set of onboarding requirements and only come
  // due after a new input has shipped. Publishing it anyway would put content on
  // the user's LinkedIn that we have already told them is too generic to
  // generate - so it waits, untouched, until they finish their profile. Nothing
  // is lost: the row keeps its scheduledAt and goes out on a later cycle, and
  // the 72-hour stale window above is what eventually retires it.
  //
  // Still at most ONE post per run, so two posts never publish together; any
  // backlog drains one post per 5-min cron cycle.
  const duePosts: typeof candidates = [];
  for (const candidate of candidates) {
    if (!assessProfile(candidate.plan.user).complete) {
      skippedIncompleteProfile++;
      continue;
    }
    duePosts.push(candidate);
    break;
  }

  if (skippedIncompleteProfile > 0) {
    console.warn(
      `[Cron:auto-post] ⚠️ ${skippedIncompleteProfile} post(s) held back - profile incomplete`
    );
  }

  if (duePosts.length > 0) {
    console.log(`[Cron:auto-post] Found ${duePosts.length} post(s) due for publishing`);
  }

  // Also log stale posts that are being permanently skipped
  const stalePosts = await prisma.post.count({
    where: {
      status: "ready",
      postedToLinkedIn: false,
      scheduledAt: { lt: staleThreshold },
    },
  });
  if (stalePosts > 0) {
    skippedStale = stalePosts;
    console.warn(`[Cron:auto-post] ⚠️ ${stalePosts} post(s) skipped - scheduled more than 72 hours ago`);
  }

  for (const post of duePosts) {
    // Claim the row before doing anything slow with it.
    //
    // This job had no claim at all, which was survivable while it ran every
    // five minutes and a publish took seconds. It is not survivable now that it
    // runs every minute: the route is capped at 60s but Vercel starts the next
    // invocation on schedule regardless, so a slow publish - a carousel PDF, a
    // large image, LinkedIn being slow - leaves two runs selecting the same row
    // and posting it to the member's feed twice.
    //
    // updateMany with the guard in its WHERE is what makes this atomic: the
    // second run matches zero rows and moves on. Same pattern the website and
    // mobile publish routes already use.
    const claimed = await prisma.post.updateMany({
      where: { id: post.id, postedToLinkedIn: false, status: "ready" },
      data: { status: "publishing" },
    });
    if (claimed.count === 0) {
      console.log(`[Cron:auto-post] ${post.id} already claimed by another run - skipping`);
      continue;
    }

    console.log(`[Cron:auto-post] Posting ${post.id} for user ${post.plan.userId}`);
    try {
      const result = await postToLinkedIn(post.plan.userId, {
        title: post.title,
        body: post.body,
        hashtags: post.hashtags,
        imageUrl: post.imageUrl,
        carouselImages: post.carouselImages ? (JSON.parse(post.carouselImages) as string[]) : null,
        documentUrl: post.documentUrl,
        documentName: post.documentName,
      });

      await prisma.post.update({
        where: { id: post.id },
        data: {
          postedToLinkedIn: result.success,
          linkedinPostId: result.linkedinPostId ?? undefined,
          // Back to "ready" on failure, because the claim above moved it to
          // "publishing" and only "ready" is ever selected again.
          status: result.success ? "published" : "ready",
          postError: result.error ?? null,
        },
      });

      if (result.success) {
        posted++;
        console.log(`[Cron:auto-post] ✅ Posted ${post.id} → ${result.linkedinPostId}`);
      } else {
        failed++;
        console.error(`[Cron:auto-post] ❌ Failed ${post.id}: ${result.error}`);
      }
    } catch (err) {
      // Without this the row stays "publishing" for good: every later run skips
      // it because it only selects "ready", and nothing ever reports it either.
      failed++;
      console.error(`[Cron:auto-post] ❌ Threw while posting ${post.id}:`, err);
      await prisma.post.updateMany({
        where: { id: post.id, status: "publishing" },
        data: {
          status: "ready",
          postError: "Publishing was interrupted. It will be retried automatically.",
        },
      });
    }
  }

  return { posted, failed, skippedStale, skippedIncompleteProfile };
}

// ─── Newsletter Send Job ─────────────────────────────────────────────────────
// Finds newsletters scheduled within the next 60 seconds and sends them.
export async function runNewsletterSend(): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const now = new Date();
  const windowEnd = new Date(now.getTime() + 60 * 1000);

  const dueNewsletters = await prisma.newsletter.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { gte: now, lt: windowEnd },
      // Was ["active", "trialing"], which also dropped cancel_pending - so a
      // user who cancelled kept getting posts published but silently stopped
      // getting the newsletters they had paid through the period for.
      user: ENTITLED_USER_FILTER,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (dueNewsletters.length > 0) {
    console.log(`[Cron:newsletter] Found ${dueNewsletters.length} newsletter(s) due`);
  }

  for (const nl of dueNewsletters) {
    if (!nl.user.email) {
      console.error(`[Cron:newsletter] No email for newsletter ${nl.id}`);
      continue;
    }

    let content: NewsletterContent;
    try {
      content = JSON.parse(nl.body) as NewsletterContent;
    } catch {
      console.error(`[Cron:newsletter] Invalid newsletter body for ${nl.id}`);
      continue;
    }

    const result = await sendNewsletterEmail({
      to: nl.user.email,
      authorName: nl.user.name ?? "Author",
      content,
    });

    await prisma.newsletter.update({
      where: { id: nl.id },
      data: {
        status: result.success ? "sent" : "scheduled",
        ...(result.success ? { scheduledAt: null } : {}),
      },
    });

    if (result.success) {
      sent++;
      console.log(`[Cron:newsletter] ✅ Sent ${nl.id} to ${nl.user.email}`);
    } else {
      failed++;
      console.error(`[Cron:newsletter] ❌ Failed ${nl.id}: ${result.error}`);
    }
  }

  return { sent, failed };
}

// ─── Trial Reminder Job ──────────────────────────────────────────────────────
// Sends trial reminder emails at 3-day, 1-day, and 0-day milestones.
export async function runTrialReminders(): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  const now = new Date();

  const trialingSubs = await prisma.subscription.findMany({
    where: {
      status: "trialing",
      trialEnd: { not: null },
    },
    include: {
      user: { select: { email: true, name: true } },
    },
  });

  for (const sub of trialingSubs) {
    if (!sub.trialEnd || !sub.user.email) continue;

    const daysLeft = Math.ceil(
      (sub.trialEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );
    const alreadySent = sub.trialRemindersSent.split(",").filter(Boolean);

    let reminderTag: string | null = null;
    let daysRemaining: number | null = null;

    if (daysLeft <= 0 && !alreadySent.includes("0d")) {
      reminderTag = "0d";
      daysRemaining = 0;
    } else if (daysLeft === 1 && !alreadySent.includes("1d")) {
      reminderTag = "1d";
      daysRemaining = 1;
    } else if (daysLeft <= 3 && daysLeft > 1 && !alreadySent.includes("3d")) {
      reminderTag = "3d";
      daysRemaining = 3;
    }

    if (reminderTag !== null && daysRemaining !== null) {
      const subscribeUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3002"}/subscribe`;

      const result = await sendTrialReminderEmail({
        to: sub.user.email,
        userName: sub.user.name?.split(" ")[0] || "there",
        daysRemaining,
        subscribeUrl,
      });

      if (result.success) {
        const updated = alreadySent.length > 0
          ? `${sub.trialRemindersSent},${reminderTag}`
          : reminderTag;
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { trialRemindersSent: updated },
        });
        sent++;
        console.log(`[Cron:trial] ✅ Sent ${reminderTag} reminder to ${sub.user.email}`);
      } else {
        failed++;
        console.error(`[Cron:trial] ❌ Failed for ${sub.user.email}: ${result.error}`);
      }
    }
  }

  return { sent, failed };
}

// ─── Image Cleanup Job ───────────────────────────────────────────────────────
// Deletes old post images from Vercel Blob storage.
export async function runImageCleanup(): Promise<{ deleted: number; errors: number }> {
  console.log("[Cron:cleanup] Running image cleanup...");
  const result = await cleanupOldImages();
  if (result.deleted > 0 || result.errors > 0) {
    console.log(
      `[Cron:cleanup] Complete: ${result.deleted} deleted, ${result.errors} errors`
    );
  }
  return result;
}

// ─── Token Refresh Job ───────────────────────────────────────────────────────
// Proactively refreshes LinkedIn tokens expiring within 7 days.
export async function runTokenRefresh(): Promise<{ refreshed: number; failed: number }> {
  const accounts = await prisma.account.findMany({
    where: {
      provider: "linkedin",
      access_token: { not: null },
      user: ENTITLED_USER_FILTER,
    },
    select: { userId: true, expires_at: true },
  });

  const nowSecs = Math.floor(Date.now() / 1000);
  const sevenDaysSecs = 7 * 24 * 60 * 60;
  let refreshed = 0;
  let failed = 0;

  for (const acct of accounts) {
    if (acct.expires_at && acct.expires_at <= nowSecs + sevenDaysSecs) {
      const status = await getTokenStatus(acct.userId);
      if (status.refreshable) {
        const result = await refreshAccessToken(acct.userId);
        if (result.success) {
          refreshed++;
        } else {
          failed++;
          console.warn(`[Cron:token] ❌ Refresh failed for user ${acct.userId}: ${result.error}`);
        }
      } else {
        console.warn(`[Cron:token] Token expiring for user ${acct.userId} but no refresh token`);
      }
    }
  }

  if (refreshed > 0 || failed > 0) {
    console.log(
      `[Cron:token] ${refreshed} refreshed, ${failed} failed out of ${accounts.length} checked`
    );
  }

  return { refreshed, failed };
}


// ─── Support Reply Cleanup Job ───────────────────────────────────────────────
// Admin replies are deliberately short-lived: each one is deleted REPLY_TTL_DAYS
// after it was written, whether or not the user ever read it. Read state only
// drives the unread badge; it never keeps a reply alive.
export async function runSupportReplyCleanup(): Promise<{ deleted: number }> {
  const cutoff = replyCutoff();

  const { count } = await prisma.supportReply.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  if (count > 0) {
    console.log(`[Cron:support-cleanup] Deleted ${count} expired admin repl${count === 1 ? "y" : "ies"}`);
  }
  return { deleted: count };
}

// ─── Profile Alert Job ───────────────────────────────────────────────────────
// Tells a user, once per requirements change, that onboarding now asks for
// something their account does not have yet - and that post writing, images and
// scheduling stay paused until they fill it in.
//
// Dedupe is by VERSION, not by date: User.profileAlertVersion holds the highest
// PROFILE_REQUIREMENTS_VERSION the account has already heard about, so bumping
// that one constant is the single action that triggers a fresh round of emails.
// Accounts that already satisfy the new requirements are marked as told without
// being mailed, which keeps the daily scan small and converging.
const PROFILE_ALERT_BATCH = 50;

export async function runProfileAlerts(): Promise<{
  sent: number;
  failed: number;
  alreadyComplete: number;
}> {
  let sent = 0;
  let failed = 0;
  let alreadyComplete = 0;

  const users = await prisma.user.findMany({
    where: {
      // Accounts that finished onboarding under the OLD requirements. Someone
      // mid-signup is already being asked for everything, so mailing them would
      // just be noise.
      onboardingCompleted: true,
      email: { not: null },
      profileAlertVersion: { lt: PROFILE_REQUIREMENTS_VERSION },
    },
    select: { id: true, name: true, email: true, ...PROFILE_SELECT },
    take: PROFILE_ALERT_BATCH,
  });

  const setupUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3002"}/onboarding`;

  for (const user of users) {
    const { complete, gaps } = assessProfile(user);

    if (complete) {
      alreadyComplete++;
      await prisma.user.update({
        where: { id: user.id },
        data: { profileAlertVersion: PROFILE_REQUIREMENTS_VERSION },
      });
      continue;
    }

    const result = await sendProfileUpdateEmail({
      to: user.email!,
      userName: user.name || "there",
      gaps: gaps.map((g) => ({ label: g.label, hint: g.hint })),
      setupUrl,
    });

    if (!result.success) {
      // Deliberately left un-bumped: tomorrow's run retries this address.
      failed++;
      console.error(`[Cron:profile-alerts] Send failed for ${user.id}: ${result.error}`);
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { profileAlertVersion: PROFILE_REQUIREMENTS_VERSION },
    });
    sent++;
  }

  if (users.length > 0) {
    console.log(
      `[Cron:profile-alerts] sent=${sent} failed=${failed} alreadyComplete=${alreadyComplete}`
    );
  }

  return { sent, failed, alreadyComplete };
}
