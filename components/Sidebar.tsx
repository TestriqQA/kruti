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
  LogOut,
  Shield,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Avatar from "@/components/Avatar";
import { useTheme } from "@/components/ThemeProvider";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Content Calendar", icon: Calendar },
  { href: "/posts", label: "Posts", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/newsletter", label: "Newsletter", icon: Mail },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  };
}

export default function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="w-64 bg-white dark:bg-[#0D131F] border-r border-slate-200 dark:border-white/10 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-slate-100 dark:border-white/10">
        <Link href="/dashboard" className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Kruti.io" className="h-16 w-auto" />
        </Link>
      </div>

      {/* User */}
      <div className="p-4 border-b border-slate-100 dark:border-white/10">
        <div className="flex items-center gap-3">
          <Avatar src={user.image} name={user.name} size={36} fallbackClassName="bg-blue-600 text-white" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user.name}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <item.icon className={cn("w-4 h-4", active ? "text-blue-600 dark:text-blue-400" : "")} />
              {item.label}
            </Link>
          );
        })}

        {/* Admin link */}
        {user.role === "admin" && (
          <>
            <div className="my-2 border-t border-slate-100 dark:border-white/10" />
            <Link
              href="/admin"
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                pathname.startsWith("/admin")
                  ? "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <Shield className={cn("w-4 h-4", pathname.startsWith("/admin") ? "text-red-700 dark:text-red-400" : "")} />
              Admin Panel
            </Link>
          </>
        )}
      </nav>

      {/* Bottom section: Dark mode + Sign out */}
      <div className="p-3 border-t border-slate-100 dark:border-white/10 space-y-1">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-colors w-full"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/" })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-colors w-full"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
