## What this does

<!-- One or two lines: what changes for the user, not which files moved. -->

## Why

<!-- The problem this solves. If it fixes a bug, what the wrong behaviour was. -->

## How it was verified

<!-- There is no test suite, so this section is the test suite.
     Say what you actually ran and what you saw - a real request, a real
     payload, a screenshot, a log line. "Looks fine" is not verification. -->

- [ ] `npx tsc --noEmit` clean
- [ ] `npm run build` passes
- [ ] Checked in a running app, not only reasoned about

## Risk checklist

<!-- Tick what applies and say what was done about it. Delete the rest. -->

- [ ] **Database** — `prisma/schema.prisma` changed. `npm run db:push` must run against every environment before this deploys, or queries selecting the full row fail with P2021/P2022.
- [ ] **Image pipeline** — touches `lib/image-styles.ts`, `image-themes.ts`, `imagen.ts`, `image-brief.ts`, `render-card.tsx`, `image-categories.ts` or the art-brief/carousel prompts. Attach before/after renders; image quality must not regress.
- [ ] **Cost** — changes how many model calls a user action makes, or which model it uses.
- [ ] **Cron / `vercel.json`** — a job was added, removed or rescheduled. Say what runs on the first deploy.
- [ ] **Emails** — anything new gets sent to real users. Say who receives it and how often.
- [ ] **Profile contract** — `lib/profile-completeness.ts` thresholds or `PROFILE_GAP_KEYS` changed. Every existing account is re-assessed against it, so say what happens to users who no longer qualify.
- [ ] **Auth / gating** — a new guarded route. Middleware, the dashboard layout and the route itself are three separate layers; confirm all three.
- [ ] None of the above.

## Anything the reviewer should know

<!-- Trade-offs taken, things deliberately left out, follow-ups worth filing. -->
