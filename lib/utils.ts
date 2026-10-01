import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInTimeZone } from "date-fns-tz";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string, timezone?: string): string {
  if (timezone) {
    return formatInTimeZone(new Date(date), timezone, "MMM d, yyyy");
  }
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getWeekDates(weekNumber: number, year: number, month: number): Date[] {
  const firstDay = new Date(year, month - 1, 1);
  const dayOfWeek = firstDay.getDay();
  const startOffset = (weekNumber - 1) * 7 - dayOfWeek;
  const weekStart = new Date(year, month - 1, 1 + startOffset);

  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
}

// These drive every post-type/status capsule AND the post thumbnail placeholder,
// so each needs a dark counterpart - a bare bg-*-100 renders as a bright chip on a
// dark surface. Dark side uses a translucent tint of the same hue so it reads as
// the same colour family without lighting up the page.
export function getPostTypeColor(type: string): string {
  const colors: Record<string, string> = {
    "thought-leadership":
      "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/30",
    tips: "bg-green-100 text-green-800 border-green-200 dark:bg-green-500/15 dark:text-green-300 dark:border-green-500/30",
    story:
      "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:border-purple-500/30",
    question:
      "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/30",
    listicle:
      "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:border-pink-500/30",
  };
  return (
    colors[type] ||
    "bg-gray-100 text-gray-800 border-gray-200 dark:bg-white/[0.08] dark:text-slate-300 dark:border-white/15"
  );
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-600 dark:bg-white/[0.08] dark:text-slate-400",
    ready: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300",
    published: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  };
  return (
    colors[status] || "bg-gray-100 text-gray-600 dark:bg-white/[0.08] dark:text-slate-400"
  );
}
