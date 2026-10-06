import Link from "next/link";
import type { Metadata } from "next";
import NotFoundReporter from "@/components/NotFoundReporter";

/**
 * The friendly 404 page (D-03).
 *
 * Reached whenever Next cannot route a URL. Before D-03 an unknown public URL
 * never got this far - the auth middleware answered it with a 307 to sign-in -
 * so this file had nothing to render and did not exist.
 *
 * noindex so the 404 body itself never competes in search results. The 404
 * status code is set by Next, not here.
 */
export const metadata: Metadata = {
  title: "Page not found | Kruti.io",
  robots: { index: false, follow: true },
};

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/blog", label: "Blog" },
  { href: "/login", label: "Sign in" },
];

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-white px-6 py-16 dark:bg-gray-950">
      {/* D-19. Must be a client component that reports on mount: Next builds
          this page's element as a prop of the NotFoundBoundary on EVERY page
          render, so anything logged in the server render body fires for
          successful pages too and fills the log with false 404s. */}
      <NotFoundReporter />
      <div className="w-full max-w-md text-center">
        <Link href="/" className="inline-flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Kruti.io" width={160} height={66} className="h-12 w-auto" />
        </Link>

        <p className="mt-10 font-display text-5xl font-bold tracking-tight text-slate-900 dark:text-gray-100">
          404
        </p>
        <h1 className="mt-3 font-display text-xl font-semibold text-slate-900 dark:text-gray-100">
          We could not find that page
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          The link may be out of date, or the address may have a typo in it. Nothing is wrong with
          your account.
        </p>

        <nav className="mt-8 flex flex-wrap items-center justify-center gap-2">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
