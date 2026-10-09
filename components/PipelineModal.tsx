"use client";

import { X, Loader2, CheckCircle2, AlertCircle, Circle, MinusCircle, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import PostImage from "@/components/PostImage";

export type StepStatus = "pending" | "running" | "done" | "error" | "skipped";

export interface PipelineCheck {
  key: string;
  label: string;
  status: StepStatus;
  detail?: string;
}

export interface PipelineStage {
  key: string;
  label: string;
  status: StepStatus;
  /** One-line summary shown next to the label. */
  detail?: string;
  /** Extra detail lines - the "everything that happened" part. */
  lines?: string[];
  /** The exact prompt sent to the model for this stage. */
  prompt?: string;
}

export interface PipelineItem {
  index: number;
  title: string;
  status: StepStatus;
  detail?: string;
  /** Thumbnail for image runs. */
  url?: string;
  /** The exact prompt sent to the image model. */
  prompt?: string;
}

export interface PipelineState {
  kind: "posts" | "images";
  title: string;
  running: boolean;
  done: boolean;
  error?: string;
  checks: PipelineCheck[];
  stages: PipelineStage[];
  items: PipelineItem[];
  itemsLabel: string;
  summary?: string;
}

/**
 * The exact prompt sent to the model, collapsed by default - these run to several
 * KB and would bury the pipeline if always expanded.
 */
function PromptBlock({ prompt }: { prompt: string }) {
  return (
    <details className="mt-2 ml-6 group">
      <summary className="cursor-pointer select-none text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
        <span className="group-open:hidden">Show prompt</span>
        <span className="hidden group-open:inline">Hide prompt</span>
        <span className="ml-1.5 font-normal text-slate-400 dark:text-slate-500">
          ({prompt.length.toLocaleString()} chars)
        </span>
      </summary>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600 dark:bg-white/[0.04] dark:text-slate-300">
        {prompt}
      </pre>
    </details>
  );
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "done") return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  if (status === "error") return <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />;
  if (status === "skipped") return <MinusCircle className="w-4 h-4 text-amber-500 shrink-0" />;
  if (status === "running") return <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />;
  return <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />;
}

/**
 * Live pipeline view for a long-running generation, mirroring the carousel popup:
 * preflight checks, then each stage as it happens, then the per-item results.
 *
 * Closing it does NOT stop the run - the run lives in GenerationProvider, so the
 * modal is just a window onto it and can be reopened at any time.
 */
