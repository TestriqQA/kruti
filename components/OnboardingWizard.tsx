"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { ChevronRight, ChevronLeft, CheckCircle, User, Target, Palette, Users, Save, Sparkles } from "lucide-react";
import { useToast } from "@/components/Toast";
import Avatar from "@/components/Avatar";

const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "Marketing", "Sales",
  "Education", "Consulting", "Legal", "Real Estate", "Media",
  "Manufacturing", "Retail", "Non-profit", "Other",
];

const POSITIONING_OPTIONS = [
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

const CONTENT_GOALS = [
  "Lead Generation",
  "Network Building",
  "Brand Awareness",
  "Job Seeking",
  "Sales / Business Development",
  "Recruiting Top Talent",
];

const CONTENT_STYLES = [
  "Problem Agitation Solution",
  "Narrative / Story",
  "List / Tips",
  "Data-driven Insights",
  "Personal Story",
  "Case Study",
  "How-to / Tutorial",
  "Motivational",
  "Contrarian Take",
  "Q&A Format",
  "Behind the Scenes",
  "Predictions & Trends",
  "Lessons Learned",
  "Social Proof / Results",
];

// Deterministic target-audience generation - maps the user's first-3-step
// onboarding answers to a natural-language audience description (no AI/API call).
const GOAL_AUDIENCE: Record<string, string> = {
  "Lead Generation": "potential clients and buyers actively looking for solutions",
  "Network Building": "peers and collaborators open to building genuine professional relationships",
  "Brand Awareness": "professionals discovering new voices and ideas to follow in their field",
  "Job Seeking": "hiring managers and recruiters scouting strong talent",
  "Sales / Business Development": "decision-makers evaluating products, services, and partnerships",
  "Recruiting Top Talent": "skilled professionals open to new roles and opportunities",
};

const POSITIONING_VALUE: Record<string, string> = {
  "Thought Leader": "bold perspectives and a clear point of view on where the industry is heading",
  "Industry Expert": "deep, credible analysis and technical insight",
  "Storyteller": "relatable stories and lessons drawn from real experience",
  "Educator": "practical frameworks and skills they can apply right away",
  "Entertainer": "sharp insights delivered in an engaging, memorable way",
  "Contrarian": "fresh takes that challenge conventional thinking",
  "Practitioner": "hands-on, tactical advice from someone doing the work",
  "Community Builder": "a sense of community and conversations worth joining",
};

// Seed a sensible voice/tone from the chosen positioning so a new user's first
// strategy and posts aren't written in the flat default "Professional" voice. The
// user can still change this any time in Settings (which overrides this).
const POSITIONING_TO_TONE: Record<string, string> = {
  "Thought Leader": "professional",
  "Industry Expert": "professional",
  "Practitioner": "professional",
  "Contrarian": "professional",
  "Educator": "educational",
  "Storyteller": "inspirational",
  "Entertainer": "conversational",
  "Community Builder": "conversational",
};

interface OnboardingWizardProps {
  user: {
    name?: string | null;
    headline?: string | null;
    industry?: string | null;
    image?: string | null;
  };
}

export default function OnboardingWizard({ user }: OnboardingWizardProps) {
  const { update } = useSession();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [showIndustryDropdown, setShowIndustryDropdown] = useState(false);

  // Form state
  const [headline, setHeadline] = useState(user.headline ?? "");
  const [industry, setIndustry] = useState(user.industry ?? "");
  const [summary, setSummary] = useState("");
  const [positioning, setPositioning] = useState("");
  const [contentGoals, setContentGoals] = useState<string[]>([]);
  const [contentStyles, setContentStyles] = useState<string[]>([]);
  const [targetAudience, setTargetAudience] = useState("");

  // Auto-detect browser timezone
  const [timezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "Asia/Kolkata";
    }
  });

  const STORAGE_KEY = "kruti_onboarding_draft";
  const [draftRestored, setDraftRestored] = useState(false);

  // Restore draft from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft.step) setStep(draft.step);
        if (draft.headline) setHeadline(draft.headline);
        if (draft.industry) setIndustry(draft.industry);
        if (draft.summary) setSummary(draft.summary);
        if (draft.positioning) setPositioning(draft.positioning);
        if (draft.contentGoals) setContentGoals(draft.contentGoals);
        if (draft.contentStyles) setContentStyles(draft.contentStyles);
        if (draft.targetAudience) setTargetAudience(draft.targetAudience);
        setDraftRestored(true);
        setTimeout(() => setDraftRestored(false), 3000);
      }
    } catch { /* ignore corrupt localStorage */ }
  }, []);

  // Auto-save draft to localStorage whenever form changes
  const saveDraft = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        step, headline, industry, summary, positioning,
        contentGoals, contentStyles, targetAudience,
      }));
    } catch { /* storage full - ignore */ }
  }, [step, headline, industry, summary, positioning, contentGoals, contentStyles, targetAudience]);

  useEffect(() => {
    saveDraft();
  }, [saveDraft]);

  // Clear draft on successful submit
  function clearDraft() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }

  const totalSteps = 4;
  const progress = (step / totalSteps) * 100;

  function toggleMulti(
    value: string,
    list: string[],
    setList: (v: string[]) => void
  ) {
    setList(
      list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
    );
  }

  // Build the target audience from the user's first-3-step answers (headline,
  // industry, positioning, goals) - fully client-side, no AI/API call.
  function handleGenerateAudience() {
    if (!industry.trim() && !positioning && contentGoals.length === 0) {
      toast("Complete the earlier steps first so we can tailor your audience.", "error");
      return;
    }

    const who = industry.trim()
      ? `${industry.trim()} professionals and decision-makers`
      : "Professionals and decision-makers in your field";

    const goalDescs = contentGoals
      .map((g) => GOAL_AUDIENCE[g])
      .filter(Boolean)
      .slice(0, 2);
    const goalPart = goalDescs.length ? ` - especially ${goalDescs.join(", and ")}` : "";

    const value = POSITIONING_VALUE[positioning] || "clear, relevant, high-quality content";

    let text = `${who}${goalPart} - who value ${value}.`;
    // Respect the 300-char field limit; drop the goal detail first if it overflows.
    if (text.length > 300) text = `${who} who value ${value}.`;
    text = text.slice(0, 300);

    setTargetAudience(text);
    toast("Target audience drafted from your profile - tweak it as you like", "success");
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline,
          industry,
          summary,
          positioning,
          contentGoals,
          contentStyles,
          targetAudience,
          timezone,
          tonePrefs: POSITIONING_TO_TONE[positioning] ?? "professional",
        }),
      });

      if (res.ok) {
        clearDraft();
        // Refresh JWT to pick up onboardingCompleted = true
        await update();
        // Use hard navigation so middleware re-reads the updated JWT cookie
        window.location.href = "/dashboard";
      } else {
        const data = await res.json().catch(() => ({}));
        console.error("Onboarding failed:", data);
      }
    } catch (err) {
      console.error("Onboarding submit error:", err);
    } finally {
      setSubmitting(false);
    }
  }

  const stepIcons = [User, Target, Palette, Users];
  const stepTitles = [
    "Your Profile",
    "Content Positioning",
    "Goals & Style",
    "Target Audience",
  ];

  return (
    <div className="min-h-screen bg-[#F6F8FB] dark:bg-[#0A0E14] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-white/[0.03] rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-7 pb-6 border-b border-slate-100 dark:border-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Kruti.io" className="h-16 w-auto mb-5" />
          <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">Welcome to Kruti.io</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Let&apos;s set up your content strategy</p>

          {/* Progress bar */}
          <div className="w-full bg-slate-200 dark:bg-white/10 rounded-full h-2 mt-6">
            <div
              className="bg-blue-600 rounded-full h-2 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-3">
            {stepTitles.map((title, i) => {
              const Icon = stepIcons[i];
              const done = i + 1 < step;
              const current = i + 1 === step;
              return (
                <div key={i} className={`flex flex-col items-center gap-1 ${i + 1 <= step ? "opacity-100" : "opacity-40"}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${done ? "bg-green-500" : current ? "bg-blue-600" : "bg-slate-200 dark:bg-white/10"}`}>
                    {done ? (
                      <CheckCircle className="w-4 h-4 text-white" />
                    ) : (
                      <Icon className={`w-3 h-3 ${current ? "text-white" : "text-slate-400 dark:text-slate-500"}`} />
                    )}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">{title}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Draft restored banner */}
        {draftRestored && (
          <div className="mx-8 mt-4 flex items-center gap-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl px-4 py-2.5 text-sm text-green-700 dark:text-green-300">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Your previous progress has been restored.
          </div>
        )}

        {/* Content */}
        <div className="px-8 py-6">
          {/* Step 1: Profile */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">Confirm your profile</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Review and complete your details so we can personalize your content</p>
              </div>

              {user.image && (
                <div className="flex items-center gap-3">
                  <Avatar src={user.image} name={user.name} size={56} className="border-2 border-blue-600" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{user.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">LinkedIn Member</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Professional Headline <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g. Senior Product Manager at Acme Corp"
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.06] text-slate-900 dark:text-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="relative">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
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
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-white/[0.06] text-slate-900 dark:text-white"
                />
                {showIndustryDropdown && (
                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-[#0D131F] border border-slate-200 dark:border-white/10 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    {INDUSTRIES.filter((ind) => ind.toLowerCase().includes(industry.toLowerCase())).length > 0 ? (
                      INDUSTRIES.filter((ind) => ind.toLowerCase().includes(industry.toLowerCase())).map((ind) => (
                        <div
                          key={ind}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setIndustry(ind);
                            setShowIndustryDropdown(false);
                          }}
                          className="px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer"
                        >
                          {ind}
                        </div>
                      ))
                    ) : (
                      industry.trim() ? (
                        <div className="px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400 italic">
                          Using custom industry: &quot;{industry}&quot;
                        </div>
                      ) : null
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Professional Summary <span className="text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  rows={3}
                  placeholder="Briefly describe your expertise and what you do..."
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.06] text-slate-900 dark:text-white rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Step 2: Positioning */}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">How do you want to show up?</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Choose the content positioning that fits your personal brand</p>
              </div>

              <div className="space-y-3">
                {POSITIONING_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setPositioning(option.value)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                      positioning === option.value
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-500/10"
                        : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/10 bg-white dark:bg-white/[0.06]"
                    }`}
                  >
                    <span className="text-2xl">{option.icon}</span>
                    <div>
                      <p className={`font-semibold text-sm ${positioning === option.value ? "text-blue-600 dark:text-blue-400" : "text-slate-800 dark:text-slate-200"}`}>
                        {option.value}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{option.description}</p>
                    </div>
                    {positioning === option.value && (
                      <CheckCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 ml-auto flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 3: Goals & Styles */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">Goals & Content Style</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Select all that apply - we&apos;ll personalize your content strategy</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">What are your LinkedIn goals?</h3>
                <div className="flex flex-wrap gap-2">
                  {CONTENT_GOALS.map((goal) => (
                    <button
                      key={goal}
                      onClick={() => toggleMulti(goal, contentGoals, setContentGoals)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                        contentGoals.includes(goal)
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/10"
                      }`}
                    >
                      {goal}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Preferred content styles</h3>
                <div className="flex flex-wrap gap-2">
                  {CONTENT_STYLES.map((style) => (
                    <button
                      key={style}
                      onClick={() => toggleMulti(style, contentStyles, setContentStyles)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border-2 transition-all ${
                        contentStyles.includes(style)
                          ? "border-indigo-500 bg-indigo-500 text-white"
                          : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/10"
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Target Audience */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold font-display text-slate-900 dark:text-white">Who are you writing for?</h2>
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Describe your ideal LinkedIn audience - this powers the AI strategy</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Target Audience Description
                </label>
                <textarea
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value.slice(0, 300))}
                  rows={5}
                  placeholder="e.g. Early-stage startup founders and CTOs in the SaaS space, struggling with team scaling and product-market fit..."
                  className="w-full px-4 py-2.5 border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.06] text-slate-900 dark:text-white rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-slate-400 dark:text-slate-500 text-right mt-1">{targetAudience.length}/300</p>
                <button
                  type="button"
                  onClick={handleGenerateAudience}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 text-sm font-semibold hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate from Profile
                </button>
              </div>

              {/* Summary of choices */}
              <div className="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-4 space-y-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Your content setup:</p>
                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                  <p><span className="font-medium">Positioning:</span> {positioning || "Not selected"}</p>
                  <p><span className="font-medium">Goals:</span> {contentGoals.join(", ") || "None selected"}</p>
                  <p><span className="font-medium">Styles:</span> {contentStyles.join(", ") || "None selected"}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="px-8 py-5 bg-[#F6F8FB] dark:bg-white/[0.06] border-t border-slate-100 dark:border-white/10 flex justify-between items-center">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i + 1 === step ? "w-6 bg-blue-600" : i + 1 < step ? "w-2 bg-blue-600/60" : "w-2 bg-slate-300 dark:bg-white/10"
                }`}
              />
            ))}
          </div>

          {step < totalSteps ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={
                (step === 1 && (!headline.trim() || !industry.trim())) ||
                (step === 2 && !positioning)
              }
              className="flex items-center gap-2 text-sm font-semibold text-white bg-blue-600 px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || !targetAudience.trim()}
              className="flex items-center gap-2 text-sm font-semibold text-white bg-blue-600 px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Setting up..." : "Start Creating"}
              <CheckCircle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
