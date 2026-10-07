import { COMPANY } from "@/lib/company";

/**
 * The operating entity's identity block, shared by all five legal pages.
 *
 * One component rather than five copies because these pages name the
 * CONTRACTING PARTY. When that drifts between Terms and Privacy, it is not a
 * cosmetic inconsistency - it is ambiguity about who the user actually agreed
 * with. Everything here reads from lib/company.ts, so there is one place to
 * change and no way for the pages to disagree.
 *
 * India's DPDP Act 2023 requires a Data Fiduciary to be identifiable and
 * contactable, which is why the registered address and GSTIN appear here and
 * not only in the footer.
 */
export default function LegalContact() {
  const a = COMPANY.address;

  return (
    <>
      <p>
        <strong>{COMPANY.name}</strong>
        <br />
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {COMPANY.constitution} &middot; Proprietor: {COMPANY.proprietor}
        </span>
      </p>

      <address className="not-italic leading-relaxed">
        {a.line1},<br />
        {a.line2},<br />
        {a.locality}, {a.district}, {a.region} {a.postalCode}, {a.country}
      </address>

      <p>
        GSTIN: <span className="font-mono tracking-tight">{COMPANY.gstin}</span>
      </p>

      <p>
        Email:{" "}
        <a
          href={`mailto:${COMPANY.supportEmail}`}
          className="text-[#0A66C2] dark:text-blue-400 hover:underline"
        >
          {COMPANY.supportEmail}
        </a>
      </p>
    </>
  );
}
