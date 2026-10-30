"use client";

import { useState } from "react";
import { Plus, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_LIST_ITEMS, MAX_LIST_ITEM_CHARS } from "@/lib/profile-completeness";

const ACCENT = {
  blue: "border-blue-600 bg-brand text-white",
  indigo: "border-indigo-500 bg-indigo-500 text-white",
} as const;

const IDLE =
  "border-edge text-text-2 hover:border-edge dark:hover:border-white/20";

const norm = (s: string) => s.trim().replace(/\s+/g, " ");
const same = (a: string, b: string) => norm(a).toLowerCase() === norm(b).toLowerCase();

/**
 * A preset chip list the user can also add their own answers to.
 *
 * Both questions on the "Goals & Content Style" step are stored as a plain
 * JSON string array and are fed to the model verbatim - buildProfileContext()
 * lists them, and assignPostStyles() rotates the style labels across the batch.
 * Neither the onboarding route nor the profile route checks the values against
 * the preset arrays, so a label the user typed themselves reaches the prompt on
 * exactly the same path a preset does. The only thing missing was a way to
 * enter one.
 *
 * Shared by OnboardingWizard and SettingsClient on purpose. When these two
 * screens held their own copies of the markup, a value added on one of them was
 * invisible on the other - the stored array still contained it, and it was
 * still saved back, but with nothing rendering it the user could neither see
 * nor remove their own answer.
 */
export default function ChipMultiSelect({
  options,
  value,
  onChange,
  accent,
  addPlaceholder,
  inputId,
  recommended,
}: {
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
  accent: keyof typeof ACCENT;
  addPlaceholder: string;
  /** Needed because two of these can share a page. */
  inputId: string;
  /**
   * Options to mark as suggested. Marks the OPTION, not the selection, so the
   * mark stays put whether or not the user has chosen it - it means "we think
   * this one suits you", which is still true after they decline it.
   */
  recommended?: readonly string[];
}) {
  const [draft, setDraft] = useState("");

  // Anything stored that is not one of the presets is the user's own wording -
  // including values added before an option list was edited.
  const custom = value.filter((v) => !options.some((o) => same(o, v)));
  const atCap = value.length >= MAX_LIST_ITEMS;

  function toggle(option: string) {
    onChange(
      value.some((v) => same(v, option))
        ? value.filter((v) => !same(v, option))
        : [...value, option]
    );
  }

  function add() {
    const entry = norm(draft).slice(0, MAX_LIST_ITEM_CHARS);
    if (!entry) return;

    // Typing something that already exists selects it rather than storing a
    // near-duplicate - two labels that differ only in case would otherwise both
    // land in the prompt and read as two different styles.
    const preset = options.find((o) => same(o, entry));
    if (preset) {
      if (!value.some((v) => same(v, preset))) onChange([...value, preset]);
      setDraft("");
      return;
    }
    if (value.some((v) => same(v, entry))) {
      setDraft("");
      return;
    }
    if (atCap) return;

    onChange([...value, entry]);
    setDraft("");
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            title={
              recommended?.some((r) => same(r, option))
                ? "Suggested from your LinkedIn profile"
                : undefined
            }
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium border-2 transition-all",
              value.some((v) => same(v, option)) ? ACCENT[accent] : IDLE
            )}
          >
            {recommended?.some((r) => same(r, option)) && (
              <Sparkles
                className="mr-1.5 inline h-3 w-3 align-[-1px]"
                aria-label="Recommended"
              />
            )}
            {option}
          </button>
        ))}

        {custom.map((entry) => (
          <span
            key={entry}
            className={cn(
              "inline-flex items-center gap-1.5 pl-4 pr-2 py-2 rounded-full text-sm font-medium border-2",
              ACCENT[accent]
            )}
          >
            {entry}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => !same(v, entry)))}
              aria-label={`Remove ${entry}`}
              className="rounded-full p-0.5 transition-colors hover:bg-white/20"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          id={inputId}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_LIST_ITEM_CHARS))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          disabled={atCap}
          placeholder={atCap ? `Maximum ${MAX_LIST_ITEMS} reached` : addPlaceholder}
          className="flex-1 px-4 py-2 text-sm rounded-control border border-edge bg-card text-text placeholder:text-text-3 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={add}
          disabled={atCap || !norm(draft)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-control border border-edge text-sm font-medium text-text transition-colors hover:bg-card-muted disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </div>
  );
}
