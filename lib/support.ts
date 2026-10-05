/**
 * Shared rules for the support-ticket form, so the browser and the server
 * enforce the same numbers instead of drifting apart.
 */

/** Blob path prefix for ticket screenshots.
 *
 * MUST stay distinct from "uploads/" and "generated/": the nightly cleanup cron
 * (lib/image-cleanup.ts) deletes anything under those prefixes that is older
 * than 7 days and not referenced by Post.imageUrl, which would quietly destroy
 * every attachment a week after it was raised. Nothing sweeps "support/".
 */
export const SUPPORT_BLOB_PREFIX = "support/";

export const MAX_SCREENSHOTS = 5;

/** Total budget across all screenshots on one ticket. */
export const MAX_TOTAL_BYTES = 5 * 1024 * 1024;

/**
 * Per-file cap. Lower than the total on purpose: Vercel rejects a serverless
 * request body over ~4.5 MB at the edge, so a single screenshot has to stay
 * comfortably under that or the upload fails before any of our code runs.
 */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;

export const SCREENSHOT_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

export const TICKET_STATUSES = ["open", "in_progress", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/**
 * Terminal status.
 *
 * Once a ticket is closed - by the user from /support or by an admin from
 * /admin/tickets - it stays closed. No status change and no further replies.
 * Enforced server-side in three places (the admin status route, the admin reply
 * route and the user close route) and mirrored in both clients so the controls
 * disappear instead of handing the user a 409.
 */
export const CLOSED_STATUS: TicketStatus = "closed";

export function isTicketClosed(status: string | null | undefined): boolean {
  return status === CLOSED_STATUS;
}

export interface TicketAttachment {
  url: string;
  name: string;
  size: number;
}

export const MAX_DESCRIPTION_CHARS = 2000;

/** How long an admin reply survives, read or not. */
export const REPLY_TTL_DAYS = 3;

export const MAX_REPLY_CHARS = 2000;

/**
 * Replies older than this are treated as gone.
 *
 * Queries filter on it so a reply vanishes the moment it turns 3 days old,
 * instead of lingering until the nightly sweep actually deletes the row.
 */
export function replyCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - REPLY_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** "in 2 days" / "in 5 hours" - how long a reply has left before it is removed. */
export function replyExpiresIn(createdAt: Date | string, now: Date = new Date()): string {
  const msLeft =
    new Date(createdAt).getTime() + REPLY_TTL_DAYS * 86400000 - now.getTime();
  if (msLeft <= 0) return "expired";
  const hours = Math.floor(msLeft / 3600000);
  if (hours < 1) return "under an hour";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** "1.4 MB" / "812 KB" - used in the picker's running total. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Parses the JSON blob stored on SupportTicket.screenshots. */
export function parseAttachments(raw?: string | null): TicketAttachment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TicketAttachment[]) : [];
  } catch {
    return [];
  }
}
