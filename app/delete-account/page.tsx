import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, Mail, Trash2 } from "lucide-react";
import { COMPANY } from "@/lib/company";
import { absoluteUrl } from "@/lib/site-url";

/**
 * Public account-deletion page (Google Play data-safety requirement).
 *
 * Play requires a deletion route reachable WITHOUT signing in, and a URL that
 * can be pasted into the store listing. /settings cannot satisfy that - it sits
 * behind the auth middleware - so this page exists to be that public URL.
 *
 * It deliberately does not attempt to delete anything itself: erasure needs an
 * authenticated session, and a form here that accepted an email address would
 * let anyone request deletion of someone else's account. Instead it explains
 * exactly what is removed and gives the two legitimate routes - self-service in
 * Settings, or an emailed request we verify.
 *
 * Public by default: /delete-account is not in APP_ROUTE_PREFIXES, so the
 * middleware hands it straight to Next.
 */

export const metadata: Metadata = {
  title: "Delete your Kruti.io account",
  description:
    "How to permanently delete your Kruti.io account and all associated data, including what is removed and what is kept.",
  alternates: { canonical: absoluteUrl("/delete-account") },
};

const REMOVED = [
  "Your account and profile, including your name, email and the details you entered during onboarding",
  "Every generated post, content plan and newsletter draft",
  "All generated images, carousel frames and uploaded documents",
  "Your support tickets and their replies, including any screenshots you attached",
  "Your subscription record",
  "Your LinkedIn connection and the access tokens held against your account",
];

const KEPT = [
  {
    what: "Posts already published to LinkedIn",
    why: "They live on your LinkedIn profile, not on ours. Delete those from LinkedIn itself.",
  },
  {
    what: "Payment and tax records",
    why: "Razorpay retains transaction records under their own policy and Indian financial regulations. We cannot remove those.",
  },
];

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-white px-6 py-14 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/" className="inline-flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Kruti.io" width={160} height={66} className="h-12 w-auto" />
        </Link>

        <h1 className="mt-10 font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-gray-100">
          Delete your account
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-400">
          You can permanently delete your Kruti.io account and the data we hold about you. This
          page explains exactly what happens and how to do it, from the app or the website.
        </p>

        <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-900/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="text-sm leading-relaxed text-amber-900 dark:text-amber-200">
            Deletion is immediate and cannot be undone. We cannot recover anything afterwards, so
            export anything you want to keep first.
          </p>
        </div>

        {/* ── How ──────────────────────────────────────────────── */}
        <h2 className="mt-10 font-display text-xl font-semibold text-slate-900 dark:text-gray-100">
          How to delete it
        </h2>

        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <div className="flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-gray-100">
                Yourself, in Settings
              </h3>
            </div>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              <li>Sign in to Kruti.io, in the mobile app or on the website.</li>
              <li>
                Open <strong>Settings</strong>.
              </li>
              <li>
                Scroll to <strong>Delete your account</strong>, type{" "}
                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs dark:bg-white/[0.08]">
                  DELETE MY ACCOUNT
                </code>{" "}
                and confirm.
              </li>
            </ol>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-500">
              You do not need an active subscription to do this.
            </p>
            <Link
              href="/login?callbackUrl=%2Fsettings"
              className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Sign in to Settings
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <h3 className="text-sm font-semibold text-slate-900 dark:text-gray-100">
                Or ask us to do it
              </h3>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Email{" "}
              <a
                href={`mailto:${COMPANY.supportEmail}?subject=Account%20deletion%20request`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {COMPANY.supportEmail}
              </a>{" "}
              from the address on your account, with the subject &ldquo;Account deletion
              request&rdquo;. We verify the request comes from the account holder before acting on
              it, and confirm in writing once it is done.
            </p>
          </div>
        </div>

        {/* ── What goes ────────────────────────────────────────── */}
        <h2 className="mt-10 font-display text-xl font-semibold text-slate-900 dark:text-gray-100">
          What is deleted
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {REMOVED.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <h2 className="mt-8 font-display text-xl font-semibold text-slate-900 dark:text-gray-100">
          What is not deleted
        </h2>
        <dl className="mt-3 space-y-3">
          {KEPT.map((item) => (
            <div key={item.what}>
              <dt className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {item.what}
              </dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {item.why}
              </dd>
            </div>
          ))}
        </dl>

        <p className="mt-10 border-t border-slate-200 pt-6 text-sm leading-relaxed text-slate-500 dark:border-white/10 dark:text-slate-500">
          Kruti.io is operated by {COMPANY.name}, {COMPANY.address.locality},{" "}
          {COMPANY.address.district}, {COMPANY.address.region} {COMPANY.address.postalCode},{" "}
          {COMPANY.address.country}. For how we handle your data generally, see our{" "}
          <Link href="/privacy" className="text-blue-600 hover:underline dark:text-blue-400">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
