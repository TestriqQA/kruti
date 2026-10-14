"use client";

import Link from "next/link";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { RuleHeader } from "@/components/dashboard/ledger";

/**
 * Content analytics.
 *
 * The honest scope of this page is PRODUCTION and PUBLISHING. LinkedIn
 * engagement columns exist on Post (likes / comments / shares / impressions)
 * but nothing populates them - the app authenticates with
 * `openid profile email w_member_social`, and reading engagement needs
 * `r_member_social`, which it does not have. The old page rendered those
 * fields anyway, so it showed a wall of confident zeros. A measurement the
 * product cannot make is stated as such here instead of being drawn.
 *
 * Charts follow the house rules: one axis, thin marks, a 2px surface gap
 * between stacked segments, direct labels rather than a number on every mark,
 * recessive grid, and status colour used only for status - always with its
 * word beside it, never colour alone.
 */

interface EngagementPost {
  id: string;
  title: string;
  postType: string;
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  engagementRate: number;
}

interface AnalyticsProps {
  stats: {
    totalPosts: number;
    postsThisWeek: number;
    linkedinPublished: number;
    linkedinErrors: number;
    avgPostsPerWeek: number;
    successRate: number;
  };
  postsByStatus: Record<string, number>;
  postsByType: Record<string, number>;
  weeklyActivity: Array<{ weekLabel: string; created: number; published: number }>;
  calendarHeatmap: Array<{ date: string; count: number }>;
  engagement?: {
    totals: { likes: number; comments: number; shares: number; impressions: number; hasSyncedData: boolean };
    byPost: EngagementPost[];
    byType: Array<{ postType: string; count: number; likes: number; comments: number; shares: number; impressions: number; avgEngagement: number }>;
  };
}

const TYPE_LABELS: Record<string, string> = {
  "thought-leadership": "Thought leadership",
  tips: "Tips",
  story: "Story",
  question: "Question",
  listicle: "Listicle",
  poll: "Poll",
  carousel: "Carousel",
};

const STATUS_ROWS = [
  { key: "draft", label: "Draft", help: "Written, waiting for your review", fill: "bg-warning", text: "text-warning" },
  { key: "ready", label: "Ready", help: "Queued for auto-publish", fill: "bg-accent", text: "text-accent" },
  { key: "published", label: "Published", help: "Live on LinkedIn", fill: "bg-success", text: "text-success" },
] as const;

/** One hue, light to dark - the rule for magnitude. */
function heatStep(count: number): string {
  if (count <= 0) return "border border-line-strong bg-transparent";
  if (count === 1) return "bg-accent/25";
  if (count === 2) return "bg-accent/45";
  if (count === 3) return "bg-accent/70";
  return "bg-accent";
}

