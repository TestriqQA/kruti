"use client";

import { X, Loader2, CheckCircle2, AlertCircle, Circle, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = "pending" | "running" | "done" | "error";
export type SlideStatus = "queued" | "rendering" | "done" | "error";

export interface PreflightItem {
  key: string;
  label: string;
  status: StepStatus;
  message?: string;
}

export interface CarouselSlideProgress {
  index: number;
  role?: string;
  headline?: string;
  subheadline?: string;
  nodes?: string[];
  visual?: string;
  connectsFrom?: string;
  connectsTo?: string;
  status: SlideStatus;
  url?: string;
  error?: string;
}

export interface CarouselProgress {
  running: boolean;
  preflight: PreflightItem[];
  plan: {
    status: StepStatus | "fallback";
    model?: string | null;
    theme?: string;
    style?: string;
    palette?: string;
    message?: string;
  };
  render: { started: boolean; total: number };
  slides: CarouselSlideProgress[];
  save: StepStatus;
  done: boolean;
  error?: string;
}

function StepIcon({ status }: { status: StepStatus | SlideStatus }) {
  if (status === "done") return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  if (status === "error") return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
  if (status === "running" || status === "rendering")
    return <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />;
  return <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />;
}

const ROLE_LABEL: Record<string, string> = { hook: "Hook", point: "Key point", takeaway: "Takeaway" };

export default function CarouselProgressModal({
  progress,
  onClose,
}: {
  progress: CarouselProgress;
  onClose: () => void;
}) {
  const { preflight, plan, render, slides, save, done, error, running } = progress;
  const hasPackets = slides.some((s) => s.headline);

  return (
    <></>
    // <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    //   <div className="bg-white dark:bg-[#0D131F] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
    //     {/* Header */}
    //     <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10">
    //       <div>
    //         <h2 className="font-display text-lg font-bold text-slate-900 dark:text-gray-100">
    //           Generating carousel
    //         </h2>
    //         <p className="text-sm text-slate-500 dark:text-slate-400">
    //           {running
    //             ? "Live pipeline - each step as it happens"
    //             : done
    //             ? "Finished - here is exactly what ran"
    //             : error
    //             ? "Stopped - see where it failed below"
    //             : "Pipeline"}
    //         </p>
    //       </div>
    //       <button
    //         onClick={onClose}
    //         className="p-2 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
    //         aria-label="Close"
    //       >
    //         <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
    //       </button>
    //     </div>

    //     {/* Body */}
    //     <div className="flex-1 overflow-y-auto p-6 space-y-5">
    //       {/* Preflight */}
    //       <section>
    //         <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
    //           Preflight checks
    //         </h3>
    //         <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
    //           {preflight.map((p) => (
    //             <div key={p.key} className="flex items-center gap-2 text-sm">
    //               <StepIcon status={p.status} />
    //               <span className="text-slate-700 dark:text-slate-300">{p.label}</span>
    //               {p.status === "error" && p.message && (
    //                 <span className="text-red-500 text-xs truncate">- {p.message}</span>
    //               )}
    //             </div>
    //           ))}
    //         </div>
    //       </section>

    //       <div className="flex justify-center">
    //         <ArrowDown className="w-4 h-4 text-slate-300 dark:text-slate-600" />
    //       </div>

    //       {/* Stage 1 - Planner */}
    //       <section>
    //         <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
    //           Stage 1 - Planner (text model)
    //         </h3>
    //         <div className="flex items-center gap-2 text-sm">
    //           <StepIcon status={plan.status === "fallback" ? "done" : (plan.status as StepStatus)} />
    //           <span className="text-slate-700 dark:text-slate-300">
    //             {plan.status === "pending" && "Waiting to plan the slides"}
    //             {plan.status === "running" && "Sending the full post to the planner..."}
    //             {plan.status === "done" &&
    //               `Plan ready - ${slides.length} packet${slides.length === 1 ? "" : "s"}${
    //                 plan.model ? ` via ${plan.model}` : ""
    //               }`}
    //             {plan.status === "fallback" && (plan.message || "Planner unavailable - using fallback")}
    //             {plan.status === "error" && (plan.message || "Planning failed")}
    //           </span>
    //         </div>
    //         {plan.theme && (
    //           <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
    //             <span className="font-medium text-slate-500 dark:text-slate-400">Theme: </span>
    //             {plan.theme}
    //           </p>
    //         )}
    //         {(plan.style || plan.palette) && (
    //           <div className="mt-2 flex flex-wrap gap-1.5">
    //             {plan.style && (
    //               <span className="text-[11px] px-2 py-1 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">
    //                 Style: {plan.style}
    //               </span>
    //             )}
    //             {plan.palette && (
    //               <span className="text-[11px] px-2 py-1 rounded-md bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300">
    //                 Palette: {plan.palette}
    //               </span>
    //             )}
    //           </div>
    //         )}
    //       </section>

    //       {/* Stage 2 - Per-slide packets + render */}
    //       {slides.length > 0 && (
    //         <section>
    //           <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
    //             Stage 2 - Render (Nano Banana Pro){render.total ? ` - ${slides.filter((s) => s.status === "done").length}/${render.total}` : ""}
    //           </h3>
    //           <div className="space-y-3">
    //             {slides.map((s) => (
    //               <div
    //                 key={s.index}
    //                 className="border border-slate-100 dark:border-white/10 rounded-xl p-3 flex gap-3"
    //               >
    //                 {/* Thumbnail / status square */}
    //                 <div className="w-16 h-16 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-100 dark:border-white/10 flex items-center justify-center overflow-hidden shrink-0">
    //                   {s.url ? (
    //                     // eslint-disable-next-line @next/next/no-img-element
    //                     <img src={s.url} alt={`Slide ${s.index + 1}`} className="w-full h-full object-cover" />
    //                   ) : (
    //                     <StepIcon status={s.status} />
    //                   )}
    //                 </div>
    //                 {/* Packet content */}
    //                 <div className="min-w-0 flex-1">
    //                   <div className="flex items-center gap-2">
    //                     <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-300">
    //                       Slide {s.index + 1}
    //                       {s.role ? ` - ${ROLE_LABEL[s.role] || s.role}` : ""}
    //                     </span>
    //                     <span
    //                       className={cn(
    //                         "text-[11px]",
    //                         s.status === "done" && "text-emerald-500",
    //                         s.status === "rendering" && "text-blue-500",
    //                         s.status === "error" && "text-red-500",
    //                         s.status === "queued" && "text-slate-400"
    //                       )}
    //                     >
    //                       {s.status === "queued" && "queued"}
    //                       {s.status === "rendering" && "rendering..."}
    //                       {s.status === "done" && "done"}
    //                       {s.status === "error" && (s.error || "failed")}
    //                     </span>
    //                   </div>
    //                   {s.headline && (
    //                     <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-1 truncate">
    //                       {s.headline}
    //                     </p>
    //                   )}
    //                   {s.subheadline && (
    //                     <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{s.subheadline}</p>
    //                   )}
    //                   {s.nodes && s.nodes.length > 0 && (
    //                     <div className="flex flex-wrap gap-1 mt-1">
    //                       {s.nodes.map((n, i) => (
    //                         <span
    //                           key={i}
    //                           className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400"
    //                         >
    //                           {n}
    //                         </span>
    //                       ))}
    //                     </div>
    //                   )}
    //                   {s.visual && (
    //                     <details className="mt-1.5">
    //                       <summary className="text-[11px] text-slate-400 dark:text-slate-500 cursor-pointer select-none">
    //                         Visual prompt
    //                       </summary>
    //                       <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
    //                         {s.visual}
    //                       </p>
    //                     </details>
    //                   )}
    //                   {(s.connectsFrom || s.connectsTo) && (
    //                     <div className="mt-1 space-y-0.5">
    //                       {s.connectsFrom && (
    //                         <p className="text-[10px] text-slate-400 dark:text-slate-500">
    //                           from prev: {s.connectsFrom}
    //                         </p>
    //                       )}
    //                       {s.connectsTo && (
    //                         <p className="text-[10px] text-slate-400 dark:text-slate-500">
    //                           to next: {s.connectsTo}
    //                         </p>
    //                       )}
    //                     </div>
    //                   )}
    //                 </div>
    //               </div>
    //             ))}
    //           </div>
    //         </section>
    //       )}

    //       {/* Stage 3 - Save */}
    //       {hasPackets || save !== "pending" ? (
    //         <section>
    //           <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
    //             Stage 3 - Save
    //           </h3>
    //           <div className="flex items-center gap-2 text-sm">
    //             <StepIcon status={save} />
    //             <span className="text-slate-700 dark:text-slate-300">
    //               {save === "pending" && "Waiting to save the carousel"}
    //               {save === "running" && "Saving the carousel to the post..."}
    //               {save === "done" && "Saved to the post"}
    //             </span>
    //           </div>
    //         </section>
    //       ) : null}

    //       {/* Outcome banner */}
    //       {error && (
    //         <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20">
    //           <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
    //           <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
    //         </div>
    //       )}
    //       {done && !error && (
    //         <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
    //           <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
    //           <p className="text-sm text-emerald-600 dark:text-emerald-300">
    //             Carousel ready - {slides.filter((s) => s.status === "done").length} image
    //             {slides.filter((s) => s.status === "done").length === 1 ? "" : "s"} generated.
    //           </p>
    //         </div>
    //       )}
    //     </div>

    //     {/* Footer */}
    //     <div className="px-6 py-4 border-t border-slate-100 dark:border-white/10 flex justify-end">
    //       <button
    //         onClick={onClose}
    //         className="text-sm px-4 py-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
    //       >
    //         {running ? "Run in background" : "Close"}
    //       </button>
    //     </div>
    //   </div>
    // </div>
  );
}
