/** Local persistence helpers for letters generation wizard state. */

import type { LettersWizardState } from "@/app/components/letters/generate/types";

const STORAGE_KEY = "letters-generate-wizard-state-v1";

export const DEFAULT_LETTERS_WIZARD_STATE: LettersWizardState = {
  projectType: "INDIVIDUAL",
  templateId: "",
  constituentId: "",
  donationId: "",
  campaignId: "",
  eventId: "",
  year: String(new Date().getFullYear()),
  batchFilterType: "ALL",
  batchConstituentIdsText: "",
  dedupeHousehold: true,
  routeTarget: "PRINT_QUEUE",
  previewConfirmedAt: null,
};

/** Loads persisted wizard state from localStorage with safe fallback defaults. */
export function loadLettersWizardState(): LettersWizardState {
  if (typeof window === "undefined") return DEFAULT_LETTERS_WIZARD_STATE;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LETTERS_WIZARD_STATE;
    const parsed = JSON.parse(raw) as Partial<LettersWizardState>;
    return {
      ...DEFAULT_LETTERS_WIZARD_STATE,
      ...parsed,
    };
  } catch {
    return DEFAULT_LETTERS_WIZARD_STATE;
  }
}

/** Saves current wizard state so users can resume generation steps later. */
export function saveLettersWizardState(state: LettersWizardState): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors so the wizard remains usable.
  }
}
