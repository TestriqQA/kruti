"use client";

import { useEffect, useState } from "react";
import {
  X,
  Send,
  Loader2,
  Lock,
  MessageSquare,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCheck,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import PostImage from "@/components/PostImage";
import { cn } from "@/lib/utils";
import {
  parseAttachments,
  TICKET_STATUSES,
  CLOSED_STATUS,
  formatBytes,
  replyExpiresIn,
  isTicketClosed,
  isUserReply,
  groupConversation,
  REPLY_TTL_DAYS,
  MAX_REPLY_CHARS,
  type TicketAttachment,
} from "@/lib/support";

export interface ModalReply {
  id: string;
  message: string;
  authorRole: string;
  createdAt: string;
  readAt: string | null;
}

export interface ModalTicket {
  id: string;
  description: string;
  screenshots: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  replies: ModalReply[];
  user: { name: string | null; email: string | null; image: string | null };
}

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  closed: "bg-gray-100 text-gray-600 dark:bg-white/[0.08] dark:text-slate-400",
};

const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

const fullDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/**
 * Everything an admin needs to act on one ticket.
 *
 * The table deliberately shows a truncated description and thumbnail strip - a
 * 2000-character description and five screenshots cannot sit in a table row
 * without destroying the row rhythm that makes a table scannable in the first
 * place. So the table is for scanning and this is for reading and replying.
 *
 * Closed tickets are read-only here, matching the server: both the status route
 * and the reply route answer 409 on a closed ticket, so showing the controls
 * would only produce an error the admin cannot act on.
 */
