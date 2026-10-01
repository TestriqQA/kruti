"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, Loader2, CheckCircle, Plus, X, CreditCard, AlertCircle, AlertTriangle, RefreshCw, ChevronDown } from "lucide-react";
import Avatar from "@/components/Avatar";
import { cn } from "@/lib/utils";
import { parsePostingSchedule, type PostingSchedule } from "@/lib/posting-schedule";

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

export default function SettingsClient({ user }: { user: User | null }) {
  const router = useRouter();

  // Basic profile
  const [headline, setHeadline] = useState(user?.headline ?? "");
  const [summary, setSummary] = useState(user?.summary ?? "");
  const [industry, setIndustry] = useState(user?.industry ?? "");
  const [skills, setSkills] = useState<string[]>(
    user?.skills ? JSON.parse(user.skills) : []
  );
  const [skillInput, setSkillInput] = useState("");
  const [tone, setTone] = useState(
    user?.tonePrefs ? JSON.parse(user.tonePrefs) : "professional"
  );

  // Content positioning
  const [positioning, setPositioning] = useState(user?.positioning ?? "");
  const [contentGoals, setContentGoals] = useState<string[]>(
    user?.contentGoals ? JSON.parse(user.contentGoals) : []
  );
  const [contentStyles, setContentStyles] = useState<string[]>(
    user?.contentStyles ? JSON.parse(user.contentStyles) : []
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

  function toggleMulti(value: string, list: string[], setList: (v: string[]) => void) {
    setList(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
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
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Save failed (${res.status})`);
      }
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
          <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">Settings</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Manage your profile and content preferences</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium hover:opacity-90 disabled:opacity-70 shadow-md shadow-blue-200 dark:shadow-blue-900/30"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      {/* Save error banner */}
      {saveError && (
        <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded-xl text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {saveError}
        </div>
      )}

      {/* Profile Overview */}
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-6">
        <div className="flex items-center gap-4 mb-6">
          <Avatar src={user?.image} name={user?.name} size={64} />
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">{user?.name}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full inline-block">
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
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Professional Headline
            </label>
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Senior Product Manager at Acme Corp"
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white dark:bg-white/[0.06] dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Industry</label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="select-field w-full pl-4 pr-11 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-white/[0.06] dark:text-white"
            >
              <option value="">Select industry</option>
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>{ind}</option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Professional Summary
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder="Describe your expertise..."
              className="w-full px-4 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-white/[0.06] dark:text-white"
            />
          </div>
        </div>

        {/* Skills */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Skills & Topics</label>
          <div className="flex gap-2 mb-3">
            <input
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
              placeholder="Add a skill or topic..."
              className="flex-1 px-4 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-white/[0.06] dark:text-white"
            />
            <button
              onClick={addSkill}
              className="flex items-center gap-1 px-4 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors dark:text-slate-300"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span key={skill} className="flex items-center gap-1 text-sm px-3 py-1 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full">
                {skill}
                <button onClick={() => removeSkill(skill)} className="hover:text-blue-900 dark:hover:text-blue-200">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tone & Voice */}
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-6">
        <h2 className="font-semibold font-display text-slate-900 dark:text-white mb-4">Tone & Voice</h2>
        <div className="grid grid-cols-2 gap-3">
          {TONES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTone(t.value)}
              className={cn(
                "p-4 rounded-xl border-2 text-left transition-all",
                tone === t.value
                  ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                  : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-gray-600"
              )}
            >
              <p className={cn("font-medium text-sm", tone === t.value ? "text-blue-600 dark:text-blue-400" : "text-gray-800 dark:text-gray-200")}>
                {t.label}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Content Positioning */}
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-6">
        <h2 className="font-semibold font-display text-slate-900 dark:text-white mb-1">Content Positioning</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">How you want to show up on LinkedIn</p>
        <div className="space-y-2">
          {POSITIONING_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPositioning(opt.value)}
              className={cn(
                "w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all",
                positioning === opt.value
                  ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                  : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-gray-600"
              )}
            >
              <div className="flex-1">
                <p className={cn("font-medium text-sm", positioning === opt.value ? "text-blue-600 dark:text-blue-400" : "text-gray-800 dark:text-gray-200")}>
                  {opt.value}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{opt.desc}</p>
              </div>
              {positioning === opt.value && <CheckCircle className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* Content Goals & Styles */}
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-6 space-y-6">
        <div>
          <h2 className="font-semibold font-display text-slate-900 dark:text-white mb-1">LinkedIn Goals</h2>
          <div className="flex flex-wrap gap-2 mt-3">
            {CONTENT_GOALS.map((goal) => (
              <button
                key={goal}
                onClick={() => toggleMulti(goal, contentGoals, setContentGoals)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium border-2 transition-all",
                  contentGoals.includes(goal)
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-gray-600"
                )}
              >
                {goal}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-semibold font-display text-slate-900 dark:text-white mb-1">Content Styles</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">The types of content that resonate with you</p>
          <div className="flex flex-wrap gap-2 mt-3">
            {CONTENT_STYLES.map((style) => (
              <button
                key={style}
                onClick={() => toggleMulti(style, contentStyles, setContentStyles)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium border-2 transition-all",
                  contentStyles.includes(style)
                    ? "border-indigo-500 bg-indigo-500 text-white"
                    : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-gray-600"
                )}
              >
                {style}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-semibold font-display text-slate-900 dark:text-white mb-1">Target Audience</h2>
          <textarea
            value={targetAudience}
            onChange={(e) => setTargetAudience(e.target.value.slice(0, 300))}
            rows={3}
            placeholder="e.g. Early-stage startup founders and CTOs in the SaaS space..."
            className="w-full mt-2 px-4 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-white/[0.06] dark:text-white"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 text-right">{targetAudience.length}/300</p>
        </div>
      </div>

      {/* Human Mode */}
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold font-display text-slate-900 dark:text-white">Human Mode (Global Default)</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Makes AI-generated content sound more naturally human - slight variations in style
              and phrasing that make posts less detectable as AI-generated.
            </p>
          </div>
          <button
            onClick={() => setHumanMode(!humanMode)}
            className={cn(
              "relative w-14 h-7 rounded-full transition-colors flex-shrink-0 ml-6",
              humanMode ? "bg-blue-600" : "bg-slate-200 dark:bg-gray-600"
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
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
          {humanMode
            ? "Human Mode is ON - all generated posts will include natural writing variations"
            : "Human Mode is OFF - clean, polished AI output (can be toggled per-post)"}
        </p>
      </div>

      {/* Post Signature */}
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-6">
        <h2 className="font-semibold font-display text-slate-900 dark:text-white mb-1">Post Signature</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
          This text is automatically appended to every post when published to LinkedIn.
          Use it for a consistent sign-off, tagline, or call-to-action.
        </p>
        <textarea
          value={postSignature}
          onChange={(e) => setPostSignature(e.target.value)}
          rows={3}
          placeholder={`e.g.\n\nFollow me for more insights on [topic].\nBook a free call: https://calendly.com/yourname`}
          className="w-full px-4 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white dark:bg-white/[0.06] dark:text-white"
        />
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 text-right">{postSignature.length} chars</p>
      </div>

      {/* Posting Schedule */}
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-6">
        <h2 className="font-semibold font-display text-slate-900 dark:text-white mb-1">Posting Schedule</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Posts set to &quot;Ready&quot; will auto-publish to LinkedIn at these times
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              className={cn(
                "px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all",
                postingSchedule.days.includes(day)
                  ? "border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                  : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-gray-600"
              )}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Posting time:</label>
          <input
            type="time"
            value={postingSchedule.time}
            onChange={(e) => setPostingSchedule((s) => ({ ...s, time: e.target.value }))}
            className="px-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-white/[0.06] dark:text-white"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500">{timezone.replace(/_/g, " ")}</p>
        </div>

        {/* Timezone with search */}
        <TimezoneSelect value={timezone} onChange={setTimezone} />
      </div>

      {/* Subscription */}
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold font-display text-slate-900 dark:text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-slate-400" />
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
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                  </p>
                )}
                {sub.trialEnd && sub.status === "trialing" && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Trial ends {new Date(sub.trialEnd).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">No subscription found</p>
            )}
          </div>

          {sub?.razorpaySubscriptionId && sub.status === "active" ? (
            <div className="relative">
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="flex items-center gap-2 text-sm px-4 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Cancel Subscription
              </button>
              {showCancelConfirm && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-20 p-4">
                  <div className="flex items-start gap-2 mb-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">Cancel subscription?</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Your access will continue until the end of the current billing period.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCancelSubscription}
                      disabled={cancelLoading}
                      className="flex-1 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-70 flex items-center justify-center gap-1"
                    >
                      {cancelLoading && <Loader2 className="w-3 h-3 animate-spin" />}
                      Yes, Cancel
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="flex-1 py-2 text-xs font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
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
              className="flex items-center gap-2 text-sm px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
            >
              Subscribe Now
            </a>
          ) : null}
        </div>

        {/* Invoice History */}
        {sub?.razorpaySubscriptionId && (
          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-white/10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Invoice History
              </h3>
              {!invoicesLoaded && !invoicesLoading && (
                <button
                  onClick={loadInvoices}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Load Invoices
                </button>
              )}
            </div>
            {invoicesLoading && (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading invoices...
              </div>
            )}
            {invoicesLoaded && invoices.length === 0 && (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No invoices found yet.
              </p>
            )}
            {invoices.length > 0 && (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between text-sm py-2.5 px-3 rounded-lg bg-slate-50 dark:bg-white/[0.06]"
                  >
                    <span className="text-slate-600 dark:text-slate-400 min-w-[90px]">
                      {inv.date
                        ? new Date(inv.date).toLocaleDateString()
                        : "-"}
                    </span>
                    <span className="text-slate-900 dark:text-white font-medium">
                      {inv.currency === "USD" ? "$" : "₹"}
                      {inv.amount}
                    </span>
                    <span
                      className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        inv.status === "captured"
                          ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                          : inv.status === "authorized"
                            ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400"
                            : "bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400"
                      )}
                    >
                      {inv.status === "captured" ? "Paid" : inv.status}
                    </span>
                    {inv.method && (
                      <span className="text-xs text-slate-400 capitalize">
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
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold hover:opacity-90 disabled:opacity-70"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : saved ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          {saved ? "All changes saved!" : "Save All Settings"}
        </button>
      </div>
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
      <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">Timezone</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-white/[0.06] dark:text-white flex items-center justify-between"
      >
        <span>{value.replace(/_/g, " ")}</span>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white dark:bg-[#0D131F] border border-slate-200 dark:border-white/10 rounded-xl shadow-xl max-h-64 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-slate-100 dark:border-white/10">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search timezone..."
              autoFocus
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-white/[0.06] dark:text-white"
            />
          </div>
          <div className="overflow-y-auto max-h-48">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-400 p-3 text-center">No matches</p>
            ) : (
              filtered.map((tz) => (
                <button
                  key={tz}
                  onClick={() => { onChange(tz); setOpen(false); setSearch(""); }}
                  className={cn(
                    "w-full text-left px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors",
                    tz === value ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium" : "text-slate-700 dark:text-slate-300"
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

      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
        Posts will be scheduled and auto-published in this timezone
      </p>
    </div>
  );
}
