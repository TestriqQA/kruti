import { COMPANY } from "@/lib/company";
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
              <img src="/logo.png" alt="Kruti.io" className="h-16 w-auto" />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-gray-500 dark:text-gray-400">
              AI-powered LinkedIn content - 30 strategic posts, professional images, and newsletters
              every month, all in your authentic voice.
            </p>
            <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">Made with care in {COMPANY.address.district}, India.</p>
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

        {/* D-18: registered company details, site-wide.
            A real address, a verifiable GSTIN and a working contact address are
            trust signals for users, for Razorpay and for search engines - the
            "who is actually behind this" question that an unnamed SaaS site
            never answers. There is no CIN: the operating entity is a
            proprietorship, which the MCA does not issue one to. */}
        <div className="mt-10 border-t border-gray-200 pt-6 dark:border-white/10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-md">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                Kruti.io is a product of {COMPANY.name}
              </p>
              <address className="mt-1.5 text-xs not-italic leading-relaxed text-gray-500 dark:text-gray-400">
                {COMPANY.address.line1}, {COMPANY.address.line2},<br />
                {COMPANY.address.locality}, {COMPANY.address.district},{" "}
                {COMPANY.address.region} {COMPANY.address.postalCode}, {COMPANY.address.country}
              </address>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                GSTIN:{" "}
                <span className="font-mono tabular-nums tracking-tight">{COMPANY.gstin}</span>
              </p>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                <a
                  href={`mailto:${COMPANY.supportEmail}`}
                  className="transition-colors hover:text-blue-600 dark:hover:text-blue-400"
                >
                  {COMPANY.supportEmail}
                </a>
              </p>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 sm:text-right">
              &copy; 2024-{year} {COMPANY.name}.<br className="hidden sm:block" /> All rights
              reserved.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
