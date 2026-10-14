"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Calendar,
  FileText,
  BarChart3,
  Mail,
  Settings,
  LifeBuoy,
  LogOut,
  Shield,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ProfileCompletionRing from "@/components/ProfileCompletionRing";
import { useTheme } from "@/components/ThemeProvider";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Content Calendar", icon: Calendar },
  { href: "/posts", label: "Posts", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/newsletter", label: "Newsletter", icon: Mail },
  { href: "/settings", label: "Settings", icon: Settings },
  // allowWhenLocked: a user whose trial ended is exactly the user who needs to
  // raise a ticket, so this link must survive the paywall lock.
  { href: "/support", label: "Help & Support", icon: LifeBuoy, allowWhenLocked: true },
];

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  };
  /** Unread, unexpired admin replies - badged on the Support link. */
  supportUnread?: number;
  /** 0-100 from assessProfile(), drawn as a ring around the avatar. */
  profileCompletion?: number;
}

export default function Sidebar({ user, supportUnread = 0, profileCompletion = 100 }: SidebarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="flex w-[232px] flex-shrink-0 flex-col border-r border-edge bg-card">
      {/* Logo */}
      <div className="flex h-16 flex-shrink-0 items-center border-b border-edge-soft px-5">
        <Link href="/dashboard" className="ring-focus flex items-center rounded-control">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Kruti.io" className="h-10 w-auto" />
        </Link>
      </div>

      {/* User */}
      <div className="border-b border-edge-soft px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-control px-2 py-1.5">
          <ProfileCompletionRing
            src={user.image}
            name={user.name}
            percent={profileCompletion}
            size={36}
          />
          <div className="flex-1 min-w-0">
            <p className="truncate text-[13px] font-semibold text-text">{user.name}</p>
            <p className="truncate text-[11.5px] text-text-3">{user.email}</p>
            {/* The ring alone shows there is something left; this says how much
                and goes straight to the screen that fixes it. */}
            {profileCompletion >= 100 ? (
              <p className="mt-0.5 text-[11px] font-semibold text-ok">Profile complete</p>
            ) : (
              <Link
                href="/onboarding"
                className="mt-0.5 inline-block text-[11px] font-semibold text-brand hover:underline"
              >
                Profile {profileCompletion}% - finish it
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {navItems.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              {...(item.allowWhenLocked ? { "data-allow-when-locked": "" } : {})}
              className={cn(
                "ring-focus relative flex h-9 items-center gap-2.5 rounded-control px-3 text-[13px] font-medium transition-colors",
                active
                  ? "bg-brand-tint text-brand"
                  : "text-text-2 hover:bg-card-muted hover:text-text"
              )}
            >
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand"
                />
              )}
              <item.icon className="h-[17px] w-[17px] flex-shrink-0" />
              {item.label}
              {item.href === "/support" && supportUnread > 0 && (
                <span className="nums ml-auto min-w-[18px] rounded-full bg-brand px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
                  {supportUnread}
                </span>
              )}
            </Link>
          );
        })}

        {/* Admin link */}
        {user.role === "admin" && (
          <>
            <div className="my-2 border-t border-edge-soft" />
            <Link
              href="/admin"
              className={cn(
                "ring-focus flex h-9 items-center gap-2.5 rounded-control px-3 text-[13px] font-medium transition-colors",
                pathname.startsWith("/admin")
                  ? "bg-bad-tint text-bad"
                  : "text-text-2 hover:bg-card-muted hover:text-text"
              )}
            >
              <Shield className="h-[17px] w-[17px] flex-shrink-0" />
              Admin Panel
            </Link>
          </>
        )}
      </nav>

      {/* Bottom section: Dark mode + Sign out */}
      <div className="flex-shrink-0 space-y-0.5 border-t border-edge-soft p-3">
        <button
          onClick={toggleTheme}
          className="ring-focus flex h-9 w-full items-center gap-2.5 rounded-control px-3 text-[13px] font-medium text-text-2 transition-colors hover:bg-card-muted hover:text-text"
        >
          {theme === "dark" ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        {/* Exempt from the subscription lock: a locked user must always be able
            to leave. See SubscriptionLock / ALLOW_WHEN_LOCKED. */}
        <button
          data-allow-when-locked=""
          onClick={() => signOut({ callbackUrl: "/" })}
          className="ring-focus flex h-9 w-full items-center gap-2.5 rounded-control px-3 text-[13px] font-medium text-text-2 transition-colors hover:bg-card-muted hover:text-text"
        >
          <LogOut className="h-[17px] w-[17px]" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
