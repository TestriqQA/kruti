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
import PipelineModal, {
  type PipelineState,
  type StepStatus,
} from "@/components/PipelineModal";

type StreamEvent = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

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
  /** Live pipeline detail, and control over the popup that shows it. */
  postPipeline: PipelineState | null;
  imagePipeline: PipelineState | null;
  showPipeline: (kind: "posts" | "images") => void;
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
  postPipeline: null,
  imagePipeline: null,
  showPipeline: noop,
});

export function useGeneration() {
  return useContext(GenerationContext);
}

// ── Labels ───────────────────────────────────────────────────────────────────
const CHECK_LABELS: Record<string, string> = {
  auth: "Signed in",
  subscription: "Subscription active",
  ratelimit: "Rate limit",
  user: "Profile loaded",
  plan: "Content plan",
  schedule: "Posting schedule",
  quota: "Monthly quota",
  input: "Selection valid",
  eligible: "Eligible posts",
};

const STAGE_LABELS: Record<string, string> = {
  startdate: "Choosing the start date",
  history: "Reading previous weeks",
  strategy: "Content strategy",
  "plan-save": "Saving the plan",
  theme: "Strategy loaded",
  research: "Web research",
  write: "Writing the posts",
  schedule: "Assigning dates",
  "posts-save": "Saving the posts",
};

// ── Pipeline state helpers (pure) ────────────────────────────────────────────
function emptyPipeline(kind: "posts" | "images"): PipelineState {
  return {
    kind,
    title: kind === "posts" ? "Generating posts" : "Generating images",
    running: true,
    done: false,
    checks: [],
    stages: [],
    items: [],
    itemsLabel: kind === "posts" ? "Posts created" : "Images",
  };
}

function upsertCheck(
  s: PipelineState,
  key: string,
  status: StepStatus,
  detail?: string
): PipelineState {
  const label = CHECK_LABELS[key] ?? key;
  const found = s.checks.some((c) => c.key === key);
  return {
    ...s,
    checks: found
      ? s.checks.map((c) => (c.key === key ? { ...c, status, detail: detail ?? c.detail } : c))
      : [...s.checks, { key, label, status, detail }],
  };
}

function upsertStage(
  s: PipelineState,
  key: string,
  status: StepStatus,
  detail?: string,
  lines?: string[],
  prompt?: string
): PipelineState {
  const label = STAGE_LABELS[key] ?? key;
  const found = s.stages.some((st) => st.key === key);
  return {
    ...s,
    stages: found
      ? s.stages.map((st) =>
          st.key === key
            ? {
                ...st,
                status,
                detail: detail ?? st.detail,
                lines: lines ?? st.lines,
                // A later event (e.g. "done") carries no prompt - keep the one
                // captured when the stage started.
                prompt: prompt ?? st.prompt,
              }
            : st
        )
      : [...s.stages, { key, label, status, detail, lines, prompt }],
  };
}

function upsertItem(
  s: PipelineState,
  index: number,
  patch: Partial<PipelineState["items"][number]>
): PipelineState {
  const found = s.items.some((i) => i.index === index);
  return {
    ...s,
    items: found
      ? s.items.map((i) => (i.index === index ? { ...i, ...patch } : i))
      : [...s.items, { index, title: "", status: "pending", ...patch }],
  };
}

const asStatus = (raw: unknown): StepStatus => {
  if (raw === "done" || raw === "error" || raw === "skipped" || raw === "running") return raw;
  if (raw === "start" || raw === "brief" || raw === "rendering") return "running";
  return "pending";
};

