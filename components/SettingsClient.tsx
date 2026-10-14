"use client";

import DeleteAccountSection from "@/components/DeleteAccountSection";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, CheckCircle, Plus, X, CreditCard, AlertCircle, AlertTriangle, RefreshCw, ChevronDown } from "lucide-react";
import Avatar from "@/components/Avatar";
import { cn, safeJsonParse } from "@/lib/utils";
import { parsePostingSchedule, type PostingSchedule } from "@/lib/posting-schedule";
import {
  resolveToneKey,
  MIN_HEADLINE_CHARS,
  MIN_SUMMARY_CHARS,
  MIN_SKILLS,
  MIN_CONTENT_STYLES,
  MIN_AUDIENCE_CHARS,
  MAX_AUDIENCE_CHARS,
  type ProfileGap,
} from "@/lib/profile-completeness";

interface Subscription {
  status: string;
  trialEnd: Date | string | null;
  currentPeriodEnd: Date | string | null;
  razorpayCustomerId: string | null;
  razorpaySubscriptionId: string | null;
  currency: string | null;
}

interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  headline?: string | null;
  summary?: string | null;
  skills?: string | null;
  industry?: string | null;
  tonePrefs?: string | null;
  positioning?: string | null;
  contentGoals?: string | null;
  contentStyles?: string | null;
  targetAudience?: string | null;
  humanMode?: boolean | null;
  postingSchedule?: string | null;
  postSignature?: string | null;
  timezone?: string | null;
  subscription?: Subscription | null;
}

const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "Marketing", "Sales",
  "Education", "Consulting", "Legal", "Real Estate", "Media",
  "Manufacturing", "Retail", "Non-profit", "Other",
];

const TONES = [
  { value: "professional", label: "Professional", desc: "Formal, data-driven, industry expert" },
  { value: "conversational", label: "Conversational", desc: "Friendly, approachable, relatable" },
  { value: "inspirational", label: "Inspirational", desc: "Motivating, story-driven, uplifting" },
  { value: "educational", label: "Educational", desc: "Teaching, how-to, step-by-step" },
];

const POSITIONING_OPTIONS = [
  { value: "Thought Leader", desc: "Share bold opinions and future predictions" },
  { value: "Industry Expert", desc: "Demonstrate deep technical knowledge" },
  { value: "Storyteller", desc: "Engage through personal journeys" },
  { value: "Educator", desc: "Teach practical skills and frameworks" },
  { value: "Entertainer", desc: "Combine insight with humor and personality" },
  { value: "Contrarian", desc: "Challenge conventional wisdom and mainstream thinking" },
  { value: "Practitioner", desc: "Share real-world experience and tactical insights" },
  { value: "Community Builder", desc: "Connect people and foster meaningful conversations" },
];

import ChipMultiSelect from "@/components/ChipMultiSelect";

const CONTENT_GOALS = [
  "Lead Generation", "Network Building", "Brand Awareness",
  "Job Seeking", "Sales / Business Development", "Recruiting Top Talent",
];

const CONTENT_STYLES = [
  "Problem Agitation Solution", "Narrative / Story", "List / Tips",
  "Data-driven Insights", "Personal Story", "Case Study",
  "How-to / Tutorial", "Motivational", "Contrarian Take",
  "Q&A Format", "Behind the Scenes", "Predictions & Trends",
  "Lessons Learned", "Social Proof / Results",
];

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Below-field note: the server's reason when a save was rejected, otherwise a
 * live count against the minimum the AI prompts need.
 *
 * Thresholds come from lib/profile-completeness.ts, the same module the profile
 * route validates with, so this can never promise a value the save will refuse.
 */
function FieldNote({
  error,
  count,
  min,
  max,
  hint,
}: {
  error?: string;
  count?: number;
  min?: number;
  max?: number;
  hint?: string;
}) {
  if (error) {
    return (
      <p className="flex items-start gap-1.5 text-xs text-danger mt-1">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />
        {error}
      </p>
    );
  }
  if (count === undefined) {
    return hint ? <p className="text-xs text-ink-muted mt-1">{hint}</p> : null;
  }
  const short = min !== undefined && count < min;
  return (
    <div className="flex items-start justify-between gap-3 mt-1">
      {hint ? <p className="text-xs text-ink-muted">{hint}</p> : <span />}
      <p
        className={`text-xs flex-shrink-0 ${
          short ? "text-warning" : "text-ink-muted"
        }`}
      >
        {max !== undefined ? `${count}/${max}` : count}
        {short ? ` - ${min - count} more needed` : ""}
      </p>
    </div>
  );
}

