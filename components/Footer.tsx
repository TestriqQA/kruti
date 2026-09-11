import Link from "next/link";
import SignInButton from "@/components/SignInButton";

const PRODUCT_LINKS = [
  { href: "/#how", label: "How it works" },
  { href: "/#features", label: "Features" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

const RESOURCE_LINKS = [
  { href: "/blog", label: "Blog" },
];

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/refund", label: "Refunds" },
  { href: "/cookies", label: "Cookies" },
  { href: "/disclaimer", label: "Disclaimer" },
];

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">{title}</h3>
      <ul className="mt-4 space-y-3">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-sm text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-gray-200 bg-[#F6F8FB] dark:border-white/10 dark:bg-[#0A0E14]">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:py-14">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="inline-flex items-center" aria-label="Kruti.io home">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Kruti.io" className="h-12 w-auto" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              AI-powered LinkedIn content - 30 strategic posts, professional images, and newsletters
              every month, all in your authentic voice.
            </p>
            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">Made with care in Mumbai, India.</p>
          </div>

          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Resources</h3>
            <ul className="mt-4 space-y-3">
              {RESOURCE_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
              <li>
                <SignInButton
                  className="text-sm text-gray-600 transition-colors hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
                >
                  Sign in
                </SignInButton>
              </li>
            </ul>
          </div>
          <FooterColumn title="Legal" links={LEGAL_LINKS} />
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-gray-200 pt-6 dark:border-white/10 sm:flex-row">
          <p className="text-xs text-gray-500 dark:text-gray-400">Kruti.io by Cinute Digital Pvt. Ltd.</p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            &copy; 2024-{year} Cinute Digital Pvt. Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
