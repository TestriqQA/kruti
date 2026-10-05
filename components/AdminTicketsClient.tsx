"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LifeBuoy,
  Loader2,
  ExternalLink,
  MessageSquare,
  Send,
  Clock,
  ChevronDown,
  ImageIcon,
  Lock,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import PostImage from "@/components/PostImage";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import {
  parseAttachments,
  TICKET_STATUSES,
  CLOSED_STATUS,
  formatBytes,
  replyExpiresIn,
  isTicketClosed,
  REPLY_TTL_DAYS,
  MAX_REPLY_CHARS,
} from "@/lib/support";

interface Reply {
  id: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}

interface Ticket {
  id: string;
  description: string;
  screenshots: string | null;
  status: string;
  createdAt: string;
  replies: Reply[];
  user: { name: string | null; email: string | null; image: string | null };
}

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  closed: "bg-gray-100 text-gray-600 dark:bg-white/[0.08] dark:text-slate-400",
};

export default function AdminTicketsClient({
  initialTickets,
  total,
  openCount,
}: {
  initialTickets: Ticket[];
  total: number;
  openCount: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [tickets, setTickets] = useState(initialTickets);

  // useState only seeds on the first render, so without this the queue stays
  // frozen at mount and router.refresh() repaints nothing. It matters more now
  // that a user can close a ticket from /support: a stale row would keep showing
  // a reply box and status buttons that the server answers with 409.
  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);
  const [filter, setFilter] = useState<string>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Closing is terminal now, so "Mark closed" asks once before it fires.
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null);

  const shown = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);
  const allOpen = shown.length > 0 && shown.every((t) => expanded.has(t.id));

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setExpanded(allOpen ? new Set() : new Set(shown.map((t) => t.id)));
  }

  async function setStatus(id: string, status: string) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/tickets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));

      // 409 means the ticket is already closed, nearly always because the user
      // closed it from /support after this page rendered. Pull the real row in
      // so the buttons disappear instead of failing again on the next click.
      if (res.status === 409) {
        setConfirmCloseId(null);
        router.refresh();
        throw new Error(data.error || "This ticket is closed and cannot be reopened.");
      }
      if (!res.ok) throw new Error(data.error || "Could not update the ticket");

      // An expired session is answered by middleware with a 307 to the sign-in
      // page; fetch() follows it and hands us a 200 full of HTML. Closing is
      // irreversible, so confirm the route really answered before saying so.
      if (data?.ticket?.status !== status) {
        throw new Error("Your session has expired. Reload the page and sign in again.");
      }

      setTickets((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)));
      setConfirmCloseId(null);
      toast(
        isTicketClosed(status)
          ? "Ticket closed. It cannot be reopened."
          : `Marked ${status.replace("_", " ")}`,
        "success"
      );
      // The "N total · N open" counters are server props, so only a refresh
      // stops them contradicting the list underneath.
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Update failed", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function sendReply(id: string) {
    const message = (drafts[id] || "").trim();
    if (message.length < 2) return;

    setSendingId(id);
    try {
      const res = await fetch(`/api/admin/tickets/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => ({}));

      // Same stale-row case as setStatus: the user closed this ticket from
      // /support, so replies are locked. Re-fetch instead of keeping a reply box
      // that can only fail.
      if (res.status === 409) {
        router.refresh();
        throw new Error(data.error || "This ticket is closed. Replies are locked.");
      }
      if (!res.ok) throw new Error(data.error || "Could not send the reply");

      // A 2xx with an unparseable body leaves data as {}. Pushing an undefined
      // reply into the array would crash the next render, so bail to the
      // refresh path instead of corrupting local state.
      if (!data?.reply?.id) {
        router.refresh();
        throw new Error("The reply may not have been saved. Reload to check.");
      }

      setTickets((prev) =>
        prev.map((t) =>
          t.id === id
            ? { ...t, replies: [...t.replies, data.reply], status: data.status ?? t.status }
            : t
        )
      );
      setDrafts((prev) => ({ ...prev, [id]: "" }));
      toast("Reply sent. The user sees it on their support page.", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Reply failed", "error");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <LifeBuoy className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            Support Tickets
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {total} total &middot; {openCount} open
          </p>
        </div>

        <div className="flex gap-1.5 flex-wrap items-center">
          {["all", ...TICKET_STATUSES].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize",
                filter === s
                  ? "bg-blue-600 text-white border-blue-600"
                  : "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06]"
              )}
            >
              {s.replace("_", " ")}
            </button>
          ))}
          {shown.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors ml-1"
            >
              {allOpen ? "Collapse all" : "Expand all"}
            </button>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-10 text-center">
          <LifeBuoy className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {filter === "all" ? "No tickets yet." : `No ${filter.replace("_", " ")} tickets.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {shown.map((t) => {
            const shots = parseAttachments(t.screenshots);
            const draft = drafts[t.id] || "";
            const open = expanded.has(t.id);
            const awaitingRead = t.replies.some((r) => !r.readAt);
            const closed = isTicketClosed(t.status);
            const confirmingClose = confirmCloseId === t.id;

            return (
              <article
                key={t.id}
                className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden"
              >
                {/* Collapsed header: enough to triage without opening */}
                <button
                  type="button"
                  onClick={() => toggle(t.id)}
                  aria-expanded={open}
                  className="w-full text-left p-4 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-white/[0.03] transition-colors"
                >
                  <Avatar src={t.user.image} name={t.user.name} size={36} />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {t.user.name || "Unknown user"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {t.user.email}
                      </p>
                    </div>
                    <p
                      className={cn(
                        "text-sm text-gray-600 dark:text-gray-400 mt-0.5",
                        open ? "sr-only" : "line-clamp-1"
                      )}
                    >
                      {t.description}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                      <span>
                        {new Date(t.createdAt).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                      {shots.length > 0 && (
                        <span className="flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          {shots.length}
                        </span>
                      )}
                      {t.replies.length > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {t.replies.length}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    {awaitingRead && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                        Unread by user
                      </span>
                    )}
                    <span
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-full capitalize",
                        STATUS_STYLE[t.status] ?? STATUS_STYLE.closed
                      )}
                    >
                      {t.status.replace("_", " ")}
                    </span>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 text-gray-400 transition-transform",
                        open && "rotate-180"
                      )}
                    />
                  </div>
                </button>

                {open && (
                  <div className="px-4 pb-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                      {t.description}
                    </p>

                    {shots.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {shots.map((s) => (
                          <a
                            key={s.url}
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`${s.name} (${formatBytes(s.size)})`}
                            className="relative w-20 h-20 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group"
                          >
                            <PostImage
                              src={s.url}
                              alt={s.name}
                              className="w-full h-full object-cover"
                              iconClassName="w-4 h-4"
                            />
                            <span className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors">
                              <ExternalLink className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </span>
                          </a>
                        ))}
                      </div>
                    )}

                    {t.replies.length > 0 && (
                      /* ONE box with ONE heading, matching what the user sees on
                         /support. Read/Unread and the expiry stay per message
                         because that is what this queue is triaged on. */
                      <div className="mt-4 rounded-xl border border-blue-100 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-blue-100 dark:border-blue-500/20 bg-white/60 dark:bg-white/[0.04]">
                          <MessageSquare className="w-3 h-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                          <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                            Kruti.io support
                          </span>
                          <span className="ml-auto flex-shrink-0 text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
                            {t.replies.length} message{t.replies.length === 1 ? "" : "s"}
                          </span>
                        </div>

                        <div className="divide-y divide-blue-100 dark:divide-blue-500/20">
                          {t.replies.map((r) => (
                            <div key={r.id} className="px-3 py-2.5">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
                                  {new Date(r.createdAt).toLocaleString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </span>
                                <span
                                  className={cn(
                                    "text-[10px] px-1.5 py-0.5 rounded-full",
                                    r.readAt
                                      ? "bg-gray-100 text-gray-600 dark:bg-white/[0.08] dark:text-slate-400"
                                      : "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                                  )}
                                >
                                  {r.readAt ? "Read" : "Unread"}
                                </span>
                                <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-auto flex items-center gap-1 flex-shrink-0">
                                  <Clock className="w-3 h-3" />
                                  {replyExpiresIn(r.createdAt) === "expired"
                                    ? "expired"
                                    : `gone in ${replyExpiresIn(r.createdAt)}`}
                                </span>
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                                {r.message}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {closed ? (
                      /* A closed ticket is terminal: no status change, no new
                         replies. Existing replies above stay readable until the
                         3-day sweep removes them. */
                      <div className="mt-4 flex items-start gap-2 rounded-xl bg-gray-50 dark:bg-white/[0.04] border border-gray-200 dark:border-gray-700 px-3 py-2.5">
                        <Lock className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          This ticket is closed. Replies and status changes are locked &mdash; a
                          closed ticket cannot be reopened, by you or by the user.
                        </p>
                      </div>
                    ) : (
                    <div className="mt-4">
                      <textarea
                        rows={3}
                        value={draft}
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [t.id]: e.target.value.slice(0, MAX_REPLY_CHARS),
                          }))
                        }
                        placeholder="Reply to this user..."
                        className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white dark:bg-white/[0.04] text-gray-900 dark:text-gray-100 placeholder:text-gray-400 resize-y"
                      />
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => sendReply(t.id)}
                          disabled={draft.trim().length < 2 || sendingId === t.id}
                          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {sendingId === t.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                          Send reply
                        </button>
                        <span className="text-[11px] text-gray-400 dark:text-gray-500">
                          Visible to the user for {REPLY_TTL_DAYS} days, then removed
                          automatically.
                        </span>

                        <div className="flex items-center gap-1.5 ml-auto flex-wrap justify-end">
                          {/* Everything except "closed", which is terminal and so
                              asks for confirmation first. */}
                          {TICKET_STATUSES.filter(
                            (s) => s !== t.status && s !== CLOSED_STATUS
                          ).map((s) => (
                            <button
                              key={s}
                              onClick={() => setStatus(t.id, s)}
                              disabled={busyId === t.id}
                              className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50 capitalize"
                            >
                              {busyId === t.id ? (
                                <Loader2 className="w-3 h-3 animate-spin inline" />
                              ) : (
                                `Mark ${s.replace("_", " ")}`
                              )}
                            </button>
                          ))}

                          {confirmingClose ? (
                            <>
                              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                                Close for good? This cannot be undone.
                              </span>
                              <button
                                onClick={() => setStatus(t.id, CLOSED_STATUS)}
                                disabled={busyId === t.id}
                                className="text-xs px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 transition-colors disabled:opacity-50"
                              >
                                {busyId === t.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin inline" />
                                ) : (
                                  "Yes, close"
                                )}
                              </button>
                              <button
                                onClick={() => setConfirmCloseId(null)}
                                disabled={busyId === t.id}
                                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setConfirmCloseId(t.id)}
                              disabled={busyId === t.id}
                              className="text-xs px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                            >
                              Mark closed
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
