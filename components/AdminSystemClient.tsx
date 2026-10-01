"use client";

import { Database, Server, AlertTriangle, HardDrive, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Counts {
  users: number;
  accounts: number;
  subscriptions: number;
  contentPlans: number;
  posts: number;
  newsletters: number;
}

interface RecentError {
  id: string;
  title: string;
  postError: string | null;
  updatedAt: string;
  plan: {
    user: { name: string | null; email: string | null };
  };
}

interface Environment {
  nodeVersion: string;
  nextVersion: string;
  database: string;
}

export default function AdminSystemClient({
  counts,
  recentErrors,
  environment,
}: {
  counts: Counts;
  recentErrors: RecentError[];
  environment: Environment;
}) {
  const dbRecords = [
    { model: "Users", count: counts.users, icon: "👤" },
    { model: "Accounts (OAuth)", count: counts.accounts, icon: "🔑" },
    { model: "Subscriptions", count: counts.subscriptions, icon: "💳" },
    { model: "Content Plans", count: counts.contentPlans, icon: "📋" },
    { model: "Posts", count: counts.posts, icon: "📝" },
    { model: "Newsletters", count: counts.newsletters, icon: "📧" },
  ];

  const totalRecords = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">System Health</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Database records, errors, and environment info</p>
      </div>

      {/* Environment Info */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <Server className="w-4 h-4 text-gray-400" />
          Environment
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="w-9 h-9 bg-green-100 dark:bg-green-900/40 rounded-lg flex items-center justify-center">
              <Server className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Node.js</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{environment.nodeVersion}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Next.js</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{environment.nextVersion}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
            <div className="w-9 h-9 bg-purple-100 dark:bg-purple-900/40 rounded-lg flex items-center justify-center">
              <HardDrive className="w-4 h-4 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Database</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{environment.database}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Database Records */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Database className="w-4 h-4 text-gray-400" />
            Database Records
          </h3>
          <span className="text-sm text-gray-500 dark:text-gray-400">{totalRecords} total</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {dbRecords.map((record) => (
            <div key={record.model} className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm">{record.icon}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{record.model}</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{record.count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Errors */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          Recent Posting Errors
          {recentErrors.length > 0 && (
            <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">
              {recentErrors.length}
            </span>
          )}
        </h3>
        {recentErrors.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">No posting errors found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentErrors.map((err) => (
              <div key={err.id} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-100 dark:border-red-900/40">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate flex-1">{err.title}</p>
                  <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                    {new Date(err.updatedAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  User: {err.plan.user.name ?? err.plan.user.email ?? "Unknown"}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 font-mono bg-red-100 dark:bg-red-900/30 rounded p-2 mt-1 break-all">
                  {err.postError}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
