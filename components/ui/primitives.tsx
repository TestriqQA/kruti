import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The dashboard's building blocks.
 *
 * Kept in one file on purpose: these only work if every page uses the same
 * ones, and a folder of fifteen near-identical card components is how that
 * stops happening. Everything here reads the design tokens from
 * app/globals.css, so none of it carries a hard-coded colour.
 */

/* ── Surface ─────────────────────────────────────────────────────────────── */

export function Panel({
  className,
  children,
  flush = false,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { flush?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-panel border border-line bg-surface",
        !flush && "p-5",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  subtitle,
  icon: Icon,
  action,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-line px-5 py-4",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && <Icon className="h-4 w-4 flex-shrink-0 text-ink-subtle" />}
        <div className="min-w-0">
          <h2 className="truncate font-display text-[15px] font-semibold text-ink">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 truncate text-xs text-ink-subtle">{subtitle}</p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

/* ── Page header ─────────────────────────────────────────────────────────── */

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-end justify-between gap-6", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */

const BUTTON_VARIANTS = {
  primary:
    "bg-accent text-accent-ink hover:bg-accent-hover shadow-e1 disabled:hover:bg-accent",
  secondary:
    "bg-surface text-ink border border-line hover:bg-surface-sunken hover:border-line-strong",
  ghost: "text-ink-muted hover:bg-surface-sunken hover:text-ink",
  danger: "bg-danger text-white hover:opacity-90",
  soft: "bg-accent-soft text-accent border border-accent-line hover:bg-accent/10",
} as const;

const BUTTON_SIZES = {
  xs: "h-7 px-2.5 text-xs gap-1.5 rounded-lg",
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-control",
  md: "h-10 px-4 text-sm gap-2 rounded-control",
  lg: "h-11 px-5 text-sm gap-2 rounded-control",
} as const;

type ButtonLook = {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
};

const buttonClass = ({ variant = "secondary", size = "md" }: ButtonLook, extra?: string) =>
  cn(
    "inline-flex items-center justify-center font-semibold transition-colors focus-ring",
    "disabled:cursor-not-allowed disabled:opacity-50",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    extra
  );

export function Button({
  variant,
  size,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonLook) {
  return <button className={buttonClass({ variant, size }, className)} {...rest} />;
}

export function LinkButton({
  variant,
  size,
  className,
  ...rest
}: React.ComponentProps<typeof Link> & ButtonLook) {
  return <Link className={buttonClass({ variant, size }, className)} {...rest} />;
}

export function IconButton({
  icon: Icon,
  label,
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-control text-ink-subtle",
        "transition-colors hover:bg-surface-sunken hover:text-ink focus-ring",
        "disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      {...rest}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

/* ── Pills ───────────────────────────────────────────────────────────────── */

const PILL_TONES = {
  neutral: "bg-surface-sunken text-ink-muted border-line",
  accent: "bg-accent-soft text-accent border-accent-line",
  success: "bg-success-soft text-success border-success/25",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-danger-soft text-danger border-danger/25",
} as const;

export function Pill({
  tone = "neutral",
  icon: Icon,
  children,
  className,
}: {
  tone?: keyof typeof PILL_TONES;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-5",
        PILL_TONES[tone],
        className
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

/** A small coloured dot - cheaper than a pill when the label is adjacent. */
export function Dot({ tone = "neutral" }: { tone?: keyof typeof PILL_TONES }) {
  const fill = {
    neutral: "bg-ink-subtle",
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  }[tone];
  return <span className={cn("h-1.5 w-1.5 flex-shrink-0 rounded-full", fill)} />;
}

/* ── Stats ───────────────────────────────────────────────────────────────── */

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  tone?: keyof typeof PILL_TONES;
  href?: string;
}) {
  const accentText = {
    neutral: "text-ink-subtle",
    accent: "text-accent",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  }[tone];

  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-subtle">
          {label}
        </p>
        {Icon && <Icon className={cn("h-4 w-4", accentText)} />}
      </div>
      <p className="tabular mt-3 font-display text-[28px] font-bold leading-none tracking-[-0.02em] text-ink">
        {value}
      </p>
      {hint && <p className="mt-2 text-xs text-ink-subtle">{hint}</p>}
    </>
  );

  const shell =
    "rounded-card border border-line bg-surface px-4 py-4 transition-colors";

  return href ? (
    <Link href={href} className={cn(shell, "block hover:border-line-strong focus-ring")}>
      {body}
    </Link>
  ) : (
    <div className={shell}>{body}</div>
  );
}

/* ── Meter ───────────────────────────────────────────────────────────────── */

export function Meter({
  value,
  max,
  tone = "accent",
  className,
}: {
  value: number;
  max: number;
  tone?: keyof typeof PILL_TONES;
  className?: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  const fill = {
    neutral: "bg-ink-subtle",
    accent: "bg-accent",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  }[tone];

  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken", className)}>
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", fill)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/* ── Empty state ─────────────────────────────────────────────────────────── */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-card border border-line bg-surface-sunken text-ink-subtle">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 font-display text-[15px] font-semibold text-ink">{title}</p>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-subtle">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ── Section label ───────────────────────────────────────────────────────── */

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p
      className={cn(
        "text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-subtle",
        className
      )}
    >
      {children}
    </p>
  );
}
