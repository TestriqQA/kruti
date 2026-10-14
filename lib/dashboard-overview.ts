import { safeJsonParse } from "@/lib/utils";
import { toZonedDayKey, utcToLocalTime, zonedDayKey } from "@/lib/timezone";
import type { ProfileGap } from "@/lib/profile-completeness";

/**
 * Everything the Overview page derives, in one pure server-side module.
 *
 * It lives here rather than in the client component for three reasons: the page
 * is a server component so this costs nothing at runtime, the client then
 * receives plain serialisable data instead of Date objects and JSON strings,
 * and CLAUDE.md's rule against raw JSON.parse in UI code is satisfied in one
 * place with one helper.
 */

export type OverviewStatus = "draft" | "ready" | "published" | "failed" | "missed";

export interface OverviewArt {
  kind: "image" | "carousel" | "pdf" | "none";
  url: string | null;
  slides: number;
}

export interface OverviewPost {
  id: string;
  title: string;
  /** yyyy-MM-dd in the user's timezone. */
  dayKey: string;
  /** "09:00" */
  timeLabel: string;
  /** "THU 16 OCT" */
  dateLabel: string;
  iso: string;
  state: OverviewStatus;
  style: string | null;
  art: OverviewArt;
  /** Raw postError. Never truncated - the UI wraps it. */
  error: string | null;
}

export interface Ask {
  key: "profile" | "failed" | "missed" | "drafts" | "artwork" | "trial";
  tone: "warning" | "danger" | "accent";
  imperative: string;
  consequence: string;
  href: string;
  cta: string;
  items?: { id: string; label: string; detail: string }[];
}

export interface RunwayDay {
  key: string;
  /** Single-letter weekday, e.g. "M". */
  dow: string;
  dayNum: string;
  isPostingDay: boolean;
  isToday: boolean;
  isPast: boolean;
  posts: OverviewPost[];
  /** A generation slot the next batch will fill. */
  ghost: boolean;
}

export interface ContinuityWeek {
  label: string;
  made: number;
  published: number;
  theme: string | null;
  isCurrent: boolean;
}

export interface Pillar {
  name: string;
  description: string;
  pct: number;
}

/** The post row shape every builder below expects. */
export interface PostRow {
  id: string;
  title: string;
  status: string;
  scheduledAt: Date | string | null;
  postedToLinkedIn?: boolean;
  postError?: string | null;
  imageUrl?: string | null;
  carouselImages?: string | null;
  documentUrl?: string | null;
  style?: string | null;
  postType?: string | null;
}

/**
 * Slide count for a carousel.
 *
 * Deliberately local rather than imported: every carousel helper lives in
 * lib/image-*.ts, and that path is frozen. If a second caller ever needs this,
 * promote it to its own module instead of reaching into the image pipeline.
 */
function countSlides(raw: string | null | undefined): number {
  const arr = safeJsonParse<unknown[]>(raw ?? null, []);
  return Array.isArray(arr) ? arr.length : 0;
}

function resolveArt(row: PostRow): OverviewArt {
  if (row.documentUrl) return { kind: "pdf", url: null, slides: 0 };
  const slides = countSlides(row.carouselImages);
  if (slides > 0) {
    const urls = safeJsonParse<string[]>(row.carouselImages ?? null, []);
    return { kind: "carousel", url: urls[0] ?? null, slides };
  }
  if (row.imageUrl) return { kind: "image", url: row.imageUrl, slides: 0 };
  return { kind: "none", url: null, slides: 0 };
}

/** One hour of grace before a still-armed post counts as missed. */
const MISSED_GRACE_MS = 60 * 60 * 1000;

export function toOverviewPost(row: PostRow, timezone: string, now: Date): OverviewPost {
  const scheduled = row.scheduledAt ? new Date(row.scheduledAt) : null;

  // Order matters. A published post is published even if it once errored, and
  // a failed post must not be reported as merely missed.
  let state: OverviewStatus;
  if (row.postedToLinkedIn || row.status === "published") state = "published";
  else if (row.postError) state = "failed";
  else if (row.status === "ready" && scheduled && scheduled.getTime() < now.getTime() - MISSED_GRACE_MS)
    state = "missed";
  else if (row.status === "ready") state = "ready";
  else state = "draft";

  return {
    id: row.id,
    title: row.title,
    dayKey: scheduled ? toZonedDayKey(scheduled, timezone) : "",
    timeLabel: scheduled ? utcToLocalTime(scheduled, timezone, "HH:mm") : "",
    dateLabel: scheduled ? utcToLocalTime(scheduled, timezone, "EEE d MMM").toUpperCase() : "",
    iso: scheduled ? scheduled.toISOString() : "",
    state,
    style: row.style ?? row.postType ?? null,
    art: resolveArt(row),
    error: row.postError ?? null,
  };
}

