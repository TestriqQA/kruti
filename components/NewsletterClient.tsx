"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Mail, Sparkles, Loader2, ChevronDown, ChevronUp,
  Copy, CheckCircle, Calendar, Send, Trash2, Clock, X,
  Pencil, Save,
} from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { useSession } from "next-auth/react";

interface Newsletter {
  id: string;
  title: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date | string | null;
  createdAt: Date | string;
}

interface NewsletterContent {
  title: string;
  subject: string;
  intro: { hook: string; preview: string };
  sections: Array<{ heading: string; content: string; keyTakeaway: string }>;
  featuredInsight: { quote: string; context: string };
  cta: { heading: string; text: string; action: string };
  signoff: string;
}

interface Props {
  newsletters: Newsletter[];
  currentMonth: number;
  currentYear: number;
}

function statusBadge(status: string) {
  if (status === "sent")
    return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-medium">Sent</span>;
  if (status === "scheduled")
    return <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 font-medium">Scheduled</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 font-medium">Draft</span>;
}

export default function NewsletterClient({ newsletters: initial, currentMonth, currentYear }: Props) {
  const router = useRouter();
  const { data: sessionData } = useSession();
  const isTrialExpired = sessionData?.user?.subscriptionStatus === "trialing" &&
    sessionData?.user?.trialEnd != null && new Date(sessionData.user.trialEnd) < new Date();
  const [newsletters, setNewsletters] = useState<Newsletter[]>(initial);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(initial[0]?.id ?? null);

  const monthName = new Date(currentYear, currentMonth - 1).toLocaleString("default", { month: "long" });

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/generate/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: currentMonth, year: currentYear }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setGenerating(false);
    }
  }

  function updateNewsletter(updated: Newsletter) {
    setNewsletters((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }

  function removeNewsletter(id: string) {
    setNewsletters((prev) => prev.filter((n) => n.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-gray-100 flex items-center gap-2">
            <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Newsletter Planner
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">{newsletters.length} newsletter{newsletters.length !== 1 ? "s" : ""} created</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating || isTrialExpired}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium hover:opacity-90 disabled:opacity-70"
          title={isTrialExpired ? "Subscribe to generate newsletters" : undefined}
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isTrialExpired ? "Subscribe to Generate" : `Generate ${monthName} Newsletter`}
        </button>
      </div>

      {newsletters.length === 0 ? (
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-12 text-center">
          <Mail className="w-12 h-12 text-slate-200 dark:text-slate-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">No newsletters yet</h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            Generate your first newsletter - AI creates it from your content pillars and profile.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating || isTrialExpired}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isTrialExpired ? "Subscribe to Generate" : "Generate Newsletter"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {newsletters.map((nl) => (
            <NewsletterCard
              key={nl.id}
              newsletter={nl}
              expanded={expandedId === nl.id}
              onToggle={() => setExpandedId(expandedId === nl.id ? null : nl.id)}
              onUpdate={updateNewsletter}
              onDelete={() => removeNewsletter(nl.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Newsletter Card ────────────────────────────────────────────────────────

function NewsletterCard({
  newsletter,
  expanded,
  onToggle,
  onUpdate,
  onDelete,
}: {
  newsletter: Newsletter;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (n: Newsletter) => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  let content: NewsletterContent | null = null;
  try { content = JSON.parse(newsletter.body) as NewsletterContent; } catch {}

  const [editContent, setEditContent] = useState<NewsletterContent | null>(content);

  function updateEditField(path: string, value: string) {
    setEditContent((prev) => {
      if (!prev) return prev;
      const clone = JSON.parse(JSON.stringify(prev)) as NewsletterContent;
      const keys = path.split(".");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let obj: any = clone;
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return clone;
    });
  }

  async function handleSaveEdit() {
    if (!editContent) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/newsletter/${newsletter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editContent.title,
          body: JSON.stringify(editContent),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        onUpdate(updated as Newsletter);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    if (!content) return;
    const text = [
      `SUBJECT: ${content.subject}`, "",
      content.intro.hook, content.intro.preview, "",
      ...content.sections.flatMap((s) => [`## ${s.heading}`, s.content, `→ ${s.keyTakeaway}`, ""]),
      `"${content.featuredInsight.quote}"`, content.featuredInsight.context, "",
      `## ${content.cta.heading}`, content.cta.text, content.cta.action, "",
      content.signoff,
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSendNow() {
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/newsletter/${newsletter.id}/send`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setSendError(data.error ?? "Send failed");
      } else {
        onUpdate(data.newsletter as Newsletter);
      }
    } finally {
      setSending(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/newsletter/${newsletter.id}`, { method: "DELETE" });
      onDelete();
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  const isSent = newsletter.status === "sent";

  return (
    <>
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden">
        {/* Header row */}
        <div
          className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
          onClick={onToggle}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Mail className="w-5 h-5 text-purple-700 dark:text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-gray-100 text-sm truncate">{newsletter.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                {formatDate(newsletter.createdAt)}
                {" · "}
                {statusBadge(newsletter.status)}
                {newsletter.scheduledAt && newsletter.status === "scheduled" && (
                  <span className="flex items-center gap-1 text-blue-600">
                    <Clock className="w-3 h-3" />
                    {new Date(newsletter.scheduledAt).toLocaleString([], {
                      month: "short", day: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-3" onClick={(e) => e.stopPropagation()}>
            {sendError && (
              <span className="text-xs text-red-500 mr-1">{sendError}</span>
            )}
            <button
              onClick={handleCopy}
              title="Copy text"
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              {copied ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              {copied ? "Copied" : "Copy"}
            </button>

            {!isSent && (
              <button
                onClick={() => setShowScheduleModal(true)}
                title="Schedule"
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                {newsletter.status === "scheduled" ? "Reschedule" : "Schedule"}
              </button>
            )}

            {!isSent && (
              <button
                onClick={handleSendNow}
                disabled={sending}
                title="Send now to your email"
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:opacity-90 disabled:opacity-60 transition-colors"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Send Now
              </button>
            )}

            <button
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete"
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            {expanded ? <ChevronUp className="w-4 h-4 text-slate-400 ml-1" /> : <ChevronDown className="w-4 h-4 text-slate-400 ml-1" />}
          </div>
        </div>

        {/* Expanded content */}
        {expanded && content && (
          <div className="border-t border-slate-100 dark:border-white/10 p-6 space-y-6">
            {/* Edit / Save toggle */}
            {!isSent && (
              <div className="flex items-center justify-end gap-2">
                {editing ? (
                  <>
                    <button
                      onClick={() => { setEditing(false); setEditContent(content); }}
                      className="text-xs px-3 py-1.5 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] text-slate-600 dark:text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:opacity-90 disabled:opacity-60"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save Changes
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setEditing(true); setEditContent(content); }}
                    className="flex items-center gap-1 text-xs px-3 py-1.5 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] text-slate-600 dark:text-slate-300"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit Content
                  </button>
                )}
              </div>
            )}

            {/* Subject Line */}
            <div className="bg-slate-50 dark:bg-white/[0.06] rounded-xl px-4 py-3">
              <p className="text-xs text-slate-500 font-semibold mb-1">SUBJECT LINE</p>
              {editing && editContent ? (
                <input
                  value={editContent.subject}
                  onChange={(e) => updateEditField("subject", e.target.value)}
                  className="w-full text-sm font-semibold text-slate-900 dark:text-gray-100 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              ) : (
                <p className="text-sm font-semibold text-slate-900 dark:text-gray-100">{content.subject}</p>
              )}
            </div>

            {/* Introduction */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Introduction</h3>
              {editing && editContent ? (
                <div className="space-y-2">
                  <input
                    value={editContent.intro.hook}
                    onChange={(e) => updateEditField("intro.hook", e.target.value)}
                    className="w-full text-sm font-medium text-slate-800 dark:text-gray-200 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="Hook..."
                  />
                  <textarea
                    value={editContent.intro.preview}
                    onChange={(e) => updateEditField("intro.preview", e.target.value)}
                    rows={2}
                    className="w-full text-sm text-slate-600 dark:text-slate-400 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                    placeholder="Preview..."
                  />
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-800 dark:text-gray-200 leading-relaxed font-medium">{content.intro.hook}</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed mt-2">{content.intro.preview}</p>
                </>
              )}
            </div>

            {/* Sections */}
            {(editing && editContent ? editContent.sections : content.sections).map((section, i) => (
              <div key={i} className="border-l-4 border-blue-600 pl-4">
                {editing && editContent ? (
                  <div className="space-y-2">
                    <input
                      value={section.heading}
                      onChange={(e) => updateEditField(`sections.${i}.heading`, e.target.value)}
                      className="w-full font-semibold text-slate-900 dark:text-gray-100 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                    />
                    <textarea
                      value={section.content}
                      onChange={(e) => updateEditField(`sections.${i}.content`, e.target.value)}
                      rows={4}
                      className="w-full text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                    />
                    <input
                      value={section.keyTakeaway}
                      onChange={(e) => updateEditField(`sections.${i}.keyTakeaway`, e.target.value)}
                      className="w-full text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="Key takeaway..."
                    />
                  </div>
                ) : (
                  <>
                    <h3 className="font-semibold text-slate-900 dark:text-gray-100 mb-2">{section.heading}</h3>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{section.content}</p>
                    <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Key Takeaway: {section.keyTakeaway}</p>
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* Featured Insight */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-5">
              {editing && editContent ? (
                <div className="space-y-2">
                  <textarea
                    value={editContent.featuredInsight.quote}
                    onChange={(e) => updateEditField("featuredInsight.quote", e.target.value)}
                    rows={2}
                    className="w-full text-base font-semibold text-slate-900 dark:text-gray-100 italic bg-white/70 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  />
                  <input
                    value={editContent.featuredInsight.context}
                    onChange={(e) => updateEditField("featuredInsight.context", e.target.value)}
                    className="w-full text-sm text-slate-600 dark:text-slate-400 bg-white/70 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              ) : (
                <>
                  <p className="text-base font-semibold text-slate-900 dark:text-gray-100 italic mb-2">
                    &ldquo;{content.featuredInsight.quote}&rdquo;
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{content.featuredInsight.context}</p>
                </>
              )}
            </div>

            {/* CTA */}
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-5">
              {editing && editContent ? (
                <div className="space-y-2">
                  <input
                    value={editContent.cta.heading}
                    onChange={(e) => updateEditField("cta.heading", e.target.value)}
                    className="w-full font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
                  />
                  <textarea
                    value={editContent.cta.text}
                    onChange={(e) => updateEditField("cta.text", e.target.value)}
                    rows={2}
                    className="w-full text-sm text-slate-700 dark:text-slate-300 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  />
                  <input
                    value={editContent.cta.action}
                    onChange={(e) => updateEditField("cta.action", e.target.value)}
                    className="w-full text-sm font-semibold text-blue-600 dark:text-blue-400 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              ) : (
                <>
                  <h3 className="font-bold text-blue-600 dark:text-blue-400 mb-2">{content.cta.heading}</h3>
                  <p className="text-sm text-slate-700 dark:text-slate-300 mb-3">{content.cta.text}</p>
                  <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{content.cta.action}</p>
                </>
              )}
            </div>

            {/* Sign-off */}
            {editing && editContent ? (
              <input
                value={editContent.signoff}
                onChange={(e) => updateEditField("signoff", e.target.value)}
                className="w-full text-sm text-slate-600 dark:text-slate-400 italic bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400 italic">{content.signoff}</p>
            )}
          </div>
        )}
      </div>

      {/* Schedule modal */}
      {showScheduleModal && (
        <ScheduleModal
          newsletter={newsletter}
          onClose={() => setShowScheduleModal(false)}
          onSaved={onUpdate}
        />
      )}

      {/* Delete confirm */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-gray-100 mb-2">Delete Newsletter?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
              &ldquo;{newsletter.title}&rdquo; will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.06]"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-60"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Schedule Modal ─────────────────────────────────────────────────────────

function ScheduleModal({
  newsletter,
  onClose,
  onSaved,
}: {
  newsletter: Newsletter;
  onClose: () => void;
  onSaved: (n: Newsletter) => void;
}) {
  const existing = newsletter.scheduledAt ? new Date(newsletter.scheduledAt) : null;

  // Default: tomorrow at 09:00
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const defaultDate = existing ?? tomorrow;
  const pad = (n: number) => String(n).padStart(2, "0");

  const [date, setDate] = useState(
    `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth() + 1)}-${pad(defaultDate.getDate())}`
  );
  const [time, setTime] = useState(
    `${pad(defaultDate.getHours())}:${pad(defaultDate.getMinutes())}`
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const scheduledAt = new Date(`${date}T${time}`).toISOString();
      const res = await fetch(`/api/newsletter/${newsletter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to schedule");
      } else {
        onSaved(data as Newsletter);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUnschedule() {
    setSaving(true);
    try {
      const res = await fetch(`/api/newsletter/${newsletter.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: null }),
      });
      const data = await res.json();
      if (res.ok) {
        onSaved(data as Newsletter);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-gray-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            Schedule Newsletter
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Newsletter will be sent to your account email at the scheduled time.
        </p>

        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Date</label>
            <input
              type="date"
              value={date}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.06] text-slate-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.06] text-slate-900 dark:text-gray-100 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        <div className="flex gap-2">
          {newsletter.status === "scheduled" && (
            <button
              onClick={handleUnschedule}
              disabled={saving}
              className="px-3 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.06] disabled:opacity-60"
            >
              Unschedule
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.06]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}
