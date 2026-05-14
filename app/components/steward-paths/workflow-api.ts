/** API client helpers for Steward Paths builder/list operations. */
import { apiFetch } from "@/app/lib/auth-client";
import type { BackendStewardPathTemplateResponse } from "./workflow-transformers";

export interface StewardPathLetterTemplateOption {
  id: string;
  name: string;
  status?: string;
}

export interface StewardPathEmailCampaignOption {
  id: string;
  name: string;
  status?: string;
}

export interface StewardPathShareInput {
  visibility: "private" | "organization" | "admins";
  allowRun?: boolean;
  allowEdit?: boolean;
}

/** Loads one template by id. */
export function getStewardPathTemplate(id: string): Promise<BackendStewardPathTemplateResponse> {
  return apiFetch<BackendStewardPathTemplateResponse>(`/api/steward-paths/templates/${id}`);
}

/** Updates metadata/status for a template. */
export function patchStewardPathTemplate(id: string, payload: Record<string, unknown>): Promise<BackendStewardPathTemplateResponse> {
  return apiFetch<BackendStewardPathTemplateResponse>(`/api/steward-paths/templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

/** Archives one template. */
export function archiveStewardPathTemplate(id: string): Promise<void> {
  return apiFetch<void>(`/api/steward-paths/templates/${id}`, { method: "DELETE" });
}

/** Duplicates one template and returns the clone. */
export function duplicateStewardPathTemplate(id: string): Promise<BackendStewardPathTemplateResponse> {
  return apiFetch<BackendStewardPathTemplateResponse>(`/api/steward-paths/templates/${id}/duplicate`, { method: "POST" });
}

/** Updates sharing state on a template. */
export function shareStewardPathTemplate(id: string, input: StewardPathShareInput): Promise<BackendStewardPathTemplateResponse> {
  return apiFetch<BackendStewardPathTemplateResponse>(`/api/steward-paths/templates/${id}/share`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

/** Starts a safe test enrollment for one template. */
export function testRunStewardPathTemplate(id: string, constituentId: string): Promise<{ success: boolean; enrollmentId: string }> {
  return apiFetch<{ success: boolean; enrollmentId: string }>(`/api/steward-paths/templates/${id}/test-run`, {
    method: "POST",
    body: JSON.stringify({ constituentId }),
  });
}

/** Lists letter templates for print nodes with optional search text. */
export async function listStewardPathLetterTemplates(search?: string): Promise<StewardPathLetterTemplateOption[]> {
  const params = new URLSearchParams();
  if (search?.trim()) params.set("search", search.trim());
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const items = await apiFetch<Array<{ id: string; name: string; status?: string }>>(`/api/letters/templates${suffix}`);
  return items.map((item) => ({ id: item.id, name: item.name, status: item.status }));
}

/** Lists email campaigns for send/schedule nodes with optional search text. */
export async function listStewardPathEmailCampaigns(search?: string): Promise<StewardPathEmailCampaignOption[]> {
  const params = new URLSearchParams();
  if (search?.trim()) params.set("search", search.trim());
  params.set("limit", "100");
  const suffix = `?${params.toString()}`;
  const items = await apiFetch<Array<{ id: string; name: string; status?: string }>>(`/api/email-campaigns${suffix}`);
  return items.map((item) => ({ id: item.id, name: item.name, status: item.status }));
}