// ── Event reducers ───────────────────────────────────────────────────────────
function applyPostEvent(
  s: PipelineState,
  ev: StreamEvent,
  phase: "strategy" | "posts"
): PipelineState {
  switch (ev.type) {
    case "preflight": {
      let detail: string | undefined = ev.message;
      if (ev.key === "schedule" && Array.isArray(ev.days)) {
        detail = `${ev.days.join(", ")} at ${ev.time}`;
      } else if (ev.key === "quota" && ev.status === "done") {
        detail = `${ev.used}/${ev.limit} used this cycle`;
      }
      return upsertCheck(s, ev.key, asStatus(ev.status), detail);
    }
    case "startdate":
      return upsertStage(s, "startdate", asStatus(ev.status), ev.label);
    case "history":
      return upsertStage(
        s,
        "history",
        asStatus(ev.status),
        ev.status === "done" ? `${ev.count} previous plan(s)` : undefined,
        Array.isArray(ev.themes) ? ev.themes.filter(Boolean) : undefined
      );
    case "strategy": {
      if (phase === "posts") {
        return upsertStage(
          s,
          "theme",
          "done",
          ev.theme ?? undefined,
          [ev.focus ? `Focus: ${ev.focus}` : "", Array.isArray(ev.postTypes) && ev.postTypes.length ? `Types: ${ev.postTypes.join(", ")}` : ""].filter(Boolean)
        );
      }
      if (ev.status === "reused") {
        return upsertStage(s, "strategy", "done", `Reused (${ev.ageDays}d old): ${ev.theme ?? ""}`);
      }
      if (ev.status === "done") {
        return upsertStage(s, "strategy", "done", ev.theme ?? undefined, [
          ev.focus ? `Focus: ${ev.focus}` : "",
          ev.pillars ? `${ev.pillars} content pillars` : "",
          Array.isArray(ev.postTypes) && ev.postTypes.length ? `Types: ${ev.postTypes.join(", ")}` : "",
        ].filter(Boolean));
      }
      return upsertStage(s, "strategy", "running", ev.message, undefined, ev.prompt);
    }
    case "research":
      return upsertStage(
        s,
        "research",
        asStatus(ev.status),
        ev.status === "done"
          ? `${ev.chars} chars of grounding`
          : ev.status === "skipped"
          ? ev.message
          : ev.message,
        ev.excerpt ? [ev.excerpt] : undefined,
        ev.prompt
      );
    case "write":
      return upsertStage(
        s,
        "write",
        asStatus(ev.status),
        ev.status === "done" ? `${ev.count} posts written` : `Writing ${ev.count} posts`,
        Array.isArray(ev.titles) ? ev.titles : Array.isArray(ev.styles) ? [`Styles: ${ev.styles.join(", ")}`] : undefined,
        ev.prompt
      );
    case "schedule": {
      if (ev.status !== "done") return upsertStage(s, "schedule", "running");
      const slotLines = Array.isArray(ev.slots) ? ev.slots.map((x: StreamEvent) => x.label) : [];
      const skipped = Array.isArray(ev.skippedDays) && ev.skippedDays.length
        ? [`Skipped ${ev.skippedDays.length} day(s) that already have posts`]
        : [];
      return upsertStage(s, "schedule", "done", `${slotLines.length} date(s) chosen`, [
        ...slotLines,
        ...skipped,
      ]);
    }
    case "save":
      return upsertStage(
        s,
        phase === "strategy" ? "plan-save" : "posts-save",
        asStatus(ev.status),
        ev.status === "done" && ev.count ? `${ev.count} saved` : undefined
      );
    case "post":
      return upsertItem(s, ev.index, {
        title: ev.title,
        status: "done",
        detail: [ev.scheduledLabel, ev.style || ev.postType].filter(Boolean).join(" · "),
      });
    default:
      return s;
  }
}

function applyImageEvent(s: PipelineState, ev: StreamEvent): PipelineState {
  switch (ev.type) {
    case "preflight": {
      let detail: string | undefined = ev.message;
      if (ev.key === "eligible" && ev.status === "done") {
        detail = `${ev.eligible} eligible${ev.skipped ? `, ${ev.skipped} skipped` : ""}`;
      } else if (ev.key === "input" && ev.status === "done") {
        detail = `${ev.requested} selected`;
      }
      return upsertCheck(s, ev.key, asStatus(ev.status), detail);
    }
    case "queue": {
      let next = s;
      for (const p of ev.posts ?? []) {
        next = upsertItem(next, p.index, { title: p.title, status: "pending", detail: "Queued" });
      }
      return next;
    }
    case "post": {
      const detail =
        ev.status === "brief"
          ? `Briefing (${ev.category ?? ""})`
          : ev.status === "rendering"
          ? ev.headline
            ? `Rendering - ${ev.headline}`
            : "Rendering"
          : ev.status === "error"
          ? ev.message
          : "Image ready";
      return upsertItem(s, ev.index, {
        title: ev.title,
        status: asStatus(ev.status),
        detail,
        url: ev.url,
        ...(ev.prompt ? { prompt: ev.prompt } : {}),
      });
    }
    default:
      return s;
  }
}

