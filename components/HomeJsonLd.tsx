import { absoluteUrl } from "@/lib/site-url";

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
  "Kruti.io is an AI LinkedIn content platform by Cinute Digital Pvt. Ltd., Mumbai. It generates 30 posts, images and newsletter drafts a month, which you review and publish through LinkedIn's official API.";

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Kruti.io",
  legalName: "Cinute Digital Pvt. Ltd.",
  url: absoluteUrl("/"),
  logo: absoluteUrl("/logo.png"),
  description: BRAND_LINE,
  address: {
    "@type": "PostalAddress",
    addressLocality: "Mumbai",
    addressCountry: "IN",
  },
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: "support@kruti.io",
  },
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
  publisher: { "@type": "Organization", name: "Cinute Digital Pvt. Ltd." },
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
