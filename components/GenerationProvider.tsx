"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { POSTS_PER_BATCH } from "@/lib/posting-schedule";

interface GenerationContextValue {
  generating: boolean;
  progress: string[];
  error: string | null;
  startGeneration: (reuseStrategy: boolean) => void;
  cancelGeneration: () => void;
  /** Bulk image generation - an independent run, same survive-navigation rules. */
  imageGenerating: boolean;
  imageStatus: string | null;
  /** Images from the last finished batch, so a mounted list can paint them at once. */
  lastImageBatch: { id: string; imageUrl: string }[] | null;
  startImageGeneration: (postIds: string[]) => void;
  cancelImageGeneration: () => void;
}

const noop = () => {};

const GenerationContext = createContext<GenerationContextValue>({
  generating: false,
  progress: [],
  error: null,
  startGeneration: noop,
  cancelGeneration: noop,
  imageGenerating: false,
  imageStatus: null,
  lastImageBatch: null,
  startImageGeneration: noop,
  cancelImageGeneration: noop,
});

export function useGeneration() {
  return useContext(GenerationContext);
}

/**
 * Owns a post-generation run.
 *
 * This lives in the root providers tree, ABOVE every page, on purpose. Generation
 * takes minutes, and it used to be driven from DashboardClient - so navigating to
 * another page unmounted the component and took the progress log with it, leaving
 * the user with no way to tell whether anything was still happening.
 *
 * Holding the run up here means:
 *  - navigating away does not disturb the in-flight requests,
 *  - returning to the dashboard re-attaches to the same live progress,
 *  - the completion toast reaches the user on whatever page they are on.
 *
 * Only an explicit cancel stops a run (a full page reload also would, which is
 * why we warn about that below).
 */
export function GenerationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const [imageGenerating, setImageGenerating] = useState(false);
  const [imageStatus, setImageStatus] = useState<string | null>(null);
  const [lastImageBatch, setLastImageBatch] = useState<
    { id: string; imageUrl: string }[] | null
  >(null);
  const imageAbortRef = useRef<AbortController | null>(null);

  // Lets the long-running run read the CURRENT route without becoming dependent
  // on it - the user may navigate several times before it finishes.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Closing or reloading the tab DOES kill an in-flight run, so ask first.
  useEffect(() => {
    if (!generating && !imageGenerating) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [generating, imageGenerating]);

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const cancelImageGeneration = useCallback(() => {
    imageAbortRef.current?.abort();
  }, []);

  const startImageGeneration = useCallback(
    async (postIds: string[]) => {
      if (imageAbortRef.current || postIds.length === 0) return; // one batch at a time

      const ac = new AbortController();
      imageAbortRef.current = ac;
      setImageGenerating(true);
      setLastImageBatch(null);
      setImageStatus(
        `Generating images for ${postIds.length} post${postIds.length === 1 ? "" : "s"}...`
      );

      try {
        const res = await fetch("/api/generate/image/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postIds }),
          signal: ac.signal,
        });
        const data = await res.json();
        // "No eligible posts" comes back as 200 with an error field and no total,
        // so treat any error with nothing generated as a failure.
        if (!res.ok || (data.error && !data.generated)) {
          throw new Error(data.error || "Image generation failed");
        }

        const images: { id: string; imageUrl: string }[] = data.images ?? [];
        setLastImageBatch(images.length > 0 ? images : null);

        const summary = `Generated images for ${data.generated} of ${data.total} post(s)${
          data.errors ? ` - ${data.errors}` : ""
        }`;
        setImageStatus(summary);
        toast(summary, "success");
        router.refresh(); // pulls the new images into whatever page is open
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setImageStatus("Image generation cancelled.");
          toast("Image generation cancelled", "info");
        } else {
          console.error(err);
          const message =
            err instanceof Error ? err.message : "Image generation failed";
          setImageStatus(message);
          toast(message, "error");
        }
      } finally {
        imageAbortRef.current = null;
        setImageGenerating(false);
      }
    },
    [router, toast]
  );

  const startGeneration = useCallback(
    async (reuseStrategy: boolean) => {
      if (abortRef.current) return; // a run is already in flight

      const ac = new AbortController();
      abortRef.current = ac;
      setGenerating(true);
      setError(null);
      setProgress([
        reuseStrategy
          ? "Using your current content strategy..."
          : "Building a fresh content strategy...",
      ]);

      try {
        // reuseStrategy: true keeps the current strategy (unless it's 30+ days
        // old); false regenerates it. weekStart is auto-computed by the API.
        const stratRes = await fetch("/api/generate/strategy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reuseStrategy }),
          signal: ac.signal,
        });
        if (!stratRes.ok) {
          const errData = await stratRes.json().catch(() => null);
          throw new Error(
            errData?.error || "Strategy generation failed. Please try again."
          );
        }
        const { plan: newPlan, strategy, reused } = await stratRes.json();

        setProgress((p) => [
          ...p,
          `${reused ? "Using your strategy" : "New strategy ready"}: "${
            strategy.weekTheme ?? "Content theme"
          }"`,
          `Generating ${POSTS_PER_BATCH} posts for your scheduled days...`,
        ]);

        const postsRes = await fetch("/api/generate/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId: newPlan.id }),
          signal: ac.signal,
        });

        if (!postsRes.ok) {
          const errorData = await postsRes.json().catch(() => null);
          if (postsRes.status === 429 && errorData?.error) {
            setProgress((p) => [...p, errorData.error]);
            toast(errorData.error, "error");
            return;
          }
          throw new Error("Posts generation failed");
        }

        const { posts, postsRemaining: remaining } = await postsRes.json();
        const count = posts?.length ?? POSTS_PER_BATCH;

        setProgress((p) => [
          ...p,
          `${count} draft posts created (${remaining} remaining this cycle)`,
        ]);
        // Reaches the user wherever they navigated to.
        toast(`${count} draft posts are ready`, "success");

        // Only pull them to /posts if they actually stayed to watch; yanking
        // someone off the page they walked away to would be rude.
        if (pathnameRef.current === "/dashboard") {
          setProgress((p) => [...p, "Done! Redirecting to your posts..."]);
          setTimeout(() => router.push("/posts"), 1500);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setProgress((p) => [...p, "Generation cancelled."]);
          setError(null);
          toast("Generation cancelled", "info");
        } else {
          console.error(err);
          const message =
            err instanceof Error ? err.message : "Something went wrong";
          setError(message);
          setProgress((p) => [...p, `Error: ${message}`]);
          toast(message, "error");
        }
      } finally {
        abortRef.current = null;
        setTimeout(() => {
          setGenerating(false);
          // Pull the new posts into whatever page the user is looking at now.
          router.refresh();
        }, 2000);
      }
    },
    [router, toast]
  );

  return (
    <GenerationContext.Provider
      value={{
        generating,
        progress,
        error,
        startGeneration,
        cancelGeneration,
        imageGenerating,
        imageStatus,
        lastImageBatch,
        startImageGeneration,
        cancelImageGeneration,
      }}
    >
      {children}
    </GenerationContext.Provider>
  );
}
