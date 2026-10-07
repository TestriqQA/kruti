import { del } from "@vercel/blob";
import { prisma } from "@/lib/prisma";
import { parseAttachments } from "@/lib/support";

/**
 * Erases a user and everything personal we hold about them.
 *
 * Shared by the user-facing route (DELETE /api/account) and the admin route
 * (DELETE /api/admin/users/[id]?mode=full) so the two cannot drift. DPDP s.12(3)
 * gives the right to erasure, and a right that depends on which endpoint was
 * called is not a right.
 *
 * Two things the Prisma cascade does NOT do, which is why this function exists
 * rather than a bare `prisma.user.delete`:
 *
 *  1. Blob objects survive. Deleting the rows that reference an image, a support
 *     screenshot or an uploaded document leaves the file itself in storage, at a
 *     public URL, forever - nothing sweeps the support/ or documents/ prefixes.
 *     So the URLs are collected BEFORE the rows are deleted, then the files are
 *     removed.
 *
 *  2. The LinkedIn tokens in `Account` are cascaded away, which is correct, but
 *     only if the delete actually reaches the User row. The admin route used to
 *     default to a mode that left it behind.
 *
 * Blob deletion is best-effort and deliberately non-fatal: if storage is
 * unreachable we would rather complete the database erasure and log the orphans
 * than abort and leave the account intact.
 */

export interface ErasureResult {
  blobsDeleted: number;
  blobsFailed: number;
}

/** Every blob URL belonging to this user, gathered before their rows are removed. */
async function collectBlobUrls(userId: string): Promise<string[]> {
  const urls = new Set<string>();

  const [posts, tickets, user] = await Promise.all([
    prisma.post.findMany({
      where: { plan: { userId } },
      select: {
        imageUrl: true,
        imageHistory: true,
        carouselImages: true,
        // documentUrl holds an uploaded PDF under the documents/ prefix. Missing
        // it would leave the user's own document in public storage after they
        // asked to be erased.
        documentUrl: true,
      },
    }),
    prisma.supportTicket.findMany({
      where: { userId },
      select: { screenshots: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { id: true } }),
  ]);

  if (!user) return [];

  const addJsonArray = (raw: string | null | undefined) => {
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (typeof entry === "string") urls.add(entry);
          else if (entry && typeof entry.url === "string") urls.add(entry.url);
        }
      }
    } catch {
      /* a malformed column must not block erasure */
    }
  };

  for (const p of posts) {
    if (p.imageUrl) urls.add(p.imageUrl);
    if (p.documentUrl) urls.add(p.documentUrl);
    addJsonArray(p.imageHistory);
    addJsonArray(p.carouselImages);
  }

  for (const t of tickets) {
    for (const a of parseAttachments(t.screenshots)) {
      if (a?.url) urls.add(a.url);
    }
  }

  // Only files in our own blob store, never an arbitrary URL that happened to be
  // stored in one of these columns.
  return Array.from(urls).filter((u) => u.includes(".public.blob.vercel-storage.com"));
}

export async function eraseUserCompletely(userId: string): Promise<ErasureResult> {
  // Order matters: read the file references while the rows still exist.
  const urls = await collectBlobUrls(userId);

  // Cascades through Account (and the LinkedIn tokens), ContentPlan, Post,
  // Newsletter, Subscription, SupportTicket and SupportReply - every relation on
  // User is onDelete: Cascade.
  await prisma.user.delete({ where: { id: userId } });

  let blobsDeleted = 0;
  let blobsFailed = 0;
  for (const url of urls) {
    try {
      await del(url);
      blobsDeleted++;
    } catch (err) {
      blobsFailed++;
      console.error(`[account-deletion] could not delete blob ${url}:`, err);
    }
  }

  console.log(
    `[account-deletion] erased user ${userId}: ${blobsDeleted} file(s) deleted, ${blobsFailed} failed`
  );

  return { blobsDeleted, blobsFailed };
}
