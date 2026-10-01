"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Image as ImageIcon,
  Copy,
  CheckCircle,
  Loader2,
  Save,
  Hash,
  Clock,
  AlertCircle,
  ExternalLink,
  Upload,
  FileText,
  X,
  ZoomIn,
  Trash2,
  Wand2,
  Repeat2,
  Crop,
} from "lucide-react";
import { cn, getPostTypeColor } from "@/lib/utils";
import PostImage from "@/components/PostImage";
import { useToast } from "@/components/Toast";
import VariantModal, { Variant } from "@/components/VariantModal";
import RepurposeModal, { RepurposeResult } from "@/components/RepurposeModal";
import CarouselProgressModal, {
  CarouselProgress,
  CarouselSlideProgress,
  SlideStatus,
} from "@/components/CarouselProgressModal";
import LinkedInPostPreview from "@/components/LinkedInPostPreview";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useSession } from "next-auth/react";
import { formatInTimeZone } from "date-fns-tz";
import { fromZonedTime } from "date-fns-tz";
import { WATERMARK_TEXT } from "@/lib/subscription-check";
import { parseImageHistory } from "@/lib/image-history";
import { IMAGE_CATEGORY_GROUPS, DEFAULT_IMAGE_CATEGORY, getImageCategory } from "@/lib/image-categories";

interface Post {
  id: string;
  title: string;
  body: string;
  hashtags: string | null;
  postType: string;
  style?: string | null;
  imageStyle?: string | null;
  status: string;
  scheduledAt: Date | string | null;
  imageUrl: string | null;
  carouselImages: string | null;
  imageHistory: string | null;
  documentUrl: string | null;
  documentName: string | null;
  imagePrompt: string | null;
  imageGenCount: number;
  weekNumber: number;
  humanModeOverride: boolean | null;
  customSignature: string | null;
  postedToLinkedIn: boolean;
  linkedinPostId: string | null;
  postError: string | null;
  plan: { strategy: string };
}

interface UserProfile {
  name: string | null;
  image: string | null;
  headline: string | null;
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
  carouselImages?: string[];
  imageUrl?: string;
  count?: number;
  remaining?: number | null;
  limit?: number;
  subscriptionRequired?: boolean;
}