export default function SettingsClient({ user }: { user: User | null }) {
  const router = useRouter();

  // Basic profile
  const [headline, setHeadline] = useState(user?.headline ?? "");
  const [summary, setSummary] = useState(user?.summary ?? "");
  const [industry, setIndustry] = useState(user?.industry ?? "");
  // safeJsonParse, not a bare JSON.parse. These columns hold JSON in a TEXT
  // field, and one corrupt or double-encoded row used to throw during render -
  // which 500'd the entire Settings page, leaving the user no way to fix the
  // very field that was broken.
  const [skills, setSkills] = useState<string[]>(() =>
    safeJsonParse<string[]>(user?.skills, [])
  );
  const [skillInput, setSkillInput] = useState("");
  const [tone, setTone] = useState<string>(
    () => resolveToneKey(user?.tonePrefs) ?? "professional"
  );

  // Content positioning
  const [positioning, setPositioning] = useState(user?.positioning ?? "");
  const [contentGoals, setContentGoals] = useState<string[]>(() =>
    safeJsonParse<string[]>(user?.contentGoals, [])
  );
  const [contentStyles, setContentStyles] = useState<string[]>(() =>
    safeJsonParse<string[]>(user?.contentStyles, [])
  );
  const [targetAudience, setTargetAudience] = useState(user?.targetAudience ?? "");

  // Human mode
  const [humanMode, setHumanMode] = useState(user?.humanMode ?? false);

  // Post signature
  const [postSignature, setPostSignature] = useState(user?.postSignature ?? "");

  // Posting schedule. Parsed through the shared helper so the default shown here
  // is byte-for-byte the default the scheduler applies (and malformed JSON stored
  // on the user can no longer throw during render).
  const [postingSchedule, setPostingSchedule] = useState<PostingSchedule>(() =>
    parsePostingSchedule(user?.postingSchedule)
  );

  // Timezone
  const [timezone, setTimezone] = useState(
    user?.timezone ?? (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "Asia/Kolkata"; }
    })()
  );

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  /** Per-field reasons returned by the profile route on a 400. */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  /** Completeness gaps on the SAVED row - what still blocks generation. */
  const [profileGaps, setProfileGaps] = useState<ProfileGap[]>([]);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [invoices, setInvoices] = useState<Array<{
    id: string; date: string | null; amount: number;
    currency: string; status: string; method?: string;
  }>>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesLoaded, setInvoicesLoaded] = useState(false);

  // LinkedIn token status
  const [tokenStatus, setTokenStatus] = useState<{
    hasToken: boolean;
    isExpired: boolean;
    expiresInDays: number | null;
    refreshable: boolean;
  } | null>(null);

  useEffect(() => {
    fetch("/api/profile/token-status")
      .then((r) => r.json())
      .then(setTokenStatus)
      .catch(() => null);
  }, []);

  async function loadInvoices() {
    setInvoicesLoading(true);
    try {
      const res = await fetch("/api/subscription/invoices");
      const data = await res.json();
      setInvoices(data.invoices || []);
      setInvoicesLoaded(true);
    } catch (err) {
      console.error("Failed to load invoices:", err);
    } finally {
      setInvoicesLoading(false);
    }
  }

  function addSkill() {
    const s = skillInput.trim();
    if (s && !skills.includes(s)) {
      setSkills([...skills, s]);
      setSkillInput("");
    }
  }

  function removeSkill(skill: string) {
    setSkills(skills.filter((s) => s !== skill));
  }

  function toggleDay(day: string) {
    setPostingSchedule((s) => ({
      ...s,
      days: s.days.includes(day) ? s.days.filter((d) => d !== day) : [...s.days, day],
    }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setFieldErrors({});
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline,
          summary,
          industry,
          skills,
          tonePrefs: tone,
          positioning,
          contentGoals,
          contentStyles,
          targetAudience,
          humanMode,
          postingSchedule,
          postSignature,
          timezone,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The profile route answers 400 with per-field reasons when a
        // content-critical field is too thin to generate from. Surface them
        // against the fields rather than as one opaque banner.
        if (data.fieldErrors && typeof data.fieldErrors === "object") {
          setFieldErrors(data.fieldErrors as Record<string, string>);
        }
        throw new Error(data.error || `Save failed (${res.status})`);
      }
      // The saved row's completeness verdict, so the user learns here that
      // generation is still blocked instead of on their next Generate click.
      setProfileGaps(Array.isArray(data.profile?.gaps) ? data.profile.gaps : []);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelSubscription() {
    setCancelLoading(true);
    try {
      const res = await fetch("/api/subscription/cancel", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setShowCancelConfirm(false);
        router.refresh();
      }
    } catch (err) {
      console.error("Cancel error:", err);
    } finally {
      setCancelLoading(false);
    }
  }

  const sub = user?.subscription;
  const now = new Date();
  const trialDaysLeft = sub?.trialEnd
    ? Math.max(0, Math.ceil((new Date(sub.trialEnd).getTime() - now.getTime()) / 86400000))
    : 0;

  return (
    <div className="max-w-3xl space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-ink">Settings</h1>
          <p className="text-ink-muted mt-1">Manage your profile and content preferences</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-control font-medium hover:opacity-90 disabled:opacity-70 shadow-e1"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      {/* Save error banner */}
      {saveError && (
        <div className="flex items-center gap-3 bg-danger-soft border border-red-200 dark:border-red-800 text-danger px-4 py-3 rounded-control text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {saveError}
        </div>
      )}

      {/* What still blocks content generation, as of the last successful save. */}
      {profileGaps.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-control px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Saved - but content generation is still blocked
          </div>
          <ul className="mt-2 space-y-1">
            {profileGaps.map((g) => (
              <li key={g.key} className="text-xs text-amber-700 dark:text-amber-300/90">
                <span className="font-medium">{g.label}:</span> {g.hint}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Profile Overview */}
      <div className="bg-surface rounded-panel border border-line shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <Avatar src={user?.image} name={user?.name} size={64} />
          <div>
            <h2 className="font-semibold text-ink">{user?.name}</h2>
            <p className="text-sm text-ink-muted">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full inline-block">
                LinkedIn Connected
              </span>
              {tokenStatus && (
                tokenStatus.isExpired ? (
                  <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Token expired - sign out &amp; sign in to reconnect
                  </span>
                ) : tokenStatus.expiresInDays !== null && tokenStatus.expiresInDays <= 14 ? (
                  <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    Token expires in {tokenStatus.expiresInDays} days
                    {tokenStatus.refreshable && " (auto-refresh enabled)"}
                  </span>
                ) : tokenStatus.expiresInDays !== null ? (
                  <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full inline-block">
                    Token valid ({tokenStatus.expiresInDays} days)
                  </span>
                ) : null
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-ink mb-1">
              Professional Headline
            </label>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Senior Product Manager at Acme - I help B2B teams ship faster"
              className="w-full px-4 py-2.5 border border-line rounded-control text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-surface dark:text-white"
            />
            <FieldNote
              error={fieldErrors.headline}
              count={headline.trim().length}
              min={MIN_HEADLINE_CHARS}
              hint="Say what you do and who you do it for."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1">Industry</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="select-field w-full pl-4 pr-11 py-2.5 border border-line rounded-control text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-surface dark:text-white"
            >
              <option value="">Select industry</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-ink mb-1">
              Professional Summary
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={5}
              placeholder="e.g. I've spent 9 years in B2B SaaS product, the last 4 leading a 12-person team. I've shipped three platform rewrites and killed two of my own features. Most teams I meet over-index on roadmap theatre and under-invest in talking to churned customers..."
              className="w-full px-4 py-2.5 border border-line rounded-control text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 bg-surface dark:text-white"
            />
            <FieldNote
              error={fieldErrors.summary}
              count={summary.trim().length}
              min={MIN_SUMMARY_CHARS}
              hint="The single biggest driver of how personal your posts read."
            />
          </div>
        </div>

        {/* Skills */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-ink mb-2">Skills & Topics</label>
          <div className="flex gap-2 mb-3">
            <input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
              placeholder="Add a skill or topic..."
              className="flex-1 px-4 py-2 border border-line rounded-control text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-surface dark:text-white"
            />
            <button
              onClick={addSkill}
              className="flex items-center gap-1 px-4 py-2 border border-line rounded-control text-sm hover:bg-surface-sunken transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span key={skill} className="flex items-center gap-1 text-sm px-3 py-1 bg-accent-soft dark:bg-accent/10 text-accent rounded-full">
                {skill}
                <button onClick={() => removeSkill(skill)} className="hover:text-accent dark:hover:text-accent">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <FieldNote
            error={fieldErrors.skills}
            count={skills.length}
            min={MIN_SKILLS}
            hint="These become your weekly content pillars - be specific."
          />
        </div>
      </div>

      {/* Tone & Voice */}
      <div className="bg-surface rounded-panel border border-line shadow-sm p-6">
        <h2 className="font-semibold font-display text-ink mb-4">Tone & Voice</h2>
        <div className="grid grid-cols-2 gap-3">
          {TONES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTone(t.value)}
              className={cn(
                "p-4 rounded-control border-2 text-left transition-all",
                tone === t.value
                  ? "border-accent bg-accent-soft"
                  : "border-line hover:border-line-strong "
              )}
            >
              <p className={cn("font-medium text-sm", tone === t.value ? "text-accent" : "text-ink")}>
                {t.label}
              </p>
              <p className="text-xs text-ink-muted mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Content Positioning */}
      <div className="bg-surface rounded-panel border border-line shadow-sm p-6">
        <h2 className="font-semibold font-display text-ink mb-1">Content Positioning</h2>
        <p className="text-sm text-ink-muted mb-4">How you want to show up on LinkedIn</p>
        <div className="space-y-2">
          {POSITIONING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPositioning(opt.value)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-control border-2 text-left transition-all",
                positioning === opt.value
                  ? "border-accent bg-accent-soft"
                  : "border-line hover:border-line-strong "
              )}
            >
              <div className="flex-1">
                <p className={cn("font-medium text-sm", positioning === opt.value ? "text-accent" : "text-ink")}>
                  {opt.value}
                </p>
                <p className="text-xs text-ink-muted">{opt.desc}</p>
              </div>
              {positioning === opt.value && <CheckCircle className="w-4 h-4 text-accent flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* Content Goals & Styles */}
      <div className="bg-surface rounded-panel border border-line shadow-sm p-6 space-y-6">
        <div>
          <h2 className="font-semibold font-display text-ink mb-1">LinkedIn Goals</h2>
          <div className="mt-3">
            <ChipMultiSelect
              options={CONTENT_GOALS}
              value={contentGoals}
              onChange={setContentGoals}
              accent="blue"
              inputId="settings-custom-goal"
              addPlaceholder="Add your own goal..."
            />
          </div>
        </div>

        <div>
          <h2 className="font-semibold font-display text-ink mb-1">Content Styles</h2>
          <p className="text-sm text-ink-muted">The types of content that resonate with you</p>
          <div className="mt-3">
            <ChipMultiSelect
              options={CONTENT_STYLES}
              value={contentStyles}
              onChange={setContentStyles}
              accent="indigo"
              inputId="settings-custom-style"
              addPlaceholder="Add a style in your own words..."
            />
          </div>
          <FieldNote
            error={fieldErrors.contentStyles}
            count={contentStyles.length}
            min={MIN_CONTENT_STYLES}
            hint="Each post in a batch uses a different style, so fewer than three makes them all read the same."
          />
        </div>

        <div>
          <h2 className="font-semibold font-display text-ink mb-1">Target Audience</h2>
          <textarea
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value.slice(0, MAX_AUDIENCE_CHARS))}
            rows={4}
            placeholder="e.g. Seed-stage B2B SaaS founders with 5-20 employees. Their biggest challenge right now: they keep shipping features nobody asked for and churn is climbing. What they actually want: a repeatable way to decide what to build next without guessing."
            className="w-full mt-2 px-4 py-2.5 border border-line rounded-control text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 bg-surface dark:text-white"
          />
          <FieldNote
            error={fieldErrors.targetAudience}
            count={targetAudience.trim().length}
            min={MIN_AUDIENCE_CHARS}
            max={MAX_AUDIENCE_CHARS}
            hint="Who they are, what they are stuck on, and what they want."
          />
        </div>
      </div>

      {/* Human Mode */}
      <div className="bg-surface rounded-panel border border-line shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold font-display text-ink">Human Mode (Global Default)</h2>
            <p className="text-sm text-ink-muted mt-1">
              Makes AI-generated content sound more naturally human - slight variations in style
              and phrasing that make posts less detectable as AI-generated.
            </p>
          </div>
          <button
            onClick={() => setHumanMode(!humanMode)}
            className={cn(
              "relative w-14 h-7 rounded-full transition-colors flex-shrink-0 ml-6",
              humanMode ? "bg-accent" : "bg-surface-sunken"
            )}
          >
            <span
              className={cn(
                "absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform",
                humanMode ? "translate-x-8" : "translate-x-1"
              )}
            />
          </button>
        </div>
        <p className="text-xs text-ink-muted mt-3">
          {humanMode
            ? "Human Mode is ON - all generated posts will include natural writing variations"
            : "Human Mode is OFF - clean, polished AI output (can be toggled per-post)"}
        </p>
      </div>

      {/* Post Signature */}
      <div className="bg-surface rounded-panel border border-line shadow-sm p-6">
        <h2 className="font-semibold font-display text-ink mb-1">Post Signature</h2>
        <p className="text-sm text-ink-muted mb-3">
          This text is automatically appended to every post when published to LinkedIn.
          Use it for a consistent sign-off, tagline, or call-to-action.
        </p>
        <textarea
          value={postSignature}
          onChange={(e) => setPostSignature(e.target.value)}
          rows={3}
          placeholder={`e.g.\n\nFollow me for more insights on [topic].\nBook a free call: https://calendly.com/yourname`}
          className="w-full px-4 py-2.5 border border-line rounded-control text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-surface dark:text-white"
        />
        <p className="text-xs text-ink-muted mt-1 text-right">{postSignature.length} chars</p>
      </div>

      {/* Posting Schedule */}
      <div className="bg-surface rounded-panel border border-line shadow-sm p-6">
        <h2 className="font-semibold font-display text-ink mb-1">Posting Schedule</h2>
        <p className="text-sm text-ink-muted mb-4">
          Posts set to &quot;Ready&quot; will auto-publish to LinkedIn at these times
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              className={cn(
                "px-4 py-2 rounded-control text-sm font-medium border-2 transition-all",
                postingSchedule.days.includes(day)
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-line text-ink-muted hover:border-line-strong "
              )}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <label className="text-sm font-medium text-ink">Posting time:</label>
          <input
            type="time"
            value={postingSchedule.time}
            onChange={(e) => setPostingSchedule((s) => ({ ...s, time: e.target.value }))}
            className="px-3 py-2 border border-line rounded-control text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 bg-surface dark:text-white"
          />
          <p className="text-xs text-ink-muted">{timezone.replace(/_/g, " ")}</p>
        </div>

        {/* Timezone with search */}
        <TimezoneSelect value={timezone} onChange={setTimezone} />
      </div>

      {/* Subscription */}
      <div className="bg-surface rounded-panel border border-line shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold font-display text-ink flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-ink-muted" />
              Subscription
            </h2>
            {sub ? (
              <div className="mt-2 space-y-1">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    sub.status === "active" ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" :
                    sub.status === "trialing" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400" :
                    "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400"
                  )}>
                    {sub.status === "trialing"
                      ? `Free Trial - ${trialDaysLeft} day${trialDaysLeft !== 1 ? "s" : ""} left`
                      : sub.status === "active"
                      ? `Active - ${sub.currency === "USD" ? "$19" : "\u20B9999"}/month`
                      : sub.status}
                  </span>
                </div>
                {sub.currentPeriodEnd && sub.status === "active" && (
                  <p className="text-xs text-ink-muted">
                    Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
                {sub.trialEnd && sub.status === "trialing" && (
                  <p className="text-xs text-ink-muted">
                    Trial ends {new Date(sub.trialEnd).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-muted mt-1">No subscription found</p>
            )}
          </div>

          {sub?.razorpaySubscriptionId && sub.status === "active" ? (
            <div className="relative">
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="flex items-center gap-2 text-sm px-4 py-2 border border-red-200 dark:border-red-800 text-danger rounded-control hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Cancel Subscription
              </button>
              {showCancelConfirm && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-surface border border-line rounded-control shadow-xl z-20 p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-ink">Cancel subscription?</p>
                      <p className="text-xs text-ink-muted mt-1">
                        Your access will continue until the end of the current billing period.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCancelSubscription}
                      disabled={cancelLoading}
                      className="flex-1 py-2 text-xs font-semibold bg-danger text-white rounded-control hover:bg-red-700 transition-colors disabled:opacity-70 flex items-center justify-center gap-1"
                    >
                      {cancelLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                      Yes, Cancel
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="flex-1 py-2 text-xs font-semibold border border-line text-ink rounded-control hover:bg-surface-sunken transition-colors"
                    >
                      Keep Plan
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : sub?.status !== "active" ? (
            <a
              href="/subscribe"
              className="flex items-center gap-2 text-sm px-4 py-2 bg-accent text-white rounded-control hover:bg-accent-hover transition-colors"
            >
              Subscribe Now
            </a>
          ) : null}
        </div>

        {/* Invoice History */}
        {sub?.razorpaySubscriptionId && (
          <div className="mt-6 pt-6 border-t border-line">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-ink">
                Invoice History
              </h3>
              {!invoicesLoaded && !invoicesLoading && (
                <button
                  onClick={loadInvoices}
                  className="text-sm text-accent hover:underline"
                >
                  Load Invoices
                </button>
              )}
            </div>
            {invoicesLoading && (
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading invoices...
              </div>
            )}
            {invoicesLoaded && invoices.length === 0 && (
              <p className="text-sm text-ink-muted">
                No invoices found yet.
              </p>
            )}
            {invoices.length > 0 && (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between text-sm py-2.5 px-3 rounded-control bg-surface-sunken"
                  >
                    <span className="text-ink-muted min-w-[90px]">
                      {inv.date
                        ? new Date(inv.date).toLocaleDateString()
                        : "-"}
                    </span>
                    <span className="text-ink font-medium">
                      {inv.currency === "USD" ? "$" : "₹"}
                      {inv.amount}
                    </span>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        inv.status === "captured"
                          ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                          : inv.status === "authorized"
                            ? "bg-accent-soft dark:bg-accent-soft/40 text-accent"
                            : "bg-surface-sunken text-ink-muted"
                      )}
                    >
                      {inv.status === "captured" ? "Paid" : inv.status}
                    </span>
                    {inv.method && (
                      <span className="text-xs text-ink-muted capitalize">
                        {inv.method}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save button at bottom */}
      <div className="pb-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white py-3 rounded-control font-semibold hover:opacity-90 disabled:opacity-70"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : saved ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          {saved ? "All changes saved!" : "Save All Settings"}
        </button>
      </div>

      {/* Erasure (DPDP s.12(3)). Last on the page, visually separated, and
          high-friction by design - it is irreversible. */}
      <DeleteAccountSection />
    </div>
  );
}

// ── Searchable Timezone Picker ──────────────────────────────────────────────

function TimezoneSelect({ value, onChange }: { value: string; onChange: (tz: string) => void }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const allTimezones = Intl.supportedValuesOf("timeZone");
  const filtered = search
    ? allTimezones.filter((tz) => tz.toLowerCase().replace(/_/g, " ").includes(search.toLowerCase()))
    : allTimezones;

  return (
    <div className="mt-4 relative">
      <label className="text-sm font-medium text-ink mb-1 block">Timezone</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 border border-line rounded-control text-sm text-left focus:outline-none focus:ring-2 focus:ring-accent/30 bg-surface dark:text-white flex items-center justify-between"
      >
        <span>{value.replace(/_/g, " ")}</span>
        <ChevronDown className="w-4 h-4 text-ink-muted" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-[#0D131F] border border-line rounded-control shadow-xl max-h-64 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-line">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search timezone..."
              autoFocus
              className="w-full px-3 py-2 text-sm border border-line rounded-control focus:outline-none focus:ring-2 focus:ring-accent/30 bg-surface dark:text-white"
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <p className="text-sm text-ink-muted p-3 text-center">No matches</p>
            ) : (
              filtered.map((tz) => (
                <button
                  key={tz}
                  onClick={() => { onChange(tz); setOpen(false); setSearch(""); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm hover:bg-accent-soft dark:hover:bg-accent-soft transition-colors",
                    tz === value ? "bg-accent-soft text-accent font-medium" : "text-ink"
                  )}
                >
                  {tz.replace(/_/g, " ")}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(""); }} />
      )}

      <p className="text-xs text-ink-muted mt-1">
        Posts will be scheduled and auto-published in this timezone
      </p>
    </div>
  );
}
