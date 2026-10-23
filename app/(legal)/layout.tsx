import Link from "next/link";
import LegalSidebar from "@/components/LegalSidebar";
import Footer from "@/components/Footer";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Kruti.io" className="h-16 w-auto" />
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-[#0A66C2] dark:hover:text-blue-400 transition-colors"
          >
            &larr; Back to Home
          </Link>
        </div>
      </header>

      {/* Content.
          flex-col until md, then a row. LegalSidebar renders TWO navs - a
          vertical one for desktop (hidden md:block) and a horizontal pill strip
          for phones (md:hidden) - and both are flex items here. As a row at all
          widths, the phone strip sat BESIDE the article instead of above it and
          forced the page 121px wider than the viewport, so every legal page
          scrolled sideways on a phone. Stacking below md puts the strip where it
          was designed to go and lets the article take the full width.
          min-w-0 on the row stops a long unbroken token in the prose doing the
          same thing at desktop width. */}
      <div className="flex-1 max-w-6xl mx-auto w-full min-w-0 px-6 py-10 flex flex-col md:flex-row md:gap-10">
        <LegalSidebar />
        <main className="flex-1 min-w-0">{children}</main>
      </div>

      <Footer />
    </div>
  );
}
