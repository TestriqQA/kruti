"use client";

import { useEffect, useRef } from "react";

/**
 * Reports a 404 once, when the not-found page actually mounts in a browser
 * (D-19).
 *
 * Why a client component rather than a console.warn in the server render:
 * Next constructs app/not-found.tsx as the `notFound` prop of its
 * NotFoundBoundary for every route, so the server render body runs on
 * successful pages too. Logging there reported "/" and "/blog" as 404s while
 * both were answering 200. An effect only runs when this page is really shown.
 *
 * This does not catch crawlers that never execute JavaScript - and those are
 * the ones whose 404s matter most for SEO. They are covered by the platform's
 * own request log, which records the path and the 404 status for every request.
 * What this adds on top is the referrer, which is what separates a broken link
 * on our own site from a stale external backlink or a scanner probing for
 * /wp-admin.
 */
export default function NotFoundReporter() {
  // StrictMode runs effects twice in development; this keeps it to one report.
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    const payload = JSON.stringify({
      path: window.location.pathname + window.location.search,
      referrer: document.referrer || null,
    });

    // keepalive so the report still goes out if the visitor navigates away
    // immediately, which on a 404 they usually do.
    fetch("/api/log-404", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {
      // A failed report must never surface to the visitor - they are already
      // looking at an error page.
    });
  }, []);

  return null;
}
