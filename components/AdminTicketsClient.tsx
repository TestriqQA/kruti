"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LifeBuoy, Loader2, MessageSquare, ImageIcon, Check, Copy } from "lucide-react";
import Avatar from "@/components/Avatar";
import PostImage from "@/components/PostImage";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { parseAttachments, TICKET_STATUSES, isTicketClosed, isUserReply } from "@/lib/support";
import TicketDetailModal, { type ModalTicket } from "@/components/TicketDetailModal";

type Ticket = ModalTicket;

const STATUS_STYLE: Record<string, string> = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-300",
  closed: "bg-gray-100 text-gray-600 dark:bg-white/[0.08] dark:text-slate-400",
};

/** Compact two-line stamp: a table row cannot afford a full date string. */
function Stamp({ iso }: { iso: string }) {
  const d = new Date(iso);
  return (
    <span className="whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
      {d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
      <span className="block text-[11px] tabular-nums text-gray-400 dark:text-gray-500">
        {d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
      </span>
    </span>
  );
}

/**
 * Admin support queue.
 *
 * A table, because an admin triaging a queue is comparing rows - who, when, what
 * state - and a stack of expandable cards makes that comparison impossible.
 *
 * Two columns cannot hold their real content at row scale, and both are handled
 * the same way: show a bounded preview, open the full thing in a modal.
 *   - Description is capped at 2000 characters, which would make rows wildly
 *     unequal in height and destroy the scannability a table exists for. So the
 *     cell is fixed-width with a two-line clamp.
 *   - Screenshots can be up to 5. The cell shows three thumbnails and a "+N"
 *     counter; the modal shows all of them with a lightbox.
 *
 * Everything that mutates a ticket lives in the modal, so there is one place
 * where actions happen rather than controls scattered across a row.
 */
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
  // actions the server answers with 409.
  useEffect(() => {
    setTickets(initialTickets);
  }, [initialTickets]);

  const [filter, setFilter] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [confirmCloseId, setConfirmCloseId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  /** Reply ids already POSTed as read, so re-opening a ticket does not re-fire. */
  const markedReadRef = useRef<Set<string>>(new Set());

  const shown = useMemo(
    () => (filter === "all" ? tickets : tickets.filter((t) => t.status === filter)),
    [tickets, filter]
  );

  // Read from `tickets` rather than captured at open time, so the modal repaints
  // after a status change or a sent reply instead of showing stale content.
  const openTicket = openId ? tickets.find((t) => t.id === openId) ?? null : null;

  // Opening a ticket marks the USER's replies read, which is what clears the
  // "new reply" marker in the table. Tracked per reply id in a ref so a ticket
  // reopened in the same session does not re-POST, and so a later user reply on
  // an already-opened ticket still gets marked.
  useEffect(() => {
    if (!openTicket) return;
    const pending = openTicket.replies.filter(
      (r) => isUserReply(r.authorRole) && !r.readAt && !markedReadRef.current.has(r.id)
    );
    if (pending.length === 0) return;

    pending.forEach((r) => markedReadRef.current.add(r.id));
    fetch(`/api/admin/tickets/${openTicket.id}/read`, { method: "POST" })
      .then((res) => {
        if (res.ok) router.refresh();
      })
      .catch(() => {
        /* the marker clears on the next load either way */
      });
  }, [openTicket, router]);

  function closeModal() {
    setOpenId(null);
    setConfirmCloseId(null);
  }

  async function copyId(id: string) {
    try {
      await navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      toast("Could not copy the ticket ID", "error");
    }
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
      // so the controls disappear instead of failing again on the next click.
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
      // stops them contradicting the table underneath.
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
      // /support, so replies are locked.
      if (res.status === 409) {
        router.refresh();
        throw new Error(data.error || "This ticket is closed. Replies are locked.");
      }
      if (!res.ok) throw new Error(data.error || "Could not send the reply");

      // A 2xx with an unparseable body leaves data as {}. Pushing an undefined
      // reply into the array would crash the next render.
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
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Reply failed", "error");
    } finally {
      setSendingId(null);
    }
  }

  const TH = "px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
            <LifeBuoy className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            Support Tickets
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            {total} total &middot; {openCount} open
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(["all", ...TICKET_STATUSES] as const).map((s) => {
            const count = s === "all" ? tickets.length : tickets.filter((t) => t.status === s).length;
            return (
              <button
                key={s}
                onClick={() => setFilter(s)}
                aria-pressed={filter === s}
                className={cn(
                  "rounded-lg border px-3 py-1.5 text-xs capitalize transition-colors",
                  filter === s
                    ? "border-blue-600 bg-blue-600 text-white"
                    : "border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.06]"
                )}
              >
                {s.replace("_", " ")}
                <span className="ml-1 tabular-nums opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-10 text-center shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <LifeBuoy className="mx-auto mb-3 h-8 w-8 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filter === "all" ? "No tickets yet." : `No ${filter.replace("_", " ")} tickets.`}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          {/* Nine columns will not fit a laptop at full width, so the table
              scrolls horizontally rather than wrapping cells into unreadable
              slivers. */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] border-collapse">
              <thead className="border-b border-gray-100 bg-gray-50/70 dark:border-gray-800 dark:bg-white/[0.02]">
                <tr>
                  <th className={TH}>Ticket ID</th>
                  <th className={TH}>Username</th>
                  <th className={TH}>User email</th>
                  <th className={TH}>Raised</th>
                  <th className={TH}>Last updated</th>
                  <th className={TH}>Status</th>
                  <th className={cn(TH, "w-[260px]")}>Description</th>
                  <th className={TH}>Images</th>
                  <th className={cn(TH, "text-right")}>Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {shown.map((t) => {
                  const shots = parseAttachments(t.screenshots);
                  const closed = isTicketClosed(t.status);
                  const awaitingUserRead = t.replies.some((r) => !isUserReply(r.authorRole) && !r.readAt);
                  const newFromUser = t.replies.some((r) => isUserReply(r.authorRole) && !r.readAt);

                  return (
                    <tr
                      key={t.id}
                      className="align-top transition-colors hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                    >
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => copyId(t.id)}
                          title={`${t.id} — click to copy`}
                          className="group inline-flex items-center gap-1.5 font-mono text-[11px] text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                        >
                          {t.id.slice(-8)}
                          {copiedId === t.id ? (
                            <Check className="h-3 w-3 text-green-600 dark:text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                          )}
                        </button>
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar src={t.user.image} name={t.user.name} size={24} />
                          <span className="max-w-[140px] truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            {t.user.name || "Unknown"}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <span className="block max-w-[190px] truncate text-xs text-gray-600 dark:text-gray-400" title={t.user.email || ""}>
                          {t.user.email}
                        </span>
                      </td>

                      <td className="px-3 py-3"><Stamp iso={t.createdAt} /></td>
                      <td className="px-3 py-3"><Stamp iso={t.updatedAt} /></td>

                      <td className="px-3 py-3">
                        <span
                          className={cn(
                            "inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] capitalize",
                            STATUS_STYLE[t.status] ?? STATUS_STYLE.closed
                          )}
                        >
                          {t.status.replace("_", " ")}
                        </span>
                        {/* A new message FROM the user is the one that needs
                            action, so it reads as a badge rather than a note. */}
                        {newFromUser && (
                          <span className="mt-1 block whitespace-nowrap rounded-full bg-blue-600 px-2 py-0.5 text-center text-[10px] font-semibold text-white">
                            New reply
                          </span>
                        )}
                        {awaitingUserRead && !newFromUser && (
                          <span className="mt-1 block whitespace-nowrap text-[10px] text-amber-700 dark:text-amber-400">
                            Unread by user
                          </span>
                        )}
                      </td>

                      {/* Fixed width + two-line clamp. The full text is one click
                          away in the modal; letting it set the row height here
                          would make the table unscannable. */}
                      <td className="px-3 py-3">
                        <p className="line-clamp-2 w-[260px] break-words text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                          {t.description}
                        </p>
                        <button
                          type="button"
                          onClick={() => setOpenId(t.id)}
                          className="mt-1 text-[11px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          Read full
                        </button>
                      </td>

                      <td className="px-3 py-3">
                        {shots.length === 0 ? (
                          <span className="text-xs text-gray-300 dark:text-gray-600">&mdash;</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setOpenId(t.id)}
                            title={`${shots.length} screenshot${shots.length === 1 ? "" : "s"}`}
                            className="flex items-center gap-1"
                          >
                            {/* Three thumbnails max, then a counter. Five at row
                                scale is a wall of thumbnails and no information. */}
                            {shots.slice(0, 3).map((s) => (
                              <span
                                key={s.url}
                                className="h-8 w-8 overflow-hidden rounded border border-gray-200 dark:border-gray-700"
                              >
                                <PostImage
                                  src={s.url}
                                  alt={s.name}
                                  className="h-full w-full object-cover"
                                  iconClassName="w-3 h-3"
                                />
                              </span>
                            ))}
                            {shots.length > 3 && (
                              <span className="flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-gray-50 text-[10px] font-medium text-gray-500 dark:border-gray-700 dark:bg-white/[0.04] dark:text-gray-400">
                                +{shots.length - 3}
                              </span>
                            )}
                          </button>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {t.replies.length > 0 && (
                            <span
                              className="flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500"
                              title={`${t.replies.length} reply sent`}
                            >
                              <MessageSquare className="h-3 w-3" />
                              {t.replies.length}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => setOpenId(t.id)}
                            disabled={busyId === t.id || sendingId === t.id}
                            className={cn(
                              "whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50",
                              closed
                                ? "border border-gray-200 text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.06]"
                                : "bg-blue-600 text-white hover:bg-blue-700"
                            )}
                          >
                            {busyId === t.id || sendingId === t.id ? (
                              <Loader2 className="inline h-3 w-3 animate-spin" />
                            ) : closed ? (
                              "View"
                            ) : (
                              "Reply"
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {openTicket && (
        <TicketDetailModal
          ticket={openTicket}
          busy={busyId === openTicket.id}
          sending={sendingId === openTicket.id}
          confirmingClose={confirmCloseId === openTicket.id}
          draft={drafts[openTicket.id] || ""}
          onDraftChange={(v) => setDrafts((prev) => ({ ...prev, [openTicket.id]: v }))}
          onClose={closeModal}
          onSetStatus={(s) => setStatus(openTicket.id, s)}
          onConfirmClose={(c) => setConfirmCloseId(c ? openTicket.id : null)}
          onSendReply={() => sendReply(openTicket.id)}
        />
      )}
    </div>
  );
}
