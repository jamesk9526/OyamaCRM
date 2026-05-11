// Client-side API helpers for Watchdog feedback ticket triage workflows.

import { apiFetch } from "@/app/lib/auth-client";
import type {
  WatchdogFeedbackTicket,
  WatchdogTicketListResponse,
  WatchdogTicketSummary,
  WatchdogTicketFilters,
  WatchdogTicketUser,
  WatchdogFeedbackTicketStatus,
} from "@/app/features/watchdog/tickets/types";

/** Builds query-string parameters from one ticket filter state. */
function buildListQuery(filters: WatchdogTicketFilters, page: number, limit: number): string {
  const params = new URLSearchParams();

  params.set("page", String(page));
  params.set("limit", String(limit));

  if (filters.search.trim()) params.set("search", filters.search.trim());
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.priority !== "all") params.set("priority", filters.priority);
  if (filters.crmScope !== "all") params.set("crmScope", filters.crmScope);
  if (filters.assignedTo.trim()) params.set("assignedTo", filters.assignedTo.trim());

  return params.toString();
}

/** Loads aggregate ticket counts for Watchdog feedback dashboard cards. */
export async function fetchWatchdogTicketSummary(): Promise<WatchdogTicketSummary> {
  return apiFetch<WatchdogTicketSummary>("/api/watchdog/feedback-tickets/summary");
}

/** Loads assignable users that can own feedback tickets. */
export async function fetchWatchdogTicketDevelopers(): Promise<WatchdogTicketUser[]> {
  const response = await apiFetch<{ items: WatchdogTicketUser[] }>("/api/watchdog/feedback-tickets/developers");
  return Array.isArray(response.items) ? response.items : [];
}

/** Loads a paginated feedback ticket list from Watchdog triage APIs. */
export async function fetchWatchdogTicketList(params: {
  filters: WatchdogTicketFilters;
  page: number;
  limit: number;
}): Promise<WatchdogTicketListResponse> {
  const query = buildListQuery(params.filters, params.page, params.limit);
  return apiFetch<WatchdogTicketListResponse>(`/api/watchdog/feedback-tickets?${query}`);
}

/** Loads one full ticket record by ID for the detail pane. */
export async function fetchWatchdogTicketById(id: string): Promise<WatchdogFeedbackTicket> {
  const response = await apiFetch<{ item: WatchdogFeedbackTicket }>(`/api/watchdog/feedback-tickets/${id}`);
  return response.item;
}

/** Applies status, assignment, and note updates to one Watchdog ticket. */
export async function updateWatchdogTicket(params: {
  id: string;
  status?: WatchdogFeedbackTicketStatus;
  priority?: "low" | "normal" | "high" | "urgent";
  assignedDeveloperId?: string | null;
  assignedToPersonId?: string;
  developerNotes?: string;
  resolutionNotes?: string;
}): Promise<WatchdogFeedbackTicket> {
  const response = await apiFetch<{ item: WatchdogFeedbackTicket }>(`/api/watchdog/feedback-tickets/${params.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      status: params.status,
      priority: params.priority,
      assignedDeveloperId: params.assignedDeveloperId,
      assignedToPersonId: params.assignedToPersonId,
      developerNotes: params.developerNotes,
      resolutionNotes: params.resolutionNotes,
    }),
  });
  return response.item;
}

/** Resolves one ticket with optional resolution notes. */
export async function resolveWatchdogTicket(id: string, resolutionNotes?: string): Promise<WatchdogFeedbackTicket> {
  const response = await apiFetch<{ item: WatchdogFeedbackTicket }>(`/api/watchdog/feedback-tickets/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ resolutionNotes }),
  });
  return response.item;
}

/** Reopens one previously resolved or closed ticket. */
export async function reopenWatchdogTicket(id: string): Promise<WatchdogFeedbackTicket> {
  const response = await apiFetch<{ item: WatchdogFeedbackTicket }>(`/api/watchdog/feedback-tickets/${id}/reopen`, {
    method: "POST",
    body: JSON.stringify({}),
  });
  return response.item;
}

/** Deletes one ticket when explicit cleanup is required. */
export async function deleteWatchdogTicket(id: string): Promise<void> {
  await apiFetch<{ success: boolean }>(`/api/watchdog/feedback-tickets/${id}`, {
    method: "DELETE",
  });
}
