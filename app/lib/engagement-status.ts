/**
 * Shared donor-engagement status vocabulary.
 *
 * Communications, Letters & Printables, Steward Paths, and Tasks each have their
 * own backend status enums. The user-facing language across them must be aligned
 * so a single donor timeline reads consistently.
 *
 * See `docs/DONOR_ENGAGEMENT_SYSTEM.md` for the canonical vocabulary and
 * `docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md` Phase 2 for context.
 *
 * This module is the single source of truth for status label + tone mapping.
 * It is intentionally pure (no React/DOM imports) so it can be reused by
 * server code, tests, and any rendering surface.
 */

/** The fixed set of user-facing engagement status labels. */
export type EngagementStatusLabel =
  | "Draft"
  | "Needs Review"
  | "Approved"
  | "Scheduled"
  | "Sent"
  | "Generated"
  | "Queued For Print"
  | "Printed"
  | "Queued For Mail"
  | "Mailed"
  | "Completed"
  | "Failed"
  | "Canceled"
  | "Archived";

/** Tone keys used by UI chip components to pick a color palette. */
export type EngagementStatusTone =
  | "neutral"
  | "amber"
  | "blue"
  | "indigo"
  | "green"
  | "red"
  | "slate";

/** Channels that can be mapped into the shared engagement status vocabulary. */
export type EngagementChannel =
  | "email" // EmailCampaign.status
  | "letter" // GeneratedLetter.status
  | "pathDraft" // StewardPathEmailDraft.status
  | "pathStepRun" // StewardPathStepRun.status
  | "pathEnrollment" // StewardPathEnrollment.status
  | "task"; // Task.status

/** Tone palette intended to match Tailwind chip styles already used across DonorCRM. */
export const ENGAGEMENT_STATUS_TONES: Record<EngagementStatusLabel, EngagementStatusTone> = {
  Draft: "slate",
  "Needs Review": "amber",
  Approved: "indigo",
  Scheduled: "blue",
  Sent: "green",
  Generated: "blue",
  "Queued For Print": "amber",
  Printed: "indigo",
  "Queued For Mail": "amber",
  Mailed: "green",
  Completed: "green",
  Failed: "red",
  Canceled: "red",
  Archived: "neutral",
};

/** Tailwind color class mapping for engagement status chips. */
export const ENGAGEMENT_STATUS_TONE_CLASSES: Record<EngagementStatusTone, string> = {
  neutral: "bg-gray-100 text-gray-700",
  slate: "bg-slate-100 text-slate-700",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-blue-100 text-blue-700",
  indigo: "bg-indigo-100 text-indigo-700",
  green: "bg-green-100 text-green-700",
  red: "bg-red-100 text-red-600",
};

/** Email campaign backend status -> shared label. */
const EMAIL_STATUS_MAP: Record<string, EngagementStatusLabel> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  SENDING: "Scheduled",
  SENT: "Sent",
  CANCELLED: "Canceled",
  CANCELED: "Canceled",
  FAILED: "Failed",
  ARCHIVED: "Archived",
};

/** Generated letter backend status -> shared label. */
const LETTER_STATUS_MAP: Record<string, EngagementStatusLabel> = {
  DRAFT: "Draft",
  NEEDS_REVIEW: "Needs Review",
  APPROVED: "Approved",
  GENERATED: "Generated",
  QUEUED_FOR_PRINT: "Queued For Print",
  PRINTED: "Printed",
  QUEUED_FOR_MAIL: "Queued For Mail",
  MAILED: "Mailed",
  EMAIL_DRAFT_CREATED: "Draft",
  EMAIL_SENT: "Sent",
  FAILED: "Failed",
  ARCHIVED: "Archived",
};

/** Steward path email draft backend status -> shared label. */
const PATH_DRAFT_STATUS_MAP: Record<string, EngagementStatusLabel> = {
  DRAFT_CREATED: "Draft",
  EDITED: "Draft",
  READY_FOR_REVIEW: "Needs Review",
  APPROVED: "Approved",
  SENT: "Sent",
  SKIPPED: "Canceled",
  FAILED: "Failed",
};

/** Steward path step run backend status -> shared label. */
const PATH_STEP_RUN_STATUS_MAP: Record<string, EngagementStatusLabel> = {
  PENDING: "Scheduled",
  RUNNING: "Scheduled",
  WAITING: "Scheduled",
  COMPLETED: "Completed",
  SKIPPED: "Canceled",
  FAILED: "Failed",
};

/** Steward path enrollment backend status -> shared label. */
const PATH_ENROLLMENT_STATUS_MAP: Record<string, EngagementStatusLabel> = {
  ACTIVE: "Scheduled",
  PAUSED: "Needs Review",
  COMPLETED: "Completed",
  CANCELLED: "Canceled",
  CANCELED: "Canceled",
  FAILED: "Failed",
};

/** Task backend status -> shared label. */
const TASK_STATUS_MAP: Record<string, EngagementStatusLabel> = {
  PENDING: "Scheduled",
  IN_PROGRESS: "Scheduled",
  COMPLETED: "Completed",
  CANCELLED: "Canceled",
  CANCELED: "Canceled",
};

const CHANNEL_MAPS: Record<EngagementChannel, Record<string, EngagementStatusLabel>> = {
  email: EMAIL_STATUS_MAP,
  letter: LETTER_STATUS_MAP,
  pathDraft: PATH_DRAFT_STATUS_MAP,
  pathStepRun: PATH_STEP_RUN_STATUS_MAP,
  pathEnrollment: PATH_ENROLLMENT_STATUS_MAP,
  task: TASK_STATUS_MAP,
};

/**
 * Maps a channel-specific backend status string to the shared user-facing label.
 *
 * Returns the original status (title-cased) when no mapping exists. Callers
 * should treat this as an indication that the backend gained a new value that
 * has not yet been added to the shared vocabulary; surface a follow-up.
 */
export function toEngagementStatusLabel(
  channel: EngagementChannel,
  rawStatus: string | null | undefined,
): EngagementStatusLabel | string {
  if (!rawStatus) return "Draft";
  const normalized = rawStatus.toUpperCase();
  const mapped = CHANNEL_MAPS[channel]?.[normalized];
  if (mapped) return mapped;
  // Fallback: title-case the raw value so we never render an enum literal.
  return rawStatus
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** Returns the chip tone for a given user-facing engagement status label. */
export function getEngagementStatusTone(label: string): EngagementStatusTone {
  return (ENGAGEMENT_STATUS_TONES as Record<string, EngagementStatusTone>)[label] ?? "neutral";
}

/** Returns the Tailwind chip class string for a given user-facing label. */
export function getEngagementStatusChipClass(label: string): string {
  return ENGAGEMENT_STATUS_TONE_CLASSES[getEngagementStatusTone(label)];
}

/** The ordered legend used by UI surfaces that show all possible statuses. */
export const ENGAGEMENT_STATUS_LEGEND: EngagementStatusLabel[] = [
  "Draft",
  "Needs Review",
  "Approved",
  "Scheduled",
  "Sent",
  "Generated",
  "Queued For Print",
  "Printed",
  "Queued For Mail",
  "Mailed",
  "Completed",
  "Failed",
  "Canceled",
  "Archived",
];