/* ── Asks ─────────────────────────────────────────────────────────────────── */

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

export function buildAsks({
  profileGaps,
  windowPosts,
  outsidePosts,
  draftCount,
  trialEndsInDays,
}: {
  profileGaps: ProfileGap[];
  windowPosts: OverviewPost[];
  outsidePosts: OverviewPost[];
  draftCount: number;
  /** null unless the account is trialing and within the warning window. */
  trialEndsInDays: number | null;
}): Ask[] {
  const asks: Ask[] = [];
  const all = [...outsidePosts, ...windowPosts];

  if (profileGaps.length > 0) {
    asks.push({
      key: "profile",
      tone: "warning",
      imperative: `Finish your profile — ${profileGaps.length} ${plural(profileGaps.length, "input", "inputs")} missing`,
      consequence: "Writing and auto-publish are both paused until these are filled in.",
      href: "/onboarding",
      cta: "Finish setup →",
      items: profileGaps.map((g) => ({ id: g.key, label: g.label, detail: g.hint })),
    });
  }

  const failed = all.filter((p) => p.state === "failed");
  if (failed.length > 0) {
    asks.push({
      key: "failed",
      tone: "danger",
      imperative: `${failed.length} ${plural(failed.length, "post", "posts")} failed to publish`,
      consequence: "LinkedIn rejected these. They stay unpublished until you retry.",
      href: `/posts/${failed[0].id}`,
      cta: "Open the first one →",
      items: failed.slice(0, 3).map((p) => ({
        id: p.id,
        label: p.title,
        detail: `${p.dateLabel} ${p.timeLabel} — ${p.error ?? "unknown error"}`,
      })),
    });
  }

  const missed = all.filter((p) => p.state === "missed");
  if (missed.length > 0) {
    asks.push({
      key: "missed",
      tone: "warning",
      imperative: `${missed.length} ${plural(missed.length, "post", "posts")} missed ${plural(missed.length, "its", "their")} slot`,
      consequence:
        "The cron retires anything more than 72 hours past its time. Reschedule or publish now.",
      href: `/posts/${missed[0].id}`,
      cta: "Open the first one →",
      items: missed.slice(0, 3).map((p) => ({
        id: p.id,
        label: p.title,
        detail: `${p.dateLabel} ${p.timeLabel}`,
      })),
    });
  }

  if (draftCount > 0) {
    asks.push({
      key: "drafts",
      tone: "accent",
      imperative: `${draftCount} ${plural(draftCount, "draft needs", "drafts need")} your review`,
      consequence:
        "A draft never publishes on its own. Mark it ready and the cron takes it from there.",
      href: "/posts?status=draft",
      cta: "Review drafts →",
    });
  }

  const bare = windowPosts.filter(
    (p) => (p.state === "draft" || p.state === "ready") && p.art.kind === "none"
  );
  if (bare.length > 0) {
    asks.push({
      key: "artwork",
      tone: "accent",
      imperative: `${bare.length} queued ${plural(bare.length, "post has", "posts have")} no artwork`,
      consequence: "They will go out as text only.",
      href: "/posts?status=ready",
      cta: "Add images →",
    });
  }

  if (trialEndsInDays !== null) {
    asks.push({
      key: "trial",
      tone: "warning",
      imperative: `Your trial ends in ${trialEndsInDays} ${plural(trialEndsInDays, "day", "days")}`,
      consequence: "Posts stop generating and publishing when it does.",
      href: "/subscribe",
      cta: "Subscribe →",
    });
  }

  return asks;
}

/* ── Runway ───────────────────────────────────────────────────────────────── */

