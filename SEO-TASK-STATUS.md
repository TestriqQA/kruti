# SEO task status — Kruti.io

Tracking `Kruti-Developer-Tasks.xlsx` (tasks D-01 … D-25) against the specs in
`Kruti.io SEO Handoff Pack for the Developer.docx`.

**Last updated:** 6 Oct 2026
**Branch:** `fixes/purchase-subscription` — all SEO work below is **uncommitted**.

> **Everything below is verified on `localhost:3002` only.** Every "Done when" in the task
> sheet is written against `https://kruti.io`, so no task can be formally signed off until it
> is deployed and re-checked in production. See [Before deploy](#before-deploy).

---

## At a glance

| Status | Count | Tasks |
|---|---|---|
| ✅ Done (pending production check) | 8 | D-01, D-02, D-03, D-04, D-05, D-10, D-11, D-19 |
| 🟡 Partly done — rest is blocked | 1 | D-05 (3 fields await founder input) |
| ⬜ Unblocked, not started | 2 | D-21, D-16 |
| ⏸ Needs your go-ahead | 1 | D-20 (DB schema change) |
| 🔒 Blocked on missing input | 13 | D-06, D-07, D-08, D-09, D-12, D-13, D-14, D-17, D-18, D-22, D-23, D-24 |
| ➖ Not applicable | 1 | D-25 |

**Progress: 8 of 25 complete.** Of the 17 remaining, **13 are blocked on inputs that do not
exist yet** — not on development time.

---

## ✅ Done

### D-01 — robots.txt · P0 · Crawl access
Serves `/robots.txt` as HTTP 200 `text/plain`, matching S-04.

- **Files:** `app/robots.ts` (new), `lib/site-url.ts` (new), `middleware.ts`
- **Root cause found:** a route handler alone was not enough. The middleware's extension
  allow-list had no `.txt`/`.xml`, so `/robots.txt` fell through to `withAuth` and was
  answered with a 307 to the sign-in page. A new explicit `CRAWLER_FILES` list is checked
  before auth runs.
- **S-04 compliance:** audited the live output against every one of the 27 page routes. S-04's
  six literal `Disallow` lines are present in its own order; the seven extra behind-sign-in
  paths S-04 asked us to work out (`/posts`, `/calendar`, `/analytics`, `/newsletter`,
  `/settings`, `/support`, `/site-gate`) are appended. Homepage, `(blog)` and `(legal)` stay
  crawlable. **Audit result: PASS.**
- **Known deviation:** Next emits `User-Agent:` (capital A); S-04 writes `User-agent:`. Field
  names are case-insensitive under RFC 9309 so every crawler treats these identically, but a
  byte-level diff against the spec will flag it. Switching to a raw route handler would give
  byte-exact output at the cost of static generation. *Recommendation: leave as is.*
- **Verified:** 200 / `text/plain` / 0 redirects, anonymously and with a Googlebot UA.

### D-02 — sitemap.xml · P0 · Crawl access
Serves `/sitemap.xml` as HTTP 200 `application/xml`.

- **Files:** `app/sitemap.ts` (new), `lib/public-pages.ts` (new), `lib/blog-data.ts`
- 27 `<url>` entries: 7 static pages + all 20 blog posts, each with a `<lastmod>`.
- Blog posts are generated from `lib/blog-data.ts`, so **publishing a post adds it to the
  sitemap with no code edit** — the "new pages appear without manual edits" criterion.
- **Known limitation:** hand-built static routes need one line in `lib/public-pages.ts`. A
  serverless function cannot scan `app/` at request time to discover them. D-12 will add its
  seven pages there.
- Added an optional `updated?: string` field to `BlogPost`, falling back to `date`. It drives
  sitemap `lastmod`, `article:modified_time` and Article `dateModified`.
- **Verified:** no app or login routes leaked in, every URL on the canonical host, all dates valid.

### D-03 — real 404 instead of a login redirect · P0 · Crawl access
Unknown public URLs now return HTTP 404 with a friendly page.

- **Files:** `middleware.ts`, `app/not-found.tsx`
- **The structural change:** the middleware was an allow-list of public paths, with everything
  unmatched handed to `withAuth`. A URL that simply did not exist got a 307 to sign-in, which
  crawlers read as "this URL exists and redirects". It is now a **deny-list** of app-route
  prefixes; everything else falls through to Next, which 404s.
- **Proof the change is isolated** — stashed the new middleware and re-probed:

  | URL | Before | After |
  |---|---|---|
  | `/about-test` | 307 → /login | **404** |
  | `/subscribe` | 307 | 307 *(unchanged — page's own `redirect()`)* |
  | `/onboarding` | 307 | 307 *(unchanged — page's own `redirect()`)* |

- **Note:** `app/not-found.tsx` already existed and was overwritten. The original linked only
  to `/dashboard`, which bounces an anonymous visitor to sign-in — recreating the problem this
  task fixes. The replacement links to Home / Blog / Sign in and adds `noindex`. Signed-in
  users are still served: `/` redirects a session-holder to `/dashboard`.
- **Verified:** 404 in light and dark mode; five app routes still 307.

### D-04 — meta tags · P0 · Meta tags
- **Files:** `app/layout.tsx`, `app/(blog)/blog/[slug]/page.tsx`, `lib/site-url.ts`
- Homepage: S-02's approved title and meta description, canonical, `og:title`,
  `og:description`, `og:image`, `og:url`, `og:type`, `twitter:card = summary_large_image`.
- Blog posts: added `og:image` and `article:modified_time`, switched to
  `summary_large_image`, **removed the `keywords` meta tag**.
- `metadataBase` added so canonicals resolve absolutely. Built from `SITE_URL`, not the
  request host — otherwise a Vercel preview deploy emits canonicals pointing at itself.
- **Bug caught during verification:** homepage `og:image` was resolving to
  `http://localhost:3002/logo.png` — Next used the dev origin instead of `metadataBase` for
  relative image URLs, which no social scraper can fetch. Both `og:image` and `twitter:image`
  are now built with `absoluteUrl()`.
- **Known limitation:** `logo.png` is 2048×842 (2.43:1); `summary_large_image` wants 1200×630
  (1.91:1), so it is cropped in social previews. **D-21 fixes this.**

### D-05 — JSON-LD · P0 · Structured data 🟡
- **Files:** `components/HomeJsonLd.tsx` (new), `app/page.tsx`, `app/(blog)/blog/[slug]/page.tsx`
- Homepage: `Organization`, `WebSite`, `SoftwareApplication` (with both INR and USD offers),
  `FAQPage` — four blocks, each in its own `<script>`, server-rendered into view-source.
- Blog posts: `Article` + `BreadcrumbList`, replacing the previous `BlogPosting`.
- **Three fields deliberately omitted, each because S-03 says so:**
  | Omitted | Waiting on |
  |---|---|
  | `Organization.address` street line | **F-02** (registered address) |
  | `Organization.sameAs` | Real LinkedIn / YouTube / Product Hunt / G2 profiles. S-03: *"Do not add placeholder links."* |
  | `aggregateRating` / `review` | Real verifiable reviews. S-03: *"Google treats invented ratings as spam."* |
- **Article author is `Organization`, not S-03's `Person`.** Every post currently reads
  "Kruti.io Team" and the real author details are **F-08**. A `Person` with a placeholder name
  would be worse than an honest Organization credit.
- **`FAQPage` still generates from the visible six-question array, not S-09's thirteen.** S-03
  requires the schema to match the visible FAQ word for word; replacing the visible FAQ is
  D-09, which is blocked. Verified all six questions *and* answers appear in the rendered HTML.
- **Outstanding:** D-05's "Done when" is *"Google Rich Results Test shows no errors"*, which
  needs a public URL or a paste into the tool's **Code** tab. **Not yet run.**

### D-10 — one canonical hostname and HTTPS · P1
- **Files:** `next.config.mjs`, `lib/redirects.mjs` (new)
- `www.kruti.io/...` → `https://kruti.io/...` with a **301**, path and query preserved.
- Used `statusCode: 301` rather than Next's `permanent: true`, which emits 308. The task asks
  for 301.
- **http → https is deliberately not handled in app code.** Vercel terminates TLS and issues
  that redirect at the edge before any application code runs; a second redirect in the app
  risks a loop behind a TLS-terminating proxy. The existing
  `Strict-Transport-Security: max-age=31536000; includeSubDomains` header stops a browser
  retrying http after its first visit.
- **Verified:** `Host: www.kruti.io` + `/blog?a=1` → `301 → https://kruti.io/blog?a=1`; bare
  host returns 200 with no loop.

### D-11 — rendering / view-source · P1
**No code change was required.** The site is already fully server-rendered.

Verified with JavaScript never running, on the raw HTML:
- Homepage (79 KB of HTML): H1, sub-headline, INR and USD pricing, "7-day free trial", FAQ
  heading, final CTA — all present.
- **All six FAQ questions *and* their answers** are in the HTML. `FAQItem` always renders the
  answer and collapses it with CSS (`grid-rows-[0fr]`), rather than conditionally rendering it.
- Blog index (6,212 chars of prose) and a blog post (3,630 chars) — body text present.
- Bonus: confirms S-03's "FAQ schema must match the visible FAQ" holds today.

### D-19 — redirect map and 404 logging · P1
- **Files:** `lib/redirects.mjs` (new), `next.config.mjs`, `components/NotFoundReporter.tsx`
  (new), `app/api/log-404/route.ts` (new), `app/not-found.tsx`, `middleware.ts`
- `REDIRECT_MAP` is in place and documented, currently empty — nothing has been renamed yet.
  Rules recorded: use 301, never chain redirects, add the old path in the same commit as a rename.
- 404s are logged with their **referrer**, which is what separates a broken internal link from
  a stale external backlink or a scanner probing for `/wp-admin`.
- **A bug I introduced and fixed:** the first attempt logged from the `not-found.tsx` server
  render. Next constructs that page as the `notFound` prop of its NotFoundBoundary on *every*
  page render, so it logged `[404] path=/` and `[404] path=/blog` while both returned 200. A
  log full of false positives is worse than no log. Replaced with a client component that
  reports on actual mount, through a rate-limited endpoint (30/hour per IP, fields clamped and
  stripped of control characters so a crafted value cannot forge log lines).
- **Known limitation:** this misses crawlers that do not execute JavaScript — and those are the
  404s that matter most for SEO. Vercel's own request log covers them (path + status); the
  endpoint adds the referrer on top.
- **Verified:** `[404] path=/dead-internal-link referrer=http://localhost:3002/blog` logged
  exactly once; visiting `/` and `/blog` adds no lines.

---

## ⬜ Unblocked — not started

### D-21 — per-post share images · P2 · depends on D-04 ✅
Auto-generate a 1200×630 `og:image` for each blog post. Next's `ImageResponse` (`next/og`) can
do this at `app/(blog)/blog/[slug]/opengraph-image.tsx` with no external service.
**Also fixes D-04's cropped-logo limitation.** Recommended next.

### D-16 — media · P1 · partially blocked
| Sub-task | Status |
|---|---|
| Alt text and width/height on all images | ⬜ Can do now |
| Full favicon set | ⬜ Can do now (`app/icon.png`, `apple-icon.png` already exist) |
| Real product screenshot slots | 🔒 **S-19** |
| Lazy-loaded YouTube demo embed | 🔒 **S-19** (needs the embed link) |

---

## ⏸ Needs your go-ahead

### D-20 — "How did you hear about us?" at signup · P1
No missing spec. Needs a new column on the `User` model, so it requires `npm run db:push`
against **shared staging**. Say the word and I will prepare the schema change for you to apply.

---

## 🔒 Blocked

Grouped by what clears them, so one sitting can unblock several.

### Waiting on the founder

| Need | Clears |
|---|---|
| **F-01** Lawyer-approved Privacy + Cookie text covering GA4 and the LinkedIn Insight Tag | D-06, D-07, D-08 |
| **F-02** Registered address, CIN, GSTIN | D-18, and `Organization.address` in D-05 |
| **F-03** Approve softened wording; decide on the three unverified testimonials | D-09 |
| **F-04** Confirm "7-day free trial" as the single offer wording | D-09 |
| **F-05** Confirm how auto-publishing works; approve one explaining sentence | D-09 |
| **F-07** Confirm whether the product works in Hindi / Hinglish | D-09 (FAQ) |
| **F-08** Founder bio, photo, LinkedIn URL | D-14, and Article `author` in D-05 |
| *(new, from the pack)* Confirm what the product actually reads from LinkedIn | D-09, Privacy Policy |
| *(new, from the pack)* Explain how the 7-day trial converts with no card at signup | D-09, pricing page |

> **F-06 is referenced by D-06 on the task sheet but does not appear anywhere in the handoff
> pack.** It needs defining or removing from the dependency list.

### Waiting on SEO copy (the pack says these are "next in line")

| Need | Clears | Note |
|---|---|---|
| **S-10** page copy | D-12 | Pack explicitly allows building the empty templates first |
| **S-11** comparison pages | D-13 | Same |
| **S-12** use-case pages | D-13 | Same |
| **S-13** blog audit | D-14 | |
| **S-14** link map | D-17 | |
| **S-19** demo video + screenshots | D-16 (part) | |
| **S-20** real named testimonials | D-09 | |
| **S-23** free tool spec | D-22 | |
| **S-24** llms.txt text | D-23 | `CRAWLER_FILES` slot is already waiting |

> On D-12 / D-13: I have **not** built the templates yet. Shipping seven pages with placeholder
> copy would create thin indexable pages, which actively harms SEO. Better to build them when
> S-10 lands, or build them unlinked and out of the sitemap until copy arrives — your call.

### Blocked on external accounts, not code

| Task | Needs |
|---|---|
| **D-07** | GA4 Measurement ID, LinkedIn Insight Tag partner ID |
| **D-24** | An alerting provider and a broken-link crawler — configuration, not code |

### ➖ Not applicable

**D-25** — hreflang. The task says *"Only if separate INR and USD pages are built… Skip
otherwise."* No separate pages exist, so this closes as not needed unless D-12 creates them.

---

## Before deploy

1. **Set `NEXT_PUBLIC_SITE_URL=https://kruti.io`** on the Vercel production project. It
   defaults to that value, so production is correct without it, but setting it explicitly stops
   a preview deploy advertising the wrong canonical and sitemap host.
2. **Re-run every "Done when" against the live domain.** All verification so far is local.
   ```bash
   curl -I https://kruti.io/robots.txt      # D-01: 200, text/plain
   curl -I https://kruti.io/sitemap.xml     # D-02: 200, XML
   curl -I https://kruti.io/about-test      # D-03: 404
   curl -I http://kruti.io/                 # D-10: 301 → https
   curl -I https://www.kruti.io/            # D-10: 301 → https://kruti.io/
   ```
3. **Run the Rich Results Test** on the homepage and one blog post — D-05's sign-off criterion,
   still outstanding.
4. **Submit the sitemap to Search Console.** Not before D-02 is live, or the `Sitemap:` line in
   robots.txt 404s. (S-04 confirms a temporary 404 here "is fine".)
5. **Confirm D-01 against S-04 one final time** — S-04's own done-when asks for this check, and
   the `User-Agent` casing note above is the only known difference.

## Files changed

**New (8):** `app/robots.ts` · `app/sitemap.ts` · `app/api/log-404/route.ts` ·
`components/HomeJsonLd.tsx` · `components/NotFoundReporter.tsx` · `lib/site-url.ts` ·
`lib/public-pages.ts` · `lib/redirects.mjs`

**Modified (7):** `app/layout.tsx` · `app/page.tsx` · `app/not-found.tsx` ·
`app/(blog)/blog/[slug]/page.tsx` · `lib/blog-data.ts` · `middleware.ts` · `next.config.mjs`

**Build status:** `tsc --noEmit` exit 0 · `next build` exit 0, 95 pages ·
`/robots.txt`, `/sitemap.xml`, `/_not-found` all prerendered static.
