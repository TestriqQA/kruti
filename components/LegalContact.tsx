import { COMPANY } from "@/lib/company";

/**
 * The contact block shared by all five legal pages.
 *
 * One component rather than five copies, so the pages cannot disagree about
 * where to write.
 *
 * This used to carry the contracting party's identity - name, constitution,
 * proprietor, registered address and GSTIN - because these pages name who the
 * user is agreeing WITH. That has been removed at the owner's request, leaving
 * an email address. If an entity is named again, add it to lib/company.ts and
 * render it here; do not write it into the individual pages.
 */
export default function LegalContact() {
  return (
    <p>
      Email:{" "}
      <a
        href={`mailto:${COMPANY.supportEmail}`}
        className="text-[#0A66C2] dark:text-blue-400 hover:underline"
      >
        {COMPANY.supportEmail}
      </a>
    </p>
  );
}
