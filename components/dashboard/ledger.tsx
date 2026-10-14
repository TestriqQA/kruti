"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  Ask,
  ContinuityWeek,
  OverviewPost,
  OverviewStatus,
  Pillar,
} from "@/lib/dashboard-overview";

/**
 * The lower half of the Overview.
 *
 * LAW: nothing in here is a bordered box. The page has exactly one bordered
 * container (the chassis above); everything below is typeset directly on the
 * app background and structured with hairlines and whitespace. A diff that adds
 * `border` or `bg-surface` to a block in this file has started reverting the
 * design - the only `bg-surface` permitted is the hover fill on a queue row,
 * where the surface behaves as a cursor rather than a container.
 *
 * Hairlines here use `line-strong`, not `line`. `--line` was calibrated against
 * `--surface`; on `--app` it sits at roughly 1.1:1 and is simply invisible.
 */

/* ── Section grammar ──────────────────────────────────────────────────────── */

export function RuleHeader({
  label,
  trailing,
  action,
}: {
  label: string;
  trailing?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 pb-3">
      <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
        {label}
      </span>
      <span className="h-px flex-1 bg-line-strong" aria-hidden="true" />
      {trailing}
      {action}
    </div>
  );
}

/* ── Status stepper ───────────────────────────────────────────────────────── */

const STEPPER: Record<OverviewStatus, { filled: number; tone: string; word: string; ring: boolean }> = {
  draft: { filled: 1, tone: "bg-warning", word: "Draft", ring: false },
  ready: { filled: 2, tone: "bg-accent", word: "Ready", ring: false },
  published: { filled: 3, tone: "bg-success", word: "Published", ring: false },
  missed: { filled: 2, tone: "bg-warning", word: "Missed", ring: true },
  failed: { filled: 2, tone: "bg-danger", word: "Failed", ring: true },
};

/**
 * Three segments filling through draft -> ready -> published, plus the word.
 * Replaces the pill: it reads as progress rather than as a label, and it is not
 * colour-only, so it survives both a greyscale print and a colour-blind reader.
 */
export function Stepper({ state, className }: { state: OverviewStatus; className?: string }) {
  const s = STEPPER[state];
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="flex items-center gap-[3px]" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              "block h-[3px] w-4 rounded-full",
              i < s.filled ? s.tone : "bg-line-strong",
              s.ring && i === s.filled - 1 && "ring-1 ring-offset-0"
            )}
          />
        ))}
      </span>
      <span
        className={cn(
          "text-[9.5px] font-semibold uppercase tracking-[0.14em]",
          state === "failed"
            ? "text-danger"
            : state === "missed"
              ? "text-warning"
              : state === "published"
                ? "text-success"
                : state === "ready"
                  ? "text-accent"
                  : "text-ink-muted"
        )}
      >
        {s.word}
      </span>
    </span>
  );
}

/* ── NEEDS YOU ────────────────────────────────────────────────────────────── */

const ASK_EDGE: Record<Ask["tone"], string> = {
  danger: "border-danger",
  warning: "border-warning",
  accent: "border-accent",
};