// ── Stream reader ────────────────────────────────────────────────────────────
async function consumeNdjson(res: Response, onEvent: (ev: StreamEvent) => void) {
  if (!res.body) throw new Error("No response body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        onEvent(JSON.parse(line) as StreamEvent);
      } catch {
        /* skip a malformed line */
      }
    }
  }
  const tail = buffer.trim();
  if (tail) {
    try {
      onEvent(JSON.parse(tail) as StreamEvent);
    } catch {
      /* ignore */
    }
  }
}

/**
 * Owns the long-running generation runs (posts and bulk images).
 *
 * It lives in the root providers tree, ABOVE every page, on purpose. Generation
 * takes minutes, and it used to be driven from the page component - so navigating
 * away unmounted it and took the progress with it. Holding the runs up here means
 * navigating away does not disturb them, coming back re-attaches to the same live
 * state, and the completion toast reaches the user wherever they are.
 *
 * Both routes stream NDJSON, so the pipeline popup can show every stage as it
 * happens rather than a bare spinner.
 */
export function GenerationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [postPipeline, setPostPipeline] = useState<PipelineState | null>(null);

  const [imageGenerating, setImageGenerating] = useState(false);
  const [imageStatus, setImageStatus] = useState<string | null>(null);
  const [lastImageBatch, setLastImageBatch] = useState<
    { id: string; imageUrl: string }[] | null
  >(null);
  const [imagePipeline, setImagePipeline] = useState<PipelineState | null>(null);

  const [openPipeline, setOpenPipeline] = useState<"posts" | "images" | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const imageAbortRef = useRef<AbortController | null>(null);

  // Lets a long-running run read the CURRENT route without becoming dependent on
  // it - the user may navigate several times before it finishes.
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

  const showPipeline = useCallback((kind: "posts" | "images") => setOpenPipeline(kind), []);

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const cancelImageGeneration = useCallback(() => {
    imageAbortRef.current?.abort();
  }, []);

  // ── Bulk image run ─────────────────────────────────────────────────────────
  const startImageGeneration = useCallback(
    async (postIds: string[]) => {
      if (imageAbortRef.current || postIds.length === 0) return; // one batch at a time

      const ac = new AbortController();
      imageAbortRef.current = ac;
      setImageGenerating(true);
      setLastImageBatch(null);
      setImagePipeline(emptyPipeline("images"));
      setOpenPipeline("images");
      setImageStatus(
        `Generating images for ${postIds.length} post${postIds.length === 1 ? "" : "s"}...`
      );

      let failure: string | null = null;
      let summary: string | null = null;

      try {
        const res = await fetch("/api/generate/image/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postIds }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error("Image generation failed");
        }

        await consumeNdjson(res, (ev) => {
          setImagePipeline((p) => (p ? applyImageEvent(p, ev) : p));

          if (ev.type === "error") {
            failure = String(ev.message ?? "Image generation failed");
          } else if (ev.type === "done") {
            const images = (ev.images ?? []) as { id: string; imageUrl: string }[];
            setLastImageBatch(images.length > 0 ? images : null);
            summary = `Generated images for ${ev.generated} of ${ev.total} post(s)${
              ev.errors ? ` - ${ev.errors}` : ""
            }`;
          }
        });

        if (failure) throw new Error(failure);

        const text = summary ?? "Image generation finished";
        setImageStatus(text);
        setImagePipeline((p) => (p ? { ...p, running: false, done: true, summary: text } : p));
        toast(text, "success");
        router.refresh(); // pulls the new images into whatever page is open
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setImageStatus("Image generation cancelled.");
          setImagePipeline((p) =>
            p ? { ...p, running: false, error: "Cancelled by you" } : p
          );
          toast("Image generation cancelled", "info");
        } else {
          console.error(err);
          const message = err instanceof Error ? err.message : "Image generation failed";
          setImageStatus(message);
          setImagePipeline((p) => (p ? { ...p, running: false, error: message } : p));
          toast(message, "error");
        }
      } finally {
        imageAbortRef.current = null;
        setImageGenerating(false);
      }
    },
    [router, toast]
  );

  // ── Post run (strategy stream, then posts stream) ──────────────────────────
  const startGeneration = useCallback(
    async (reuseStrategy: boolean) => {
      if (abortRef.current) return; // a run is already in flight

      const ac = new AbortController();
      abortRef.current = ac;
      setGenerating(true);
      setError(null);
      setPostPipeline(emptyPipeline("posts"));
      setOpenPipeline("posts");
      setProgress([
        reuseStrategy
          ? "Using your current content strategy..."
          : "Building a fresh content strategy...",
      ]);

      const log = (line: string) => setProgress((p) => [...p, line]);

      try {
        // ── Stage A: strategy ──
        let failure: string | null = null;
        let planId: string | null = null;
        let weekTheme: string | null = null;
        let reused = false;

        const stratRes = await fetch("/api/generate/strategy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reuseStrategy }),
          signal: ac.signal,
        });
        if (!stratRes.ok || !stratRes.body) {
          throw new Error("Strategy generation failed. Please try again.");
        }

        await consumeNdjson(stratRes, (ev) => {
          setPostPipeline((p) => (p ? applyPostEvent(p, ev, "strategy") : p));
          if (ev.type === "error") {
            failure = String(ev.message ?? "Strategy generation failed");
          } else if (ev.type === "done") {
            planId = ev.plan?.id ?? null;
            weekTheme = ev.strategy?.weekTheme ?? null;
            reused = !!ev.reused;
          }
        });

        if (failure) throw new Error(failure);
        if (!planId) throw new Error("Strategy generation failed. Please try again.");

        log(`${reused ? "Using your strategy" : "New strategy ready"}: "${weekTheme ?? "Content theme"}"`);
        log(`Generating ${POSTS_PER_BATCH} posts for your scheduled days...`);

        // ── Stage B: posts ──
        let created = 0;
        let remaining: number | null = null;

        const postsRes = await fetch("/api/generate/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ planId }),
          signal: ac.signal,
        });
        if (!postsRes.ok || !postsRes.body) {
          throw new Error("Posts generation failed");
        }

        await consumeNdjson(postsRes, (ev) => {
          setPostPipeline((p) => (p ? applyPostEvent(p, ev, "posts") : p));
          if (ev.type === "error") {
            failure = String(ev.message ?? "Posts generation failed");
          } else if (ev.type === "done") {
            created = Number(ev.count ?? 0);
            remaining = ev.postsRemaining ?? null;
          } else if (ev.type === "post") {
            log(`Created: ${ev.title}${ev.scheduledLabel ? ` - ${ev.scheduledLabel}` : ""}`);
          }
        });

        if (failure) throw new Error(failure);

        const text = `${created} draft posts created${
          remaining !== null ? ` (${remaining} remaining this cycle)` : ""
        }`;
        log(text);
        setPostPipeline((p) => (p ? { ...p, running: false, done: true, summary: text } : p));
        toast(`${created} draft posts are ready`, "success");

        // Only pull them to /posts if they actually stayed to watch; yanking someone
        // off the page they walked away to would be rude.
        if (pathnameRef.current === "/dashboard") {
          log("Done! Redirecting to your posts...");
          setTimeout(() => router.push("/posts"), 1500);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          log("Generation cancelled.");
          setError(null);
          setPostPipeline((p) => (p ? { ...p, running: false, error: "Cancelled by you" } : p));
          toast("Generation cancelled", "info");
        } else {
          console.error(err);
          const message = err instanceof Error ? err.message : "Something went wrong";
          setError(message);
          log(`Error: ${message}`);
          setPostPipeline((p) => (p ? { ...p, running: false, error: message } : p));
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

  const visible =
    openPipeline === "posts" ? postPipeline : openPipeline === "images" ? imagePipeline : null;

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
        postPipeline,
        imagePipeline,
        showPipeline,
      }}
    >
      {children}
      {visible && (
        <PipelineModal
          state={visible}
          onClose={() => setOpenPipeline(null)}
          onCancel={openPipeline === "posts" ? cancelGeneration : cancelImageGeneration}
        />
      )}
    </GenerationContext.Provider>
  );
}