export default function PostEditorClient({
  post,
  postSignature,
  userProfile,
  userTimezone = "Asia/Kolkata",
  showWatermark = false,
  prevPostId = null,
  nextPostId = null,
}: {
  post: Post;
  postSignature: string | null;
  userProfile: UserProfile;
  userTimezone?: string;
  showWatermark?: boolean;
  prevPostId?: string | null;
  nextPostId?: string | null;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { data: sessionData } = useSession();
  const isTrialExpired = sessionData?.user?.subscriptionStatus === "trialing" &&
    sessionData?.user?.trialEnd != null && new Date(sessionData.user.trialEnd) < new Date();
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [status, setStatus] = useState(post.status);
  const [imageUrl, setImageUrl] = useState(post.imageUrl);
  // Persistent gallery of every generated/uploaded image set, so past results
  // stay reusable for free even after a reload or after the generation limit.
  const [generations, setGenerations] = useState<string[][]>(() => {
    const stored = parseImageHistory(post.imageHistory);
    if (stored.length > 0) return stored;
    // Backfill from the current image/carousel for posts created before history existed
    const seed: string[][] = [];
    try {
      const cur = post.carouselImages ? JSON.parse(post.carouselImages) : null;
      if (Array.isArray(cur) && cur.length > 0) seed.push(cur);
      else if (post.imageUrl) seed.push([post.imageUrl]);
    } catch {
      if (post.imageUrl) seed.push([post.imageUrl]);
    }
    return seed;
  });
  const [carouselImages, setCarouselImages] = useState<string[]>(() => {
    if (!post.carouselImages) return [];
    try {
      const a = JSON.parse(post.carouselImages);
      return Array.isArray(a) ? (a as string[]) : [];
    } catch {
      return [];
    }
  });
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [generatingCarousel, setGeneratingCarousel] = useState(false);
  const [carouselProgress, setCarouselProgress] = useState<CarouselProgress | null>(null);
  const [cropping, setCropping] = useState(false);
  const [imageStyle, setImageStyle] = useState<string>(post.imageStyle ?? DEFAULT_IMAGE_CATEGORY);
  const [documentUrl, setDocumentUrl] = useState<string | null>(post.documentUrl);
  const [documentName, setDocumentName] = useState<string | null>(post.documentName);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  // true = Human Mode (default), false = AI Mode
  const [humanMode, setHumanMode] = useState<boolean>(post.humanModeOverride ?? true);
  const [signature, setSignature] = useState(
    post.customSignature !== null ? (post.customSignature || "") : (postSignature || "")
  );

  // Schedule date/time state - display in user's configured timezone
  const initDate = post.scheduledAt ? new Date(post.scheduledAt) : null;
  const [scheduledDate, setScheduledDate] = useState(
    initDate ? formatInTimeZone(initDate, userTimezone, "yyyy-MM-dd") : ""
  );
  const [scheduledTime, setScheduledTime] = useState(
    initDate ? formatInTimeZone(initDate, userTimezone, "HH:mm") : "09:00"
  );

  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const IMAGE_GEN_LIMIT: number = isAdmin ? Infinity : 2;
  const [imageGenRemaining, setImageGenRemaining] = useState(
    isAdmin ? Infinity : Math.max(0, IMAGE_GEN_LIMIT - (post.imageGenCount || 0))
  );
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [generatingImage, setGeneratingImage] = useState(false);
  const [posting, setPosting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [postResult, setPostResult] = useState<{ success: boolean; error?: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPublishChecklist, setShowPublishChecklist] = useState(false);
  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [hashtags, setHashtags] = useState<string[]>(
    post.hashtags ? JSON.parse(post.hashtags) : []
  );
  // Version history - stores previous content before regeneration
  const [previousVersion, setPreviousVersion] = useState<{ title: string; body: string; hashtags: string[] } | null>(null);

  // Variant state
  const [variants, setVariants] = useState<Variant[]>([]);
  const [showVariants, setShowVariants] = useState(false);
  const [generatingVariants, setGeneratingVariants] = useState(false);
  // Repurpose state
  const [repurposeResults, setRepurposeResults] = useState<RepurposeResult[]>([]);
  const [showRepurpose, setShowRepurpose] = useState(false);
  const [generatingRepurpose, setGeneratingRepurpose] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  // Set true when the user dismisses the live carousel modal, so late stream events
  // don't re-open it (the generation itself keeps running in the background).
  const carouselClosedRef = useRef(false);

  // Weekend detection
  const isWeekend = (() => {
    if (!scheduledDate) return false;
    const d = new Date(scheduledDate + "T00:00:00");
    return d.getDay() === 0 || d.getDay() === 6;
  })();

  const charCount = body.length;
  const charLimit = 3000;

  async function handleSave() {
    cancelAutoSave(); // Prevent race with auto-save
    setSaving(true);
    try {
      // Combine date + time, convert from user's timezone to UTC
      let scheduledAt: string | null = null;
      if (scheduledDate) {
        const localDate = new Date(`${scheduledDate}T${scheduledTime || "09:00"}:00`);
        scheduledAt = fromZonedTime(localDate, userTimezone).toISOString();
      }

      await fetch(`/api/content/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title, 
          body, 
          hashtags, 
          status, 
          humanModeOverride: humanMode, 
          scheduledAt,
          customSignature: signature === (postSignature || "") ? null : signature,
        }),
      });
      markSaved(); // Update auto-save's last-saved baseline
      setSaved(true);
      toast("Post saved successfully", "success");
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleRegenerate() {
    // Save current version for undo
    setPreviousVersion({ title, body, hashtags: [...hashtags] });
    setRegenerating(true);
    try {
      const res = await fetch("/api/generate/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      });
      const updated = await res.json();
      if (updated.title) setTitle(updated.title);
      if (updated.body) setBody(updated.body);
      toast("Post regenerated - click Undo to restore previous version", "success");
      router.refresh();
    } finally {
      setRegenerating(false);
    }
  }

  function handleUndoRegenerate() {
    if (!previousVersion) return;
    setTitle(previousVersion.title);
    setBody(previousVersion.body);
    setHashtags(previousVersion.hashtags);
    setPreviousVersion(null);
    toast("Previous version restored - save to keep changes", "info");
  }

  // Add a newly produced image set to the in-session gallery (server already
  // persisted it). Skips a duplicate of the most recent entry, caps the length.
  function pushGeneration(urls: string[]) {
    const group = urls.filter((u): u is string => typeof u === "string" && u.length > 0);
    if (group.length === 0) return;
    setGenerations((prev) => {
      const last = prev[prev.length - 1];
      const dupe = last && last.length === group.length && last.every((u, i) => u === group[i]);
      return dupe ? prev : [...prev, group].slice(-24);
    });
  }

  // After cropping in place, swap the active generation's URLs for the cropped ones
  // so the gallery thumbnail tracks the cropped result (mirrors the server update).
  function replaceActiveGeneration(oldGroup: string[], newGroup: string[]) {
    const next = newGroup.filter((u): u is string => typeof u === "string" && u.length > 0);
    if (next.length === 0) return;
    setGenerations((prev) => {
      const same = (a: string[], b: string[]) =>
        a.length === b.length && a.every((u, i) => u === b[i]);
      let replaced = false;
      const updated = prev.map((g) => {
        if (!replaced && same(g, oldGroup)) {
          replaced = true;
          return next;
        }
        return g;
      });
      if (!replaced) updated.push(next);
      return updated.slice(-24);
    });
  }

  // Reuse a previous generation (single image or full carousel). This is FREE -
  // no new generation is consumed - and it persists so the choice survives reload.
  async function restoreGeneration(group: string[]) {
    const isCarousel = group.length > 1;
    setImageUrl(group[0]);
    setCarouselImages(isCarousel ? group : []);
    setCarouselIndex(0);
    setDocumentUrl(null);
    setDocumentName(null);
    try {
      await fetch(`/api/content/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: group[0],
          carouselImages: isCarousel ? group : null,
          documentUrl: null,
          documentName: null,
        }),
      });
      toast(isCarousel ? "Carousel restored" : "Image restored", "success");
      router.refresh();
    } catch {
      toast("Couldn't save that selection", "error");
    }
  }

  async function handleImageStyleChange(next: string) {
    setImageStyle(next);
    try {
      await fetch(`/api/content/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageStyle: next }),
      });
    } catch {
      toast("Couldn't save the image style", "error");
    }
  }

  async function handleGenerateImage() {
    setGeneratingImage(true);
    try {
      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast(data.error || "Failed to generate image", "error");
        if (data.remaining !== undefined) setImageGenRemaining(data.remaining);
        return;
      }
      if (data.imageUrl) {
        setImageUrl(data.imageUrl);
        pushGeneration([data.imageUrl]);
        setDocumentUrl(null);
        setDocumentName(null);
        const remaining = data.remaining ?? 0;
        setImageGenRemaining(remaining);
        toast(
          remaining > 0
            ? `Image generated (${remaining} generation${remaining === 1 ? "" : "s"} remaining)`
            : "Image generated (no more generations left for this post)",
          "success"
        );
      }
    } finally {
      setGeneratingImage(false);
    }
  }

  async function handleGenerateCarousel() {
    setGeneratingCarousel(true);
    carouselClosedRef.current = false;
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
      if (!carouselClosedRef.current) setCarouselProgress(next);
    };
    update(prog);

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
                      ev.status === "start" ? "rendering" : ev.status === "done" ? "done" : "error",
                    url: ev.url ?? s.url,
                    error: ev.message ?? s.error,
                  }
                : s
            ),
          });
          break;
        case "save":
          update({ ...prog, save: ev.status === "start" ? "running" : "done" });
          break;
        case "done": {
          const imgs = ev.carouselImages ?? [];
          if (imgs.length > 0) {
            setCarouselImages(imgs);
            setCarouselIndex(0);
            setImageUrl(imgs[0]);
            pushGeneration(imgs);
            setDocumentUrl(null);
            setDocumentName(null);
          }
          if (ev.remaining !== undefined && ev.remaining !== null) setImageGenRemaining(ev.remaining);
          update({ ...prog, running: false, done: true, save: "done" });
          toast(`Carousel created (${ev.count ?? imgs.length} images)`, "success");
          router.refresh();
          break;
        }
        case "error":
          if (ev.remaining !== undefined && ev.remaining !== null) setImageGenRemaining(ev.remaining);
          update({ ...prog, running: false, error: ev.message || "Carousel generation failed" });
          toast(ev.message || "Failed to generate carousel", "error");
          break;
      }
    };

    try {
      const res = await fetch("/api/generate/carousel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      });
      if (!res.ok || !res.body) {
        let msg = "Failed to generate carousel";
        try {
          const d = await res.json();
          msg = d.error || msg;
        } catch {
          /* response was not JSON */
        }
        update({ ...prog, running: false, error: msg });
        toast(msg, "error");
        return;
      }
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
            applyEvent(JSON.parse(line) as CarouselStreamEvent);
          } catch {
            /* skip a malformed line */
          }
        }
      }
      const tail = buffer.trim();
      if (tail) {
        try {
          applyEvent(JSON.parse(tail) as CarouselStreamEvent);
        } catch {
          /* ignore */
        }
      }
    } catch {
      update({ ...prog, running: false, error: "Carousel generation failed. Please try again." });
      toast("Carousel generation failed. Please try again.", "error");
    } finally {
      setGeneratingCarousel(false);
      if (!carouselClosedRef.current) {
        setCarouselProgress((p) => (p ? { ...p, running: false } : p));
      }
    }
  }

  // Crop 1px off every side and re-encode (server-side via sharp). This strips the
  // C2PA / Content-Credentials metadata so the LinkedIn "CR" AI-content tag is gone.
  // Cropping is free - it never consumes an image generation.
  async function handleCropImages() {
    setCropping(true);
    try {
      const res = await fetch("/api/images/crop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast(data.error || "Couldn't crop the image", "error");
        return;
      }
      if (Array.isArray(data.carouselImages) && data.carouselImages.length > 0) {
        const cropped: string[] = data.carouselImages;
        const prevGroup = carouselImages;
        setCarouselImages(cropped);
        setCarouselIndex((i) => Math.min(i, cropped.length - 1));
        setImageUrl(data.imageUrl ?? cropped[0]);
        replaceActiveGeneration(prevGroup, cropped);
        toast("Carousel cropped - the LinkedIn AI tag is removed", "success");
        router.refresh();
      } else if (data.imageUrl) {
        const oldUrl = imageUrl;
        setImageUrl(data.imageUrl);
        if (oldUrl) replaceActiveGeneration([oldUrl], [data.imageUrl]);
        toast("Image cropped - the LinkedIn AI tag is removed", "success");
        router.refresh();
      }
    } catch {
      toast("Couldn't crop the image. Please try again.", "error");
    } finally {
      setCropping(false);
    }
  }

  function handleCopy() {
    let fullText = `${body}\n\n${hashtags.map((h) => `#${h}`).join(" ")}`;
    if (signature.trim()) {
      fullText += `\n\n${signature.trim()}`;
    }
    if (showWatermark) {
      fullText += `\n\n${WATERMARK_TEXT}`;
    }
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast("Copied to clipboard", "success");
    setTimeout(() => setCopied(false), 2000);
  }

  function getPublishChecklist() {
    return [
      { label: "Post body has content", passed: body.trim().length > 20 },
      { label: "Image attached", passed: !!imageUrl, optional: true },
      { label: "Hashtags added", passed: hashtags.length > 0, optional: true },
      { label: "Schedule date set", passed: !!scheduledDate, optional: true },
    ];
  }

  function handlePublishClick() {
    setShowPublishChecklist(true);
  }

  async function handlePostToLinkedIn() {
    setShowPublishChecklist(false);
    // Save first, then post
    await handleSave();
    setPosting(true);
    setPostResult(null);
    try {
      const res = await fetch("/api/post-to-linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      });
      const data = await res.json();
      if (data.success) {
        setPostResult({ success: true });
        setStatus("published");
        toast("Successfully posted to LinkedIn!", "success");
        router.refresh();
      } else {
        setPostResult({ success: false, error: data.error });
        toast(`Failed to post: ${data.error}`, "error");
      }
    } finally {
      setPosting(false);
    }
  }

  // Remove the post from LinkedIn and unlock it for editing + re-posting. Kruti
  // deletes the LinkedIn post itself (idempotent), so it works whether the post is
  // still live or the user already deleted it manually on LinkedIn.
  async function handleUnpublish() {
    setShowUnpublishConfirm(false);
    setUnpublishing(true);
    try {
      const res = await fetch(`/api/content/${post.id}/unpublish`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setPostResult(null);
        setStatus("draft");
        toast("Removed from LinkedIn - you can edit and post it again now", "success");
        router.refresh();
      } else if (data.requiresReauth) {
        toast(data.error || "Please sign out and sign in again to reconnect LinkedIn.", "error");
      } else {
        toast(data.error || "Couldn't remove the post from LinkedIn", "error");
      }
    } catch {
      toast("Couldn't remove the post from LinkedIn. Please try again.", "error");
    } finally {
      setUnpublishing(false);
    }
  }

  async function handleToggleHumanMode() {
    if (isPublished || regenerating) return;
    const next = !humanMode;
    setHumanMode(next);
    cancelAutoSave();
    // Persist the per-post mode so the regenerate endpoint uses it,
    // then regenerate the post content in the selected (Human / AI) mode.
    await fetch(`/api/content/${post.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ humanModeOverride: next }),
    });
    await handleRegenerate();
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("postId", post.id);

      const res = await fetch("/api/upload/image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.imageUrl) {
        setImageUrl(data.imageUrl);
        pushGeneration([data.imageUrl]);
        setDocumentUrl(null);
        setDocumentName(null);
        toast("Image uploaded", "success");
        router.refresh();
      } else {
        toast(data.error || "Upload failed", "error");
      }
    } catch {
      toast("Upload failed. Please try again.", "error");
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveImage() {
    try {
      await fetch(`/api/content/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: null, carouselImages: null }),
      });
      setImageUrl(null);
      setCarouselImages([]);
      setCarouselIndex(0);
      toast("Image removed", "info");
      router.refresh();
    } catch {
      toast("Failed to remove image", "error");
    }
  }

  async function handleUploadDocument(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append("document", file);
      formData.append("postId", post.id);
      const res = await fetch("/api/upload/document", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.documentUrl) {
        setDocumentUrl(data.documentUrl);
        setDocumentName(data.documentName);
        // A document replaces image media - reflect the server-side clear locally
        setImageUrl(null);
        setCarouselImages([]);
        setCarouselIndex(0);
        toast("PDF uploaded", "success");
        router.refresh();
      } else {
        toast(data.error || "PDF upload failed", "error");
      }
    } catch {
      toast("PDF upload failed. Please try again.", "error");
    } finally {
      setUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = "";
    }
  }

  async function handleRemoveDocument() {
    try {
      await fetch(`/api/content/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentUrl: null, documentName: null }),
      });
      setDocumentUrl(null);
      setDocumentName(null);
      toast("PDF removed", "info");
      router.refresh();
    } catch {
      toast("Failed to remove PDF", "error");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch("/api/content/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", postIds: [post.id] }),
      });
      if (res.ok) {
        toast("Post deleted", "info");
        router.push("/posts");
      } else {
        const data = await res.json();
        toast(data.error || "Failed to delete post", "error");
      }
    } catch {
      toast("Failed to delete post", "error");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  async function handleGenerateVariants() {
    setGeneratingVariants(true);
    setShowVariants(true);
    setVariants([]);
    try {
      const res = await fetch("/api/generate/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      });
      const data = await res.json();
      if (data.variants) {
        setVariants(data.variants);
      } else {
        toast("Failed to generate variants", "error");
        setShowVariants(false);
      }
    } catch {
      toast("Failed to generate variants", "error");
      setShowVariants(false);
    } finally {
      setGeneratingVariants(false);
    }
  }

  function handleVariantSelect(variant: Variant) {
    setTitle(variant.title);
    setBody(variant.body);
    setHashtags(variant.hashtags);
    setShowVariants(false);
    toast("Variant applied - review and save", "success");
  }

  async function handleRepurpose() {
    setGeneratingRepurpose(true);
    setShowRepurpose(true);
    setRepurposeResults([]);
    try {
      const res = await fetch("/api/generate/repurpose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      });
      const data = await res.json();
      if (data.results) {
        setRepurposeResults(data.results);
      } else {
        toast("Failed to repurpose content", "error");
        setShowRepurpose(false);
      }
    } catch {
      toast("Failed to repurpose content", "error");
      setShowRepurpose(false);
    } finally {
      setGeneratingRepurpose(false);
    }
  }

  // Close lightbox on Escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxOpen(false);
    }
    if (lightboxOpen) {
      document.addEventListener("keydown", handleKey);
      return () => document.removeEventListener("keydown", handleKey);
    }
  }, [lightboxOpen]);

  const isPublished = post.postedToLinkedIn;

  // Auto-save hook - only for unpublished posts
  const { status: autoSaveStatus, cancelAutoSave, markSaved } = useAutoSave({
    postId: post.id,
    title,
    body,
    customSignature: signature === (postSignature || "") ? null : signature,
    isPublished,
  });

  const humanModeBg = humanMode ? "bg-blue-600" : "bg-slate-300 dark:bg-white/[0.12]";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Published banner */}
      {isPublished && (
        <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
          <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-300 flex-1">
            This post has been published to LinkedIn. Editing is disabled.
          </p>
          <button
            onClick={() => setShowUnpublishConfirm(true)}
            disabled={unpublishing}
            className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-green-300 dark:border-green-700 text-green-800 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 disabled:opacity-70 transition-colors whitespace-nowrap"
            title="Remove this post from LinkedIn so you can edit and post it again"
          >
            {unpublishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Repeat2 className="w-4 h-4" />}
            {unpublishing ? "Removing..." : "Edit again"}
          </button>
        </div>
      )}

      {/* Unpublish confirmation */}
      {showUnpublishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-[#0D131F] rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-gray-100">
              Remove from LinkedIn?
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              This deletes the post from LinkedIn and unlocks it so you can edit and post it again.
              Re-posting creates a new LinkedIn post. This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowUnpublishConfirm(false)}
                className="text-sm px-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUnpublish}
                className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                Remove &amp; edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating toolbar: navigation + actions, stays in view while scrolling */}
      <div className="sticky top-0 z-30 space-y-3 rounded-xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#0D131F]/95 backdrop-blur-sm shadow-sm px-4 py-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => router.push("/posts")}
            className="flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            title="Back to all posts"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex items-center gap-1">
            <button
              onClick={() => prevPostId && router.push(`/posts/${prevPostId}`)}
              disabled={!prevPostId}
              className="flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={prevPostId ? "Previous post" : "No previous post"}
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <button
              onClick={() => nextPostId && router.push(`/posts/${nextPostId}`)}
              disabled={!nextPostId}
              className="flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title={nextPostId ? "Next post" : "No next post"}
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <span className={cn("text-xs px-2 py-0.5 rounded-full border", getPostTypeColor(post.postType))}>
            {post.style || post.postType}
          </span>
          {!isPublished && (
            <div className="ml-auto flex items-center gap-1.5">
              {autoSaveStatus === "saving" && (
                <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Saving...
                </span>
              )}
              {autoSaveStatus === "saved" && (
                <span className="text-xs text-green-500 dark:text-green-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Saved
                </span>
              )}
              {autoSaveStatus === "error" && (
                <span className="text-xs text-red-500 dark:text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Save failed
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action buttons row */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-sm px-3 py-2 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors dark:text-slate-300"
            title="Copy to clipboard"
          >
            {copied ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-slate-500 dark:text-slate-400" />}
            {copied ? "Copied!" : "Copy"}
          </button>

          <button
            onClick={handleRepurpose}
            disabled={generatingRepurpose}
            className="flex items-center gap-1.5 text-sm px-3 py-2 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/30 disabled:opacity-70 transition-colors"
            title="Repurpose for other platforms"
          >
            {generatingRepurpose ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Repeat2 className="w-4 h-4" />
            )}
            Repurpose
          </button>

          {/* Status - mirrors the Post Details dropdown (same state, so both stay in sync) */}
          <div className="flex items-center gap-2">
            <label
              htmlFor="toolbar-status"
              className="text-xs text-slate-500 dark:text-slate-400"
            >
              Status
            </label>
            <select
              id="toolbar-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              disabled={post.postedToLinkedIn || isTrialExpired}
              className="select-field text-sm pl-3 pr-10 py-2 border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-white/[0.06] dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title={
                post.postedToLinkedIn
                  ? "Published posts cannot change status"
                  : "Post status - click Save to apply"
              }
            >
              <option value="draft">Draft</option>
              <option value="ready">Ready (auto-post)</option>
              <option value="published">Published</option>
            </select>
          </div>

          <div className="flex-1" />

          {/* Post to LinkedIn */}
          {!post.postedToLinkedIn ? (
            <button
              onClick={handlePublishClick}
              disabled={posting || isTrialExpired}
              className="flex items-center gap-1.5 text-sm px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70"
              title={isTrialExpired ? "Subscribe to post to LinkedIn" : undefined}
            >
              {posting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              )}
              {posting ? "Posting..." : "Post to LinkedIn"}
            </button>
          ) : (
            <a
              href={`https://www.linkedin.com/feed/update/${post.linkedinPostId ?? ""}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm px-4 py-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              View on LinkedIn
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {!isPublished && (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg hover:opacity-90 disabled:opacity-70"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : saved ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {saved ? "Saved!" : "Save"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-sm px-3 py-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                title="Delete post"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Post result alerts */}
      {postResult && (
        <div className={cn("rounded-xl p-4 flex items-start gap-3", postResult.success ? "bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800")}>
          {postResult.success ? (
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          )}
          <p className={cn("text-sm", postResult.success ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300")}>
            {postResult.success
              ? "Successfully posted to LinkedIn!"
              : `Failed to post: ${postResult.error}`}
          </p>
        </div>
      )}

      {/* Last auto-post error */}
      {post.postError && !post.postedToLinkedIn && !postResult && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-700 dark:text-red-300">Auto-post failed</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{post.postError}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Editor */}
        <div className="lg:col-span-2 space-y-4">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">
              Post Hook / Opening Line
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isPublished}
              className={cn(
                "w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white dark:bg-white/[0.03] dark:text-gray-100",
                isPublished && "bg-slate-50 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 cursor-not-allowed"
              )}
              placeholder="Post hook..."
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Post Body
              </label>
              <span className={cn("text-xs", charCount > charLimit * 0.9 ? "text-orange-500" : "text-slate-400 dark:text-slate-500")}>
                {charCount} / {charLimit}
              </span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={isPublished}
              rows={14}
              className={cn(
                "w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none bg-white dark:bg-white/[0.03] dark:text-gray-100",
                isPublished && "bg-slate-50 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 cursor-not-allowed"
              )}
              placeholder="Post content..."
            />
          </div>

          {/* Hashtags Editor */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 flex items-center gap-1">
              <Hash className="w-3 h-3" />
              Hashtags
              <span className="font-normal text-slate-400 dark:text-slate-500 ml-1">({hashtags.length})</span>
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {hashtags.map((tag, i) => (
                <span
                  key={i}
                  className="group flex items-center gap-1 text-xs px-2.5 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg"
                >
                  #{tag}
                  {!isPublished && (
                    <button
                      onClick={() => {
                        setHashtags((prev) => prev.filter((_, idx) => idx !== i));
                      }}
                      className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
                      title="Remove hashtag"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {!isPublished && (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Add hashtag..."
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white dark:bg-white/[0.03] dark:text-gray-100"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const input = e.currentTarget;
                      const value = input.value.trim().replace(/^#/, "").replace(/\s+/g, "");
                      if (value && !hashtags.includes(value)) {
                        setHashtags((prev) => [...prev, value]);
                        input.value = "";
                      }
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                    const value = input.value.trim().replace(/^#/, "").replace(/\s+/g, "");
                    if (value && !hashtags.includes(value)) {
                      setHashtags((prev) => [...prev, value]);
                      input.value = "";
                    }
                  }}
                  className="px-3 py-2 text-xs font-medium border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors text-slate-600 dark:text-slate-300"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {/* Post Signature Editor */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1.5 block">
              Post Signature
            </label>
            <textarea
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              disabled={isPublished}
              rows={3}
              placeholder="Signature..."
              className={cn(
                "w-full px-4 py-3 border border-slate-200 dark:border-white/10 rounded-xl text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none bg-white dark:bg-white/[0.03] dark:text-gray-100",
                isPublished && "bg-slate-50 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 cursor-not-allowed"
              )}
            />
          </div>

          {/* Actions - hidden for published posts */}
          {!isPublished && (
            isTrialExpired ? (
              <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/[0.06] rounded-xl border border-slate-200 dark:border-white/10">
                <AlertCircle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Your trial has ended.{" "}
                  <a href="/subscribe" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">Subscribe</a>
                  {" "}to regenerate posts, generate images, and create variants.
                </p>
              </div>
            ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex items-center gap-2 text-sm px-4 py-2 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] disabled:opacity-70 transition-colors dark:text-slate-300"
              >
                {regenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                )}
                Regenerate Post
              </button>
              {previousVersion && (
                <button
                  onClick={handleUndoRegenerate}
                  className="flex items-center gap-1.5 text-sm px-3 py-2 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
                  title="Restore previous version"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Undo
                </button>
              )}

              <button
                onClick={handleGenerateVariants}
                disabled={generatingVariants}
                className="flex items-center gap-2 text-sm px-4 py-2 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/30 disabled:opacity-70 transition-colors"
              >
                {generatingVariants ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Wand2 className="w-4 h-4" />
                )}
                Generate Variants
              </button>

              <button
                onClick={handleGenerateImage}
                disabled={generatingImage || imageGenRemaining <= 0}
                className="flex items-center gap-2 text-sm px-4 py-2 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] disabled:opacity-70 transition-colors dark:text-slate-300"
                title={imageGenRemaining <= 0 ? "Image generation limit reached for this post" : Number.isFinite(imageGenRemaining) ? `${imageGenRemaining} generation${imageGenRemaining === 1 ? "" : "s"} remaining` : "Generate a new AI image"}
              >
                {generatingImage ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                )}
                {imageGenRemaining <= 0 ? "Limit Reached" : imageUrl ? "Regenerate Image" : "Generate Image"}
              </button>
            </div>
            )
          )}

        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Image Preview */}
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-white/10 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Post Image</h3>
              {imageUrl && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLightboxOpen(true)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
                    title="View full size"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  {!isPublished && (
                    <button
                      onClick={handleRemoveImage}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Remove image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
            {!isPublished && (
              <div className="px-4 pt-4 pb-3 border-b border-slate-100 dark:border-white/10">
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                  Image style
                </label>
                <select
                  value={imageStyle}
                  onChange={(e) => handleImageStyleChange(e.target.value)}
                  className="select-field w-full text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 pl-2.5 pr-10 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  {IMAGE_CATEGORY_GROUPS.map((g) => (
                    <optgroup key={g.group} label={g.group}>
                      {g.items.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {getImageCategory(imageStyle).hint && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                    Best made as a carousel - use the Carousel button below.
                  </p>
                )}
              </div>
            )}
            <div className="p-4">
              {documentUrl ? (
                <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4 flex items-center gap-3 bg-slate-50 dark:bg-white/[0.04]">
                  <div className="w-10 h-12 rounded bg-red-50 dark:bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400 flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {documentName || "Document.pdf"}
                    </p>
                    <a
                      href={documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      View PDF
                    </a>
                  </div>
                  {!isPublished && (
                    <button
                      onClick={handleRemoveDocument}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors flex-shrink-0"
                      title="Remove PDF"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : carouselImages.length > 0 ? (
                <div>
                  <div className="relative aspect-square rounded-xl overflow-hidden">
                    <PostImage
                      src={carouselImages[carouselIndex]}
                      alt={`Carousel slide ${carouselIndex + 1}`}
                      className="absolute inset-0 w-full h-full object-cover"
                      iconClassName="w-8 h-8"
                      label="Image no longer available"
                    />
                    <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white">
                      <ImageIcon className="w-3 h-3" /> Carousel &middot; {carouselIndex + 1}/{carouselImages.length}
                    </span>
                    {carouselImages.length > 1 && (
                      <>
                        <button
                          onClick={() => setCarouselIndex((i) => (i > 0 ? i - 1 : carouselImages.length - 1))}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center"
                          title="Previous slide"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setCarouselIndex((i) => (i < carouselImages.length - 1 ? i + 1 : 0))}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center"
                          title="Next slide"
                        >
                          <ArrowLeft className="w-4 h-4 rotate-180" />
                        </button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-1.5 mt-3">
                    {carouselImages.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCarouselIndex(i)}
                        className={cn(
                          "h-1.5 rounded-full transition-all",
                          i === carouselIndex ? "w-5 bg-blue-600" : "w-1.5 bg-slate-300 dark:bg-white/20"
                        )}
                        aria-label={`Go to slide ${i + 1}`}
                      />
                    ))}
                  </div>
                </div>
              ) : imageUrl ? (
                <div
                  className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group"
                  onClick={() => setLightboxOpen(true)}
                >
                  <PostImage
                    src={imageUrl}
                    alt="Post image"
                    className="absolute inset-0 w-full h-full object-cover"
                    iconClassName="w-8 h-8"
                    label="Image no longer available"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "aspect-square rounded-xl bg-slate-50 dark:bg-white/[0.06] border-2 border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center transition-colors",
                    imageGenRemaining > 0 ? "cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.08]" : "opacity-60"
                  )}
                  onClick={imageGenRemaining > 0 ? handleGenerateImage : undefined}
                >
                  {generatingImage ? (
                    <>
                      <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin mb-2" />
                      <p className="text-xs text-slate-500 dark:text-slate-400">Generating...</p>
                    </>
                  ) : imageGenRemaining <= 0 ? (
                    <>
                      <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-center px-4">
                        Generation limit reached. Upload an image instead.
                      </p>
                    </>
                  ) : (
                    <>
                      <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-center px-4">
                        Click to generate an AI image
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Previously generated images - reuse any past result for free */}
              {!isPublished && generations.length > 0 && (
                <div className="mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-1.5">
                    Previously generated &middot; tap to reuse (free)
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {generations.map((group, i) => {
                      const isCarousel = group.length > 1;
                      const active = isCarousel
                        ? carouselImages.length > 0 && carouselImages[0] === group[0]
                        : carouselImages.length === 0 && imageUrl === group[0];
                      return (
                        <button
                          key={`${group[0]}-${i}`}
                          type="button"
                          onClick={() => restoreGeneration(group)}
                          className={cn(
                            "relative flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors",
                            active
                              ? "border-blue-600"
                              : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/25"
                          )}
                          title={isCarousel ? `Carousel - ${group.length} images` : "Single image"}
                        >
                          <PostImage
                            src={group[0]}
                            className="absolute inset-0 w-full h-full object-cover"
                            iconClassName="w-4 h-4"
                          />
                          {isCarousel && (
                            <span className="absolute bottom-0.5 right-0.5 inline-flex items-center gap-0.5 rounded bg-black/65 px-1 py-0.5 text-[9px] font-bold leading-none text-white">
                              <ImageIcon className="w-2.5 h-2.5" />
                              {group.length}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Upload / Replace buttons - hidden for published posts */}
              {!isPublished && (
                <>
                  <div className="mt-3 flex gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] disabled:opacity-70 transition-colors dark:text-slate-300"
                    >
                      {uploading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      )}
                      {uploading ? "Uploading..." : imageUrl ? "Replace Image" : "Upload Image"}
                    </button>
                    <button
                      onClick={handleGenerateImage}
                      disabled={generatingImage || imageGenRemaining <= 0}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs px-3 py-2 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] disabled:opacity-70 transition-colors dark:text-slate-300"
                      title={imageGenRemaining <= 0 ? "Limit reached" : Number.isFinite(imageGenRemaining) ? `${imageGenRemaining} left` : "Regenerate image"}
                    >
                      {generatingImage ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      )}
                      {generatingImage ? "Generating..." : imageGenRemaining <= 0 ? "Limit Reached" : imageUrl ? "Regenerate" : "AI Generate"}
                    </button>
                  </div>
                  <button
                    onClick={handleGenerateCarousel}
                    disabled={generatingCarousel || imageGenRemaining <= 0}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 border border-blue-200 dark:border-blue-500/30 bg-blue-50/60 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 disabled:opacity-70 transition-colors"
                    title={imageGenRemaining <= 0 ? "Generation limit reached" : "Generate 4 carousel images"}
                  >
                    {generatingCarousel ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <ImageIcon className="w-3.5 h-3.5" />
                    )}
                    {generatingCarousel
                      ? "Generating carousel..."
                      : carouselImages.length > 0
                      ? "Regenerate Carousel"
                      : "Carousel (4 images)"}
                  </button>
                  {(imageUrl || carouselImages.length > 0) && (
                    <button
                      onClick={handleCropImages}
                      disabled={cropping}
                      className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] disabled:opacity-70 transition-colors dark:text-slate-300"
                      title="Remove the AI tag LinkedIn shows on generated images"
                    >
                      {cropping ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Crop className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                      )}
                      {cropping ? "Cropping..." : "Crop Images"}
                    </button>
                  )}
                  <input
                    ref={docInputRef}
                    type="file"
                    accept="application/pdf"
                    onChange={handleUploadDocument}
                    className="hidden"
                  />
                  <button
                    onClick={() => docInputRef.current?.click()}
                    disabled={uploadingDoc}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 text-xs px-3 py-2 border border-slate-200 dark:border-white/10 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] disabled:opacity-70 transition-colors dark:text-slate-300"
                    title="Upload a PDF - published as a LinkedIn document (swipeable PDF carousel)"
                  >
                    {uploadingDoc ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-red-500" />
                    )}
                    {uploadingDoc ? "Uploading PDF..." : documentUrl ? "Replace PDF" : "Upload PDF"}
                  </button>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 text-center">
                    JPG, PNG, GIF, WebP &middot; Max 5MB &middot; PDF &middot; Max 25MB
                  </p>
                  <p className={cn(
                    "text-[10px] mt-1 text-center",
                    imageGenRemaining <= 0 ? "text-amber-500 dark:text-amber-400" : "text-slate-400 dark:text-slate-500"
                  )}>
                    {imageGenRemaining === Infinity
                      ? "Unlimited AI generations remaining"
                      : imageGenRemaining <= 0
                        ? "AI generation limit reached for this post"
                        : `${imageGenRemaining} of ${IMAGE_GEN_LIMIT} AI generation${IMAGE_GEN_LIMIT === 1 ? "" : "s"} remaining`}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Post Details */}
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Post Details</h3>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="select-field w-full pl-3 pr-10 py-2 text-sm border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white dark:bg-white/[0.06] dark:text-gray-100"
                disabled={post.postedToLinkedIn || isTrialExpired}
              >
                <option value="draft">Draft</option>
                <option value="ready">Ready (auto-post)</option>
                <option value="published">Published</option>
              </select>
            </div>
            {/* Auto-Publish Schedule */}
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Auto-Publish Date & Time
              </label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  disabled={post.postedToLinkedIn}
                  className="flex-1 px-2 py-1.5 text-xs border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 bg-white dark:bg-white/[0.06] dark:text-gray-100"
                />
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  disabled={post.postedToLinkedIn}
                  className="w-24 px-2 py-1.5 text-xs border border-slate-200 dark:border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:opacity-50 bg-white dark:bg-white/[0.06] dark:text-gray-100"
                />
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Timezone: {userTimezone.replace(/_/g, " ")}
              </p>
              {isWeekend && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Weekend selected - posts may get less engagement
                </p>
              )}
            </div>
            {post.postedToLinkedIn && (
              <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1.5 rounded-lg">
                <CheckCircle className="w-3.5 h-3.5" />
                Posted to LinkedIn
              </div>
            )}
            {post.imagePrompt && (
              <div>
                <label className="text-xs text-slate-500 dark:text-slate-400 mb-1 block">Image Prompt</label>
                <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-white/[0.06] p-2 rounded-lg leading-relaxed line-clamp-3">
                  {post.imagePrompt}
                </p>
              </div>
            )}
          </div>

          {/* Content mode toggle: Human (default) ↔ AI */}
          <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-slate-100 dark:border-white/10 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {humanMode ? "Human Mode" : "AI Mode"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {humanMode ? "Natural, human-written style" : "Standard AI-generated style"}
                </p>
              </div>
              <button
                onClick={handleToggleHumanMode}
                disabled={isPublished || regenerating}
                className={cn(
                  "w-12 h-6 rounded-full transition-colors relative flex items-center",
                  humanModeBg,
                  (isPublished || regenerating) && "opacity-50 cursor-not-allowed"
                )}
                title="Toggle Human / AI mode (regenerates this post)"
              >
                <span
                  className={cn(
                    "w-4 h-4 bg-white rounded-full shadow transition-transform mx-1",
                    humanMode ? "translate-x-6" : "translate-x-0"
                  )}
                />
              </button>
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
              {regenerating
                ? `Regenerating in ${humanMode ? "Human" : "AI"} mode...`
                : "Toggling regenerates this post in the selected mode."}
            </p>
          </div>
        </div>
      </div>

      {/* LinkedIn Post Preview */}
      <LinkedInPostPreview
        name={userProfile.name}
        image={userProfile.image}
        headline={userProfile.headline}
        title={title}
        body={body}
        hashtags={hashtags}
        postSignature={signature}
        imageUrl={imageUrl}
        carouselImages={carouselImages}
        documentName={documentUrl ? documentName || "Document.pdf" : null}
        watermark={showWatermark ? WATERMARK_TEXT : null}
      />

      {/* Lightbox Modal */}
      {lightboxOpen && imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <div
            className="relative max-w-4xl max-h-[90vh] w-full h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <PostImage
              src={imageUrl}
              alt="Post image full view"
              className="absolute inset-0 w-full h-full object-contain"
              iconClassName="w-12 h-12"
              label="Image no longer available"
            />
          </div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors backdrop-blur-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Open in New Tab
            </a>
            <button
              onClick={() => {
                fileInputRef.current?.click();
                setLightboxOpen(false);
              }}
              className="flex items-center gap-1.5 text-sm px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors backdrop-blur-sm"
            >
              <Upload className="w-4 h-4" />
              Upload New
            </button>
          </div>
        </div>
      )}

      {/* Variant Modal */}
      {showVariants && (
        <VariantModal
          variants={variants}
          loading={generatingVariants}
          onSelect={handleVariantSelect}
          onClose={() => setShowVariants(false)}
        />
      )}

      {/* Repurpose Modal */}
      {showRepurpose && (
        <RepurposeModal
          results={repurposeResults}
          loading={generatingRepurpose}
          onClose={() => setShowRepurpose(false)}
        />
      )}

      {/* Live Carousel Pipeline Modal */}
      {carouselProgress && (
        <CarouselProgressModal
          progress={carouselProgress}
          onClose={() => {
            carouselClosedRef.current = true;
            setCarouselProgress(null);
          }}
        />
      )}

      {/* Pre-publish Checklist Modal */}
      {showPublishChecklist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-[#0D131F] rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-gray-100">Pre-publish Checklist</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Review before posting to LinkedIn</p>
              </div>
            </div>
            <div className="space-y-2">
              {getPublishChecklist().map((item) => (
                <div key={item.label} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 dark:bg-white/[0.06]">
                  {item.passed ? (
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className={cn("w-5 h-5 flex-shrink-0", item.optional ? "text-amber-400" : "text-red-500")} />
                  )}
                  <span className={cn("text-sm", item.passed ? "text-slate-700 dark:text-slate-300" : item.optional ? "text-amber-700 dark:text-amber-300" : "text-red-700 dark:text-red-300")}>
                    {item.label}
                    {!item.passed && item.optional && <span className="text-xs text-slate-400 ml-1">(optional)</span>}
                  </span>
                </div>
              ))}
            </div>
            {!getPublishChecklist()[0].passed && (
              <p className="text-xs text-red-500 dark:text-red-400">Post body must have at least 20 characters to publish.</p>
            )}
            <p className="text-xs text-center text-slate-400 dark:text-slate-500 flex items-center justify-center gap-1">
              <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
              Posted via LinkedIn&apos;s official API - safe &amp; compliant
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPublishChecklist(false)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePostToLinkedIn}
                disabled={!getPublishChecklist()[0].passed}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
                Publish Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white dark:bg-[#0D131F] rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-100 dark:bg-red-900/40 rounded-xl flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-gray-100">Delete this post?</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  This action cannot be undone. The post and its generated image will be permanently removed.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
