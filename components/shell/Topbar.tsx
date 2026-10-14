"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, LifeBuoy } from "lucide-react";
import { cn } from "@/lib/utils";
import { OPEN_PALETTE_EVENT } from "@/components/shell/CommandPalette";

/**
 * Thin persistent bar above every dashboard page.
 *
 * It exists for two reasons. It tells the user where they are without each
 * page having to render its own orientation, and it puts the command palette
 * somewhere visible - a shortcut nobody can see is a shortcut nobody uses.
 */

const TITLES: { match: (p: string) => boolean; label: string }[] = [
  { match: (p) => p === "/dashboard", label: "Overview" },
  { match: (p) => p.startsWith("/posts/"), label: "Post editor" },
  { match: (p) => p.startsWith("/posts"), label: "Posts" },
  { match: (p) => p.startsWith("/calendar"), label: "Calendar" },
  { match: (p) => p.startsWith("/analytics"), label: "Analytics" },
  { match: (p) => p.startsWith("/newsletter"), label: "Newsletter" },
  { match: (p) => p.startsWith("/settings"), label: "Settings" },
  { match: (p) => p.startsWith("/support"), label: "Help & Support" },
];

export default function Topbar({ supportUnread = 0 }: { supportUnread?: number }) {
  const pathname = usePathname();
  const title = TITLES.find((t) => t.match(pathname))?.label ?? "Kruti.io";

  // Mac gets the glyph it expects; everyone else gets Ctrl.
  const isMac =
    typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || "");

  function openPalette() {
    window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 flex-shrink-0 items-center gap-4 border-b border-line bg-app/80 px-7 backdrop-blur-md">
      <p className="font-display text-sm font-semibold text-ink">{title}</p>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={openPalette}
          className={cn(
            "group flex h-9 w-[260px] items-center gap-2.5 rounded-control border border-line bg-surface px-3",
            "text-left text-[13px] text-ink-subtle transition-colors hover:border-line-strong focus-ring"
          )}
        >
          <Search className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="flex-1 truncate">Search or jump to...</span>
          <kbd className="flex-shrink-0 rounded border border-line bg-surface-sunken px-1.5 py-0.5 text-[10px] font-semibold">
            {isMac ? "⌘" : "Ctrl"} K
          </kbd>
        </button>

        <Link
          href="/support"
          data-allow-when-locked=""
          aria-label="Help and support"
          title="Help and support"
          className="relative flex h-9 w-9 items-center justify-center rounded-control border border-line bg-surface text-ink-subtle transition-colors hover:border-line-strong hover:text-ink focus-ring"
        >
          <LifeBuoy className="h-4 w-4" />
          {supportUnread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink ring-2 ring-app">
              {supportUnread}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
