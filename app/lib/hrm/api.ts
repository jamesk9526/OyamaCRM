// Client API wrappers for OyamaHRM route handlers.

import { apiFetch } from "@/app/lib/auth-client";
import type {
  HrmDashboardResponse,
  HrmLocationsResponse,
  HrmMessagesResponse,
  HrmPeopleResponse,
  HrmSchedulingResponse,
  HrmSettingsResponse,
} from "@/app/lib/hrm/types";

/** Loads HRM dashboard cards and list widgets. */
export async function fetchHrmDashboard(): Promise<HrmDashboardResponse> {
  return apiFetch<HrmDashboardResponse>("/api/hrm/dashboard");
}

/** Loads HRM people directory rows with optional filters. */
export async function fetchHrmPeople(params: {
  search?: string;
  status?: string;
  type?: string;
}): Promise<HrmPeopleResponse> {
  const searchParams = new URLSearchParams();

  if (params.search?.trim()) searchParams.set("search", params.search.trim());
  if (params.status?.trim()) searchParams.set("status", params.status.trim());
  if (params.type?.trim()) searchParams.set("type", params.type.trim());

  const query = searchParams.toString();
  return apiFetch<HrmPeopleResponse>(`/api/hrm/people${query ? `?${query}` : ""}`);
}

/** Loads date-scoped schedule assignments and overlap conflicts for HRM scheduling workspace. */
export async function fetchHrmScheduling(date?: string): Promise<HrmSchedulingResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiFetch<HrmSchedulingResponse>(`/api/hrm/scheduling${query}`);
}

/** Loads persisted HRM locations with optional search filters. */
export async function fetchHrmLocations(params?: {
  date?: string;
  status?: string;
  search?: string;
}): Promise<HrmLocationsResponse> {
  const searchParams = new URLSearchParams();

  if (params?.date) searchParams.set("date", params.date);
  if (params?.status?.trim()) searchParams.set("status", params.status.trim());
  if (params?.search?.trim()) searchParams.set("search", params.search.trim());

  const query = searchParams.toString();
  return apiFetch<HrmLocationsResponse>(`/api/hrm/locations${query ? `?${query}` : ""}`);
}

/** Creates one persisted HRM location row. */
export async function createHrmLocation(payload: {
  name: string;
  code?: string;
  timezone?: string;
  status?: "ACTIVE" | "INACTIVE";
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
}) {
  return apiFetch<{ item: unknown }>("/api/hrm/locations", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Updates one persisted HRM location row. */
export async function updateHrmLocation(locationId: string, payload: {
  name?: string;
  code?: string;
  timezone?: string;
  status?: "ACTIVE" | "INACTIVE";
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
}) {
  return apiFetch<{ item: unknown }>(`/api/hrm/locations/${locationId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** Loads HRM message folders for inbox/sent/announcement workflows. */
export async function fetchHrmMessages(folder: "inbox" | "sent" | "announcements"): Promise<HrmMessagesResponse> {
  return apiFetch<HrmMessagesResponse>(`/api/hrm/messages?folder=${folder}`);
}

/** Sends one internal HRM message. */
export async function sendHrmMessage(payload: {
  title: string;
  body: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  kind?: "DIRECT" | "ANNOUNCEMENT";
  recipientUserId?: string;
  recipientRole?: string;
  broadcastAll?: boolean;
}) {
  return apiFetch<{ item: unknown }>("/api/hrm/messages", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Marks one message as read. */
export async function markHrmMessageRead(messageId: string) {
  return apiFetch<{ item: unknown }>(`/api/hrm/messages/${messageId}/read`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
}

/** Archives one sent message. */
export async function archiveHrmMessage(messageId: string) {
  return apiFetch<{ item: unknown }>(`/api/hrm/messages/${messageId}/archive`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
}

/** Loads persisted HRM module settings and active location options. */
export async function fetchHrmSettings(): Promise<HrmSettingsResponse> {
  return apiFetch<HrmSettingsResponse>("/api/hrm/settings");
}

/** Updates persisted HRM module settings. */
export async function updateHrmSettings(payload: {
  defaultTimezone?: string;
  defaultLocationId?: string | null;
  allowCompassionAssignmentSync?: boolean;
  requireSchedulableFlag?: boolean;
  messageDigestEnabled?: boolean;
}) {
  return apiFetch<{ item: unknown }>("/api/hrm/settings", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
