import { absoluteUrl } from "@/lib/site-url";
import { COMPANY, companyPostalAddress } from "@/lib/company";

/**
 * Organization, WebSite and SoftwareApplication JSON-LD for the homepage
 * (D-05, spec S-03).
 *
 * A server component with no "use client", so the markup is in view-source
 * rather than injected after hydration - S-03 requires it to be server-rendered,
 * and a crawler that does not run JavaScript must still see it.
 *
 * The FAQPage block is NOT here. It lives in components/LandingPage.tsx, built
 * from the same `faqs` array the page renders, because S-03 requires the schema
 * to match the visible FAQ word for word. Generating it from S-09's 13 questions
 * while the page still shows its current six would be a mismatch, and replacing
 * the visible FAQ is D-09, which is blocked on F-03/F-04/F-05/F-07.
 *
 * Deliberately omitted, per S-03:
 *   - Organization.address street line: waits on F-02 (registered address).
 *     Locality and country are known, so those are included.
 *   - Organization.sameAs: waits on the LinkedIn company page, YouTube, Product
 *     Hunt and G2 profiles existing. S-03: "Do not add placeholder links."
 *   - aggregateRating / review: S-03 forbids these until real, verifiable
 *     reviews exist, because Google treats invented ratings as spam.
 */

const BRAND_LINE =
  "Kruti.io is an AI LinkedIn content platform by Cinute InfoMedia, Thane, India. It generates 30 posts, images and newsletter drafts a month, which you review and publish through LinkedIn's official API.";

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Kruti.io",
  // S-03 specifies "Cinute Digital Pvt. Ltd." - that is a different company.
  // The entity that operates Kruti.io is Cinute InfoMedia; see lib/company.ts.
  legalName: COMPANY.name,
  url: absoluteUrl("/"),
  logo: absoluteUrl("/logo.png"),
  description: BRAND_LINE,
  // F-02 is now answered, so the full street address is included rather than
  // the locality-only placeholder this shipped with.
  address: companyPostalAddress(),
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: COMPANY.supportEmail,
  },
  // Disambiguates the brand from the unrelated entities that dominate the
  // "kruti" SERP - Ola Krutrim's Kruti assistant and the Kruti Dev font.
  // These are descriptive facts, not links, so no placeholder URLs are invented.
  alternateName: "Kruti.io - AI LinkedIn content platform",
};

const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Kruti.io",
  url: absoluteUrl("/"),
  publisher: { "@type": "Organization", name: "Kruti.io" },
};

const softwareApplication = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Kruti.io",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: absoluteUrl("/"),
  description:
    "AI tool that plans, writes, schedules and publishes LinkedIn posts, images and newsletter drafts.",
  publisher: { "@type": "Organization", name: COMPANY.name },
  offers: [
    {
      "@type": "Offer",
      price: "999",
      priceCurrency: "INR",
      description: "Monthly plan for users in India. 7-day free trial.",
    },
    {
      "@type": "Offer",
      price: "19",
      priceCurrency: "USD",
      description: "Monthly plan for international users. 7-day free trial.",
    },
  ],
};

export default function HomeJsonLd() {
  return (
    <>
      {[organization, website, softwareApplication].map((block, i) => (
        <script
          // Each block gets its own <script> tag, as S-03 specifies.
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }}
        />
      ))}
    </>
  );
}