export default function TicketDetailModal({
  ticket,
  busy,
  sending,
  confirmingClose,
  draft,
  onDraftChange,
  onClose,
  onSetStatus,
  onConfirmClose,
  onSendReply,
}: {
  ticket: ModalTicket;
  busy: boolean;
  sending: boolean;
  confirmingClose: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onClose: () => void;
  onSetStatus: (status: string) => void;
  onConfirmClose: (confirming: boolean) => void;
  onSendReply: () => void;
}) {
  const shots = parseAttachments(ticket.screenshots);
  const closed = isTicketClosed(ticket.status);
  const [lightbox, setLightbox] = useState<number | null>(null);

  // Escape closes the lightbox first, then the modal - otherwise one key press
  // dismisses both and the admin loses the ticket they were reading.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (lightbox !== null) setLightbox(null);
        else onClose();
      }
      if (lightbox === null) return;
      if (e.key === "ArrowRight") setLightbox((i) => (i === null ? null : (i + 1) % shots.length));
      if (e.key === "ArrowLeft")
        setLightbox((i) => (i === null ? null : (i - 1 + shots.length) % shots.length));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, shots.length, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Ticket detail"
      >
        {/* ── Header ───────────────────────────────────────────── */}
        <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <Avatar src={ticket.user.image} name={ticket.user.name} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {ticket.user.name || "Unknown user"}
            </p>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {ticket.user.email}
            </p>
            <p className="mt-1 font-mono text-[11px] text-gray-400 dark:text-gray-500">
              {ticket.id}
            </p>
          </div>
          <span
            className={cn(
              "flex-shrink-0 rounded-full px-2.5 py-1 text-xs capitalize",
              STATUS_STYLE[ticket.status] ?? STATUS_STYLE.closed
            )}
          >
            {ticket.status.replace("_", " ")}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <span className="text-gray-400 dark:text-gray-500">Raised</span>
              <p className="mt-0.5 text-gray-700 dark:text-gray-300">
                {fullDate(ticket.createdAt)}
              </p>
            </div>
            <div>
              <span className="text-gray-400 dark:text-gray-500">Last updated</span>
              <p className="mt-0.5 text-gray-700 dark:text-gray-300">
                {fullDate(ticket.updatedAt)}
              </p>
            </div>
          </div>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            Description
          </h3>
          {/* Full text here - no clamp. This is the whole reason the modal exists. */}
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {ticket.description}
          </p>

          {shots.length > 0 && (
            <>
              <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Screenshots ({shots.length})
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {shots.map((s, i) => (
                  <button
                    key={s.url}
                    type="button"
                    onClick={() => setLightbox(i)}
                    title={`${s.name} (${formatBytes(s.size)})`}
                    className="group relative h-24 w-24 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <PostImage
                      src={s.url}
                      alt={s.name}
                      className="h-full w-full object-cover"
                      iconClassName="w-4 h-4"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/40">
                      <ExternalLink className="h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100" />
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {ticket.replies.length > 0 && (
            <>
              <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                Replies sent
              </h3>
              <div className="mt-2 overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-white/[0.03]">
                <div className="flex items-center gap-2 border-b border-gray-200 bg-white/60 px-3 py-2 dark:border-gray-700 dark:bg-white/[0.04]">
                  <MessageSquare className="h-3 w-3 flex-shrink-0 text-blue-600 dark:text-blue-400" />
                  <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                    Conversation
                  </span>
                  <span className="ml-auto flex-shrink-0 text-[10px] tabular-nums text-gray-400 dark:text-gray-500">
                    {ticket.replies.length} message{ticket.replies.length === 1 ? "" : "s"}
                  </span>
                </div>

                {/* Mirror of the user's view, flipped: the admin's own replies sit
                    right, the user's left. Grouped by day, then by consecutive
                    author, so a run of messages is one bubble not several. */}
                <div className="space-y-3 px-3 py-3">
                  {groupConversation(ticket.replies).map((day) => (
                    <div key={day.dayKey} className="space-y-2">
                      <div className="flex justify-center">
                        <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-medium text-gray-500 shadow-sm dark:bg-white/[0.08] dark:text-gray-400">
                          {day.label}
                        </span>
                      </div>

                      {/* Each message keeps its own bubble, time and tick; a run
                          from one sender is grouped visually via tight stacking,
                          a name on the first only, and the tail corner on the
                          last. The expiry note appears once per run, since it is
                          about retention rather than the conversation. */}
                      {day.groups.map((g) => {
                        const fromUser = isUserReply(g.authorRole);
                        return (
                          <div key={g.messages[0].id} className="space-y-0.5">
                            {g.messages.map((m, i) => {
                              const first = i === 0;
                              const last = i === g.messages.length - 1;
                              return (
                                <div
                                  key={m.id}
                                  className={cn(
                                    "flex",
                                    fromUser ? "justify-start" : "justify-end"
                                  )}
                                >
                                  <div className="max-w-[85%]">
                                    <div
                                      className={cn(
                                        "rounded-2xl px-3 py-1.5",
                                        fromUser
                                          ? "border border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-white/[0.08] dark:text-gray-200"
                                          : "bg-blue-600 text-white",
                                        last && (fromUser ? "rounded-bl-sm" : "rounded-br-sm")
                                      )}
                                    >
                                      {first && (
                                        <p
                                          className={cn(
                                            "mb-0.5 text-[10px] font-semibold",
                                            fromUser
                                              ? "text-gray-500 dark:text-gray-400"
                                              : "text-blue-100"
                                          )}
                                        >
                                          {fromUser ? ticket.user.name || "User" : "You"}
                                        </p>
                                      )}
                                      <p className="whitespace-pre-wrap break-words text-sm">
                                        {m.message}
                                      </p>
                                      <div
                                        className={cn(
                                          "mt-0.5 flex items-center justify-end gap-1 text-[10px] tabular-nums",
                                          fromUser
                                            ? "text-gray-400 dark:text-gray-500"
                                            : "text-blue-100"
                                        )}
                                      >
                                        <span>{clockTime(m.createdAt)}</span>
                                        {!fromUser &&
                                          (m.readAt ? (
                                            <CheckCheck className="h-3 w-3" />
                                          ) : (
                                            <Check className="h-3 w-3" />
                                          ))}
                                      </div>
                                    </div>

                                    {last && (
                                      <p
                                        className={cn(
                                          "mt-0.5 flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500",
                                          fromUser ? "justify-start" : "justify-end"
                                        )}
                                      >
                                        <Clock className="h-3 w-3" />
                                        {replyExpiresIn(m.createdAt) === "expired"
                                          ? "expired"
                                          : `gone in ${replyExpiresIn(m.createdAt)}`}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Footer: the actions ──────────────────────────────── */}
        <div className="border-t border-gray-100 px-5 py-4 dark:border-gray-800">
          {closed ? (
            <div className="flex items-start gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 dark:border-gray-700 dark:bg-white/[0.04]">
              <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-gray-400 dark:text-gray-500" />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                This ticket is closed. Replies and status changes are locked &mdash; a closed
                ticket cannot be reopened, by you or by the user.
              </p>
            </div>
          ) : (
            <>
              <textarea
                rows={3}
                value={draft}
                onChange={(e) => onDraftChange(e.target.value.slice(0, MAX_REPLY_CHARS))}
                placeholder="Reply to this user..."
                className="w-full resize-y rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:border-gray-700 dark:bg-white/[0.04] dark:text-gray-100"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  onClick={onSendReply}
                  disabled={draft.trim().length < 2 || sending}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Send className="h-3 w-3" />
                  )}
                  Send reply
                </button>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  Visible to the user for {REPLY_TTL_DAYS} days, then removed automatically.
                </span>

                <div className="ml-auto flex flex-wrap items-center justify-end gap-1.5">
                  {TICKET_STATUSES.filter((s) => s !== ticket.status && s !== CLOSED_STATUS).map(
                    (s) => (
                      <button
                        key={s}
                        onClick={() => onSetStatus(s)}
                        disabled={busy}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs capitalize text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.06]"
                      >
                        {busy ? (
                          <Loader2 className="inline h-3 w-3 animate-spin" />
                        ) : (
                          `Mark ${s.replace("_", " ")}`
                        )}
                      </button>
                    )
                  )}

                  {confirmingClose ? (
                    <>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        Close for good?
                      </span>
                      <button
                        onClick={() => onSetStatus(CLOSED_STATUS)}
                        disabled={busy}
                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                      >
                        {busy ? (
                          <Loader2 className="inline h-3 w-3 animate-spin" />
                        ) : (
                          "Yes, close"
                        )}
                      </button>
                      <button
                        onClick={() => onConfirmClose(false)}
                        disabled={busy}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.06]"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => onConfirmClose(true)}
                      disabled={busy}
                      className="rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      Mark closed
                    </button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Lightbox ─────────────────────────────────────────── */}
      {lightbox !== null && shots[lightbox] && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-6"
          onClick={(e) => {
            e.stopPropagation();
            setLightbox(null);
          }}
        >
          <div className="flex max-h-full max-w-5xl flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center gap-3">
              <p className="truncate text-sm text-white">
                {shots[lightbox].name}{" "}
                <span className="text-white/50">
                  ({formatBytes(shots[lightbox].size)}) &middot; {lightbox + 1} of {shots.length}
                </span>
              </p>
              <a
                href={shots[lightbox].url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex-shrink-0 text-xs text-white/70 underline hover:text-white"
              >
                Open original
              </a>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                aria-label="Close image"
                className="flex-shrink-0 rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex min-h-0 items-center gap-3">
              {shots.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLightbox((i) => (i! - 1 + shots.length) % shots.length)}
                  aria-label="Previous image"
                  className="flex-shrink-0 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shots[lightbox].url}
                alt={shots[lightbox].name}
                className="max-h-[75vh] min-h-0 rounded-lg object-contain"
              />
              {shots.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLightbox((i) => (i! + 1) % shots.length)}
                  aria-label="Next image"
                  className="flex-shrink-0 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export type { TicketAttachment };