export default function PipelineModal({
  state,
  onClose,
  onCancel,
}: {
  state: PipelineState;
  onClose: () => void;
  onCancel: () => void;
}) {
  const { title, running, done, error, checks, stages, items, itemsLabel, summary } = state;

  return (
    <></>
    // <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    //   <div className="bg-white dark:bg-[#0D131F] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
    //     {/* Header */}
    //     <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/10">
    //       <div className="min-w-0">
    //         <h2 className="font-display text-lg font-bold text-slate-900 dark:text-gray-100">{title}</h2>
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
    //       <div className="flex items-center gap-2 shrink-0">
    //         {running && (
    //           <button
    //             onClick={onCancel}
    //             className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
    //           >
    //             Cancel run
    //           </button>
    //         )}
    //         <button
    //           onClick={onClose}
    //           className="p-2 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
    //           aria-label="Close"
    //         >
    //           <X className="w-5 h-5 text-slate-500 dark:text-slate-400" />
    //         </button>
    //       </div>
    //     </div>

    //     {/* Body */}
    //     <div className="flex-1 overflow-y-auto p-6 space-y-5">
    //       {running && (
    //         <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
    //           You can close this and keep working - the run continues in the background
    //           and you will get a notification when it finishes.
    //         </p>
    //       )}

    //       {/* Preflight */}
    //       {checks.length > 0 && (
    //         <>
    //           <section>
    //             <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
    //               Preflight checks
    //             </h3>
    //             <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
    //               {checks.map((c) => (
    //                 <div key={c.key} className="flex items-center gap-2 text-sm">
    //                   <StepIcon status={c.status} />
    //                   <span className="text-slate-700 dark:text-slate-300">{c.label}</span>
    //                   {c.detail && (
    //                     <span
    //                       className={cn(
    //                         "text-xs truncate",
    //                         c.status === "error" ? "text-red-500" : "text-slate-400 dark:text-slate-500"
    //                       )}
    //                     >
    //                       - {c.detail}
    //                     </span>
    //                   )}
    //                 </div>
    //               ))}
    //             </div>
    //           </section>
    //           <div className="flex justify-center">
    //             <ArrowDown className="w-4 h-4 text-slate-300 dark:text-slate-600" />
    //           </div>
    //         </>
    //       )}

    //       {/* Stages */}
    //       {stages.length > 0 && (
    //         <section className="space-y-3">
    //           <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
    //             Stages
    //           </h3>
    //           {stages.map((s) => (
    //             <div
    //               key={s.key}
    //               className="rounded-xl border border-slate-100 dark:border-white/10 px-4 py-3"
    //             >
    //               <div className="flex items-center gap-2 text-sm">
    //                 <StepIcon status={s.status} />
    //                 <span className="font-medium text-slate-800 dark:text-slate-200">{s.label}</span>
    //                 {s.detail && (
    //                   <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
    //                     - {s.detail}
    //                   </span>
    //                 )}
    //               </div>
    //               {s.lines && s.lines.length > 0 && (
    //                 <ul className="mt-2 space-y-1 pl-6">
    //                   {s.lines.map((l, i) => (
    //                     <li
    //                       key={i}
    //                       className="text-xs leading-relaxed text-slate-500 dark:text-slate-400"
    //                     >
    //                       {l}
    //                     </li>
    //                   ))}
    //                 </ul>
    //               )}
    //               {s.prompt && <PromptBlock prompt={s.prompt} />}
    //             </div>
    //           ))}
    //         </section>
    //       )}

    //       {/* Per-item results */}
    //       {items.length > 0 && (
    //         <>
    //           <div className="flex justify-center">
    //             <ArrowDown className="w-4 h-4 text-slate-300 dark:text-slate-600" />
    //           </div>
    //           <section>
    //             <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
    //               {itemsLabel}
    //             </h3>
    //             <div className="space-y-1.5">
    //               {items.map((it) => (
    //                 <div
    //                   key={it.index}
    //                   className="flex items-center gap-2.5 rounded-lg border border-slate-100 dark:border-white/10 px-3 py-2"
    //                 >
    //                   <StepIcon status={it.status} />
    //                   {it.url && (
    //                     <PostImage
    //                       src={it.url}
    //                       className="w-8 h-8 rounded object-cover shrink-0"
    //                       iconClassName="w-3 h-3"
    //                     />
    //                   )}
    //                   <div className="min-w-0 flex-1">
    //                     <p className="truncate text-sm text-slate-700 dark:text-slate-300">
    //                       {it.title}
    //                     </p>
    //                     {it.detail && (
    //                       <p
    //                         className={cn(
    //                           "truncate text-xs",
    //                           it.status === "error"
    //                             ? "text-red-500"
    //                             : "text-slate-400 dark:text-slate-500"
    //                         )}
    //                       >
    //                         {it.detail}
    //                       </p>
    //                     )}
    //                     {it.prompt && <PromptBlock prompt={it.prompt} />}
    //                   </div>
    //                 </div>
    //               ))}
    //             </div>
    //           </section>
    //         </>
    //       )}

    //       {/* Outcome */}
    //       {error && (
    //         <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
    //           <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
    //           <span>{error}</span>
    //         </div>
    //       )}
    //       {done && summary && !error && (
    //         <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
    //           <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
    //           <span>{summary}</span>
    //         </div>
    //       )}
    //     </div>
    //   </div>
    // </div>
  );
}
