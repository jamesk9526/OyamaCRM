/**
 * Steward context event utilities.
 *
 * Uses a browser CustomEvent on `window` so any component can open the Steward
 * dock panel with a pre-filled (and auto-sent) prompt without needing to be
 * inside the same React subtree as StewardDockPanel.
 */

/** The event name fired to open Steward with a specific prompt. */
export const STEWARD_OPEN_EVENT = "steward:open-with-prompt" as const;

type StewardModuleKey = "donor" | "compassion" | "events" | "watchdog" | "webmaster" | "hrm" | "all";
type StewardChatMode = "ask" | "analyze" | "draft" | "action" | "help";

/** Payload attached to the steward:open-with-prompt CustomEvent. */
export interface StewardOpenPromptDetail {
  /** The message to send to Steward. Pre-filled and auto-sent when dock opens. */
  prompt: string;
  /** CRM module scope to activate in the dock. Defaults to "donor". */
  moduleKey?: StewardModuleKey;
  /** Chat mode to activate. Defaults to "ask". */
  mode?: StewardChatMode;
}

/**
 * Opens the Steward dock panel with a pre-filled prompt that is auto-sent.
 * Fires a CustomEvent on `window` so StewardDockPanel can listen from anywhere.
 *
 * Safe to call on the server (no-op when window is undefined).
 */
export function openStewardWithPrompt(detail: StewardOpenPromptDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<StewardOpenPromptDetail>(STEWARD_OPEN_EVENT, { detail }));
}
