import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import OnboardingWizard from "@/components/OnboardingWizard";
import { assessProfile, resolveToneKey, isTemplateAudience } from "@/lib/profile-completeness";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login?callbackUrl=/onboarding");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      onboardingCompleted: true,
      name: true,
      image: true,
      headline: true,
      industry: true,
      summary: true,
      skills: true,
      positioning: true,
      contentGoals: true,
      contentStyles: true,
      targetAudience: true,
      tonePrefs: true,
    },
  });

  const assessment = assessProfile(user);

  // Re-entry is allowed on purpose.
  //
  // This used to be `if (user?.onboardingCompleted) redirect("/dashboard")`,
  // which locked out every existing account - and every existing account is
  // missing fields, because `skills` was never collected and `targetAudience`
  // was filled from a template. Those users had no route back to the one screen
  // that fixes their content quality.
  //
  // Now the wizard stays reachable while the profile is incomplete, pre-filled
  // with whatever is already saved, so it is a top-up rather than a redo. A
  // complete profile still goes straight to the dashboard, so nobody is stuck
  // in a loop.
  // if (user?.onboardingCompleted && assessment.complete) redirect("/dashboard");

  return (
    <OnboardingWizard
      isTopUp={!!user?.onboardingCompleted}
      user={{
        name: user?.name,
        image: user?.image,
        headline: user?.headline,
        industry: user?.industry,
        summary: user?.summary,
        skills: user?.skills,
        positioning: user?.positioning,
        contentGoals: user?.contentGoals,
        contentStyles: user?.contentStyles,
        // Deliberately NOT seeded when it is the old auto-generated template:
        // pre-filling it invites the user to accept it again, which is how the
        // field stayed identical across every account in an industry. Leaving it
        // blank sends them through the three guided questions instead.
        targetAudience: isTemplateAudience(user?.targetAudience) ? "" : user?.targetAudience,
        // Normalised here so the wizard can match it against its own tone list
        // without re-implementing the bare-string / object / double-encoded
        // parsing that lib/profile-completeness.ts already owns.
        tone: resolveToneKey(user?.tonePrefs),
      }}
    />
  );
}
