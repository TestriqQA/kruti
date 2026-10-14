"use client";

import {
  FileText,
  TrendingUp,
  Linkedin,
  BarChart3,
  Heart,
  MessageCircle,
  Share2,
  Eye,
} from "lucide-react";
import { cn, getPostTypeColor } from "@/lib/utils";
import { StatCard } from "@/components/dashboard/bits";

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

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  ready: "Ready",
  published: "Published",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-400 dark:bg-gray-500",
  ready: "bg-amber-400 dark:bg-amber-500",
  published: "bg-green-500 dark:bg-green-400",
};

const TYPE_LABELS: Record<string, string> = {
  "thought-leadership": "Thought Leadership",
  tips: "Tips & How-To",
  story: "Personal Story",
  question: "Question / Engagement",
  listicle: "Listicle / Steps",
};

/** One hue, light to dark - the rule for magnitude. A second green scale here
    competed with the status colours used for published/failed everywhere else. */
function heatmapColor(count: number): string {
  if (count === 0) return "bg-card-muted";
  if (count === 1) return "bg-brand/25";
  if (count === 2) return "bg-brand/55";
  return "bg-brand";
}

export default function AnalyticsClient({
  stats,
  postsByStatus,
  postsByType,
  weeklyActivity,
  calendarHeatmap,
  engagement,
}: AnalyticsProps) {
  const maxWeeklyCount = Math.max(1, ...weeklyActivity.map((w) => Math.max(w.created, w.published)));
  const hasAnyWeeklyData = weeklyActivity.some((w) => w.created > 0 || w.published > 0);

  const totalByStatus = Object.values(postsByStatus).reduce((a, b) => a + b, 0) || 1;
  const totalByType = Object.values(postsByType).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="pt-1">
        <h1 className="font-display text-[34px] font-bold leading-[1.1] tracking-[-0.03em] text-text">
          Content Analytics
        </h1>
        <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-text-2">
          How much you are writing, and how reliably it reaches LinkedIn. Everything here is
          measured from your own posts.
        </p>
      </div>

      {/* Readings. Each card carries a line only it can say. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Total posts"
          value={stats.totalPosts}
          note="written all time"
          icon={FileText}
          tone="brand"
          href="/posts"
        />
        <StatCard
          label="This week"
          value={stats.postsThisWeek}
          note="written since Monday"
          icon={TrendingUp}
          tone="ok"
          href="/posts"
        />
        <StatCard
          label="Published"
          value={stats.linkedinPublished}
          note={
            stats.linkedinErrors > 0
              ? `${stats.linkedinErrors} failed to send`
              : "every attempt succeeded"
          }
          icon={Linkedin}
          tone="violet"
          href="/posts"
        />
        <StatCard
          label="Weekly average"
          value={stats.avgPostsPerWeek}
          note="over the last 8 weeks"
          icon={BarChart3}
          tone="warn"
          href="/calendar"
        />
      </div>

      {/* LinkedIn Success Rate */}
      {(stats.linkedinPublished > 0 || stats.linkedinErrors > 0) && (
        <div className="card p-6">
          <h3 className="mb-3 font-display text-[16px] font-bold tracking-[-0.02em] text-text">
            LinkedIn Publishing Success Rate
          </h3>
          <div className="flex items-center gap-4">
            <div className="flex-1 bg-card-muted rounded-full h-3 overflow-hidden">
              <div
                className="bg-green-500 dark:bg-green-400 h-full rounded-full transition-all"
                style={{ width: `${stats.successRate}%` }}
              />
            </div>
            <span className="text-sm font-bold text-text w-12 text-right">
              {stats.successRate}%
            </span>
          </div>
          <p className="text-xs text-text-3 mt-2">
            {stats.linkedinPublished} published &middot; {stats.linkedinErrors} errors
          </p>
        </div>
      )}

      {/* Funnel + Post Types - 2 column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Publishing Funnel */}
        <div className="card p-6">
          <h3 className="mb-4 font-display text-[16px] font-bold tracking-[-0.02em] text-text">
            Publishing Funnel
          </h3>
          <div className="space-y-4">
            {["draft", "ready", "published"].map((status) => {
              const count = postsByStatus[status] || 0;
              const pct = Math.round((count / totalByStatus) * 100);
              return (
                <div key={status}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-text-2 font-medium">
                      {STATUS_LABELS[status] || status}
                    </span>
                    <span className="text-text dark:text-gray-200 font-semibold tabular-nums">
                      {count} <span className="text-text-3 font-normal">({pct}%)</span>
                    </span>
                  </div>
                  <div className="bg-card-muted rounded-full h-3 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", STATUS_COLORS[status] || "bg-gray-300")}
                      style={{ width: `${Math.max(pct > 0 ? 3 : 0, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Post Type Distribution */}
        <div className="card p-6">
          <h3 className="mb-4 font-display text-[16px] font-bold tracking-[-0.02em] text-text">
            Post Type Distribution
          </h3>
          <div className="space-y-4">
            {Object.entries(postsByType)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => {
                const pct = Math.round((count / totalByType) * 100);
                const colorClasses = getPostTypeColor(type);
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-medium", colorClasses)}>
                        {TYPE_LABELS[type] || type}
                      </span>
                      <span className="text-text dark:text-gray-200 font-semibold tabular-nums">
                        {count} <span className="text-text-3 font-normal">({pct}%)</span>
                      </span>
                    </div>
                    <div className="bg-card-muted rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-brand h-full rounded-full transition-all"
                        style={{ width: `${Math.max(pct > 0 ? 3 : 0, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            {Object.keys(postsByType).length === 0 && (
              <p className="text-xs text-text-3 italic">No posts yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Activity Chart */}
      <div className="card p-6">
        <h3 className="mb-4 font-display text-[16px] font-bold tracking-[-0.02em] text-text">
          Weekly Activity
        </h3>
        {hasAnyWeeklyData ? (
          <div className="flex items-end gap-2 h-44">
            {weeklyActivity.map((week) => {
              const createdH = week.created > 0
                ? Math.max(8, Math.round((week.created / maxWeeklyCount) * 140))
                : 0;
              const publishedH = week.published > 0
                ? Math.max(8, Math.round((week.published / maxWeeklyCount) * 140))
                : 0;

              return (
                <div key={week.weekLabel} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  {/* Bar column - stacked from bottom */}
                  <div className="w-full flex items-end justify-center gap-[2px] h-36">
                    {/* Created bar */}
                    <div
                      className={cn(
                        "flex-1 max-w-5 bg-slate-300 dark:bg-white/20 rounded-t transition-all",
                        createdH === 0 && "invisible"
                      )}
                      style={{ height: `${createdH}px` }}
                      title={`${week.created} created`}
                    />
                    {/* Published bar */}
                    <div
                      className={cn(
                        "flex-1 max-w-5 bg-brand rounded-t transition-all",
                        publishedH === 0 && "invisible"
                      )}
                      style={{ height: `${publishedH}px` }}
                      title={`${week.published} published`}
                    />
                  </div>
                  <span className="text-[10px] text-text-3 truncate w-full text-center">
                    {week.weekLabel}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-36">
            <p className="text-sm text-text-3 italic">No activity in the last 8 weeks</p>
          </div>
        )}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-edge-soft">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-slate-300 dark:bg-white/20" />
            <span className="text-xs text-text-2">Created</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-brand" />
            <span className="text-xs text-text-2">Published to LinkedIn</span>
          </div>
        </div>
      </div>

      {/* Calendar Heatmap */}
      <div className="card p-6">
        <h3 className="mb-4 font-display text-[16px] font-bold tracking-[-0.02em] text-text">
          Posting Activity (Last 90 Days)
        </h3>
        <div className="overflow-x-auto pb-1">
          <div
            className="grid gap-[3px]"
            style={{
              gridTemplateRows: "repeat(7, 14px)",
              gridAutoFlow: "column",
              gridAutoColumns: "14px",
            }}
          >
            {calendarHeatmap.map((day) => (
              <div
                key={day.date}
                className={cn("w-[14px] h-[14px] rounded-[3px]", heatmapColor(day.count))}
                title={`${day.date}: ${day.count} post${day.count !== 1 ? "s" : ""}`}
              />
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-3">
          <span className="text-[10px] text-text-3 mr-1">Less</span>
          <div className="w-[14px] h-[14px] rounded-[3px] bg-card-muted" />
          <div className="w-[14px] h-[14px] rounded-[3px] bg-green-200 dark:bg-green-900/60" />
          <div className="w-[14px] h-[14px] rounded-[3px] bg-green-400 dark:bg-green-700" />
          <div className="w-[14px] h-[14px] rounded-[3px] bg-green-600 dark:bg-green-500" />
          <span className="text-[10px] text-text-3 ml-1">More</span>
        </div>
      </div>

      {/* Engagement Metrics - hidden entirely until LinkedIn actually syncs data */}
      {engagement?.totals.hasSyncedData && (
        <>
          {/* Engagement Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Likes", value: engagement.totals.likes, icon: Heart, color: "text-red-500 dark:text-red-400", bg: "bg-bad-tint" },
              { label: "Comments", value: engagement.totals.comments, icon: MessageCircle, color: "text-brand", bg: "bg-brand-tint" },
              { label: "Shares", value: engagement.totals.shares, icon: Share2, color: "text-ok", bg: "bg-ok-tint" },
              { label: "Impressions", value: engagement.totals.impressions, icon: Eye, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/30" },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="card p-6">
                <div className="flex items-center gap-3">
                  <div className={cn("w-10 h-10 rounded-control flex items-center justify-center", bg)}>
                    <Icon className={cn("w-5 h-5", color)} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-text">
                      {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                    </p>
                    <p className="text-xs text-text-2">{label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Performance by Post Type */}
          {engagement.byType && engagement.byType.length > 0 && (
            <div className="card p-6">
              <h3 className="mb-4 font-display text-[16px] font-bold tracking-[-0.02em] text-text">
                Performance by Post Type
              </h3>
              <div className="space-y-3">
                {engagement.byType
                  .sort((a, b) => b.avgEngagement - a.avgEngagement)
                  .map((t) => {
                    const total = t.likes + t.comments + t.shares;
                    const maxTotal = Math.max(1, ...engagement.byType.map((x) => x.likes + x.comments + x.shares));
                    const barWidth = Math.max(3, Math.round((total / maxTotal) * 100));
                    return (
                      <div key={t.postType}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className={cn("px-2 py-0.5 rounded-md border text-[10px] font-medium", getPostTypeColor(t.postType))}>
                            {TYPE_LABELS[t.postType] || t.postType}
                          </span>
                          <div className="flex items-center gap-3 text-text-2">
                            <span>{t.count} posts</span>
                            <span className="font-semibold text-brand">{t.avgEngagement}% eng.</span>
                          </div>
                        </div>
                        <div className="bg-card-muted rounded-full h-3 overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-blue-600 to-blue-700 h-full rounded-full transition-all"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-text-3">
                          <span>{t.likes} likes</span>
                          <span>{t.comments} comments</span>
                          <span>{t.shares} shares</span>
                          <span>{t.impressions} impressions</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Top Posts by Engagement */}
          {engagement.byPost.length > 0 && (
            <div className="card p-6">
              <h3 className="mb-4 font-display text-[16px] font-bold tracking-[-0.02em] text-text">
                Top Posts by Engagement
              </h3>
              <div className="space-y-3">
                {engagement.byPost
                  .sort((a, b) => (b.likes + b.comments + b.shares) - (a.likes + a.comments + a.shares))
                  .slice(0, 5)
                  .map((p) => (
                    <div key={p.id} className="flex items-center gap-3 p-3 bg-card-muted rounded-control">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text truncate">{p.title}</p>
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-md border font-medium", getPostTypeColor(p.postType))}>
                          {TYPE_LABELS[p.postType] || p.postType}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-text-2 flex-shrink-0">
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-red-400" />{p.likes}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3 text-blue-400" />{p.comments}</span>
                        <span className="flex items-center gap-1"><Share2 className="w-3 h-3 text-green-400" />{p.shares}</span>
                        {p.engagementRate > 0 && (
                          <span className="font-semibold text-brand">{p.engagementRate}%</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
