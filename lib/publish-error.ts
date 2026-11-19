/**
 * Turns whatever the publish path stored into something a person can act on.
 *
 * Post.postError is written straight from the failure and rendered verbatim in
 * the editor, so the reader was being shown things like
 *
 *   LinkedIn rejected the post (HTTP 422): Content is a duplicate of
 *   urn:li:share:7528730858439127040
 *
 * which tells someone who writes LinkedIn posts for a living nothing at all,
 * and reads like the product is broken. The useful half is still worth keeping
 * for whoever answers the support ticket, so it is not thrown away - it moves
 * behind a disclosure, and the sentence in front of it says what to DO.
 *
 * Matching is on the raw text because that is all that is stored; the status
 * codes are matched as words, not parsed, since the same sentence can arrive
 * from the website route, the mobile route or the cron.
 */
export type PublishErrorView = {
  /** Plain language, and always something the reader can act on. */
  message: string;
  /** The original, for the disclosure. Omitted when it adds nothing. */
  detail?: string;
};

export function describePublishError(
  raw: string | null | undefined
): PublishErrorView | null {
  const text = (raw ?? "").trim();
  if (!text) return null;

  const t = text.toLowerCase();
  const detail = text;

  // A duplicate is not really a failure - LinkedIn already has the content.
  if (t.includes("duplicate")) {
    return {
      message:
        "LinkedIn already has a post with this text, so it refused a second copy. Edit the wording and save, then try again.",
      detail,
    };
  }

  // The account is being throttled, usually after repeated retries.
  if (t.includes("429") || t.includes("rate limit") || t.includes("action was blocked")) {
    return {
      message:
        "LinkedIn is temporarily limiting how often this account can post. Nothing is lost - leave it scheduled and auto-publish will carry on once the limit clears.",
      detail,
    };
  }

  // The connection itself is gone. Only the user can fix this one.
  if (t.includes("401") || t.includes("token") || t.includes("expired") || t.includes("reconnect") || t.includes("reauth")) {
    return {
      message:
        "The connection to your LinkedIn account has expired. Sign out and sign in again to reconnect it - posts will not publish until you do.",
      detail,
    };
  }

  if (t.includes("403") || t.includes("permission") || t.includes("scope")) {
    return {
      message:
        "LinkedIn would not accept a post on your behalf. This usually means permission to post was withdrawn - sign in again and allow posting when LinkedIn asks.",
      detail,
    };
  }

  if (t.includes("500") || t.includes("502") || t.includes("503") || t.includes("having trouble")) {
    return {
      message:
        "LinkedIn was not responding when this was last tried. Leave it scheduled - auto-publish will try again.",
      detail,
    };
  }

  // Written by the cron itself when a publish was cut off mid-flight. Already
  // in plain language, and there is no raw detail worth showing underneath.
  if (t.includes("interrupted")) {
    return { message: text };
  }

  return {
    message:
      "Something went wrong while posting this to LinkedIn. It is still scheduled and will be tried again. If it keeps failing, send support the details below.",
    detail,
  };
}
