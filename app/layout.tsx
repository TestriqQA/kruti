import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { cn } from "@/lib/utils";
import { SITE_URL, OG_IMAGE_PATH, absoluteUrl } from "@/lib/site-url";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  fallback: ["ui-sans-serif", "system-ui", "Segoe UI", "Helvetica", "Arial", "sans-serif"],
  display: "swap",
});

/**
 * Site-wide metadata defaults (D-04).
 *
 * metadataBase is what makes every relative canonical and og:image resolve to an
 * absolute URL, which both Open Graph and Google require. It comes from
 * SITE_URL rather than the request host on purpose - otherwise a Vercel preview
 * deploy would emit canonicals pointing at itself.
 *
 * Title and description are S-02's approved text. Pages that need their own
 * values override these; anything that does not gets these.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "AI LinkedIn Post Generator & Scheduler | Kruti.io",
  description:
    "Generate 30 LinkedIn posts, images and newsletters a month in your own voice. Schedule and publish via the official API. 7-day free trial.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: "Kruti.io",
    title: "AI LinkedIn Post Generator & Scheduler | Kruti.io",
    description:
      "Generate 30 LinkedIn posts, images and newsletters a month in your own voice. Schedule and publish via the official API. 7-day free trial.",
    url: "/",
    locale: "en_IN",
    // Absolute on purpose: a relative og:image resolved against the dev origin
    // rather than metadataBase, and a social scraper cannot fetch that.
    // NOTE: logo.png is 2048x842, not the 1200x630 declared here, so it is
    // cropped in social previews. D-21 (generated share cards) is the fix and
    // is still outstanding - see SEO-TASK-STATUS.md.
    images: [{ url: absoluteUrl(OG_IMAGE_PATH), width: 1200, height: 630, alt: "Kruti.io" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AI LinkedIn Post Generator & Scheduler | Kruti.io",
    description:
      "Generate 30 LinkedIn posts, images and newsletters a month in your own voice. Schedule and publish via the official API. 7-day free trial.",
    images: [absoluteUrl(OG_IMAGE_PATH)],
  },
  verification: {
    google: "3PtMkclQtn24rcMvN_fMWe3gBTMiCSb8Bst-HbmcmbU",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="scroll-smooth">
      <body className={cn(inter.className, inter.variable, display.variable, "bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100")}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
