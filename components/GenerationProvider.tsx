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
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { raiseProfileGate, ProfileGateError, isProfileGateError } from "@/lib/profile-gate";
import { PREVIEW_TOOLS_ENABLED } from "@/lib/preview-tools";
import PipelineModal, {
  type PipelineState,
  type StepStatus,
} from "@/components/PipelineModal";
import CarouselProgressModal, {
  type CarouselProgress,
  type CarouselSlideProgress,
  type SlideStatus,
} from "@/components/CarouselProgressModal";

type StreamEvent = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

type PipelineKind = "posts" | "images" | "single-image";

/** The outcome of one editor image run, kept so the editor can apply it
 *  whenever it next mounts - including long after the run finished. */
export interface SingleImageResult {
  postId: string;
  imageUrl: string | null;
  remaining: number;
  limit: number;
}

/** The outcome of one carousel run, kept for the same reason. */
export interface CarouselResult {
  postId: string;
  images: string[];
  /** null when the run never got far enough to report an allowance. */
  remaining: number | null;
  count: number;
}

// Shape of one NDJSON event streamed by /api/generate/carousel.
interface CarouselStreamSlide {
  index: number;
  role?: string;
  headline?: string;
  subheadline?: string;
  nodes?: string[];
  visual?: string;
  connectsFrom?: string;
  connectsTo?: string;
}
interface CarouselStreamEvent {
  type: string;
  key?: string;
  status?: string;
  message?: string;
  model?: string | null;
  theme?: string | null;
  style?: string;
  palette?: string;
  slides?: CarouselStreamSlide[];
  total?: number;
  index?: number;
  url?: string;
  prompt?: string;
  carouselImages?: string[];
  imageUrl?: string;
  count?: number;
  remaining?: number | null;
  limit?: number;
  subscriptionRequired?: boolean;
}

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
  /**
   * Single-post image generation, started from the editor.
   *
   * It lives up here for the same reason the other two runs do: the editor
   * unmounts the moment the user navigates, and a run owned by that component
   * lost its spinner while the request carried on in the background - the
   * image would appear minutes later with nothing having said it was coming.
   */
  singleImagePostId: string | null;
  lastSingleImage: SingleImageResult | null;
  startSingleImageGeneration: (postId: string) => void;
  cancelSingleImageGeneration: () => void;
  /** Carousel generation, also started from the editor, same rules. */
  carouselPostId: string | null;
  lastCarousel: CarouselResult | null;
  startCarouselGeneration: (postId: string) => void;
  cancelCarouselGeneration: () => void;
  showCarouselProgress: () => void;
  closeCarouselProgress: () => void;
  /** Live pipeline detail, and control over the popup that shows it. */
  postPipeline: PipelineState | null;
  imagePipeline: PipelineState | null;
  singleImagePipeline: PipelineState | null;
  showPipeline: (kind: PipelineKind) => void;
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
  singleImagePostId: null,
  lastSingleImage: null,
  startSingleImageGeneration: noop,
  cancelSingleImageGeneration: noop,
  carouselPostId: null,
  lastCarousel: null,
  startCarouselGeneration: noop,
  cancelCarouselGeneration: noop,
  showCarouselProgress: noop,
  closeCarouselProgress: noop,
  postPipeline: null,
  imagePipeline: null,
  singleImagePipeline: null,
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
  profile: "Profile complete",
  plan: "Content plan",
  schedule: "Posting schedule",
  quota: "Monthly quota",
  input: "Selection valid",
  eligible: "Eligible posts",
  post: "Post loaded",
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
function emptyPipeline(kind: "posts" | "images", title?: string): PipelineState {
  return {
    kind,
    title: title ?? (kind === "posts" ? "Generating posts" : "Generating images"),
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
        // batchSize comes from the server, which has already shortened the
        // batch to the allowance left - so it is the real number.
        const n = typeof ev.batchSize === "number" ? ev.batchSize : null;
        const size = n === null ? "" : ` \u00b7 ${n} post${n === 1 ? "" : "s"}`;
        detail = `${ev.days.join(", ")} at ${ev.time}${size}`;
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

  const [singleImagePostId, setSingleImagePostId] = useState<string | null>(null);
  const [lastSingleImage, setLastSingleImage] = useState<SingleImageResult | null>(null);
  const [singleImagePipeline, setSingleImagePipeline] = useState<PipelineState | null>(null);

  const [carouselPostId, setCarouselPostId] = useState<string | null>(null);
  const [lastCarousel, setLastCarousel] = useState<CarouselResult | null>(null);
  const [carouselProgress, setCarouselProgress] = useState<CarouselProgress | null>(null);
  // Separate from the state above on purpose. Closing used to null the
  // progress AND latch a ref that stopped all further painting, so a
  // dismissed carousel could never be reopened and the run became
  // unreachable - no way back in to watch it or cancel it. Now closing only
  // hides: the run keeps reporting and the modal can be brought back.
  const [carouselOpen, setCarouselOpen] = useState(false);

  const [openPipeline, setOpenPipeline] = useState<PipelineKind | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const imageAbortRef = useRef<AbortController | null>(null);
  const singleImageAbortRef = useRef<AbortController | null>(null);
  const carouselAbortRef = useRef<AbortController | null>(null);

  // Lets a long-running run read the CURRENT route without becoming dependent on
  // it - the user may navigate several times before it finishes.
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Closing or reloading the tab DOES kill an in-flight run, so ask first.
  useEffect(() => {
    if (!generating && !imageGenerating && !singleImagePostId && !carouselPostId) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [generating, imageGenerating, singleImagePostId, carouselPostId]);

  const showPipeline = useCallback((kind: PipelineKind) => setOpenPipeline(kind), []);

  const cancelSingleImageGeneration = useCallback(() => {
    singleImageAbortRef.current?.abort();
  }, []);

  const cancelCarouselGeneration = useCallback(() => {
    carouselAbortRef.current?.abort();
  }, []);

  const showCarouselProgress = useCallback(() => setCarouselOpen(true), []);
  const closeCarouselProgress = useCallback(() => setCarouselOpen(false), []);

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
      let gateBlocked = false;

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
            gateBlocked = raiseProfileGate(ev) || gateBlocked;
          } else if (ev.type === "done") {
            const images = (ev.images ?? []) as { id: string; imageUrl: string }[];
            setLastImageBatch(images.length > 0 ? images : null);
            summary = `Generated images for ${ev.generated} of ${ev.total} post(s)${
              ev.errors ? ` - ${ev.errors}` : ""
            }`;
          }
        });

        // Thrown ahead of the message so the catch can tell a refusal from a
        // fault: the dialog is already up and a red toast under it would read
        // as "retry", which will never clear this.
        if (gateBlocked) throw new ProfileGateError();
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
        } else if (isProfileGateError(err)) {
          setImageStatus("Finish your profile to generate images.");
          setImagePipeline((p) =>
            p ? { ...p, running: false, error: "Profile incomplete" } : p
          );
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

  // ── Single image run, from the post editor ─────────────────────────────────
  const startSingleImageGeneration = useCallback(
    async (postId: string) => {
      if (!postId) return;
      if (singleImageAbortRef.current) {
        toast("An image is already being generated - one at a time.", "info");
        return;
      }

      const ac = new AbortController();
      singleImageAbortRef.current = ac;
      setSingleImagePostId(postId);
      setLastSingleImage(null);
      setSingleImagePipeline(emptyPipeline("images", "Generating image"));
      setOpenPipeline("single-image");

      let failure: string | null = null;
      let gateBlocked = false;
      const outcome: { value: SingleImageResult | null } = { value: null };

      try {
        const res = await fetch("/api/generate/image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Opts into the pipeline. Without it this route still answers with
            // the single JSON body the mobile app expects.
            Accept: "application/x-ndjson",
          },
          body: JSON.stringify({ postId }),
          signal: ac.signal,
        });

        // The stream itself always answers 200 and reports failure as an event,
        // so a non-ok here is something that happened BEFORE the run started -
        // in practice an expired session - and carries a plain JSON body.
        if (!res.ok || !res.body) {
          let message = "Image generation failed";
          try {
            const body = await res.json();
            message = body.error || message;
            gateBlocked = raiseProfileGate(body) || gateBlocked;
          } catch {
            /* response was not JSON */
          }
          throw gateBlocked ? new ProfileGateError() : new Error(message);
        }

        await consumeNdjson(res, (ev) => {
          setSingleImagePipeline((pl) => (pl ? applyImageEvent(pl, ev) : pl));

          if (ev.type === "error") {
            failure = String(ev.message ?? "Image generation failed");
            gateBlocked = raiseProfileGate(ev) || gateBlocked;
          } else if (ev.type === "done") {
            outcome.value = {
              postId,
              imageUrl: (ev.imageUrl as string | null) ?? null,
              remaining: Number(ev.remaining ?? 0),
              limit: Number(ev.limit ?? 0),
            };
            // A run can finish with no image and still be a `done` - the models
            // all declined. That is a failure to the user even though the
            // transport succeeded.
            if (!ev.imageUrl && ev.error) failure = String(ev.error);
          }
        });

        if (gateBlocked) throw new ProfileGateError();
        if (failure) throw new Error(failure);

        // Published even when the editor is unmounted. Whenever it next mounts
        // for this post it picks the result up, so a user who navigated away
        // mid-run comes back to the finished image rather than a dead spinner.
        if (outcome.value) setLastSingleImage(outcome.value);
        const remaining = outcome.value?.remaining ?? 0;
        const text =
          remaining > 0
            ? `Image generated (${remaining} generation${remaining === 1 ? "" : "s"} remaining)`
            : "Image generated (no more generations left for this post)";
        setSingleImagePipeline((pl) =>
          pl ? { ...pl, running: false, done: true, summary: text } : pl
        );
        toast(text, "success");
        router.refresh();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setSingleImagePipeline((pl) =>
            pl ? { ...pl, running: false, error: "Cancelled by you" } : pl
          );
          toast("Image generation cancelled", "info");
        } else if (isProfileGateError(err)) {
          setSingleImagePipeline((pl) =>
            pl ? { ...pl, running: false, error: "Profile incomplete" } : pl
          );
        } else {
          console.error(err);
          const message = err instanceof Error ? err.message : "Image generation failed";
          setSingleImagePipeline((pl) => (pl ? { ...pl, running: false, error: message } : pl));
          toast(message, "error");
        }
        // The editor still needs the updated allowance on a refusal - a rate
        // limit or a spent quota both change what its button should say.
        if (outcome.value) setLastSingleImage(outcome.value);
      } finally {
        singleImageAbortRef.current = null;
        setSingleImagePostId(null);
      }
    },
    [router, toast]
  );

  // ── Carousel run, from the post editor ─────────────────────────────────────
  const startCarouselGeneration = useCallback(
    async (postId: string) => {
      if (!postId) return;
      if (carouselAbortRef.current) {
        toast("A carousel is already being generated - one at a time.", "info");
        return;
      }

      const ac = new AbortController();
      carouselAbortRef.current = ac;
      setCarouselOpen(true);
      setCarouselPostId(postId);
      setLastCarousel(null);

      // `prog` is the live copy every reducer branch builds on. React state is
      // not readable mid-run, so the running value is kept here and mirrored
      // into state on every change - whether or not the modal is on screen, so
      // reopening it shows where the run has actually got to.
      let prog: CarouselProgress = {
        running: true,
        preflight: [
          { key: "auth", label: "Signed in", status: "pending" },
          { key: "subscription", label: "Subscription", status: "pending" },
          { key: "ratelimit", label: "Rate limit", status: "pending" },
          { key: "post", label: "Post loaded", status: "pending" },
          { key: "quota", label: "Generation quota", status: "pending" },
        ],
        plan: { status: "pending" },
        render: { started: false, total: 0 },
        slides: [],
        save: "pending",
        done: false,
      };
      const update = (next: CarouselProgress) => {
        prog = next;
        setCarouselProgress(next);
      };
      update(prog);

      let failure: string | null = null;
      let gateBlocked = false;
      const outcome: { value: CarouselResult | null } = { value: null };

      const applyEvent = (ev: CarouselStreamEvent) => {
        switch (ev.type) {
          case "preflight":
            update({
              ...prog,
              preflight: prog.preflight.map((p) =>
                p.key === ev.key
                  ? { ...p, status: ev.status === "done" ? "done" : "error", message: ev.message }
                  : p
              ),
            });
            break;
          case "plan":
            if (ev.status === "start") {
              update({ ...prog, plan: { ...prog.plan, status: "running" } });
            } else if (ev.status === "done") {
              const slides: CarouselSlideProgress[] = (ev.slides ?? []).map((s) => ({
                index: s.index,
                role: s.role,
                headline: s.headline,
                subheadline: s.subheadline,
                nodes: s.nodes,
                visual: s.visual,
                connectsFrom: s.connectsFrom,
                connectsTo: s.connectsTo,
                status: "queued",
              }));
              update({
                ...prog,
                plan: {
                  status: "done",
                  model: ev.model,
                  theme: ev.theme ?? undefined,
                  style: ev.style,
                  palette: ev.palette,
                },
                slides,
              });
            } else if (ev.status === "fallback") {
              update({ ...prog, plan: { status: "fallback", message: ev.message } });
            } else if (ev.status === "error") {
              update({ ...prog, plan: { ...prog.plan, status: "error", message: ev.message } });
            }
            break;
          case "render": {
            let slides = prog.slides;
            if (slides.length === 0 && ev.total) {
              slides = Array.from({ length: ev.total }, (_, i) => ({
                index: i,
                status: "queued" as SlideStatus,
              }));
            }
            update({ ...prog, render: { started: true, total: ev.total ?? slides.length }, slides });
            break;
          }
          case "slide":
            update({
              ...prog,
              slides: prog.slides.map((s) =>
                s.index === ev.index
                  ? {
                      ...s,
                      status:
                        ev.status === "start"
                          ? "rendering"
                          : ev.status === "done"
                          ? "done"
                          : "error",
                      url: ev.url ?? s.url,
                      error: ev.message ?? s.error,
                      // The terminal `done` event carries no prompt - keep the
                      // one the render-start event brought.
                      prompt: ev.prompt ?? s.prompt,
                    }
                  : s
              ),
            });
            break;
          case "save":
            update({ ...prog, save: ev.status === "start" ? "running" : "done" });
            break;
          case "done": {
            const images = ev.carouselImages ?? [];
            outcome.value = {
              postId,
              images,
              remaining: ev.remaining ?? null,
              count: ev.count ?? images.length,
            };
            update({ ...prog, running: false, done: true, save: "done" });
            break;
          }
          case "error":
            // Still published: a refusal changes the allowance the editor shows.
            outcome.value = { postId, images: [], remaining: ev.remaining ?? null, count: 0 };
            failure = String(ev.message ?? "Carousel generation failed");
            gateBlocked = raiseProfileGate(ev) || gateBlocked;
            update({ ...prog, running: false, error: failure });
            break;
        }
      };

      try {
        const res = await fetch("/api/generate/carousel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId }),
          signal: ac.signal,
        });
        if (!res.ok || !res.body) {
          let message = "Failed to generate carousel";
          try {
            const body = await res.json();
            message = body.error || message;
            gateBlocked = raiseProfileGate(body) || gateBlocked;
          } catch {
            /* response was not JSON */
          }
          update({ ...prog, running: false, error: message });
          throw gateBlocked ? new ProfileGateError() : new Error(message);
        }

        await consumeNdjson(res, (ev) => applyEvent(ev as CarouselStreamEvent));

        if (gateBlocked) throw new ProfileGateError();
        if (failure) throw new Error(failure);

        if (outcome.value) setLastCarousel(outcome.value);
        toast(`Carousel created (${outcome.value?.count ?? 0} images)`, "success");
        router.refresh();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          update({ ...prog, running: false, error: "Cancelled by you" });
          toast("Carousel generation cancelled", "info");
        } else if (isProfileGateError(err)) {
          // A profile block is not a fault to retry, so the dialog stands on its
          // own - a red toast under it would read as "try again", which can
          // never clear this.
          update({ ...prog, running: false, error: "Profile incomplete" });
        } else {
          const message = err instanceof Error ? err.message : "Carousel generation failed";
          update({ ...prog, running: false, error: message });
          toast(message, "error");
        }
        if (outcome.value) setLastCarousel(outcome.value);
      } finally {
        carouselAbortRef.current = null;
        setCarouselPostId(null);
        // Whatever happened, the modal must stop claiming it is still running.
        setCarouselProgress((p) => (p ? { ...p, running: false } : p));
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
        let gateBlocked = false;
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
            gateBlocked = raiseProfileGate(ev) || gateBlocked;
          } else if (ev.type === "done") {
            planId = ev.plan?.id ?? null;
            weekTheme = ev.strategy?.weekTheme ?? null;
            reused = !!ev.reused;
          }
        });

        if (gateBlocked) throw new ProfileGateError();
        if (failure) throw new Error(failure);
        if (!planId) throw new Error("Strategy generation failed. Please try again.");

        log(`${reused ? "Using your strategy" : "New strategy ready"}: "${weekTheme ?? "Content theme"}"`);
        // No number here: the batch is shortened server-side to whatever
        // allowance is left, and the real count arrives on the schedule
        // preflight a moment later.
        log("Generating posts for your scheduled days...");

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
            gateBlocked = raiseProfileGate(ev) || gateBlocked;
          } else if (ev.type === "done") {
            created = Number(ev.count ?? 0);
            remaining = ev.postsRemaining ?? null;
          } else if (ev.type === "post") {
            log(`Created: ${ev.title}${ev.scheduledLabel ? ` - ${ev.scheduledLabel}` : ""}`);
          }
        });

        if (gateBlocked) throw new ProfileGateError();
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
        } else if (isProfileGateError(err)) {
          setError(null);
          log("Paused - your profile needs a few more details.");
          setPostPipeline((p) =>
            p ? { ...p, running: false, error: "Profile incomplete" } : p
          );
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

  // Both generation entry points call setOpenPipeline() as the run starts, so
  // this is the single gate that keeps the pipeline off production: no state
  // anywhere else has to know about the flag.
  const visible = !PREVIEW_TOOLS_ENABLED
    ? null
    : openPipeline === "posts"
    ? postPipeline
    : openPipeline === "images"
    ? imagePipeline
    : openPipeline === "single-image"
    ? singleImagePipeline
    : null;

  /**
   * An IN-FLIGHT run whose modal is not on screen, so there is always a way
   * back in to watch it or cancel it. Dismissing the modal used to strand the
   * run with no route back to either.
   *
   * Only the two started from the post editor: the dashboard and the posts
   * list already carry their own "View pipeline" buttons, and duplicating
   * those here would put two controls on one page.
   *
   * Finished runs are deliberately excluded. Their state is never cleared, so
   * including them would leave a button floating over every page for the rest
   * of the session. A pipeline worth studying after the fact can simply be
   * left open - the modal is built for that ("Finished - here is exactly what
   * ran").
   */
  const dismissedRuns: { key: string; label: string; open: () => void }[] = [];
  if (PREVIEW_TOOLS_ENABLED) {
    if (singleImagePipeline?.running && openPipeline !== "single-image") {
      dismissedRuns.push({
        key: "single-image",
        label: "Generating image",
        open: () => setOpenPipeline("single-image"),
      });
    }
    if (carouselProgress?.running && !carouselOpen) {
      dismissedRuns.push({
        key: "carousel",
        label: "Generating carousel",
        open: showCarouselProgress,
      });
    }
  }

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
        singleImagePostId,
        lastSingleImage,
        startSingleImageGeneration,
        cancelSingleImageGeneration,
        carouselPostId,
        lastCarousel,
        startCarouselGeneration,
        cancelCarouselGeneration,
        showCarouselProgress,
        closeCarouselProgress,
        postPipeline,
        imagePipeline,
        singleImagePipeline,
        showPipeline,
      }}
    >
      {children}
      {visible && (
        <PipelineModal
          state={visible}
          onClose={() => setOpenPipeline(null)}
          onCancel={
            openPipeline === "posts"
              ? cancelGeneration
              : openPipeline === "single-image"
              ? cancelSingleImageGeneration
              : cancelImageGeneration
          }
        />
      )}
      {PREVIEW_TOOLS_ENABLED && carouselOpen && carouselProgress && (
        <CarouselProgressModal
          progress={carouselProgress}
          onClose={closeCarouselProgress}
          onCancel={cancelCarouselGeneration}
        />
      )}
      {dismissedRuns.length > 0 && (
        <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
          {dismissedRuns.map((run) => (
            <button
              key={run.key}
              onClick={run.open}
              className="ring-focus flex items-center gap-2 rounded-full border border-edge bg-card px-3.5 py-2 text-[12.5px] font-semibold text-text-2 shadow-lift-lg transition-colors hover:bg-card-muted"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
              {run.label}
            </button>
          ))}
        </div>
      )}
    </GenerationContext.Provider>
  );
}
