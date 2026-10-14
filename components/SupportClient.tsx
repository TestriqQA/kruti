"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ImagePlus,
  X,
  Loader2,
  Send,
  AlertCircle,
  MessageSquare,
  Clock,
  ChevronDown,
  Check,
  CheckCheck,
  CheckCircle2,
  Lock,
  Inbox,
  Mail,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import { StatCard } from "@/components/dashboard/bits";
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
  isUserReply,
  groupConversation,
  MAX_REPLY_CHARS,
  isTicketClosed,
  type TicketAttachment,
} from "@/lib/support";

interface Reply {
  id: string;
  message: string;
  authorRole: string;
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
  open: "bg-warn-tint text-warn",
  in_progress: "bg-brand-tint text-brand",
  closed: "bg-card-muted text-text-2",
};

/** Time only - the date lives in the separator above the group. */
const clockTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

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
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [replyingId, setReplyingId] = useState<string | null>(null);

  const shown = filter === "all" ? tickets : tickets.filter((t) => t.status === filter);

  const totalBytes = picked.reduce((n, p) => n + p.file.size, 0);
  const overBudget = totalBytes > MAX_TOTAL_BYTES;
  const canSubmit = description.trim().length >= 10 && !overBudget && !submitting;

  // Tracked per REPLY, not per ticket. Latching on the ticket id meant the
  // second and every later reply on a ticket the user had already opened was
  // never marked read, so the sidebar badge kept counting it forever.
  // Admin replies only - the user's own messages are never "unread" to them.
  const unreadCount = (t: Ticket) =>
    t.replies.filter((r) => !isUserReply(r.authorRole) && !r.readAt && !readLocally.has(r.id))
      .length;

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

    // Admin replies only. The user's own messages stay unread until an admin
    // reads them, so firing on those would clear the admin's "new reply" signal.
    const pending = t.replies.filter(
      (r) => !isUserReply(r.authorRole) && !r.readAt && !attemptedRef.current.has(r.id)
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

  async function handleReply(id: string) {
    const message = (replyDrafts[id] || "").trim();
    if (message.length < 2 || replyingId) return;

    setReplyingId(id);
    try {
      const res = await fetch(`/api/support/tickets/${id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not send your reply.");

      // A dropped session is answered with a 307 to sign-in, which fetch()
      // follows and reports as a 200 of HTML. Confirm the route really answered.
      if (!data?.reply?.id) {
        throw new Error("Your session has expired. Reload the page and sign in again.");
      }

      setReplyDrafts((prev) => ({ ...prev, [id]: "" }));
      toast("Reply sent.", "success");
      // The transcript comes from server props, so a refresh is what paints it.
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not send your reply.", "error");
    } finally {
      setReplyingId(null);
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

  // Read off the same array the column below renders, so raising or closing a
  // ticket moves these at the same moment it moves the list.
  const openCount = tickets.filter((t) => t.status === "open").length;
  const activeCount = tickets.filter((t) => t.status === "in_progress").length;
  const closedCount = tickets.filter((t) => t.status === "closed").length;

  return (
    // One attribute exempts this whole subtree from the paywall lock, so a user
    // whose trial lapsed can still reach us. See components/SubscriptionLock.tsx.
    <div data-allow-when-locked="">
      <div className="mb-6 pt-1">
        <h1 className="font-display text-[34px] font-bold leading-[1.1] tracking-[-0.03em] text-text">
          Help &amp; Support
        </h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-text-2">
          Tell us what went wrong and we will pick it up. Your conversation stays on the right,
          and a reply shows up there without you having to refresh.
        </p>
      </div>

      {/* Readings. Each card carries a line only it can say. */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Open"
          value={openCount}
          note={openCount > 0 ? "waiting on us" : "nothing waiting on us"}
          icon={Inbox}
          tone="warn"
          onClick={() => setFilter(filter === "open" ? "all" : "open")}
          active={filter === "open"}
        />
        <StatCard
          label="In progress"
          value={activeCount}
          note={activeCount > 0 ? "we are on it" : "nothing in hand"}
          icon={Clock}
          tone="brand"
          onClick={() => setFilter(filter === "in_progress" ? "all" : "in_progress")}
          active={filter === "in_progress"}
        />
        <StatCard
          label="Closed"
          value={closedCount}
          note={closedCount > 0 ? "settled all time" : "none closed yet"}
          icon={CheckCircle2}
          tone="ok"
          onClick={() => setFilter(filter === "closed" ? "all" : "closed")}
          active={filter === "closed"}
        />
        <StatCard
          label="New replies"
          value={totalUnread}
          note={totalUnread > 0 ? "open the one waiting" : "nothing unread"}
          icon={Mail}
          tone="violet"
          onClick={
            totalUnread > 0
              ? () => {
                  // Recomputed on click rather than captured at mount, so this
                  // still lands on a waiting ticket after you have read others.
                  const next = tickets.find((t) => unreadCount(t) > 0);
                  if (!next) return;
                  setFilter("all");
                  setOpenId(next.id);
                }
              : undefined
          }
        />
      </div>

      {/* 60/40: form left, tickets right.
          The tickets column used to be pinned at a fixed 360px, so every pixel
          of extra width went to the form and the conversation stayed cramped.
          Proportional columns mean it now grows with the viewport.
          minmax(0,...) on both, so a long unbroken string in either column
          cannot blow the grid out past its track. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start">
        {/* ── Left: raise a ticket ─────────────────────────────── */}
        <div className="min-w-0">
          <section className="card p-6 space-y-5">
            <div>
              <h2 className="font-display text-[17px] font-bold tracking-[-0.02em] text-text">
                Raise a ticket
              </h2>
              <p className="mt-1 text-[13.5px] leading-relaxed text-text-2">
                One ticket per problem gets you a faster answer than one long one.
              </p>
            </div>

            {/* What is attached, shown inside the form it is attached to rather
                than as a card of its own above it. */}
            <div className="flex items-center gap-3 rounded-control bg-card-muted px-3.5 py-3">
              <Avatar src={user.image} name={user.name} size={36} />
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-medium text-text">
                  {user.name || "Your account"}
                </p>
                <p className="truncate text-[12px] text-text-2">{user.email}</p>
              </div>
              <span
                className={cn(
                  "ml-auto flex-shrink-0 rounded-full px-2.5 py-1 text-xs capitalize",
                  STATUS_STYLE.closed
                )}
              >
                {user.plan.replace("_", " ")}
              </span>
            </div>
            <p className="-mt-2 text-xs text-text-3">
              Your name, email, plan and timezone ({user.timezone || "not set"}) ride along
              automatically - nothing to fill in.
            </p>

            <div>
              <label
                htmlFor="ticket-description"
                className="block text-sm font-medium text-text mb-1.5"
              >
                What went wrong?
              </label>
              <textarea
                id="ticket-description"
                rows={6}
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_CHARS))}
                placeholder="What were you doing, what did you expect, and what happened instead?"
                className="w-full px-3 py-2.5 text-sm border border-edge rounded-control focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand bg-card text-text placeholder:text-text-3 resize-y"
              />
              <p className="mt-1 text-xs text-text-3 text-right tabular-nums">
                {description.length} / {MAX_DESCRIPTION_CHARS}
              </p>
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-1.5 gap-2 flex-wrap">
                <label className="block text-sm font-medium text-text">
                  Screenshots <span className="text-text-3 font-normal">(optional)</span>
                </label>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    overBudget
                      ? "text-bad"
                      : "text-text-3"
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
                    className="relative w-24 h-24 rounded-control overflow-hidden border border-edge"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.preview} alt={p.file.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeAt(i)}
                      aria-label={`Remove ${p.file.name}`}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-slate-900/70 text-white flex items-center justify-center hover:bg-bad transition-colors"
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
                    className="w-24 h-24 rounded-control border-2 border-dashed border-edge dark:border-white/15 flex flex-col items-center justify-center gap-1 text-text-3 hover:border-blue-400 hover:text-blue-600 dark:hover:border-blue-500/50 dark:hover:text-blue-400 transition-colors"
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
              <p className="mt-2 text-xs text-text-3">
                PNG, JPG or WebP. Up to {MAX_SCREENSHOTS} images, {formatBytes(MAX_TOTAL_BYTES)} in
                total.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-bad-tint border border-bad/30 rounded-control px-4 py-3">
                <AlertCircle className="w-4 h-4 text-bad flex-shrink-0 mt-0.5" />
                <p className="text-sm text-bad">{error}</p>
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="btn-brand ring-focus inline-flex h-11 items-center gap-2 rounded-control px-5 text-[14px] font-semibold disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                {submitting ? "Sending..." : "Raise ticket"}
              </button>
              {description.trim().length > 0 && description.trim().length < 10 && (
                <span className="text-xs text-text-3">
                  A little more detail, please.
                </span>
              )}
            </div>
          </section>
        </div>

        {/* ── Right: your tickets and our replies ──────────────── */}
        <aside className="space-y-3 min-w-0 lg:sticky lg:top-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-[17px] font-bold tracking-[-0.02em] text-text">
              Your tickets
            </h2>
            {totalUnread > 0 && (
              <span className="flex-shrink-0 rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white">
                {totalUnread} new
              </span>
            )}
          </div>

          {tickets.length > 0 && (
            <div>
              <p className="eyebrow mb-1.5">Show</p>
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
                        "ring-focus flex h-8 items-center gap-1.5 rounded-control border px-3 text-[12.5px] font-medium capitalize transition-colors",
                        filter === s
                          ? "border-brand bg-brand text-white"
                          : "border-edge text-text-2 hover:border-brand-edge hover:text-text"
                      )}
                    >
                      {s === "all" ? "All" : s.replace("_", " ")}
                      <span className="tabular-nums opacity-60">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Stated ONCE for the whole column, outside the ticket cards. It used
              to sit inside each replies box, which repeated it per ticket and ate
              a banner's worth of space every time. */}
          {tickets.some((t) => t.replies.length > 0) && (
            <p className="flex items-start gap-1.5 text-[10px] leading-snug text-text-3">
              <Clock className="w-3 h-3 flex-shrink-0 mt-px" />
              <span>
                Replies disappear {REPLY_TTL_DAYS} days after we send them, read or not &mdash;
                copy anything you need to keep.
              </span>
            </p>
          )}

          {tickets.length === 0 ? (
            <div className="rounded-card border border-dashed border-edge bg-card-muted/60 px-6 py-10 text-center">
              <MessageSquare className="mx-auto mb-2.5 h-7 w-7 text-text-3" />
              <p className="text-xs text-text-3">
                Nothing raised yet. Replies from our team will appear here.
              </p>
            </div>
          ) : shown.length === 0 ? (
            <div className="rounded-card border border-dashed border-edge bg-card-muted/60 px-6 py-10 text-center">
              <MessageSquare className="mx-auto mb-2.5 h-7 w-7 text-text-3" />
              <p className="text-xs text-text-3">
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
                    "rounded-card border transition-colors",
                    unread
                      ? "border-blue-400 dark:border-blue-500/50 bg-blue-50/60 dark:bg-brand/[0.07]"
                      : "border-edge bg-card"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : t.id)}
                    aria-expanded={open}
                    className="w-full text-left px-4 py-3 flex items-start gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-text line-clamp-2">
                        {t.description}
                      </p>
                      <p className="text-xs text-text-3 mt-1">
                        {shortDate(t.createdAt)}
                        {shots.length > 0 && ` · ${shots.length} shot${shots.length === 1 ? "" : "s"}`}
                        {t.replies.length > 0 &&
                          ` · ${t.replies.length} repl${t.replies.length === 1 ? "y" : "ies"}`}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      {unread > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand text-white">
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
                          "w-3.5 h-3.5 text-text-3 transition-transform",
                          open && "rotate-180"
                        )}
                      />
                    </div>
                  </button>

                  {open && (
                    <div className="px-4 pb-4 border-t border-edge/70 pt-3 space-y-3">
                      {t.replies.length === 0 ? (
                        <p className="text-xs text-text-3">
                          No reply yet. We will answer here &mdash; and you can add anything you
                          forgot using the box below.
                        </p>
                      ) : (
                        /* The whole conversation in ONE box: a single expiry notice
                           at the top, then the messages as chat bubbles. */
                        <div className="rounded-control border border-edge bg-card-muted overflow-hidden">
                          {/* ONE heading for the whole box - not repeated per message. */}
                          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-edge bg-white/70 dark:bg-white/[0.04]">
                            <MessageSquare className="w-3 h-3 text-brand flex-shrink-0" />
                            <span className="text-[11px] font-semibold text-brand">
                              Conversation
                            </span>
                            <span className="ml-auto flex-shrink-0 text-[10px] text-text-3 tabular-nums">
                              {t.replies.length} message{t.replies.length === 1 ? "" : "s"}
                            </span>
                          </div>

                          {/* Chat transcript, grouped twice: a date separator per
                              day, and one bubble per run of consecutive messages
                              from the same author. No dividers - alignment and
                              colour carry the turn-taking. */}
                          <div className="px-3 py-3 space-y-3">
                            {groupConversation(t.replies).map((day) => (
                              <div key={day.dayKey} className="space-y-2">
                                <div className="flex justify-center">
                                  <span className="rounded-full bg-white px-2.5 py-0.5 text-[10px] font-medium text-text-2 shadow-lift">
                                    {day.label}
                                  </span>
                                </div>

                                {/* Each message keeps its OWN bubble, time and tick.
                                    A run from one sender is grouped visually
                                    instead: tight stacking, the name only on the
                                    first, and the squared "tail" corner only on
                                    the last. Merging them into one bubble reads as
                                    a single long message and hides per-message
                                    read state. */}
                                {day.groups.map((g) => {
                                  const mine = isUserReply(g.authorRole);
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
                                              mine ? "justify-end" : "justify-start"
                                            )}
                                          >
                                            <div
                                              className={cn(
                                                "max-w-[85%] rounded-card px-3 py-1.5",
                                                mine
                                                  ? "bg-brand text-white"
                                                  : "border border-edge bg-white text-text   ",
                                                last && (mine ? "rounded-br-sm" : "rounded-bl-sm")
                                              )}
                                            >
                                              {first && !mine && (
                                                <p className="mb-0.5 text-[10px] font-semibold text-brand">
                                                  Kruti.io support
                                                </p>
                                              )}
                                              <p className="whitespace-pre-wrap break-words text-sm">
                                                {m.message}
                                              </p>
                                              <div
                                                className={cn(
                                                  "mt-0.5 flex items-center justify-end gap-1 text-[10px] tabular-nums",
                                                  mine
                                                    ? "text-blue-100"
                                                    : "text-text-3"
                                                )}
                                              >
                                                <span>{clockTime(m.createdAt)}</span>
                                                {/* Ticks only on your own messages:
                                                    one until support reads it, two
                                                    once they have. Per message, so
                                                    the state is never approximated. */}
                                                {mine &&
                                                  (m.readAt ? (
                                                    <CheckCheck className="h-3 w-3" />
                                                  ) : (
                                                    <Check className="h-3 w-3" />
                                                  ))}
                                              </div>
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
                      )}

                      {/* Reply composer. Hidden on a closed ticket, matching the
                          server: the reply route answers 409 once a ticket is
                          closed, so showing the box would only produce an error. */}
                      {!closed && (
                        <div>
                          <textarea
                            rows={2}
                            value={replyDrafts[t.id] || ""}
                            onChange={(e) =>
                              setReplyDrafts((prev) => ({
                                ...prev,
                                [t.id]: e.target.value.slice(0, MAX_REPLY_CHARS),
                              }))
                            }
                            placeholder="Reply to support..."
                            className="w-full px-3 py-2 text-sm border border-edge rounded-control focus:outline-none focus:ring-2 focus:ring-brand/25 focus:border-brand bg-card text-text placeholder:text-text-3 resize-y"
                          />
                          <div className="mt-1.5 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleReply(t.id)}
                              disabled={
                                (replyDrafts[t.id] || "").trim().length < 2 || replyingId === t.id
                              }
                              className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-control bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {replyingId === t.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Send className="w-3 h-3" />
                              )}
                              Send
                            </button>
                            <span className="text-[10px] text-text-3 tabular-nums">
                              {(replyDrafts[t.id] || "").length} / {MAX_REPLY_CHARS}
                            </span>
                          </div>
                        </div>
                      )}

                      {closed ? (
                        <p className="flex items-start gap-1.5 text-[11px] text-text-3">
                          <Lock className="w-3 h-3 flex-shrink-0 mt-0.5" />
                          <span>
                            This ticket is closed and cannot be reopened. Raise a new one if you
                            still need help.
                          </span>
                        </p>
                      ) : confirming ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[11px] text-text-2">
                            Close for good? This cannot be undone.
                          </span>
                          <button
                            type="button"
                            onClick={() => handleClose(t.id)}
                            disabled={busyClosing}
                            className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-control bg-bad text-white hover:bg-red-700 dark:hover:bg-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                            className="text-[11px] px-2.5 py-1 rounded-control border border-edge text-text-2 hover:bg-card-muted transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmCloseId(t.id)}
                          className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-control border border-red-300 dark:border-red-500/40 text-bad hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
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