export function AttentionList({ asks }: { asks: Ask[] }) {
  if (asks.length === 0) return null;

  return (
    <section id="attention" className="scroll-mt-24">
      <RuleHeader
        label="Needs you"
        trailing={
          <span className="tabular font-display text-[13px] font-bold text-ink">{asks.length}</span>
        }
      />
      <div>
        {asks.map((ask, i) => (
          <div
            key={ask.key}
            className={cn(
              "-ml-4 border-l-2 py-4 pl-4",
              ASK_EDGE[ask.tone],
              i > 0 && "border-t border-t-line-strong/70"
            )}
          >
            <div className="flex items-start gap-3">
              <span className="tabular mt-0.5 flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full border border-line-strong text-[11px] font-semibold text-ink-muted">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold leading-snug text-ink">{ask.imperative}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{ask.consequence}</p>

                {ask.items && ask.items.length > 0 && (
                  <ul className="mt-2.5 space-y-1.5">
                    {ask.items.map((item) =>
                      ask.key === "profile" ? (
                        // Gap hints are the only thing telling a new user what
                        // to write. They are never collapsed.
                        <li key={item.id} className="text-[12px] leading-relaxed text-ink-muted">
                          <span className="text-line-strong">· </span>
                          <span className="font-semibold text-ink">{item.label}</span> — {item.detail}
                        </li>
                      ) : (
                        <li key={item.id}>
                          <Link
                            href={`/posts/${item.id}`}
                            className="block text-[12px] leading-relaxed text-ink-muted hover:text-ink"
                          >
                            <span className="text-line-strong">· </span>
                            <span className="font-medium text-ink">{item.label}</span>
                            <span className="text-ink-muted"> — {item.detail}</span>
                          </Link>
                        </li>
                      )
                    )}
                  </ul>
                )}
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1">
                <Link
                  href={ask.href}
                  className="whitespace-nowrap text-[12px] font-semibold text-accent hover:underline"
                >
                  {ask.cta}
                </Link>
                {ask.key === "profile" && (
                  <Link
                    href="/settings"
                    className="whitespace-nowrap text-[11.5px] text-ink-muted hover:text-ink"
                  >
                    Or edit in Settings
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── ON DECK ──────────────────────────────────────────────────────────────── */

export function OnDeck({
  post,
  excerpt,
  isUpcoming,
}: {
  post: OverviewPost;
  excerpt: string;
  isUpcoming: boolean;
}) {
  return (
    <section>
      <RuleHeader
        label={isUpcoming ? "On deck" : "Last published"}
        action={
          <Link
            href={`/posts/${post.id}`}
            className="text-[12px] font-semibold text-accent hover:underline"
          >
            Open in editor →
          </Link>
        }
      />
      <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4">
        <div>
          {post.art.url ? (
            <div className="relative">
              {post.art.kind === "carousel" && (
                <>
                  <span className="absolute -right-1 -top-1 h-[72px] w-24 rounded-card bg-surface ring-1 ring-line-strong" />
                  <span className="absolute -right-0.5 -top-0.5 h-[72px] w-24 rounded-card bg-surface ring-1 ring-line-strong" />
                </>
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.art.url}
                alt=""
                className="relative h-[72px] w-24 rounded-card object-cover ring-1 ring-line-strong"
              />
            </div>
          ) : post.art.kind === "pdf" ? (
            <div className="flex h-[72px] w-24 flex-col items-center justify-center gap-1 rounded-card bg-surface-sunken ring-1 ring-line-strong">
              <FileText className="h-5 w-5 text-ink-muted" />
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                PDF
              </span>
            </div>
          ) : (
            <div className="flex h-[72px] w-24 items-center justify-center rounded-card border border-dashed border-line-strong">
              <span className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                No art
              </span>
            </div>
          )}
          {post.art.kind === "carousel" && (
            <p className="mt-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
              {post.art.slides} slides
            </p>
          )}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Stepper state={post.state} />
            <span className="tabular text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">
              <span className="text-line-strong">·</span> {post.dateLabel} {post.timeLabel}
              {post.style && (
                <>
                  <span className="text-line-strong"> ·</span> {post.style}
                </>
              )}
            </span>
          </div>

          {/* The product's actual output at a size you can read. Never clamped. */}
          <h3 className="mt-2 font-display text-[19px] font-semibold leading-[1.25] text-ink">
            {post.title}
          </h3>

          {excerpt && (
            <>
              {/* The only clamp on the page, and an honest one - the link
                  underneath says there is more and where it is. */}
              <p className="mt-2 line-clamp-2 text-[13px] leading-[1.6] text-ink-muted">{excerpt}</p>
              <Link
                href={`/posts/${post.id}`}
                className="mt-1.5 inline-block text-[12px] font-semibold text-accent hover:underline"
              >
                Read the full post →
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ── QUEUE ────────────────────────────────────────────────────────────────── */

export function QueueList({
  posts,
  total,
  hoverId,
}: {
  posts: OverviewPost[];
  total: number;
  hoverId: string | null;
}) {
  if (posts.length === 0) return null;

  return (
    <section>
      <RuleHeader
        label="Queue"
        trailing={<span className="tabular text-[12px] text-ink-muted">{total} scheduled</span>}
      />
      <div>
        {posts.map((p) => {
          const isProblem = p.state === "failed" || p.state === "missed";
          return (
            <Link
              key={p.id}
              href={`/posts/${p.id}`}
              className={cn(
                "group -mx-3 grid min-h-[56px] grid-cols-[76px_minmax(0,1fr)_120px_16px] items-center gap-4 rounded-card px-3 py-3 transition-colors focus-ring",
                "hover:bg-surface",
                hoverId === p.id && "bg-surface",
                isProblem &&
                  cn("-ml-7 border-l-2 pl-7", p.state === "failed" ? "border-danger" : "border-warning")
              )}
            >
              {/* Left-aligned, not centred - the hard vertical edge is what
                  makes a timetable look designed. */}
              <div>
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  {p.dateLabel.split(" ")[0]}
                </p>
                <p className="tabular text-[12.5px] font-semibold text-ink">
                  {p.dateLabel.split(" ").slice(1).join(" ")}
                </p>
                <p className="tabular text-[10.5px] text-ink-muted">{p.timeLabel}</p>
              </div>

              <div className="min-w-0">
                <p className="text-[14px] font-semibold leading-snug text-ink">{p.title}</p>
                {p.error ? (
                  <p className="mt-1 text-[11px] leading-relaxed text-danger">{p.error}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-ink-muted">
                    {p.style ?? "Post"}
                    <span className="text-line-strong"> · </span>
                    {p.art.kind === "carousel"
                      ? `Carousel ${p.art.slides}`
                      : p.art.kind === "image"
                        ? "Image"
                        : p.art.kind === "pdf"
                          ? "PDF"
                          : "No artwork"}
                  </p>
                )}
              </div>

              <Stepper state={p.state} />

              <span className="text-ink-muted opacity-0 transition-opacity group-hover:opacity-100">
                →
              </span>
            </Link>
          );
        })}
      </div>
      {total > posts.length && (
        <Link
          href="/posts"
          className="mt-1 flex h-10 items-center border-t border-line-strong text-[12px] font-semibold text-accent hover:underline"
        >
          {total - posts.length} more in the queue →
        </Link>
      )}
    </section>
  );
}

/* ── BRIEF ────────────────────────────────────────────────────────────────── */

const PILLAR_LIGHT = ["opacity-100", "opacity-[0.72]", "opacity-[0.52]", "opacity-[0.36]", "opacity-[0.24]"];
const PILLAR_DARK = ["dark:opacity-100", "dark:opacity-80", "dark:opacity-[0.62]", "dark:opacity-[0.48]", "dark:opacity-[0.36]"];

export function BriefBlock({
  brief,
}: {
  brief: { weekStartLabel: string; weekTheme: string | null; weekFocus: string | null; pillars: Pillar[] } | null;
}) {
  if (!brief) {
    return (
      <section>
        <RuleHeader label="This week's brief" />
        <p className="text-[15px] text-ink">No brief yet.</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
          Your first run builds one from your profile and keeps it for 30 days.
        </p>
      </section>
    );
  }

  return (
    <section>
      <RuleHeader
        label="This week's brief"
        trailing={<span className="tabular text-[11px] text-ink-muted">{brief.weekStartLabel}</span>}
      />
      {brief.weekTheme && (
        <h3 className="font-display text-[17px] font-semibold leading-[1.3] text-ink">
          {brief.weekTheme}
        </h3>
      )}
      {/* In full. It is what the model writes from, so the user has to be able
          to check it. */}
      {brief.weekFocus && (
        <p className="mt-2 text-[12.5px] leading-[1.6] text-ink-muted">{brief.weekFocus}</p>
      )}

      {brief.pillars.length > 0 && (
        <>
          <div className="mt-4 flex h-1.5 w-full gap-px overflow-hidden rounded-[3px]">
            {brief.pillars.map((p, i) => (
              <span
                key={p.name}
                className={cn(
                  "block bg-accent",
                  PILLAR_LIGHT[Math.min(i, PILLAR_LIGHT.length - 1)],
                  PILLAR_DARK[Math.min(i, PILLAR_DARK.length - 1)]
                )}
                style={{ width: `${p.pct}%` }}
              />
            ))}
          </div>
          <ul className="mt-3 space-y-2">
            {brief.pillars.map((p, i) => (
              <li key={p.name} className="flex items-center gap-2">
                <span
                  className={cn(
                    "block h-[7px] w-[7px] flex-shrink-0 rounded-[2px] bg-accent",
                    PILLAR_LIGHT[Math.min(i, PILLAR_LIGHT.length - 1)],
                    PILLAR_DARK[Math.min(i, PILLAR_DARK.length - 1)]
                  )}
                />
                <span className="min-w-0 flex-1 text-[12px] leading-snug text-ink">{p.name}</span>
                <span className="tabular flex-shrink-0 text-[11px] text-ink-muted">{p.pct}%</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <Link
        href="/settings"
        className="mt-4 inline-block text-[12px] font-semibold text-accent hover:underline"
      >
        Adjust your content setup →
      </Link>
    </section>
  );
}

/* ── CONTINUITY ───────────────────────────────────────────────────────────── */

export function ContinuityBars({ weeks }: { weeks: ContinuityWeek[] }) {
  // Six empty stubs is a worse zero than nothing at all.
  if (weeks.every((w) => w.made === 0)) return null;

  const maxMade = Math.max(...weeks.map((w) => w.made), 1);
  const current = weeks.find((w) => w.isCurrent);

  return (
    <section>
      <RuleHeader
        label="Continuity"
        trailing={<span className="text-[11px] text-ink-muted">6 weeks</span>}
        action={
          <Link href="/calendar" className="text-[12px] font-semibold text-accent hover:underline">
            Calendar →
          </Link>
        }
      />
      {current?.theme && (
        <p className="mb-3 line-clamp-1 text-[12px] text-ink-muted">{current.theme}</p>
      )}
      <div className="flex h-[44px] items-end justify-between border-b border-line-strong">
        {weeks.map((w) => {
          const h = Math.round((44 * w.made) / maxMade);
          const pub = w.made > 0 ? Math.round((h * w.published) / w.made) : 0;
          return (
            <div
              key={w.label}
              title={`${w.label}: ${w.made} made · ${w.published} published`}
              className={cn(
                "flex w-3 flex-col justify-end",
                w.isCurrent && "rounded-t-sm ring-1 ring-accent"
              )}
              style={{ height: Math.max(h, 1) }}
            >
              <span className="w-full flex-1 bg-line-strong" />
              {pub > 0 && <span className="w-full bg-success" style={{ height: pub }} />}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between">
        {weeks.map((w) => (
          <span
            key={w.label}
            className={cn(
              "tabular w-3 text-center text-[9.5px]",
              w.isCurrent ? "font-semibold text-ink" : "text-ink-muted"
            )}
          >
            {w.label.split(" ")[1]}
          </span>
        ))}
      </div>
    </section>
  );
}

/* ── FOOTNOTE ─────────────────────────────────────────────────────────────── */

export function Footnote({
  newsletter,
  billing,
  postingTime,
}: {
  newsletter: { title: string; dateLabel: string } | null;
  billing: string | null;
  postingTime: string;
}) {
  const sep = <span className="px-2 text-line-strong">·</span>;
  return (
    <div className="border-t border-line-strong pt-4 text-[11px] text-ink-muted">
      <span>Auto-publish checks every 5 minutes</span>
      {sep}
      {newsletter ? (
        <span>
          Next newsletter &ldquo;{newsletter.title}&rdquo; sends {newsletter.dateLabel}
        </span>
      ) : (
        <Link href="/newsletter" className="hover:underline">
          No newsletter queued · Draft one →
        </Link>
      )}
      {billing && (
        <>
          {sep}
          <span>{billing}</span>
        </>
      )}
      {sep}
      <span className="tabular">Posting at {postingTime}</span>
    </div>
  );
}
