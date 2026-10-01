"use client";

import { FileText, Linkedin, AlertCircle, Mail, BarChart3, Trophy } from "lucide-react";
import Avatar from "@/components/Avatar";
import { cn } from "@/lib/utils";

interface ContentStats {
  totalPosts: number;
  postsByStatus: Record<string, number>;
  postsByType: Record<string, number>;
  linkedinPublished: number;
  linkedinErrors: number;
  totalNewsletters: number;
  newslettersByStatus: Record<string, number>;
}

interface TopUser {
  userId: string;
  plans: number;
  user: { id: string; name: string | null; email: string | null; image: string | null };
}

const TYPE_COLORS: Record<string, string> = {
  "thought-leadership": "bg-indigo-500",
  "tips": "bg-green-500",
  "story": "bg-amber-500",
  "question": "bg-purple-500",
  "listicle": "bg-cyan-500",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-400",
  ready: "bg-blue-500",
  published: "bg-green-500",
};

export default function AdminContentStatsClient({
  stats,
  topUsers,
}: {
  stats: ContentStats;
  topUsers: TopUser[];
}) {
  const linkedinSuccessRate = stats.linkedinPublished + stats.linkedinErrors > 0
    ? Math.round((stats.linkedinPublished / (stats.linkedinPublished + stats.linkedinErrors)) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Content Stats</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Content creation and publishing analytics</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <FileText className="w-5 h-5 text-indigo-600 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalPosts}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Total Posts</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <Linkedin className="w-5 h-5 text-[#0A66C2] mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.linkedinPublished}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Published to LinkedIn</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <AlertCircle className="w-5 h-5 text-red-500 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.linkedinErrors}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Posting Errors</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <Mail className="w-5 h-5 text-purple-600 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalNewsletters}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Newsletters</p>
        </div>
      </div>

      {/* LinkedIn Success Rate */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Linkedin className="w-4 h-4 text-[#0A66C2]" />
            LinkedIn Publishing Success Rate
          </h3>
          <span className={cn(
            "text-2xl font-bold",
            linkedinSuccessRate >= 80 ? "text-green-600" : linkedinSuccessRate >= 50 ? "text-amber-600" : "text-red-600"
          )}>
            {linkedinSuccessRate}%
          </span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3">
          <div
            className={cn(
              "rounded-full h-3 transition-all",
              linkedinSuccessRate >= 80 ? "bg-green-500" : linkedinSuccessRate >= 50 ? "bg-amber-500" : "bg-red-500"
            )}
            style={{ width: `${linkedinSuccessRate}%` }}
          />
        </div>
        <div className="flex justify-between mt-2 text-xs text-gray-400 dark:text-gray-500">
          <span>{stats.linkedinPublished} successful</span>
          <span>{stats.linkedinErrors} errors</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Posts by Status */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-400" />
            Posts by Status
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.postsByStatus).map(([status, count]) => (
              <div key={status}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{status}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{count}</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                  <div
                    className={cn("rounded-full h-2 transition-all", STATUS_COLORS[status] ?? "bg-gray-400")}
                    style={{ width: `${stats.totalPosts ? (count / stats.totalPosts) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Posts by Type */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-gray-400" />
            Posts by Type
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.postsByType).map(([type, count]) => (
              <div key={type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{type.replace("-", " ")}</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{count}</span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                  <div
                    className={cn("rounded-full h-2 transition-all", TYPE_COLORS[type] ?? "bg-gray-400")}
                    style={{ width: `${stats.totalPosts ? (count / stats.totalPosts) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
            {Object.keys(stats.postsByType).length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No posts yet</p>
            )}
          </div>
        </div>

        {/* Newsletter Status */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Mail className="w-4 h-4 text-gray-400" />
            Newsletters by Status
          </h3>
          <div className="space-y-3">
            {Object.entries(stats.newslettersByStatus).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{status}</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{count}</span>
              </div>
            ))}
            {Object.keys(stats.newslettersByStatus).length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No newsletters yet</p>
            )}
          </div>
        </div>

        {/* Top Users */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            Most Active Users
          </h3>
          <div className="space-y-3">
            {topUsers.map((item, idx) => (
              <div key={item.userId} className="flex items-center gap-3">
                <span className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                  idx === 0 ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400" :
                  idx === 1 ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400" :
                  idx === 2 ? "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400" :
                  "bg-gray-50 dark:bg-gray-800 text-gray-400"
                )}>
                  {idx + 1}
                </span>
                <Avatar src={item.user.image} name={item.user.name} size={28} fallbackClassName="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{item.user.name ?? "Unnamed"}</p>
                </div>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{item.plans} plans</span>
              </div>
            ))}
            {topUsers.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No content plans yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
