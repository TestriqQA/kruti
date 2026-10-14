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
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ProfileCompletionRing from "@/components/ProfileCompletionRing";
import { useTheme } from "@/components/ThemeProvider";
import { SectionLabel } from "@/components/ui/primitives";

/**
 * Navigation, grouped by what the user came to do rather than listed flat.
 *
 * A flat list of seven makes every destination look equally likely, so the two
 * that are used constantly (the calendar and the post list) sit at the same
 * weight as the one opened twice a year. Grouping gives the eye somewhere to
 * land, and keeps "where do I go to publish" separate from "where do I go to
 * change my plan".
 */
type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Survives the subscription paywall - see SubscriptionLock. */
  allowWhenLocked?: boolean;
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/posts", label: "Posts", icon: FileText },
      { href: "/calendar", label: "Calendar", icon: Calendar },
    ],
  },
  {
    label: "Grow",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/newsletter", label: "Newsletter", icon: Mail },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/settings", label: "Settings", icon: Settings },
      // A user whose trial ended is exactly the user who needs to raise a
      // ticket, so this link must survive the paywall lock.
      { href: "/support", label: "Help & Support", icon: LifeBuoy, allowWhenLocked: true },
    ],
  },
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

export default function Sidebar({
  user,
  supportUnread = 0,
  profileCompletion = 100,
}: SidebarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <aside className="flex w-[244px] flex-shrink-0 flex-col border-r border-line bg-surface">
      {/* Brand */}
      <div className="flex h-16 flex-shrink-0 items-center px-5">
        <Link href="/dashboard" className="flex items-center rounded-control focus-ring">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Kruti.io" className="h-11 w-auto" />
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group, i) => (
          <div key={group.label} className={cn(i > 0 && "mt-6")}>
            <SectionLabel className="px-3 pb-2">{group.label}</SectionLabel>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    {...(item.allowWhenLocked ? { "data-allow-when-locked": "" } : {})}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-control px-3 py-2 text-[13px] font-medium transition-colors focus-ring",
                      active
                        ? "nav-active-bar bg-accent-soft text-accent"
                        : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
                    )}
                  >
                    <item.icon className="h-[17px] w-[17px] flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.href === "/support" && supportUnread > 0 && (
                      <span className="tabular ml-auto min-w-[18px] rounded-full bg-accent px-1.5 py-0.5 text-center text-[10px] font-bold text-accent-ink">
                        {supportUnread}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {user.role === "admin" && (
          <div className="mt-6">
            <SectionLabel className="px-3 pb-2">Internal</SectionLabel>
            <Link
              href="/admin"
              className={cn(
                "relative flex items-center gap-2.5 rounded-control px-3 py-2 text-[13px] font-medium transition-colors focus-ring",
                pathname.startsWith("/admin")
                  ? "nav-active-bar bg-danger-soft text-danger"
                  : "text-ink-muted hover:bg-surface-sunken hover:text-ink"
              )}
            >
              <Shield className="h-[17px] w-[17px] flex-shrink-0" />
              Admin Panel
            </Link>
          </div>
        )}
      </nav>

      {/* Account block. Moved to the bottom: the user's own face is the one
          thing they never need to find, so it should not occupy the position
          the eye checks first. */}
      <div className="flex-shrink-0 border-t border-line p-3">
        <Link
          href={profileCompletion >= 100 ? "/settings" : "/onboarding"}
          className="flex items-center gap-2.5 rounded-control p-2 transition-colors hover:bg-surface-sunken focus-ring"
        >
          <ProfileCompletionRing
            src={user.image}
            name={user.name}
            percent={profileCompletion}
            size={32}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink">{user.name}</p>
            {profileCompletion >= 100 ? (
              <p className="truncate text-[11px] text-ink-subtle">{user.email}</p>
            ) : (
              <p className="truncate text-[11px] font-semibold text-accent">
                Profile {profileCompletion}% &middot; finish it
              </p>
            )}
          </div>
        </Link>

        <div className="mt-1 flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="flex flex-1 items-center gap-2 rounded-control px-3 py-2 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink focus-ring"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          {/* Exempt from the subscription lock: a locked user must always be
              able to leave. See SubscriptionLock / ALLOW_WHEN_LOCKED. */}
          <button
            data-allow-when-locked=""
            onClick={() => signOut({ callbackUrl: "/" })}
            aria-label="Sign out"
            title="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-control text-ink-subtle transition-colors hover:bg-surface-sunken hover:text-ink focus-ring"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
