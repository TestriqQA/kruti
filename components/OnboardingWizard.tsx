"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { startGlobalLoading, stopGlobalLoading } from "@/lib/loading-indicator";
import {
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  User,
  Target,
  Palette,
  Users,
  Plus,
  X,
  AlertCircle,
  Sparkles,
  Loader2,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import Avatar from "@/components/Avatar";
import {
  composeTargetAudience,
  MIN_HEADLINE_CHARS,
  MIN_SUMMARY_CHARS,
  MIN_SKILLS,
  MIN_CONTENT_STYLES,
  MIN_AUDIENCE_CHARS,
  MAX_AUDIENCE_CHARS,
  MAX_SKILLS,
  INDUSTRIES,
  POSITIONING_VALUES,
  CONTENT_GOALS,
  CONTENT_STYLES,
  ONBOARDING_TONE_VALUES,
  type ProfileGap,
} from "@/lib/profile-completeness";
import { MAX_PASTE_CHARS, type ProfileSuggestion } from "@/lib/profile-suggest";

import ChipMultiSelect from "@/components/ChipMultiSelect";

/**
 * The option VALUES now live in lib/profile-completeness.ts, because the
 * profile suggester has to emit them too and a third copy is a third thing to
 * drift. Display metadata - icons, labels, descriptions - stays here.
 *
 * The annotations below are load-bearing: typing `value` as the union from the
 * canonical list turns any future drift into a compile error rather than a
 * suggestion that silently highlights nothing in the form.
 */
const POSITIONING_OPTIONS: {
  value: (typeof POSITIONING_VALUES)[number];
  icon: string;
  description: string;
}[] = [
  {
    value: "Thought Leader",
    icon: "💡",
    description: "Share bold opinions and future predictions in your space",
  },
  {
    value: "Industry Expert",
    icon: "🎯",
    description: "Demonstrate deep technical knowledge and analysis",
  },
  {
    value: "Storyteller",
    icon: "📖",
    description: "Engage through personal journeys and narrative arcs",
  },
  {
    value: "Educator",
    icon: "🎓",
    description: "Teach practical skills and frameworks through posts",
  },
  {
    value: "Entertainer",
    icon: "✨",
    description: "Combine insight with humor, relatability, and personality",
  },
  {
    value: "Contrarian",
    icon: "🔥",
    description: "Challenge conventional wisdom and mainstream thinking",
  },
  {
    value: "Practitioner",
    icon: "🛠",
    description: "Share real-world experience and tactical how-it-works insights",
  },
  {
    value: "Community Builder",
    icon: "🤝",
    description: "Connect people, spark conversations, and foster community",
  },
];

/**
 * Must stay in step with TONES in SettingsClient and TONE_KEYS in
 * lib/profile-completeness.ts - a value outside that set resolves to a flat
 * generic voice in lib/linkedin.ts.
 *
 * Tone used to be DERIVED from the chosen positioning here (a
 * POSITIONING_TO_TONE map), which meant nobody ever actually chose their voice:
 * every Educator wrote "educational", every Storyteller "inspirational". It is a
 * real question now, because tone.direction is injected into every single prompt
 * as a hard constraint.
 */
const TONES: {
  value: (typeof ONBOARDING_TONE_VALUES)[number];
  label: string;
  desc: string;
}[] = [
  { value: "professional", label: "Professional", desc: "Precise, expert, substantive. Confident without hype." },
  { value: "conversational", label: "Conversational", desc: "Friendly and relatable, like talking to a peer." },
  { value: "inspirational", label: "Inspirational", desc: "Story-driven and motivating, but earned." },
  { value: "educational", label: "Educational", desc: "Teaching-first. Explain the why, step by step." },
];

/**
 * Marks the OPTION the paste box suggested, so the user can see which one we
 * think fits rather than just being told that a field was touched.
 *
 * Deliberately stays put when they pick something else: our suggestion has not
 * changed, and seeing it beside their own choice is the whole point.
 *
 * Free-text fields carry no mark - there is no option to point at, and the
 * panel at the top of step 1 already reports how many fields were filled.
 */
function Recommended() {
  return (
    <span
      className="ml-2 inline-flex items-center gap-1 rounded-control bg-brand-tint px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand align-middle"
      title="Suggested from your LinkedIn profile"
    >
      <Sparkles className="h-2.5 w-2.5" />
      Recommended
    </span>
  );
}

interface OnboardingWizardProps {
  user: {
    name?: string | null;
    headline?: string | null;
    industry?: string | null;
    image?: string | null;
    summary?: string | null;
    /** JSON array string. */
    skills?: string | null;
    positioning?: string | null;
    /** JSON array string. */
    contentGoals?: string | null;
    /** JSON array string. */
    contentStyles?: string | null;
    targetAudience?: string | null;
    /** Already normalised to a tone key by the page. */
    tone?: string | null;
  };
  /**
   * True when this user already finished onboarding once and is back only
   * because their profile is missing fields the prompts need.
   */
  isTopUp?: boolean;
}

/** Small helper so the char counters read consistently. */
function Counter({ value, min, max }: { value: number; min?: number; max?: number }) {
  const short = min !== undefined && value < min;
  return (
    <p
      className={`text-xs text-right mt-1 ${
        short ? "text-warn" : "text-text-3"
      }`}
    >
      {max !== undefined ? `${value}/${max}` : value}
      {short ? ` - ${min - value} more needed` : min !== undefined ? " - looks good" : ""}
    </p>
  );
}

export default function OnboardingWizard({ user, isTopUp = false }: OnboardingWizardProps) {
  const { update } = useSession();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);
  const [serverGaps, setServerGaps] = useState<ProfileGap[]>([]);

  // Form state - seeded from whatever the account already has so a returning
  // user tops up the gaps instead of retyping everything.
  const [headline, setHeadline] = useState(user.headline ?? "");
  const [industry, setIndustry] = useState(user.industry ?? "");
  const [summary, setSummary] = useState(user.summary ?? "");
  const [skills, setSkills] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(user.skills ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
    } catch {
      return [];
    }
  });
  const [skillInput, setSkillInput] = useState("");
  const [positioning, setPositioning] = useState(user.positioning ?? "");
  const [tone, setTone] = useState(user.tone ?? "");
  const [contentGoals, setContentGoals] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(user.contentGoals ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
    } catch {
      return [];
    }
  });
  const [contentStyles, setContentStyles] = useState<string[]>(() => {
    try {
      const parsed = JSON.parse(user.contentStyles ?? "[]");
      return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
    } catch {
      return [];
    }
  });

  // ── Target audience ───────────────────────────────────────────────────────
  //
  // Three guided answers rather than one free textarea, because the old field
  // was filled by a "Generate from Profile" button that composed a template
  // from industry + positioning + goals. Almost nobody edited it, so every user
  // in the same industry with the same positioning sent the model BYTE-IDENTICAL
  // audience text - and "concrete pains and outcomes, in the audience's own
  // words" is precisely what the strategy prompt is built to consume.
  //
  // `audienceText` stays the submitted value so a returning user's existing
  // description is never clobbered; the guided fields only drive it once the
  // user actually touches one.
  const [audienceWho, setAudienceWho] = useState("");
  const [audiencePain, setAudiencePain] = useState("");
  const [audienceOutcome, setAudienceOutcome] = useState("");
  const [audienceTouched, setAudienceTouched] = useState(false);
  const [audienceText, setAudienceText] = useState(user.targetAudience ?? "");

  useEffect(() => {
    if (!audienceTouched) return;
    setAudienceText(composeTargetAudience(audienceWho, audiencePain, audienceOutcome));
  }, [audienceTouched, audienceWho, audiencePain, audienceOutcome]);

  /* ── Fill from a pasted LinkedIn profile ──────────────────────────────────
   *
   * LinkedIn's API gives this app name, photo and email and nothing else (see
   * lib/linkedin.ts), so the nine fields below cannot be fetched. They CAN be
   * read out of text the user pastes from their own profile, which is one
   * copy-paste instead of nine inputs.
   *
   * `recommended` holds the VALUES we suggested for the fields that have
   * options, so the mark can sit on the option itself - "we think Educator
   * suits you" - rather than on the field label, which only ever said "we
   * touched this" and left the user hunting for what changed.
   *
   * It marks the option, not the selection, so it stays put when they choose
   * something else: our suggestion is still what it was, and seeing it next to
   * their own choice is the point.
   *
   * Free-text fields - headline, summary, audience, skills - carry no mark.
   * There is nothing to point at, and the panel above already reports how many
   * fields were filled.
   */
  const [pasteText, setPasteText] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [suggestNote, setSuggestNote] = useState<string | null>(null);
  const [filledCount, setFilledCount] = useState(0);
  const [pasteOpen, setPasteOpen] = useState(true);
  const [recommended, setRecommended] = useState<{
    industry: string;
    positioning: string;
    tone: string;
    contentGoals: string[];
    contentStyles: string[];
  }>({ industry: "", positioning: "", tone: "", contentGoals: [], contentStyles: [] });

  async function applySuggestions() {
    if (suggesting || pasteText.trim().length < 40) return;
    setSuggesting(true);
    setSuggestNote(null);
    try {
      const res = await fetch("/api/onboarding/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paste: pasteText }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setSuggestNote(data?.error ?? "Could not read that. You can fill the form in yourself.");
        return;
      }

      const s: ProfileSuggestion | undefined = data?.suggestion;
      if (!s) {
        setSuggestNote("Could not read that. You can fill the form in yourself.");
        return;
      }

      // Only non-empty values are applied, so a field the model had no opinion
      // on keeps whatever the user already typed instead of being blanked.
      let filled = 0;
      const take = (value: string, set: (v: string) => void) => {
        if (!value) return;
        set(value);
        filled++;
      };

      take(s.headline, setHeadline);
      take(s.industry, setIndustry);
      take(s.summary, setSummary);
      take(s.positioning, setPositioning);
      take(s.tone, setTone);
      // Step 4 asks three questions and composes the final description from
      // them. Writing only the composed box left all three visibly blank, so
      // fill the three and let the effect above build the sentence - that way
      // all four boxes agree, and editing any one of them still works.
      if (s.audienceWho || s.audiencePain || s.audienceOutcome) {
        if (s.audienceWho) setAudienceWho(s.audienceWho);
        if (s.audiencePain) setAudiencePain(s.audiencePain);
        if (s.audienceOutcome) setAudienceOutcome(s.audienceOutcome);
        // Marks the audience as user-driven, which is what makes the compose
        // effect run. It fires once with all three new values batched in.
        setAudienceTouched(true);
        filled++;
      } else if (s.targetAudience) {
        // The model had an audience but could not split it into the three.
        // Fill the final box directly; `touched` stays false so the compose
        // effect does not blank it the moment the user answers one question.
        setAudienceText(s.targetAudience);
        setAudienceTouched(false);
        filled++;
      }
      if (s.skills.length) { setSkills(s.skills); filled++; }
      if (s.contentGoals.length) { setContentGoals([...s.contentGoals]); filled++; }
      if (s.contentStyles.length) { setContentStyles([...s.contentStyles]); filled++; }

      // Kept separately from the form state: these stay put as "what we
      // suggested" even after the user picks something different.
      setRecommended({
        industry: s.industry,
        positioning: s.positioning,
        tone: s.tone,
        contentGoals: [...s.contentGoals],
        contentStyles: [...s.contentStyles],
      });
      setFilledCount(filled);

      if (filled === 0) {
        setSuggestNote(
          "We could not pull anything usable out of that. Try including your headline and your About section."
        );
      } else {
        setPasteOpen(false);
        toast(`Filled in ${filled} field${filled === 1 ? "" : "s"} - check them over`, "success");
      }
    } catch {
      setSuggestNote("Could not reach the server. You can fill the form in yourself.");
    } finally {
      setSuggesting(false);
    }
  }

  // Auto-detect browser timezone
  const [timezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "Asia/Kolkata";
    }
  });

  // Versioned key. The draft shape changed (skills and tone were added,
  // targetAudience became audienceText plus three guided fields), so a v1 draft
  // restored into this wizard would silently drop the user's audience text and
  // leave them staring at an empty required field they thought they had filled.
  // Bumping the key discards those drafts instead.
  const STORAGE_KEY = "kruti_onboarding_draft_v2";
  const [draftRestored, setDraftRestored] = useState(false);

  // Restore draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const draft = JSON.parse(saved);
      if (draft.step) setStep(draft.step);
      if (draft.headline) setHeadline(draft.headline);
      if (draft.industry) setIndustry(draft.industry);
      if (draft.summary) setSummary(draft.summary);
      if (Array.isArray(draft.skills)) setSkills(draft.skills);
      if (draft.positioning) setPositioning(draft.positioning);
      if (draft.tone) setTone(draft.tone);
      if (Array.isArray(draft.contentGoals)) setContentGoals(draft.contentGoals);
      if (Array.isArray(draft.contentStyles)) setContentStyles(draft.contentStyles);
      if (draft.audienceWho) setAudienceWho(draft.audienceWho);
      if (draft.audiencePain) setAudiencePain(draft.audiencePain);
      if (draft.audienceOutcome) setAudienceOutcome(draft.audienceOutcome);
      if (draft.audienceText) setAudienceText(draft.audienceText);
      if (draft.audienceTouched) setAudienceTouched(true);
      setDraftRestored(true);
      setTimeout(() => setDraftRestored(false), 3000);
    } catch {
      /* ignore corrupt localStorage */
    }
  }, []);

  // Auto-save draft to localStorage whenever form changes
  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          step, headline, industry, summary, skills, positioning, tone,
          contentGoals, contentStyles,
          audienceWho, audiencePain, audienceOutcome, audienceText, audienceTouched,
        })
      );
    } catch {
      /* storage full - ignore */
    }
  }, [
    step, headline, industry, summary, skills, positioning, tone,
    contentGoals, contentStyles,
    audienceWho, audiencePain, audienceOutcome, audienceText, audienceTouched,
  ]);

  useEffect(() => {
    saveDraft();
  }, [saveDraft]);

  function clearDraft() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  function addSkill() {
    const s = skillInput.trim().replace(/\s+/g, " ");
    if (!s) return;
    if (skills.length >= MAX_SKILLS) {
      toast(`You can add up to ${MAX_SKILLS} skills.`, "error");
      return;
    }
    if (skills.some((existing) => existing.toLowerCase() === s.toLowerCase())) {
      setSkillInput("");
      return;
    }
    setSkills([...skills, s]);
    setSkillInput("");
  }

  // ── Per-step gates. Mirror lib/profile-completeness.ts; the server re-checks. ──
  const step1Ok =
    headline.trim().length >= MIN_HEADLINE_CHARS &&
    industry.trim().length > 0 &&
    summary.trim().length >= MIN_SUMMARY_CHARS &&
    skills.length >= MIN_SKILLS;
  const step2Ok = !!positioning && !!tone;
  const step3Ok = contentGoals.length >= 1 && contentStyles.length >= MIN_CONTENT_STYLES;
  const step4Ok = audienceText.trim().length >= MIN_AUDIENCE_CHARS;

  const stepOk = [step1Ok, step2Ok, step3Ok, step4Ok];

  // Moving between steps deliberately has NO loader.
  //
  // It is a local state change with no network and no code to fetch - measured
  // at 9ms in a production build - so a loader there would be a flicker the
  // work never earned.
  //
  // It was tried with useTransition, driving the loader off `isPending` so it
  // would appear only for a genuinely slow render. That made things worse in a
  // way worth recording: the loader's progress bar trickles on a 240ms interval,
  // and each of those is an urgent state update that interrupts and restarts a
  // low-priority transition render. The step change went from 9ms to 4-5
  // seconds, finishing only once the bar saturated at 90% and stopped
  // re-rendering. A loader must never be driven by a transition it can starve.
  async function handleSubmit() {
    setSubmitting(true);
    setServerGaps([]);

    // Saving is three waits back to back - the POST, the session refresh, and
    // then a full page load - and NavigationProgress can see none of them, so
    // until now the only feedback was the button text changing. Raised here, on
    // the click, so the bar is up before the first request leaves.
    startGlobalLoading();
    // On success the browser tears this page down for /dashboard, and that is
    // what ends the loader - so it covers the page load too and stops the
    // instant the new page is there. Stopping it ourselves would blank the
    // screen for the slowest part of the wait.
    let navigatingAway = false;

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline,
          industry,
          summary,
          skills,
          positioning,
          tonePrefs: tone,
          contentGoals,
          contentStyles,
          targetAudience: audienceText,
          timezone,
        }),
      });

      if (res.ok) {
        clearDraft();
        // Refresh JWT so middleware sees onboardingCompleted = true
        await update();
        // Hard navigation so middleware re-reads the updated JWT cookie
        navigatingAway = true;
        window.location.href = "/dashboard";
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data.gaps) && data.gaps.length > 0) {
        setServerGaps(data.gaps);
      }
      toast(data.error || "Could not save your profile. Please try again.", "error");
    } catch (err) {
      console.error("Onboarding submit error:", err);
      toast("Network error. Please check your connection and try again.", "error");
    } finally {
      setSubmitting(false);
      // Every path that leaves the user on this page drops the loader here, so
      // a failed save never leaves it spinning.
      if (!navigatingAway) stopGlobalLoading();
    }
  }

  const stepIcons = [User, Target, Palette, Users];
  const stepTitles = ["Your Profile", "Positioning & Voice", "Goals & Style", "Target Audience"];

  const inputCls =
    "w-full px-4 py-2.5 border border-edge bg-card text-text rounded-control text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";

  return (
    <div className="min-h-screen bg-[#F6F8FB] dark:bg-[#0A0E14] flex items-center justify-center p-4">
      <div className="bg-card rounded-3xl shadow-lift-lg w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-7 pb-6 border-b border-edge-soft">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Kruti.io" className="h-16 w-auto mb-5" />
          <h1 className="text-2xl font-bold font-display text-text">
            {isTopUp ? "Finish your profile" : "Welcome to Kruti.io"}
          </h1>
          <p className="text-text-2 text-sm mt-1">
            {isTopUp
              ? "A few details are missing. These are what make your posts sound like you - not a generic AI."
              : "Let's set up your content strategy"}
          </p>

          {/* Progress bar */}
          <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2 mt-6">
            <div
              className="bg-brand rounded-full h-2 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-3">
            {stepTitles.map((title, i) => {
              const Icon = stepIcons[i];
              const done = i + 1 < step;
              const current = i + 1 === step;
              return (
                <div
                  key={title}
                  className={`flex flex-col items-center gap-1 ${i + 1 <= step ? "opacity-100" : "opacity-40"}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      done ? "bg-green-500" : current ? "bg-brand" : "bg-slate-200 dark:bg-white/10"
                    }`}
                  >
                    {done ? (
                      <CheckCircle className="w-4 h-4 text-white" />
                    ) : (
                      <Icon className={`w-3 h-3 ${current ? "text-white" : "text-text-3"}`} />
                    )}
                  </div>
                  <span className="text-xs text-text-2 hidden sm:block">{title}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Draft restored banner */}
        {draftRestored && (
          <div className="mx-8 mt-4 flex items-center gap-2 bg-ok-tint border border-green-200 dark:border-green-800 rounded-control px-4 py-2.5 text-sm text-ok">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Your previous progress has been restored.
          </div>
        )}

        {/* Server-side validation feedback */}
        {serverGaps.length > 0 && (
          <div className="mx-8 mt-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-control px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              Still needed
            </div>
            <ul className="mt-2 space-y-1">
              {serverGaps.map((g) => (
                <li key={g.key} className="text-xs text-amber-700 dark:text-amber-300/90">
                  <span className="font-medium">{g.label}:</span> {g.hint}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Content */}
        <div className="px-8 py-6">
          {/* ── Step 1: Profile ─────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold font-display text-text">
                  Tell us about your work
                </h2>
                <p className="text-text-2 text-sm mt-1">
                  LinkedIn only shares your name, photo and email with us - everything below is what
                  makes your content specific to you.
                </p>
              </div>

              {user.image && (
                <div className="flex items-center gap-3">
                  <Avatar src={user.image} name={user.name} size={56} className="border-2 border-blue-600" />
                  <div>
                    <p className="font-semibold text-text">{user.name}</p>
                    <p className="text-sm text-text-2">LinkedIn Member</p>
                  </div>
                </div>
              )}

              {/* Fill-from-paste. Sits directly under the line explaining that
                  LinkedIn gives us almost nothing, because this is the answer
                  to that problem rather than a separate feature. Collapses once
                  it has run so it stops competing with the fields it filled. */}
              <div className="rounded-control border border-brand/25 bg-brand-tint p-4">
                <button
                  type="button"
                  onClick={() => setPasteOpen((v) => !v)}
                  className="ring-focus flex w-full items-center gap-2 text-left"
                >
                  <Sparkles className="h-4 w-4 flex-shrink-0 text-brand" />
                  <span className="flex-1 text-sm font-semibold text-text">
                    {filledCount > 0
                      ? `Filled in ${filledCount} field${filledCount === 1 ? "" : "s"} from your profile`
                      : "Fill this in from your LinkedIn profile"}
                  </span>
                  <span className="text-xs font-medium text-brand">
                    {pasteOpen ? "Hide" : filledCount > 0 ? "Redo" : "Open"}
                  </span>
                </button>

                {pasteOpen && (
                  <div className="mt-3 space-y-2">
                    <p className="text-xs leading-relaxed text-text-2">
                      Open your LinkedIn profile, copy your <strong>headline</strong> and your{" "}
                      <strong>About</strong> section, and paste both here. We will suggest the rest
                      of this form from them. Anything we cannot work out is left blank for you.
                    </p>
                    <textarea
                      value={pasteText}
                      onChange={(e) => setPasteText(e.target.value.slice(0, MAX_PASTE_CHARS))}
                      rows={5}
                      placeholder={"Senior Backend Engineer at Acme | Node.js, Postgres, distributed systems\n\nI have spent eight years building payment infrastructure..."}
                      className="w-full resize-y rounded-control border border-edge bg-card px-3 py-2 text-sm text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-brand/30"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-text-3">
                        {pasteText.length > 0 && `${pasteText.length} / ${MAX_PASTE_CHARS}`}
                      </span>
                      <button
                        type="button"
                        onClick={applySuggestions}
                        disabled={suggesting || pasteText.trim().length < 40}
                        className="btn-brand ring-focus flex h-9 items-center gap-2 rounded-control px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {suggesting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Reading your profile...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Fill in my details
                          </>
                        )}
                      </button>
                    </div>
                    {suggestNote && (
                      <p className="flex items-start gap-1.5 text-xs text-warn">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                        {suggestNote}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Professional Headline <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Senior Product Manager at Acme - I help B2B teams ship faster"
                  className={inputCls}
                />
                <Counter value={headline.trim().length} min={MIN_HEADLINE_CHARS} />
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-text mb-1">
                  Industry <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => {
                    setIndustry(e.target.value);
                    setShowIndustryDropdown(true);
                  }}
                  onFocus={() => setShowIndustryDropdown(true)}
                  onBlur={() => setShowIndustryDropdown(false)}
                  placeholder="Select or type your industry"
                  className={inputCls}
                />
                {showIndustryDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#0D131F] border border-edge rounded-control shadow-lift-lg max-h-60 overflow-y-auto">
                    {INDUSTRIES.filter((ind) => ind.toLowerCase().includes(industry.toLowerCase())).length > 0 ? (
                      INDUSTRIES.filter((ind) => ind.toLowerCase().includes(industry.toLowerCase())).map((ind) => (
                        <div
                          key={ind}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setIndustry(ind);
                            setShowIndustryDropdown(false);
                          }}
                          className="px-4 py-2.5 text-sm text-text dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer"
                        >
                          {ind}
                          {recommended.industry === ind && <Recommended />}
                        </div>
                      ))
                    ) : industry.trim() ? (
                      <div className="px-4 py-2.5 text-sm text-text-2 italic">
                        Using custom industry: &quot;{industry}&quot;
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Professional Summary <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-text-2 mb-1.5">
                  The single biggest factor in how personal your posts read. What do you actually do,
                  how long have you done it, and what have you learned that others get wrong?
                </p>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={5}
                  placeholder="e.g. I've spent 9 years in B2B SaaS product, the last 4 leading a 12-person team at Acme. I've shipped three platform rewrites and killed two of my own features. Most teams I meet over-index on roadmap theatre and under-invest in talking to churned customers..."
                  className={`${inputCls} resize-none`}
                />
                <Counter value={summary.trim().length} min={MIN_SUMMARY_CHARS} />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Skills &amp; Topics You Can Speak On <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-text-2 mb-1.5">
                  These become your weekly content pillars. Add at least {MIN_SKILLS} - be specific
                  (&quot;pricing experiments&quot; beats &quot;marketing&quot;).
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                    placeholder="Add a skill or topic..."
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={addSkill}
                    className="flex items-center gap-1 px-4 py-2 border border-edge rounded-control text-sm hover:bg-card-muted transition-colors flex-shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>
                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="flex items-center gap-1 text-sm px-3 py-1 bg-blue-50 dark:bg-brand/10 text-brand rounded-full"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => setSkills(skills.filter((s) => s !== skill))}
                          className="hover:text-blue-900 dark:hover:text-blue-200"
                          aria-label={`Remove ${skill}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <Counter value={skills.length} min={MIN_SKILLS} />
              </div>
            </div>
          )}

          {/* ── Step 2: Positioning & Voice ─────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold font-display text-text">
                  How do you want to show up?
                </h2>
                <p className="text-text-2 text-sm mt-1">
                  Your positioning sets the writing stance; your tone sets the voice. Both are applied
                  to every post as hard constraints.
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-text mb-3">
                  Your positioning <span className="text-red-500">*</span>
                </h3>
              </div>

              <div className="space-y-3">
                {POSITIONING_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPositioning(option.value)}
                    className={`w-full flex items-center gap-4 p-4 rounded-control border-2 text-left transition-all ${
                      positioning === option.value
                        ? "border-blue-600 bg-blue-50 dark:bg-brand/10"
                        : "border-edge hover:border-edge dark:hover:border-white/10 bg-card"
                    }`}
                  >
                    <span className="text-2xl">{option.icon}</span>
                    <div>
                      <p
                        className={`font-semibold text-sm ${
                          positioning === option.value
                            ? "text-brand"
                            : "text-text"
                        }`}
                      >
                        {option.value}
                        {recommended.positioning === option.value && <Recommended />}
                      </p>
                      <p className="text-xs text-text-2 mt-0.5">{option.description}</p>
                    </div>
                    {positioning === option.value && (
                      <CheckCircle className="w-5 h-5 text-brand ml-auto flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>

              <div>
                <h3 className="text-sm font-semibold text-text mb-1">
                  Your writing voice <span className="text-red-500">*</span>
                </h3>
                <p className="text-xs text-text-2 mb-3">
                  Pick how your posts should sound. You can change this any time in Settings.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {TONES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setTone(t.value)}
                      className={`p-4 rounded-control border-2 text-left transition-all ${
                        tone === t.value
                          ? "border-blue-600 bg-brand-tint"
                          : "border-edge hover:border-edge dark:hover:border-white/10 bg-card"
                      }`}
                    >
                      <p
                        className={`font-medium text-sm ${
                          tone === t.value
                            ? "text-brand"
                            : "text-text"
                        }`}
                      >
                        {t.label}
                        {recommended.tone === t.value && <Recommended />}
                      </p>
                      <p className="text-xs text-text-2 mt-0.5">{t.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Goals & Styles ──────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold font-display text-text">
                  Goals &amp; Content Style
                </h2>
                <p className="text-text-2 text-sm mt-1">
                  Select all that apply - we&apos;ll personalize your content strategy
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-text mb-3">
                  What are your LinkedIn goals? <span className="text-red-500">*</span>
                </h3>
                <ChipMultiSelect
                  options={CONTENT_GOALS}
                  recommended={recommended.contentGoals}
                  value={contentGoals}
                  onChange={setContentGoals}
                  accent="blue"
                  inputId="onboarding-custom-goal"
                  addPlaceholder="Add your own goal..."
                />
              </div>

              <div>
                <h3 className="text-sm font-semibold text-text mb-1">
                  Preferred content styles <span className="text-red-500">*</span>
                </h3>
                <p className="text-xs text-text-2 mb-3">
                  Each post in a batch is written in a different style, so pick at least{" "}
                  {MIN_CONTENT_STYLES} - otherwise all five posts come out the same shape.
                </p>
                <ChipMultiSelect
                  options={CONTENT_STYLES}
                  recommended={recommended.contentStyles}
                  value={contentStyles}
                  onChange={setContentStyles}
                  accent="indigo"
                  inputId="onboarding-custom-style"
                  addPlaceholder="Add a style in your own words..."
                />
                <Counter value={contentStyles.length} min={MIN_CONTENT_STYLES} />
              </div>
            </div>
          )}

          {/* ── Step 4: Target Audience ─────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold font-display text-text">
                  Who are you writing for?
                </h2>
                <p className="text-text-2 text-sm mt-1">
                  Answer these three and we&apos;ll assemble the description the AI writes against.
                  The more specific you are, the less generic your posts.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  1. Who exactly are they?
                </label>
                <input
                  type="text"
                  value={audienceWho}
                  onChange={(e) => {
                    setAudienceWho(e.target.value);
                    setAudienceTouched(true);
                  }}
                  placeholder="e.g. Seed-stage B2B SaaS founders with 5-20 employees"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  2. What are they stuck on right now?
                </label>
                <input
                  type="text"
                  value={audiencePain}
                  onChange={(e) => {
                    setAudiencePain(e.target.value);
                    setAudienceTouched(true);
                  }}
                  placeholder="e.g. they keep shipping features nobody asked for and churn is climbing"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  3. What do they actually want?
                </label>
                <input
                  type="text"
                  value={audienceOutcome}
                  onChange={(e) => {
                    setAudienceOutcome(e.target.value);
                    setAudienceTouched(true);
                  }}
                  placeholder="e.g. a repeatable way to decide what to build next without guessing"
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text mb-1">
                  Final description <span className="text-text-3">(edit freely)</span>
                </label>
                <textarea
                  value={audienceText}
                  onChange={(e) => setAudienceText(e.target.value.slice(0, MAX_AUDIENCE_CHARS))}
                  rows={4}
                  placeholder="Fill in the three questions above, or write your own description here."
                  className={`${inputCls} resize-none`}
                />
                <Counter
                  value={audienceText.trim().length}
                  min={MIN_AUDIENCE_CHARS}
                  max={MAX_AUDIENCE_CHARS}
                />
              </div>

              {/* Summary of choices */}
              <div className="bg-blue-50 dark:bg-brand/10 rounded-control p-4 space-y-2">
                <p className="text-sm font-semibold text-text">Your content setup:</p>
                <div className="text-xs text-text-2 space-y-1">
                  <p>
                    <span className="font-medium">Positioning:</span> {positioning || "Not selected"}
                  </p>
                  <p>
                    <span className="font-medium">Voice:</span>{" "}
                    {TONES.find((t) => t.value === tone)?.label || "Not selected"}
                  </p>
                  <p>
                    <span className="font-medium">Pillars:</span> {skills.join(", ") || "None added"}
                  </p>
                  <p>
                    <span className="font-medium">Goals:</span> {contentGoals.join(", ") || "None selected"}
                  </p>
                  <p>
                    <span className="font-medium">Styles:</span> {contentStyles.join(", ") || "None selected"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        {/* bg-card-muted, not a literal. This strip was #F6F8FB with no dark
            override, so in dark mode the entire footer - Back, the step dots
            and Next - sat on near-white with light grey text on it.
            card-muted is the token for a nested strip inside a card and
            carries its own dark value, so there is nothing to keep in step. */}
        <div className="px-8 py-5 bg-card-muted border-t border-edge-soft flex justify-between items-center">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center gap-2 text-sm text-text-2 hover:text-text dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i + 1 === step
                    ? "w-6 bg-brand"
                    : i + 1 < step
                    ? "w-2 bg-brand/60"
                    : "w-2 bg-slate-300 dark:bg-white/10"
                }`}
              />
            ))}
          </div>

          {step < totalSteps ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!stepOk[step - 1]}
              className="flex items-center gap-2 text-sm font-semibold text-white bg-brand px-5 py-2.5 rounded-control hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !step4Ok}
              className="flex items-center gap-2 text-sm font-semibold text-white bg-brand px-5 py-2.5 rounded-control hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Saving..." : isTopUp ? "Save and continue" : "Start Creating"}
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
