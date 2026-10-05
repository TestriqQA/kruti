"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BarChart3,
  Users,
  CreditCard,
  FileText,
  Server,
  LineChart,
  LifeBuoy,
  LogOut,
  ArrowLeft,
  Shield,
  Eye,
  EyeOff,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Avatar from "@/components/Avatar";

const adminNavItems = [
  { href: "/admin", label: "Overview", icon: BarChart3, exact: true },
  { href: "/admin/users", label: "Users", icon: Users, exact: false },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard, exact: false },
  { href: "/admin/content", label: "Content Stats", icon: FileText, exact: false },
  { href: "/admin/analytics", label: "Usage & Cost", icon: LineChart, exact: false },
  { href: "/admin/system", label: "System", icon: Server, exact: false },
  { href: "/admin/tickets", label: "Support Tickets", icon: LifeBuoy, exact: false },
];

interface AdminSidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  imagePromptsRevealUntil?: string | null;
}

export default function AdminSidebar({ user, imagePromptsRevealUntil = null }: AdminSidebarProps) {
  const pathname = usePathname();

  // Privacy toggle: reveal user image thumbnails + prompts in analytics for a window.
  const [revealUntil] = useState<string | null>(imagePromptsRevealUntil);
  const [now, setNow] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [daysInput, setDaysInput] = useState("7");
  const [error, setError] = useState<string | null>(null);

  // Tick for the countdown + auto-expiry. Client-only init avoids hydration mismatch.
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const revealMs = revealUntil ? Date.parse(revealUntil) : NaN;
  const active = !Number.isNaN(revealMs) && (now === null || revealMs > now);

  function remainingLabel(): string {
    if (now === null || Number.isNaN(revealMs)) return "Visible";
    const ms = revealMs - now;
    if (ms <= 0) return "Expiring…";
    const totalMin = Math.floor(ms / 60_000);
    const d = Math.floor(totalMin / 1440);
    const h = Math.floor((totalMin % 1440) / 60);
    const m = totalMin % 60;
    if (d > 0) return `${d}d ${h}h left`;
    if (h > 0) return `${h}h ${m}m left`;
    return `${m}m left`;
  }

  async function setReveal(action: "enable" | "disable", days?: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/image-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "enable" ? { action, days } : { action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Something went wrong. Please try again.");
        setBusy(false);
        return;
      }
      setModalOpen(false);
      // Reload so analytics reflects the new privacy state immediately (server-gated).
      window.location.reload();
    } catch {
      setError("Network error. Please try again.");
      setBusy(false);
    }
  }

  function submitDays() {
    const n = Number(daysInput);
    if (!Number.isInteger(n) || n < 1) {
      setError("Enter a whole number of days (1 or more).");
      return;
    }
    setReveal("enable", n);
  }

  function onToggle() {
    if (busy) return;
    if (active) {
      setReveal("disable");
    } else {
      setError(null);
      setDaysInput("7");
      setModalOpen(true);
    }
  }

  return (
    <>
      <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <div className="flex flex-col gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Kruti.io" className="h-16 w-auto" />
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Admin Panel
              </span>
            </div>
          </div>
        </div>

        {/* User */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <Avatar src={user.image} name={user.name} size={36} fallbackClassName="bg-red-600 text-white" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user.name}</p>
              <span className="text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">
                Admin
              </span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {adminNavItems.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active
                    ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200"
                )}
              >
                <item.icon className={cn("w-4 h-4", active ? "text-red-700 dark:text-red-400" : "")} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Privacy: reveal user image thumbnails + prompts in analytics */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {active ? (
                <Eye className="w-4 h-4 text-amber-500 flex-shrink-0" />
              ) : (
                <EyeOff className="w-4 h-4 text-gray-400 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">User media</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                  {active ? remainingLabel() : "Hidden in analytics"}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={active}
              aria-label="Show user images and prompts in analytics"
              disabled={busy}
              onClick={onToggle}
              className={cn(
                "relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-60",
                active ? "bg-amber-500" : "bg-gray-300 dark:bg-gray-700"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
                  active ? "translate-x-4" : "translate-x-0.5"
                )}
              />
            </button>
          </div>
        </div>

        {/* Bottom */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800 space-y-1">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-colors w-full"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200 transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Reveal-window modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => !busy && setModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-xl w-full max-w-sm p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Eye className="w-4 h-4 text-amber-500" /> Show user media
              </h3>
              <button
                onClick={() => !busy && setModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              For how many days should user image thumbnails &amp; prompts be visible in analytics? They hide again
              automatically when the window ends - or turn the toggle off any time to hide them earlier.
            </p>
            <label htmlFor="reveal-days" className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1.5">
              Number of days
            </label>
            <div className="flex items-center gap-2">
              <input
                id="reveal-days"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={daysInput}
                autoFocus
                disabled={busy}
                onChange={(e) => setDaysInput(e.target.value.replace(/[^0-9]/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitDays();
                }}
                className="w-24 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 disabled:opacity-60"
                aria-label="Number of days to show user media"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">day(s)</span>
              <button
                type="button"
                disabled={busy}
                onClick={submitDays}
                className="ml-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium disabled:opacity-60 transition-colors flex items-center gap-2"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {busy ? "Applying…" : "Apply"}
              </button>
            </div>
            {error && <p className="text-xs text-red-600 dark:text-red-400 mt-3">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
