"use client";

import { Check } from "lucide-react";
import Avatar from "@/components/Avatar";
import { cn } from "@/lib/utils";

/**
 * The user's avatar with a completion ring around it.
 *
 * The number comes from assessProfile(), the same function that decides whether
 * generation is allowed, so the ring can never disagree with the gate: a full
 * ring means every generate button works, and anything less means at least one
 * of them is refusing. Adding a new required input to onboarding lowers every
 * existing user's ring on the next page load, with no change needed here - the
 * denominator is PROFILE_GAP_KEYS.length.
 */
export default function ProfileCompletionRing({
  src,
  name,
  percent,
  size = 36,
  stroke = 2.5,
  gap = 3,
  className,
}: {
  src?: string | null;
  name?: string | null;
  /** 0-100, from assessProfile(). */
  percent: number;
  /** Avatar diameter; the ring is drawn outside it. */
  size?: number;
  stroke?: number;
  /** Space between the avatar edge and the ring. */
  gap?: number;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)));
  const complete = pct >= 100;

  const box = size + (stroke + gap) * 2;
  const radius = (box - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // A 0% ring still shows the track, so the control never looks broken.
  const offset = circumference * (1 - pct / 100);

  return (
    <div
      className={cn("relative flex-shrink-0", className)}
      style={{ width: box, height: box }}
      title={complete ? "Profile complete" : `Profile ${pct}% complete`}
    >
      <svg
        width={box}
        height={box}
        viewBox={`0 0 ${box} ${box}`}
        className="absolute inset-0 -rotate-90"
        role="img"
        aria-label={complete ? "Profile complete" : `Profile ${pct} percent complete`}
      >
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke="currentColor"
          className="text-slate-200 dark:text-white/10"
        />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke="currentColor"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            "transition-[stroke-dashoffset] duration-500",
            complete ? "text-emerald-500" : "text-blue-600 dark:text-blue-500"
          )}
        />
      </svg>

      <div
        className="absolute"
        style={{ top: stroke + gap, left: stroke + gap, width: size, height: size }}
      >
        <Avatar src={src} name={name} size={size} fallbackClassName="bg-blue-600 text-white" />
      </div>

      {complete && (
        <span
          aria-hidden="true"
          className="absolute -bottom-0.5 -right-0.5 flex h-[14px] w-[14px] items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white dark:ring-[#0D131F]"
        >
          <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
        </span>
      )}
    </div>
  );
}
