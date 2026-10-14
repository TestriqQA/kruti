"use client";

import Link from "next/link";
import * as Tooltip from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";
import type { OverviewPost, OverviewStatus, RunwayDay } from "@/lib/dashboard-overview";

/**
 * The runway: 14 days of the user's actual posting rhythm, today-3 to today+10.
 *
 * Absolutely-positioned divs on percentage x-positions rather than SVG. The
 * plot is a 1fr column, so a fixed viewBox would blur every 1px stroke at the
 * 970px content width this page is designed against, and text inside SVG does
 * not inherit the type stack. Percentages need no measurement pass either.
 *
 * The weekday comb is the point: a Mon/Wed/Fri user and a daily user get
 * visibly different pages, because the posting schedule is drawn as structure
 * rather than stated as a sentence. No generic dashboard can do that, because
 * none of them know the user has a cadence.
 */

const CELL_PCT = 100 / 14;

const CAPSULE: Record<OverviewStatus, string> = {
  draft: "bg-warning/70",
  ready: "bg-accent",
  published: "bg-success",
  missed: "bg-warning ring-[1.5px] ring-warning",
  failed: "bg-danger ring-[1.5px] ring-danger",
};

const STATE_WORD: Record<OverviewStatus, string> = {
  draft: "Draft",
  ready: "Ready",
  published: "Published",
  missed: "Missed its slot",
  failed: "Failed to publish",
};

const LEGEND: { state: OverviewStatus; label: string }[] = [
  { state: "draft", label: "draft" },
  { state: "ready", label: "ready" },
  { state: "published", label: "published" },
  { state: "missed", label: "missed" },
  { state: "failed", label: "failed" },
];

