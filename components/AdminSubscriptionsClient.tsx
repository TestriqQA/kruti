"use client";

import { useState, useCallback } from "react";
import { CreditCard, Clock, AlertTriangle, XCircle, Filter, Plus } from "lucide-react";
import Avatar from "@/components/Avatar";
import { cn } from "@/lib/utils";

interface SubUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface SubscriptionRow {
  id: string;
  userId: string;
  status: string;
  trialEnd: string | Date | null;
  currentPeriodEnd: string | Date | null;
  razorpayCustomerId: string | null;
  razorpaySubscriptionId: string | null;
  currency: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  user: SubUser;
}

const STATUS_TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active", color: "text-green-600" },
  { key: "trialing", label: "Trialing", color: "text-amber-600" },
  { key: "past_due", label: "Past Due", color: "text-red-600" },
  { key: "canceled", label: "Canceled", color: "text-gray-500" },
];

export default function AdminSubscriptionsClient({
  initialSubscriptions,
  statusCounts,
}: {
  initialSubscriptions: SubscriptionRow[];
  statusCounts: Record<string, number>;
}) {
  const [subs, setSubs] = useState<SubscriptionRow[]>(initialSubscriptions);
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchSubs = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const url = status && status !== "all"
        ? `/api/admin/subscriptions?status=${status}`
        : `/api/admin/subscriptions`;
      const res = await fetch(url);
      const data = await res.json();
      setSubs(data.subscriptions);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    fetchSubs(tab);
  }

  async function handleStatusChange(subId: string, newStatus: string) {
    const confirmed = window.confirm(`Change subscription status to "${newStatus}"?`);
    if (!confirmed) return;
    setActionLoading(subId);
    try {
      await fetch(`/api/admin/subscriptions/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchSubs(activeTab);
    } catch (err) {
      console.error("Status change failed:", err);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleExtendTrial(subId: string, days: number) {
    setActionLoading(subId);
    try {
      await fetch(`/api/admin/subscriptions/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extendTrial: days }),
      });
      fetchSubs(activeTab);
    } catch (err) {
      console.error("Extend trial failed:", err);
    } finally {
      setActionLoading(null);
    }
  }

  const totalSubs = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      active: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
      trialing: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
      past_due: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
      canceled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
      unpaid: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
    };
    return (
      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", colors[status] ?? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400")}>
        {status.replace("_", " ")}
      </span>
    );
  };

  const formatDate = (d: string | Date | null) => {
    if (!d) return "-";
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const isExpired = (d: string | Date | null) => {
    if (!d) return false;
    return new Date(d) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Subscriptions</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">{totalSubs} total subscriptions</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <CreditCard className="w-5 h-5 text-green-600 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{statusCounts["active"] ?? 0}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Active</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <Clock className="w-5 h-5 text-amber-600 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{statusCounts["trialing"] ?? 0}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Trialing</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <AlertTriangle className="w-5 h-5 text-red-600 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{statusCounts["past_due"] ?? 0}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Past Due</p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <XCircle className="w-5 h-5 text-gray-400 mb-2" />
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{statusCounts["canceled"] ?? 0}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Canceled</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1 w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              activeTab === tab.key
                ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            {tab.label}
            {tab.key !== "all" && statusCounts[tab.key] ? (
              <span className="ml-1.5 text-xs text-gray-400">({statusCounts[tab.key]})</span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">User</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Trial End</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Period End</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Razorpay</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
              </tr>
            </thead>
            <tbody className={cn("divide-y divide-gray-50 dark:divide-gray-800", loading && "opacity-50")}>
              {subs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    No subscriptions found
                  </td>
                </tr>
              ) : (
                subs.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={sub.user.image} name={sub.user.name} size={32} fallbackClassName="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{sub.user.name ?? "Unnamed"}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{sub.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{statusBadge(sub.status)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs", isExpired(sub.trialEnd) ? "text-red-500" : "text-gray-500")}>
                        {formatDate(sub.trialEnd)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs", isExpired(sub.currentPeriodEnd) ? "text-red-500" : "text-gray-500")}>
                        {formatDate(sub.currentPeriodEnd)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-gray-400 font-mono">
                        {sub.razorpaySubscriptionId ? sub.razorpaySubscriptionId.slice(0, 14) + "\u2026" : "-"}
                      </span>
                      {sub.currency && (
                        <span className="ml-1 text-[10px] text-gray-400 dark:text-gray-500">{sub.currency}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Status change buttons */}
                        {sub.status !== "active" && (
                          <button
                            onClick={() => handleStatusChange(sub.id, "active")}
                            disabled={actionLoading === sub.id}
                            className="px-2 py-1 text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors disabled:opacity-50"
                          >
                            Activate
                          </button>
                        )}
                        {sub.status !== "canceled" && (
                          <button
                            onClick={() => handleStatusChange(sub.id, "canceled")}
                            disabled={actionLoading === sub.id}
                            className="px-2 py-1 text-xs bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                        {/* Extend trial dropdown */}
                        <div className="relative group">
                          <button
                            disabled={actionLoading === sub.id}
                            className="px-2 py-1 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors disabled:opacity-50 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> Trial
                          </button>
                          <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-20 py-1 w-36 hidden group-hover:block">
                            {[7, 14, 30].map((days) => (
                              <button
                                key={days}
                                onClick={() => handleExtendTrial(sub.id, days)}
                                className="block w-full px-4 py-2 text-xs text-left hover:bg-gray-50 dark:hover:bg-gray-800 dark:text-gray-300"
                              >
                                +{days} days
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
