"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { cn } from "@/lib/utils";

/**
 * Self-service account deletion (DPDP s.12(3)).
 *
 * The right to erasure has to be exercisable by the person themselves. Before
 * this, the only way to delete an account was to email support and wait for an
 * admin - which is a request, not a right.
 *
 * Deliberately high-friction: collapsed by default, and the confirm button stays
 * disabled until the exact phrase is typed. This is irreversible and there is no
 * undo, so a mis-click must not be able to trigger it. It is NOT gated on an
 * active subscription - a lapsed trial cannot be a reason to withhold erasure.
 */

const CONFIRMATION = "DELETE MY ACCOUNT";

export default function DeleteAccountSection() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canDelete = typed.trim() === CONFIRMATION && !deleting;

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: CONFIRMATION }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not delete your account.");

      toast("Your account has been deleted.", "success");
      // The session is a JWT, so it has to be cleared client-side; without this
      // the browser would hold a token for an account that no longer exists.
      await signOut({ callbackUrl: "/" });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete your account.", "error");
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-red-200 bg-red-50/40 p-5 dark:border-red-500/30 dark:bg-red-500/[0.04]">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-gray-100">
            Delete your account
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            This permanently removes your account, your profile, every post, content plan and
            newsletter, your generated images, your support history and your LinkedIn connection.
            It cannot be undone, and we cannot recover anything afterwards.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Posts already published to LinkedIn stay on LinkedIn &mdash; delete those from
            LinkedIn itself. If you want a copy of your posts, export them before you continue.
          </p>

          {!open ? (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-red-300 px-3.5 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-500/40 dark:text-red-400 dark:hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
              Delete my account
            </button>
          ) : (
            <div className="mt-4">
              <label
                htmlFor="confirm-delete"
                className="block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Type <span className="font-mono font-semibold">{CONFIRMATION}</span> to confirm
              </label>
              <input
                id="confirm-delete"
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                disabled={deleting}
                className="mt-1.5 w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-100"
                placeholder={CONFIRMATION}
              />

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!canDelete}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-white transition-colors",
                    canDelete
                      ? "bg-red-600 hover:bg-red-700"
                      : "cursor-not-allowed bg-red-600/40"
                  )}
                >
                  {deleting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {deleting ? "Deleting..." : "Permanently delete"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setTyped("");
                  }}
                  disabled={deleting}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
