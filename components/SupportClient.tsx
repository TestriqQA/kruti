"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LifeBuoy,
  ImagePlus,
  X,
  Loader2,
  Send,
  AlertCircle,
  MessageSquare,
  Clock,
  ChevronDown,
  CheckCircle2,
  Lock,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";
import {
  MAX_SCREENSHOTS,
  MAX_TOTAL_BYTES,
  MAX_ATTACHMENT_BYTES,
  MAX_DESCRIPTION_CHARS,
  SCREENSHOT_MIME_TYPES,
  REPLY_TTL_DAYS,
  TICKET_STATUSES,
  CLOSED_STATUS,
  formatBytes,
  parseAttachments,
  isTicketClosed,
  type TicketAttachment,
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
}

interface Picked {
  file: File;
  preview: string;
}

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  closed: "bg-slate-100 text-slate-600 dark:bg-white/[0.08] dark:text-slate-400",
};

const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default function SupportClient({
  user,
  tickets,
}: {
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
    timezone: string | null;
    plan: string;
  };
  tickets: Ticket[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState("");
  const [picked, setPicked] = useState<Picked[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Open the newest ticket that has an unread reply, so the thing the user came
  // back for is already on screen.
  const firstUnread = tickets.find((t) => t.replies.some((r) => !r.readAt));
  const [openId, setOpenId] = useState<string | null>(firstUnread?.id ?? null);
  /** Reply ids this page has optimistically cleared from the unread badge. */
  const [readLocally, setReadLocally] = useState<Set<string>>(new Set());
  /** Reply ids a mark-read request has already been fired for, success or not. */
  const attemptedRef = useRef<Set<string>>(new Set());

  const [filter, setFilter] = useState<string>("all");
  // Closing is irreversible, so the button asks once before it fires.
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

  const shown = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  const totalBytes = picked.reduce((n, p) => n + p.file.size, 0);
  const overBudget = totalBytes > MAX_TOTAL_BYTES;
  const canSubmit = description.trim().length >= 10 && !overBudget && !submitting;

  // Tracked per REPLY, not per ticket. Latching on the ticket id meant the
  // second and every later reply on a ticket the user had already opened was
  // never marked read, so the sidebar badge kept counting it forever.
  const unreadCount = (t: Ticket) =>
    t.replies.filter((r) => !r.readAt && !readLocally.has(r.id)).length;

  useEffect(() => {
    return () => picked.forEach((p) => URL.revokeObjectURL(p.preview));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mark replies read as soon as the ticket is opened - including the one opened
  // automatically on arrival, and including a reply that lands while the ticket
  // is already open (hence `tickets` in the deps).
  //
  // attemptedRef is what stops this becoming a retry loop: a reply id goes in
  // before the request and stays in even if the request fails, so a persistent
  // failure rolls the badge back once instead of hammering the route.
  useEffect(() => {
    if (!openId) return;
    const t = tickets.find((x) => x.id === openId);
    if (!t) return;

    const pending = t.replies.filter(
      (r) => !r.readAt && !attemptedRef.current.has(r.id)
    );
    if (pending.length === 0) return;

    const ids = pending.map((r) => r.id);
    ids.forEach((id) => attemptedRef.current.add(id));
    setReadLocally((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });

    const rollback = () =>
      setReadLocally((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });

    fetch(`/api/support/tickets/${openId}/read`, { method: "POST" })
      .then((res) => {
        // fetch only rejects on a network error, so a 401/404/500 would
        // otherwise be treated as success and desync the sidebar badge.
        if (!res.ok) {
          rollback();
          return;
        }
        router.refresh();
      })
      .catch(rollback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId, tickets]);

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setError(null);

    const incoming = Array.from(list);
    const room = MAX_SCREENSHOTS - picked.length;
    if (room <= 0) {
      setError(`You can attach at most ${MAX_SCREENSHOTS} screenshots.`);
      return;
    }

    const accepted: Picked[] = [];
    let runningTotal = totalBytes;

    for (const file of incoming.slice(0, room)) {
      if (!SCREENSHOT_MIME_TYPES.includes(file.type)) {
        setError(`"${file.name}" is not a PNG, JPG or WebP image.`);
        continue;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setError(
          `"${file.name}" is ${formatBytes(file.size)} - each screenshot must be under ${formatBytes(
            MAX_ATTACHMENT_BYTES
          )}.`
        );
        continue;
      }
      if (runningTotal + file.size > MAX_TOTAL_BYTES) {
        setError(
          `Adding "${file.name}" would take you past the ${formatBytes(MAX_TOTAL_BYTES)} total.`
        );
        continue;
      }
      runningTotal += file.size;
      accepted.push({ file, preview: URL.createObjectURL(file) });
    }

    if (incoming.length > room) {
      setError(`Only ${room} more screenshot${room === 1 ? "" : "s"} can be attached.`);
    }
    if (accepted.length > 0) setPicked((prev) => [...prev, ...accepted]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeAt(i: number) {
    setError(null);
    setPicked((prev) => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, n) => n !== i);
    });
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);

    try {
      // One request per screenshot: a single body carrying all five would be
      // rejected by the platform before reaching our route.
      const attachments: TicketAttachment[] = [];
      for (const p of picked) {
        const fd = new FormData();
        fd.append("file", p.file);
        const res = await fetch("/api/support/attachment", { method: "POST", body: fd });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Could not upload "${p.file.name}".`);
        attachments.push(data as TicketAttachment);
      }

      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), attachments }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not raise the ticket.");

      picked.forEach((p) => URL.revokeObjectURL(p.preview));
      setPicked([]);
      setDescription("");
      toast("Ticket raised. Our reply will appear here.", "success");
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      setError(message);
      toast(message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleClose(id: string) {
    setClosingId(id);
    try {
      const res = await fetch(`/api/support/tickets/${id}/close`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not close the ticket.");

      // A dropped session is answered by middleware with a 307 to the sign-in
      // page, which fetch() follows and reports as a 200 carrying HTML. Without
      // this check that reads as success and we would claim the ticket closed.
      if (data?.ticket?.status !== CLOSED_STATUS) {
        throw new Error("Your session has expired. Reload the page and sign in again.");
      }

      setConfirmCloseId(null);
      toast("Ticket closed. It cannot be reopened.", "success");
      // The status badge comes straight from the server props, so a refresh is
      // what repaints it - there is no local copy of the list to patch.
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not close the ticket.";
      toast(message, "error");
    } finally {
      setClosingId(null);
    }
  }

  // Counted across every ticket, not just the filtered ones, so switching to
  // "closed" does not hide the fact that a reply is waiting elsewhere.
  const totalUnread = tickets.reduce((n, t) => n + unreadCount(t), 0);

  return (
    // One attribute exempts this whole subtree from the paywall lock, so a user
    // whose trial lapsed can still reach us. See components/SubscriptionLock.tsx.
    <div data-allow-when-locked="">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-gray-100 flex items-center gap-2">
          <LifeBuoy className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          Help &amp; Support
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Tell us what went wrong. Our replies show up on the right.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
        {/* ── Left: raise a ticket ─────────────────────────────── */}
        <div className="space-y-6 min-w-0">
          <section className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl p-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Sent with your ticket
            </h2>
            <div className="mt-3 flex items-center gap-3">
              <Avatar src={user.image} name={user.name} size={40} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-gray-100 truncate">
                  {user.name || "Your account"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
              </div>
              <span
                className={cn(
                  "ml-auto flex-shrink-0 text-xs px-2.5 py-1 rounded-full capitalize",
                  STATUS_STYLE.closed
                )}
              >
                {user.plan.replace("_", " ")}
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
              Your name, email, plan and timezone ({user.timezone || "not set"}) are attached
              automatically, so there is nothing to fill in here.
            </p>
          </section>

          <section className="bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-2xl p-5 space-y-5">
            <div>
              <label
                htmlFor="ticket-description"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                What went wrong?
              </label>
              <textarea
                id="ticket-description"
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_CHARS))}
                placeholder="What were you doing, what did you expect, and what happened instead?"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white dark:bg-white/[0.06] text-slate-900 dark:text-gray-100 placeholder:text-slate-400 resize-y"
              />
              <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 text-right tabular-nums">
                {description.length} / {MAX_DESCRIPTION_CHARS}
              </p>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1.5 gap-2 flex-wrap">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Screenshots <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    overBudget
                      ? "text-red-600 dark:text-red-400"
                      : "text-slate-400 dark:text-slate-500"
                  )}
                >
                  {picked.length} of {MAX_SCREENSHOTS} &middot; {formatBytes(totalBytes)} of{" "}
                  {formatBytes(MAX_TOTAL_BYTES)}
                </span>
              </div>

              <div className="flex flex-wrap gap-3">
                {picked.map((p, i) => (
                  <div
                    key={p.preview}
                    className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.preview} alt={p.file.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      aria-label={`Remove ${p.file.name}`}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/70 text-white flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <span className="absolute bottom-0 inset-x-0 bg-slate-900/70 text-white text-[10px] px-1.5 py-0.5 truncate">
                      {formatBytes(p.file.size)}
                    </span>
                  </div>
                ))}

                {picked.length < MAX_SCREENSHOTS && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/15 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500/50 dark:hover:text-blue-400 transition-colors"
                  >
                    <ImagePlus className="w-5 h-5" />
                    <span className="text-[11px]">Add</span>
                  </button>
                )}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept={SCREENSHOT_MIME_TYPES.join(",")}
                multiple
                onChange={(e) => addFiles(e.target.files)}
                className="hidden"
              />
              <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                PNG, JPG or WebP. Up to {MAX_SCREENSHOTS} images, {formatBytes(MAX_TOTAL_BYTES)} in
                total.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {submitting ? "Sending..." : "Raise ticket"}
              </button>
              {description.trim().length > 0 && description.trim().length < 10 && (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  A little more detail, please.
                </span>
              )}
            </div>
          </section>
        </div>

        {/* ── Right: your tickets and our replies ──────────────── */}
        <aside className="space-y-3 min-w-0 lg:sticky lg:top-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Your tickets
            </h2>
            {totalUnread > 0 && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                {totalUnread} new
              </span>
            )}
          </div>

          {tickets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {(["all", ...TICKET_STATUSES] as const).map((s) => {
                const count = s === "all" ? tickets.length : tickets.filter((t) => t.status === s).length;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFilter(s)}
                    aria-pressed={filter === s}
                    className={cn(
                      "text-[11px] px-2.5 py-1 rounded-lg border transition-colors capitalize",
                      filter === s
                        ? "bg-blue-600 text-white border-blue-600"
                        : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                    )}
                  >
                    {s.replace("_", " ")}
                    <span className="ml-1 tabular-nums opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Stated ONCE for the whole column, outside the ticket cards. It used
              to sit inside each replies box, which repeated it per ticket and ate
              a banner's worth of space every time. */}
          {tickets.some((t) => t.replies.length > 0) && (
            <p className="flex items-start gap-1.5 text-[10px] leading-snug text-slate-400 dark:text-slate-500">
              <Clock className="w-3 h-3 flex-shrink-0 mt-px" />
              <span>
                Replies disappear {REPLY_TTL_DAYS} days after we send them, read or not &mdash;
                copy anything you need to keep.
              </span>
            </p>
          )}

          {tickets.length === 0 ? (
            <div className="border border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-6 text-center">
              <MessageSquare className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Nothing raised yet. Replies from our team will appear here.
              </p>
            </div>
          ) : shown.length === 0 ? (
            <div className="border border-dashed border-slate-200 dark:border-white/10 rounded-2xl p-6 text-center">
              <MessageSquare className="w-6 h-6 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400 dark:text-slate-500">
                No {filter.replace("_", " ")} tickets.
              </p>
            </div>
          ) : (
            shown.map((t) => {
              const unread = unreadCount(t);
              const open = openId === t.id;
              const shots = parseAttachments(t.screenshots);
              const closed = isTicketClosed(t.status);
              const confirming = confirmCloseId === t.id;
              const busyClosing = closingId === t.id;

              return (
                <div
                  key={t.id}
                  className={cn(
                    "rounded-2xl border transition-colors",
                    unread
                      ? "border-blue-400 dark:border-blue-500/50 bg-blue-50/60 dark:bg-blue-500/[0.07]"
                      : "border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.03]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : t.id)}
                    aria-expanded={open}
                    className="w-full text-left px-4 py-3 flex items-start gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">
                        {t.description}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        {shortDate(t.createdAt)}
                        {shots.length > 0 && ` · ${shots.length} shot${shots.length === 1 ? "" : "s"}`}
                        {t.replies.length > 0 &&
                          ` · ${t.replies.length} repl${t.replies.length === 1 ? "y" : "ies"}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {unread > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-600 text-white">
                          New reply
                        </span>
                      )}
                      <span
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded-full capitalize",
                          STATUS_STYLE[t.status] ?? STATUS_STYLE.closed
                        )}
                      >
                        {t.status.replace("_", " ")}
                      </span>
                      <ChevronDown
                        className={cn(
                          "w-3.5 h-3.5 text-slate-400 transition-transform",
                          open && "rotate-180"
                        )}
                      />
                    </div>
                  </button>

                  {open && (
                    <div className="px-4 pb-4 border-t border-slate-200/70 dark:border-white/10 pt-3 space-y-3">
                      {t.replies.length === 0 ? (
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          No reply yet. We will answer here.
                        </p>
                      ) : (
                        /* Every reply sits in ONE box: a single expiry notice at the
                           top, then the messages separated by a hairline, instead of
                           a bordered card and a repeated warning per message. */
                        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.06] overflow-hidden">
                          {/* ONE heading for the whole box - not repeated per message. */}
                          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-200 dark:border-white/10 bg-white/70 dark:bg-white/[0.04]">
                            <MessageSquare className="w-3 h-3 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                            <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300">
                              Kruti.io support
                            </span>
                            <span className="ml-auto flex-shrink-0 text-[10px] text-slate-400 dark:text-slate-500 tabular-nums">
                              {t.replies.length} message{t.replies.length === 1 ? "" : "s"}
                            </span>
                          </div>

                          <div className="divide-y divide-slate-200/70 dark:divide-white/10">
                            {t.replies.map((r) => (
                              <div key={r.id} className="px-3 py-2.5">
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1 tabular-nums">
                                  {shortDate(r.createdAt)}
                                </p>
                                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words">
                                  {r.message}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {closed ? (
                        <p className="flex items-start gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                          <Lock className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          <span>
                            This ticket is closed and cannot be reopened. Raise a new one if you
                            still need help.
                          </span>
                        </p>
                      ) : confirming ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Close for good? This cannot be undone.
                          </span>
                          <button
                            type="button"
                            onClick={() => handleClose(t.id)}
                            disabled={busyClosing}
                            className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {busyClosing ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            Yes, close
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmCloseId(null)}
                            disabled={busyClosing}
                            className="text-[11px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmCloseId(t.id)}
                          className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg border border-red-300 dark:border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          Close ticket
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

        </aside>
      </div>
    </div>
  );
}
