/**
 * Contact details the public pages use.
 *
 * This module used to carry the operating company's registered identity -
 * trading name, proprietor, GSTIN and registered address - and every public
 * surface read from it so they could not drift apart. That identity has been
 * removed at the owner's request: the site now presents itself as Kruti.io and
 * names no operating entity.
 *
 * The module stays as the single source for what is left, so a contact address
 * still cannot disagree between the footer, the legal pages and llms.txt.
 *
 * ── If an entity has to be named again ───────────────────────────────────────
 * Put it back HERE, not in the pages. The registered details are in git
 * history (see the commit that removed them) and the legal pages, the footer,
 * the Organization JSON-LD and llms.txt all import from this file already.
 *
 * Worth knowing before deciding: India's DPDP Act 2023 requires a Data
 * Fiduciary to be identifiable and contactable, and Razorpay's merchant terms
 * expect the operating entity to be shown. Neither is satisfied by an email
 * address alone.
 */

export const COMPANY = {
  supportEmail: "support@kruti.io",
} as const;