export default function RhythmStrip({
  days,
  ghostBeyond,
  overdueCount,
  onHoverPost,
}: {
  days: RunwayDay[];
  ghostBeyond: string[];
  overdueCount: number;
  onHoverPost?: (id: string | null) => void;
}) {
  const todayIndex = days.findIndex((d) => d.isToday);

  return (
    <Tooltip.Provider delayDuration={120}>
      <div className="flex h-full flex-col">
        {/* ── Lane 1: axis ─────────────────────────────────────────────── */}
        <div className="relative h-[18px]">
          {days.map((d, i) => (
            <div
              key={d.key}
              className="absolute top-0 -translate-x-1/2 text-center"
              style={{ left: `${(i + 0.5) * CELL_PCT}%` }}
            >
              <span
                className={cn(
                  "block text-[9.5px] uppercase leading-none tracking-[0.12em]",
                  d.isPostingDay ? "font-semibold text-ink" : "text-ink-muted/70"
                )}
              >
                {d.dow}
              </span>
              <span
                className={cn(
                  "tabular mt-0.5 block text-[11px] leading-none",
                  d.isToday
                    ? "font-bold text-accent"
                    : d.isPostingDay
                      ? "text-ink"
                      : "text-ink-muted/70"
                )}
              >
                {d.dayNum}
              </span>
            </div>
          ))}
        </div>

        {/* ── Lane 2: scheduled ────────────────────────────────────────── */}
        <div className="relative mt-2 h-[64px]">
          {/* Monday rules */}
          {days.map((d, i) =>
            d.dow === "M" ? (
              <span
                key={`rule-${d.key}`}
                aria-hidden="true"
                className="absolute top-0 h-full w-px bg-line/55"
                style={{ left: `${i * CELL_PCT}%` }}
              />
            ) : null
          )}

          {/* today's wash - accent/6 reads in both themes, accent-soft does not */}
          {todayIndex >= 0 && (
            <span
              aria-hidden="true"
              className="absolute top-0 h-full rounded-[3px] bg-accent/[0.06]"
              style={{ left: `${todayIndex * CELL_PCT}%`, width: `${CELL_PCT}%` }}
            />
          )}

          {/* spine */}
          <span aria-hidden="true" className="absolute left-0 top-1/2 h-px w-full bg-line-strong" />

          {/* NOW */}
          {todayIndex >= 0 && (
            <span
              aria-hidden="true"
              className="absolute top-0 h-full w-px bg-accent"
              style={{ left: `${(todayIndex + 0.5) * CELL_PCT}%` }}
            />
          )}

          {days.map((d, i) =>
            d.posts.slice(0, 3).map((p, k) => (
              <Tooltip.Root key={p.id}>
                <Tooltip.Trigger asChild>
                  <Link
                    href={`/posts/${p.id}`}
                    onMouseEnter={() => onHoverPost?.(p.id)}
                    onMouseLeave={() => onHoverPost?.(null)}
                    aria-label={`${p.title}. ${p.dateLabel} ${p.timeLabel}. ${STATE_WORD[p.state]}.`}
                    // 10px capsule inside a 24px transparent anchor: the mark is
                    // small because density is the point, the hit target is not.
                    className="absolute top-1/2 flex h-7 w-6 -translate-y-1/2 items-center justify-center rounded focus-ring"
                    style={{ left: `calc(${(i + 0.5) * CELL_PCT}% + ${k * 4}px)`, marginLeft: -12 }}
                  >
                    <span
                      className={cn(
                        "block h-7 w-[10px] rounded-full transition-opacity",
                        CAPSULE[p.state],
                        d.isPast && "opacity-55"
                      )}
                    />
                    {p.art.kind !== "none" && (
                      <span
                        aria-hidden="true"
                        className="absolute -bottom-0.5 h-0.5 w-[10px] rounded-full bg-ink/35"
                      />
                    )}
                  </Link>
                </Tooltip.Trigger>
                {/* Portals out - the chassis is overflow-hidden and would clip
                    a hand-rolled absolute tooltip at the strip's bottom edge. */}
                <Tooltip.Portal>
                  <Tooltip.Content
                    side="top"
                    sideOffset={6}
                    className="z-50 max-w-xs rounded-control border border-line bg-surface px-3 py-2 shadow-e3"
                  >
                    <p className="text-[12.5px] font-semibold leading-snug text-ink">{p.title}</p>
                    <p className="tabular mt-1 text-[11px] text-ink-muted">
                      {p.dateLabel} · {p.timeLabel} · {STATE_WORD[p.state]}
                    </p>
                    {p.error && (
                      <p className="mt-1 text-[11px] leading-relaxed text-danger">{p.error}</p>
                    )}
                  </Tooltip.Content>
                </Tooltip.Portal>
              </Tooltip.Root>
            ))
          )}

          {days.map((d, i) =>
            d.posts.length > 3 ? (
              <span
                key={`more-${d.key}`}
                className="tabular absolute top-1/2 -translate-y-1/2 text-[9.5px] font-semibold text-ink-muted"
                style={{ left: `calc(${(i + 0.5) * CELL_PCT}% + 16px)` }}
              >
                +{d.posts.length - 3}
              </span>
            ) : null
          )}

          {/* Overdue bracket - a failure from nine days ago is one click away
              instead of existing only as an integer in a gauge. */}
          {overdueCount > 0 && (
            <a
              href="#attention"
              className="absolute left-0 top-1/2 flex h-4 -translate-y-1/2 items-center gap-1 rounded-r border-l-2 border-danger bg-danger/[0.12] pl-1 pr-1.5 text-[9.5px] font-semibold text-danger focus-ring"
            >
              ← {overdueCount}
            </a>
          )}
        </div>

        {/* ── Lane 3: capacity ─────────────────────────────────────────── */}
        <div className="relative mt-1.5 h-[20px]">
          {days.map((d, i) => {
            if (d.ghost) {
              return (
                <span
                  key={`ghost-${d.key}`}
                  aria-hidden="true"
                  data-ghost-slot=""
                  className={cn(
                    "absolute top-0 h-7 w-[10px] -translate-x-1/2 rounded-full",
                    "border border-dashed border-accent/45 transition-colors duration-150",
                    "group-data-[ghost=on]/chassis:border-solid group-data-[ghost=on]/chassis:bg-accent/35"
                  )}
                  style={{ left: `${(i + 0.5) * CELL_PCT}%`, transitionDelay: `${i * 40}ms` }}
                />
              );
            }
            // An empty posting day is a missing tooth in the comb. line-strong,
            // or it vanishes in dark.
            if (d.isPostingDay && d.posts.length === 0) {
              return (
                <span
                  key={`tick-${d.key}`}
                  aria-hidden="true"
                  className="absolute top-1 h-[10px] w-[3px] -translate-x-1/2 rounded-sm border border-line-strong"
                  style={{ left: `${(i + 0.5) * CELL_PCT}%` }}
                />
              );
            }
            return null;
          })}

          {ghostBeyond.length > 0 && (
            <span className="absolute right-0 top-0 rounded border border-dashed border-accent/45 px-1.5 py-0.5 text-[9.5px] font-semibold text-accent">
              +{ghostBeyond.length} beyond
            </span>
          )}
        </div>

        {/* ── Lane 4: legend ───────────────────────────────────────────── */}
        <div className="mt-auto flex items-center gap-3 pt-1">
          {LEGEND.map((l) => (
            <span key={l.state} className="flex items-center gap-1 text-[9.5px] text-ink-muted">
              <span className={cn("block h-2 w-[5px] rounded-full", CAPSULE[l.state])} />
              {l.label}
            </span>
          ))}
          <Link href="/calendar" className="ml-auto text-[12px] font-semibold text-accent hover:underline">
            Calendar →
          </Link>
        </div>
      </div>
    </Tooltip.Provider>
  );
}
