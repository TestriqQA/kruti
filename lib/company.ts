/**
 * The operating company's registered details (F-02, used by D-18 and D-05).
 *
 * Single source of truth so the footer, the Organization JSON-LD and any future
 * About or Contact page cannot drift apart. Taken from the GST registration
 * certificate (Form GST REG-06), issued 01/10/2026.
 *
 * ── A correction to the SEO handoff pack ──────────────────────────────────
 * S-02, S-03 and S-08 all name "Cinute Digital Pvt. Ltd., Mumbai". That is a
 * DIFFERENT legal entity: Cinute Digital Private Limited, CIN
 * U74999MH2018PTC304936, registered at Goregaon East, Mumbai 400065.
 *
 * The entity that actually operates Kruti.io is Cinute InfoMedia, a sole
 * proprietorship of Sandeep M Maske registered in Thane. Confirmed by the
 * client on 2026-10-07. The values below are the accurate ones.
 *
 * Consequences still outstanding:
 *   - The five legal pages still name Cinute Digital Pvt. Ltd. as the
 *     contracting party. That is a lawyer's change, not a find-and-replace.
 *   - S-02/S-08's brand line and S-09's FAQ answers 1 and 3 name the wrong
 *     company and need re-approval from whoever wrote the pack.
 *   - A proprietorship has no CIN, so the "CIN" half of F-02 does not exist.
 */

export const COMPANY = {
  /** Trading name, as it should appear to users. */
  name: "Cinute InfoMedia",
  /** Legal constitution - a proprietorship, not a private limited company. */
  constitution: "Proprietorship",
  /** Legal name on the GST certificate. */
  proprietor: "Sandeep M Maske",

  gstin: "27AMZPM6333R1ZU",
  /** Proprietorships are not registered with the MCA, so there is no CIN. */
  cin: null as string | null,

  address: {
    line1: "2nd Floor, Shop No. 3, Ashley Tower",
    line2: "St Jalaram Bapa Marg, Mira Road East",
    locality: "Mira Bhayandar",
    district: "Thane",
    region: "Maharashtra",
    postalCode: "401107",
    country: "India",
    countryCode: "IN",
  },

  supportEmail: "support@kruti.io",
} as const;

/** One-line address for the footer. */
export function companyAddressLine(): string {
  const a = COMPANY.address;
  return `${a.line1}, ${a.line2}, ${a.locality}, ${a.district}, ${a.region} ${a.postalCode}, ${a.country}`;
}

/** schema.org PostalAddress, for the Organization block in D-05. */
export function companyPostalAddress() {
  const a = COMPANY.address;
  return {
    "@type": "PostalAddress",
    streetAddress: `${a.line1}, ${a.line2}`,
    addressLocality: a.locality,
    addressRegion: a.region,
    postalCode: a.postalCode,
    addressCountry: a.countryCode,
  };
}