export default function AnalyticsClient({
  stats,
  postsByStatus,
  postsByType,
  weeklyActivity,
  calendarHeatmap,
}: AnalyticsProps) {
  const statusTotal = Math.max(
    1,
    STATUS_ROWS.reduce((s, r) => s + (postsByStatus[r.key] ?? 0), 0)
  );

  const typeRows = Object.entries(postsByType)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
  const typeMax = Math.max(1, ...typeRows.map((t) => t.count));

  const weekMax = Math.max(1, ...weeklyActivity.map((w) => w.created));
  const attempted = stats.linkedinPublished + stats.linkedinErrors;

  // 13 columns of 7 days, oldest on the left.
  const heatWeeks: { date: string; count: number }[][] = [];
  for (let i = 0; i < calendarHeatmap.length; i += 7) {
    heatWeeks.push(calendarHeatmap.slice(i, i + 7));
  }

  return (
    <div className="space-y-7">
      {/* ═══ CHASSIS ════════════════════════════════════════════════════════ */}
      <section className="animate-rise-in divide-y divide-line overflow-hidden rounded-panel border border-line bg-surface shadow-e1 motion-reduce:animate-none dark:shadow-none">
        <div className="px-7 py-6">
          <p className="tabular text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
            Analytics · last 90 days
          </p>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-[1.1] tracking-[-0.03em] text-ink">
            Content analytics
          </h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
            How much you are writing and how reliably it reaches LinkedIn. Reach and
            engagement are not shown because Kruti cannot read them yet &mdash; see the last
            section.
          </p>
        </div>

        <div className="grid grid-cols-4 divide-x divide-line">
          {[
            { label: "Total posts", value: stats.totalPosts, hint: "all time" },
            { label: "Published", value: stats.linkedinPublished, hint: "reached LinkedIn" },
            { label: "This week", value: stats.postsThisWeek, hint: "written since Monday" },
            { label: "Weekly average", value: stats.avgPostsPerWeek, hint: "over 8 weeks" },
          ].map((s) => (
            <div key={s.label} className="px-5 py-4">
              <p className="text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
                {s.label}
              </p>
              <p className="tabular mt-2 font-display text-[26px] font-bold leading-none tracking-[-0.02em] text-ink">
                {s.value}
              </p>
              <p className="mt-1.5 text-[11px] text-ink-muted">{s.hint}</p>
            </div>
          ))}
        </div>
      </section>

      <div
        className="grid animate-rise-in grid-cols-[minmax(0,1fr)_320px] gap-7 motion-reduce:animate-none"
        style={{ animationDelay: "70ms" }}
      >
        <div className="min-w-0 space-y-7">
          {/* ── Production over time ────────────────────────────────────── */}
          <section>
            <RuleHeader
              label="Posts written each week"
              trailing={
                <span className="flex items-center gap-3 text-[11px] text-ink-muted">
                  <span className="flex items-center gap-1.5">
                    <span className="block h-2 w-3 rounded-sm bg-accent/35" />
                    Written
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="block h-2 w-3 rounded-sm bg-success" />
                    Published
                  </span>
                </span>
              }
            />
            {weeklyActivity.every((w) => w.created === 0) ? (
              <p className="py-6 text-[13px] text-ink-muted">
                Nothing written in the last eight weeks.
              </p>
            ) : (
              <div className="flex h-[168px] items-end gap-2">
                {weeklyActivity.map((w) => {
                  const h = Math.round((140 * w.created) / weekMax);
                  const pub = w.created > 0 ? Math.round((h * w.published) / w.created) : 0;
                  return (
                    <div key={w.weekLabel} className="flex min-w-0 flex-1 flex-col items-center">
                      <span className="tabular mb-1 text-[10.5px] font-semibold text-ink">
                        {w.created > 0 ? w.created : ""}
                      </span>
                      <div
                        title={`Week of ${w.weekLabel}: ${w.created} written, ${w.published} published`}
                        className="flex w-full max-w-[44px] flex-col justify-end rounded-t"
                        style={{ height: Math.max(h, 2) }}
                      >
                        {/* 2px surface gap between the segments, per the mark spec */}
                        <span
                          className="w-full rounded-t bg-accent/35"
                          style={{ height: Math.max(h - pub - (pub > 0 ? 2 : 0), 0) }}
                        />
                        {pub > 0 && <span className="h-0.5 w-full" />}
                        {pub > 0 && (
                          <span className="w-full rounded-b-sm bg-success" style={{ height: pub }} />
                        )}
                      </div>
                      <span className="tabular mt-2 truncate text-[9.5px] text-ink-muted">
                        {w.weekLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Writing days ───────────────────────────────────────────── */}
          <section>
            <RuleHeader
              label="Days you wrote"
              trailing={
                <span className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                  Fewer
                  {[0, 1, 2, 3, 4].map((n) => (
                    <span key={n} className={cn("block h-2.5 w-2.5 rounded-[2px]", heatStep(n))} />
                  ))}
                  More
                </span>
              }
            />
            <div className="flex gap-1">
              {heatWeeks.map((week, i) => (
                <div key={i} className="flex flex-col gap-1">
                  {week.map((d) => (
                    <span
                      key={d.date}
                      title={`${d.date}: ${d.count} ${d.count === 1 ? "post" : "posts"}`}
                      className={cn("block h-3.5 w-3.5 rounded-[2px]", heatStep(d.count))}
                    />
                  ))}
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-ink-muted">
              Each square is one day over the last 90, darker where you wrote more.
            </p>
          </section>

          {/* ── Engagement, stated honestly ─────────────────────────────── */}
          <section>
            <RuleHeader label="Reach and engagement" />
            <div className="flex items-start gap-3 border-l-2 border-line-strong pl-4">
              <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-muted" />
              <div>
                <p className="text-[14px] font-semibold text-ink">Not available yet.</p>
                <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
                  Likes, comments, shares and impressions are stored on every post, but nothing
                  fills them in: Kruti signs in with permission to publish on your behalf, not to
                  read how a post performed. That needs a different LinkedIn permission
                  (<span className="tabular">r_member_social</span>) which this app has not been
                  granted.
                </p>
                <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-muted">
                  Rather than show you a page of zeros, this section stays empty until the data is
                  real. Everything above is measured from your own posts and is accurate.
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* ── Right rail ───────────────────────────────────────────────── */}
        <aside className="space-y-7">
          <section>
            <RuleHeader label="Publishing reliability" />
            {attempted === 0 ? (
              <p className="text-[13px] text-ink-muted">
                Nothing has been sent to LinkedIn yet.
              </p>
            ) : (
              <>
                <p className="tabular font-display text-[34px] font-bold leading-none tracking-[-0.03em] text-ink">
                  {stats.successRate}
                  <span className="text-[20px] text-ink-muted">%</span>
                </p>
                <p className="mt-1.5 text-[12px] text-ink-muted">
                  of {attempted} attempts reached LinkedIn
                </p>
                <div className="mt-4 flex h-2 gap-0.5 overflow-hidden rounded-full">
                  <span
                    className="bg-success"
                    style={{ width: `${(stats.linkedinPublished / attempted) * 100}%` }}
                  />
                  {stats.linkedinErrors > 0 && (
                    <span
                      className="bg-danger"
                      style={{ width: `${(stats.linkedinErrors / attempted) * 100}%` }}
                    />
                  )}
                </div>
                <ul className="mt-3 space-y-1.5">
                  <li className="flex items-center gap-2 text-[12px] text-ink-muted">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    <span className="flex-1">Published</span>
                    <span className="tabular font-semibold text-ink">
                      {stats.linkedinPublished}
                    </span>
                  </li>
                  <li className="flex items-center gap-2 text-[12px] text-ink-muted">
                    <AlertCircle className="h-3.5 w-3.5 text-danger" />
                    <span className="flex-1">Failed</span>
                    <span className="tabular font-semibold text-ink">{stats.linkedinErrors}</span>
                  </li>
                </ul>
                {stats.linkedinErrors > 0 && (
                  <Link
                    href="/posts?status=ready"
                    className="mt-3 inline-block text-[12px] font-semibold text-accent hover:underline"
                  >
                    See what failed →
                  </Link>
                )}
              </>
            )}
          </section>

          <section>
            <RuleHeader label="Where your posts are" />
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
              {STATUS_ROWS.map((r) => {
                const v = postsByStatus[r.key] ?? 0;
                if (v === 0) return null;
                return (
                  <span
                    key={r.key}
                    className={r.fill}
                    style={{ width: `${(v / statusTotal) * 100}%` }}
                  />
                );
              })}
            </div>
            <ul className="mt-3 space-y-2.5">
              {STATUS_ROWS.map((r) => (
                <li key={r.key} className="flex items-start gap-2">
                  <span className={cn("mt-1.5 block h-2 w-2 flex-shrink-0 rounded-full", r.fill)} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[12.5px] font-semibold text-ink">{r.label}</span>
                      <span className="tabular text-[12.5px] font-semibold text-ink">
                        {postsByStatus[r.key] ?? 0}
                      </span>
                    </span>
                    <span className="block text-[11px] leading-snug text-ink-muted">{r.help}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <RuleHeader label="What you write" />
            {typeRows.length === 0 ? (
              <p className="text-[13px] text-ink-muted">Nothing written yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {typeRows.map((t) => (
                  <li key={t.type}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12px] text-ink">
                        {TYPE_LABELS[t.type] ?? t.type}
                      </span>
                      <span className="tabular text-[12px] font-semibold text-ink">{t.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-sunken">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${(t.count / typeMax) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
