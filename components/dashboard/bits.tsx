"use client";

import { cn } from "@/lib/utils";

/**
 * Small pieces the dashboard is assembled from. Kept together so the stat
 * tiles, pills and bars cannot drift apart as the page changes.
 */

/* ── Stat card ─────────────────────────────────────────────────────────────
   Every card carries a line only IT can say - when the next post goes out, how
   many landed this month, which draft is due first. Four identical sparklines
   told the reader nothing about which card they were looking at. */

const STAT_TONE = {
  brand: "bg-brand-tint text-brand",
  ok: "bg-ok-tint text-ok",
  warn: "bg-warn-tint text-warn",
  violet: "bg-violet-tint text-violet",
} as const;

export function StatCard({
  label,
  value,
  note,
  icon: Icon,
  tone,
  href,
}: {
  label: string;
  value: number | string;
  note: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: keyof typeof STAT_TONE;
  href: string;
}) {
  return (
    <a href={href} className="card card-lift ring-focus flex items-start gap-4 px-5 py-5">
      <span
        className={cn(
          "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-control",
          STAT_TONE[tone]
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="eyebrow block">{label}</span>
        <span className="nums mt-1.5 block font-display text-[30px] font-bold leading-none tracking-[-0.03em] text-text">
          {value}
        </span>
        <span className="mt-2 block text-[12px] leading-snug text-text-2">{note}</span>
      </span>
    </a>
  );
}

/* ── Category pill ─────────────────────────────────────────────────────────
   The reference uses colour to tell content styles apart at a glance. The hue
   is derived from the label so a given style is always the same colour, rather
   than depending on where it happens to sit in a list. */
const PILL_HUES = [
  "bg-brand-tint text-brand",
  "bg-violet-tint text-violet",
  "bg-ok-tint text-ok",
  "bg-warn-tint text-warn",
  "bg-pink-tint text-pink",
] as const;

export function hueFor(label: string): string {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) >>> 0;
  return PILL_HUES[h % PILL_HUES.length];
}

export function Pill({ children, className }: { children: React.ReactNode; className?: string }) {
  const label = typeof children === "string" ? children : "";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-semibold leading-none",
        label ? hueFor(label) : "bg-card-muted text-text-2",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ── Status badge ──────────────────────────────────────────────────────────── */

const STATUS = {
  scheduled: "bg-brand-tint text-brand",
  draft: "bg-warn-tint text-warn",
  published: "bg-ok-tint text-ok",
} as const;

export function StatusBadge({ kind }: { kind: keyof typeof STATUS }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-control px-3 py-1.5 text-[12px] font-semibold capitalize",
        STATUS[kind]
      )}
    >
      {kind}
    </span>
  );
}

/* ── Segmented proportion bar ──────────────────────────────────────────────── */

const SEG = ["bg-violet", "bg-brand", "bg-ok", "bg-warn", "bg-pink"] as const;
const DOT = ["bg-violet", "bg-brand", "bg-ok", "bg-warn", "bg-pink"] as const;

export function MixBar({ parts }: { parts: { label: string; pct: number }[] }) {
  if (parts.length === 0) return null;
  return (
    <div>
      <div className="flex h-2 gap-1 overflow-hidden rounded-full">
        {parts.map((p, i) => (
          <span
            key={p.label}
            className={cn("rounded-full", SEG[i % SEG.length])}
            style={{ width: `${p.pct}%` }}
          />
        ))}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {parts.map((p, i) => (
          <span key={p.label} className="flex items-center gap-1.5 text-[12px] text-text-2">
            <span className={cn("h-2 w-2 rounded-full", DOT[i % DOT.length])} />
            <span className="capitalize">{p.label}</span>
            <span className="nums font-semibold text-text">{p.pct}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Pillar row ────────────────────────────────────────────────────────────── */

export function PillarRow({ name, pct }: { name: string; pct: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-[13px] leading-snug text-text">{name}</p>
        <span className="nums flex-shrink-0 text-[12px] font-semibold text-text-2">{pct}%</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-card-muted">
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
