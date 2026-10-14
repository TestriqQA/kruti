"use client";

import { useEffect, useState } from "react";
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
  Loader2,
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
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Escape closes the confirmation, but not while the sign-out is already in
  // flight - dismissing it then would leave the page looking signed in.
  useEffect(() => {
    if (!confirmSignOut) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !signingOut) setConfirmSignOut(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmSignOut, signingOut]);

  return (
    <aside className="flex w-[288px] flex-shrink-0 flex-col border-r border-edge bg-card">
      {/* Logo */}
      <div className="flex h-20 flex-shrink-0 items-center justify-center border-b border-edge-soft px-4">
        <Link href="/dashboard" className="ring-focus flex items-center rounded-control">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* Width-driven so the mark scales with the sidebar rather than being
              pinned to a height. */}
          <img src="/logo.png" alt="Kruti.io" className="h-auto w-[168px]" />
        </Link>
      </div>

      {/* User */}
      <div className="border-b border-edge-soft px-3 py-2.5">
        <div className="flex items-center gap-3 rounded-control px-2 py-1">
          <ProfileCompletionRing
            src={user.image}
            name={user.name}
            percent={profileCompletion}
            size={44}
          />
          <div className="flex-1 min-w-0">
            <p className="truncate text-[14.5px] font-semibold text-text">{user.name}</p>
            <p className="truncate text-[12.5px] text-text-3">{user.email}</p>
            {/* The ring alone shows there is something left; this says how much
                and goes straight to the screen that fixes it. */}
            {profileCompletion >= 100 ? (
              <p className="mt-0.5 text-[11.5px] font-semibold text-ok">Profile complete</p>
            ) : (
              <Link
                href="/onboarding"
                className="mt-0.5 inline-block text-[11.5px] font-semibold text-brand hover:underline"
              >
                Profile {profileCompletion}% - finish it
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
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
                "ring-focus relative flex h-10 items-center gap-3 rounded-control px-3 text-[13.5px] font-medium transition-colors",
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
                "ring-focus flex h-10 items-center gap-3 rounded-control px-3 text-[13.5px] font-medium transition-colors",
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
      <div className="flex-shrink-0 space-y-1 border-t border-edge-soft px-3 py-2.5">
        <button
          onClick={toggleTheme}
          className="ring-focus flex h-10 w-full items-center gap-3 rounded-control px-3 text-[13.5px] font-medium text-text-2 transition-colors hover:bg-card-muted hover:text-text"
        >
          {theme === "dark" ? <Sun className="h-[17px] w-[17px]" /> : <Moon className="h-[17px] w-[17px]" />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        {/* Exempt from the subscription lock: a locked user must always be able
            to leave. See SubscriptionLock / ALLOW_WHEN_LOCKED. */}
        <button
          data-allow-when-locked=""
          onClick={() => setConfirmSignOut(true)}
          className="ring-focus flex h-10 w-full items-center gap-3 rounded-control px-3 text-[13.5px] font-medium text-text-2 transition-colors hover:bg-card-muted hover:text-text"
        >
          <LogOut className="h-[17px] w-[17px]" />
          Sign Out
        </button>
      </div>

      {/* Signing out took one click and there is no undo - LinkedIn is the only
          way back in. Carries the lock exemption too, or a locked user could
          open this and not be able to answer it. */}
      {confirmSignOut && (
        <div
          data-allow-when-locked=""
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !signingOut && setConfirmSignOut(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-sm space-y-4 rounded-card bg-card p-6 shadow-lift-lg"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="signout-title"
          >
            <h3 id="signout-title" className="font-display text-lg font-bold text-text">
              Sign out of Kruti?
            </h3>
            <p className="text-sm leading-relaxed text-text-2">
              Anything you have saved stays where it is. You will need to sign in with
              LinkedIn again to get back in.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmSignOut(false)}
                className="ring-focus h-9 rounded-control border border-edge px-4 text-sm font-medium text-text-2 transition-colors hover:border-brand-edge hover:text-text"
              >
                Stay signed in
              </button>
              <button
                onClick={() => {
                  setSigningOut(true);
                  signOut({ callbackUrl: "/" });
                }}
                disabled={signingOut}
                className="ring-focus flex h-9 items-center gap-2 rounded-control bg-bad px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-70"
              >
                {signingOut && <Loader2 className="h-4 w-4 animate-spin" />}
                {signingOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