const DOW_LETTER = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function buildRunway({
  windowPosts,
  postingDays,
  batchDates,
  timezone,
  now,
  windowStartKey,
  days: dayCount,
}: {
  windowPosts: OverviewPost[];
  /** Weekday names from parsePostingSchedule(). */
  postingDays: string[];
  batchDates: string[];
  timezone: string;
  now: Date;
  windowStartKey: string;
  days: number;
}): { days: RunwayDay[]; ghostBeyond: string[] } {
  const todayKey = toZonedDayKey(now, timezone);
  const postingSet = new Set(postingDays.map((d) => d.toLowerCase()));

  const ghostKeys = new Set(batchDates.map((iso) => toZonedDayKey(new Date(iso), timezone)));

  const days: RunwayDay[] = [];
  for (let i = 0; i < dayCount; i++) {
    const key = zonedDayKey(`${windowStartKey}T12:00:00Z`, "UTC", i);
    // Noon avoids any chance of the midnight boundary moving the weekday.
    const at = new Date(`${key}T12:00:00Z`);
    const dowIndex = at.getUTCDay();
    days.push({
      key,
      dow: DOW_LETTER[dowIndex],
      dayNum: String(at.getUTCDate()),
      isPostingDay: postingSet.has(DAY_NAMES[dowIndex].toLowerCase()),
      isToday: key === todayKey,
      isPast: key < todayKey,
      posts: windowPosts.filter((p) => p.dayKey === key),
      ghost: ghostKeys.has(key),
    });
  }

  const inWindow = new Set(days.map((d) => d.key));
  const ghostBeyond = batchDates
    .map((iso) => toZonedDayKey(new Date(iso), timezone))
    .filter((k) => !inWindow.has(k));

  return { days, ghostBeyond };
}

/* ── Continuity ───────────────────────────────────────────────────────────── */

export function buildContinuity({
  plans,
  planPosts,
  timezone,
  now,
  weeks = 6,
}: {
  plans: { id: string; weekStart: Date | string; strategy: string }[];
  planPosts: { planId: string; postedToLinkedIn: boolean; status: string }[];
  timezone: string;
  now: Date;
  weeks?: number;
}): ContinuityWeek[] {
  // Enumerate the last N Mondays rather than taking the N most recent plans:
  // a week with no plan has to be visible as a gap, and "most recent plans"
  // silently closes those gaps up.
  const todayKey = toZonedDayKey(now, timezone);
  const today = new Date(`${todayKey}T12:00:00Z`);
  const backToMonday = (today.getUTCDay() + 6) % 7;
  const thisMondayMs = today.getTime() - backToMonday * 86_400_000;

  const byWeek = new Map<string, { id: string; strategy: string }>();
  for (const p of plans) {
    byWeek.set(toZonedDayKey(new Date(p.weekStart), timezone), {
      id: p.id,
      strategy: p.strategy,
    });
  }

  const counts = new Map<string, { made: number; published: number }>();
  for (const row of planPosts) {
    const c = counts.get(row.planId) ?? { made: 0, published: 0 };
    c.made += 1;
    if (row.postedToLinkedIn || row.status === "published") c.published += 1;
    counts.set(row.planId, c);
  }

  const out: ContinuityWeek[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = new Date(thisMondayMs - i * 7 * 86_400_000);
    const key = monday.toISOString().slice(0, 10);
    const plan = byWeek.get(key);
    const c = plan ? counts.get(plan.id) ?? { made: 0, published: 0 } : { made: 0, published: 0 };
    out.push({
      label: monday.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      made: c.made,
      published: c.published,
      theme: plan ? parseStrategy(plan.strategy).weekTheme : null,
      isCurrent: i === 0,
    });
  }
  return out;
}

/* ── Strategy ─────────────────────────────────────────────────────────────── */

export function parseStrategy(raw: string | null | undefined): {
  weekTheme: string | null;
  weekFocus: string | null;
  pillars: Pillar[];
} {
  const parsed = safeJsonParse<{
    weekTheme?: string;
    weekFocus?: string;
    pillars?: unknown;
  }>(raw ?? null, {});

  const rawPillars = Array.isArray(parsed.pillars) ? parsed.pillars : [];
  const normalised = rawPillars
    .map((p) => {
      // Older plans stored plain strings; current ones store objects with a
      // percentage the model is asked for but nothing validates.
      if (typeof p === "string") return { name: p, description: "", pct: 0 };
      const o = p as { name?: string; description?: string; percentage?: number };
      return {
        name: o?.name ?? "",
        description: o?.description ?? "",
        pct: typeof o?.percentage === "number" && o.percentage > 0 ? o.percentage : 0,
      };
    })
    .filter((p) => p.name);

  const total = normalised.reduce((s, p) => s + p.pct, 0);
  const pillars =
    total > 0
      ? normalised.map((p) => ({
          ...p,
          // Missing percentages share whatever the stated ones leave over; if
          // they all stated one, this just normalises them to 100.
          pct: Math.round((p.pct / total) * 100),
        }))
      : normalised.map((p) => ({
          ...p,
          pct: normalised.length ? Math.round(100 / normalised.length) : 0,
        }));

  return {
    weekTheme: parsed.weekTheme ?? null,
    weekFocus: parsed.weekFocus ?? null,
    pillars,
  };
}

/** First couple of lines of a post body, cut on a word boundary. */
export function excerpt(body: string | null | undefined, max = 180): string {
  if (!body) return "";
  const flat = body
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 60 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}
