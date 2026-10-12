import { prisma } from "@/lib/prisma";
import {
  assessProfile,
  profileGapMessage,
  type ProfileGap,
} from "@/lib/profile-completeness";

/**
 * Server-side profile gate for the AI routes.
 *
 * Kept separate from lib/profile-completeness.ts on purpose: that module is
 * imported by OnboardingWizard (a client component), so it must stay free of
 * `prisma` or anything else that cannot be bundled for the browser. This file is
 * the server half.
 */

/**
 * Exactly the columns `assessProfile` reads. Routes that already load the whole
 * User row can pass it straight to `assessProfile`; this select exists for the
 * ones that should not fetch more than they need.
 */
export const PROFILE_SELECT = {
  headline: true,
  industry: true,
  summary: true,
  skills: true,
  positioning: true,
  contentGoals: true,
  contentStyles: true,
  targetAudience: true,
  tonePrefs: true,
} as const;

export interface ProfileReadiness {
  ready: boolean;
  /** Present when not ready - safe to show the user verbatim. */
  message?: string;
  gaps: ProfileGap[];
}

/**
 * Can we write genuinely personalised content for this user right now?
 *
 * Every AI route calls this before spending a token. The reason it is a hard
 * block rather than a warning: a generation run from an empty profile produces
 * five generic posts, burns the user's monthly quota of 30, costs real money,
 * and lands as "this product doesn't work". Blocking for two minutes of profile
 * work is strictly better for the user than any of that.
 *
 * Admins are NOT exempt. The gate is about input quality, not entitlement - an
 * admin with a blank profile gets exactly the same generic output as anyone else.
 */
export async function checkProfileReady(userId: string): Promise<ProfileReadiness> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PROFILE_SELECT,
  });

  const { complete, gaps } = assessProfile(user);
  if (complete) return { ready: true, gaps: [] };

  return { ready: false, message: profileGapMessage(gaps), gaps };
}
