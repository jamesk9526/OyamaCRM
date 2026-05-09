/**
 * Shared TypeScript types for the Grant Management module.
 * Used across the grants list, detail, writing, and funder pages.
 */

/** Status pipeline stages for a grant application. */
export type GrantStatus =
  | "IDEA" | "RESEARCH" | "LOI_DRAFT" | "LOI_SUBMITTED"
  | "PROPOSAL_DRAFT" | "PROPOSAL_SUBMITTED" | "UNDER_REVIEW"
  | "AWARDED" | "REJECTED" | "WITHDRAWN" | "CLOSED";

/** Category of the grant-making organization. */
export type GrantFunderType =
  | "GOVERNMENT" | "PRIVATE_FOUNDATION" | "CORPORATE"
  | "COMMUNITY" | "FAITH_BASED" | "INDIVIDUAL" | "OTHER";

/** Type of entry in the grant activity timeline. */
export type GrantActivityType =
  | "NOTE" | "STATUS_CHANGE" | "LOI_SUBMITTED" | "PROPOSAL_SUBMITTED"
  | "AWARD_NOTIFICATION" | "REJECTION_NOTIFICATION"
  | "REPORTING_SUBMITTED" | "DOCUMENT_ADDED" | "OTHER";

/** A grant funder (foundation, government agency, corporate, etc.) */
export interface GrantFunder {
  id: string;
  organizationId: string;
  name: string;
  type: GrantFunderType;
  website?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  notes?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { grants: number };
}

/** A grant opportunity tracked through the application pipeline. */
export interface Grant {
  id: string;
  organizationId: string;
  funderId: string;
  assigneeId?: string | null;
  title: string;
  programArea?: string | null;
  status: GrantStatus;
  amountRequested?: number | string | null;
  amountAwarded?: number | string | null;
  requiresLOI: boolean;
  loiDeadline?: string | null;
  loiSubmittedAt?: string | null;
  applicationDeadline?: string | null;
  submittedAt?: string | null;
  awardedAt?: string | null;
  rejectedAt?: string | null;
  grantPeriodStart?: string | null;
  grantPeriodEnd?: string | null;
  reportingDeadline?: string | null;
  reportingSubmittedAt?: string | null;
  notes?: string | null;
  internalNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  funder?: Pick<GrantFunder, "id" | "name" | "type">;
  assignee?: { id: string; firstName: string; lastName: string } | null;
  sections?: GrantSection[];
  activities?: GrantActivity[];
  _count?: { sections: number; activities: number };
}

/** A writing section within a grant proposal. */
export interface GrantSection {
  id: string;
  grantId: string;
  key: string;
  title: string;
  content?: string | null;
  wordLimit?: number | null;
  sortOrder: number;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
}

/** A timeline event or note recorded against a grant. */
export interface GrantActivity {
  id: string;
  grantId: string;
  userId?: string | null;
  type: GrantActivityType;
  description: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  user?: { id: string; firstName: string; lastName: string } | null;
}

/** Summary stats returned by GET /api/grants/stats */
export interface GrantStats {
  byStatus: Record<GrantStatus, { count: number; totalRequested: number }>;
  totalRequested: number;
  totalAwarded: number;
  total: number;
  upcomingDeadlines: number;
}

// ─── Status metadata ──────────────────────────────────────────────────────────

/** Visual metadata for each grant status. */
export const STATUS_META: Record<GrantStatus, { label: string; color: string; bg: string; border: string; stage: "active" | "terminal" }> = {
  IDEA:               { label: "Idea",              color: "text-gray-600",   bg: "bg-gray-100",   border: "border-gray-200",  stage: "active" },
  RESEARCH:           { label: "Research",          color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200",  stage: "active" },
  LOI_DRAFT:          { label: "LOI Draft",         color: "text-yellow-700", bg: "bg-yellow-50",  border: "border-yellow-200",stage: "active" },
  LOI_SUBMITTED:      { label: "LOI Submitted",     color: "text-orange-700", bg: "bg-orange-50",  border: "border-orange-200",stage: "active" },
  PROPOSAL_DRAFT:     { label: "Proposal Draft",    color: "text-purple-700", bg: "bg-purple-50",  border: "border-purple-200",stage: "active" },
  PROPOSAL_SUBMITTED: { label: "Proposal Submitted",color: "text-indigo-700", bg: "bg-indigo-50",  border: "border-indigo-200",stage: "active" },
  UNDER_REVIEW:       { label: "Under Review",      color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200", stage: "active" },
  AWARDED:            { label: "Awarded",            color: "text-green-700",  bg: "bg-green-100",  border: "border-green-300", stage: "terminal" },
  REJECTED:           { label: "Rejected",           color: "text-red-700",    bg: "bg-red-50",     border: "border-red-200",   stage: "terminal" },
  WITHDRAWN:          { label: "Withdrawn",          color: "text-gray-500",   bg: "bg-gray-100",   border: "border-gray-200",  stage: "terminal" },
  CLOSED:             { label: "Closed",             color: "text-gray-500",   bg: "bg-gray-100",   border: "border-gray-200",  stage: "terminal" },
};

/** Ordered pipeline stages (active statuses, excluding terminal). */
export const PIPELINE_STAGES: GrantStatus[] = [
  "IDEA", "RESEARCH", "LOI_DRAFT", "LOI_SUBMITTED",
  "PROPOSAL_DRAFT", "PROPOSAL_SUBMITTED", "UNDER_REVIEW",
];

/** Terminal statuses (final outcomes). */
export const TERMINAL_STAGES: GrantStatus[] = ["AWARDED", "REJECTED", "WITHDRAWN", "CLOSED"];

/** Format currency with $ prefix. */
export function fmt$(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v === 0 ? "—" : `$${v.toLocaleString()}`;
}

/** Format a date string as a short human-readable date. */
export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Count words in a string. */
export function wordCount(text: string | null | undefined): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}
