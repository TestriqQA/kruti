"use client";

import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Post media that degrades gracefully. Blob images are removed once a post passes its
 * retention window (and can go missing for other reasons - a failed upload, a manual
 * blob delete), while the DB may still hold the URL. A plain <img> would then show the
 * browser's broken-image icon, so this swaps in a designed "image no longer available"
 * tile on any load error.
 *
 * Deliberately NOT next/image: the optimizer fetches the source server-side, so a dead
 * blob fails before any client-side onError can run - the same reasoning as Avatar.tsx.
 *
 * `className` is applied to BOTH the <img> and the fallback so absolute-fill layouts
 * and fixed-size thumbnails both work, and overlay badges keep sitting correctly.
 */
export default function PostImage({
  src,
  alt = "",
  className,
  iconClassName = "w-5 h-5",
  label,
  loading,
  title,
}: {
  src?: string | null;
  alt?: string;
  className?: string;
  iconClassName?: string;
  /** Optional caption, for surfaces big enough to show it. */
  label?: string;
  loading?: "lazy" | "eager";
  title?: string;
}) {
  const [failed, setFailed] = useState(false);

  // Reset when the URL changes (carousel prev/next, history restore) so one dead
  // slide does not poison every slide shown after it.
  useEffect(() => setFailed(false), [src]);

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading={loading}
        title={title}
        onError={() => setFailed(true)}
        className={className}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1 bg-card-muted text-text-3",
        className
      )}
      role="img"
      aria-label="Image no longer available"
      title="Image no longer available"
    >
      <ImageOff className={iconClassName} />
      {label && <span className="px-2 text-center text-[10px] leading-tight">{label}</span>}
    </div>
  );
}
