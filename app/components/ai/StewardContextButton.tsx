/**
 * StewardContextButton — a small, inline contextual AI action button.
 *
 * Fires a `steward:open-with-prompt` CustomEvent when clicked, which causes
 * the global StewardDockPanel to open and auto-send the specified prompt.
 * Designed to appear natively inside cards, record pages, and report widgets.
 */
"use client";

import StewardAvatarIcon from "@/app/components/ui/StewardAvatarIcon";
import { openStewardWithPrompt } from "@/app/lib/steward-context";
import type { StewardOpenPromptDetail } from "@/app/lib/steward-context";

// ── Preset action definitions ──────────────────────────────────────────────────

/** Convenience type for building prompt detail with an optional context injection. */
export type StewardActionPreset =
  | "ask-donor"
  | "draft-followup"
  | "find-risks"
  | "create-tasks"
  | "explain-report"
  | "summarize-event"
  | "analyze-campaign"
  | "draft-appeal"
  | "identify-prospects";

// ── Props ──────────────────────────────────────────────────────────────────────

interface StewardContextButtonProps {
  /** The label shown on the button. */
  label: string;
  /** The prompt sent to Steward when clicked. */
  prompt: string;
  /** Optional CRM module scope. Defaults to "donor". */
  moduleKey?: StewardOpenPromptDetail["moduleKey"];
  /** Optional chat mode. Defaults to "ask". */
  mode?: StewardOpenPromptDetail["mode"];
  /**
   * Visual variant.
   * - "chip" (default): icon + label, small rounded pill.
   * - "mini": icon + label, more compact.
   * - "icon": icon only with tooltip.
   */
  variant?: "chip" | "mini" | "icon";
  /** Extra CSS classes. */
  className?: string;
  /** Whether the button is disabled (e.g. no AI configured). */
  disabled?: boolean;
  /** Optional title for icon-only variant. */
  title?: string;
}

/** A compact contextual button that opens Steward with a pre-filled prompt. */
export default function StewardContextButton({
  label,
  prompt,
  moduleKey = "donor",
  mode = "ask",
  variant = "chip",
  className = "",
  disabled = false,
  title,
}: StewardContextButtonProps) {
  function handleClick(e: React.MouseEvent) {
    e.stopPropagation(); // don't trigger parent card clicks
    if (disabled) return;
    openStewardWithPrompt({ prompt, moduleKey, mode });
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={title ?? label}
        aria-label={label}
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
      >
        <StewardAvatarIcon size={13} alt="Steward" />
      </button>
    );
  }

  if (variant === "mini") {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={title ?? label}
        className={`inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${className}`}
      >
        <StewardAvatarIcon size={10} alt="" />
        {label}
      </button>
    );
  }

  // default: "chip"
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      title={title ?? label}
      className={`inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50/80 px-2 py-0.5 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${className}`}
    >
      <StewardAvatarIcon size={11} alt="" />
      {label}
    </button>
  );
}
