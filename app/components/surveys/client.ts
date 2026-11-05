import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import type { Definition } from "@/server/src/surveys/definition";

export type Audience = "DONOR" | "CLIENT";
export type Identity = "ANONYMOUS" | "LINKED";
export type Status = "DRAFT" | "LIVE" | "CLOSED" | "ARCHIVED";
export type Ability = "view" | "edit" | "publish" | "send" | "responses" | "export";
export type Access = { DONOR: Ability[]; CLIENT: Ability[]; timezone: string };
export type SurveyCard = {
  id: string; title: string; audience: Audience; identity: Identity; status: Status;
  published: number; closesAt: string | null; updatedAt: string; responseCount?: number;
};
export type SurveyDetail = SurveyCard & {
  draft: Definition; editVersion: number; timezone: string; abilities: Ability[];
  hasUnpublishedChanges: boolean; revisions: { id: string; number: number; createdAt: string; path: string | null }[];
};
export const audiences = { DONOR: "Donors", CLIENT: "Clients" } as const;
export const identities = { LINKED: "CRM-linked", ANONYMOUS: "Anonymous" } as const;
export const statusLabels = { DRAFT: "Draft", LIVE: "Live", CLOSED: "Closed", ARCHIVED: "Archived" } as const;

export function surveyApiPath(audience: Audience, path: string) {
  return `/api/${audience === "CLIENT" ? "compassion/" : ""}surveys${path}`;
}

export function surveyHref(id: string, audience: Audience, params?: Record<string, string>) {
  const query = new URLSearchParams({ ...(audience === "CLIENT" ? { audience } : {}), ...params });
  const search = query.toString();
  return `/surveys/${encodeURIComponent(id)}${search ? `?${search}` : ""}`;
}

export function surveyRequest<T>(audience: Audience, path: string, signal?: AbortSignal) {
  return apiFetch<T>(surveyApiPath(audience, path), { signal });
}

export function surveyWrite<T = unknown>(audience: Audience, path: string, body: object = {}, method = "POST") {
  return apiFetch<T>(surveyApiPath(audience, path), { method, body: JSON.stringify(body) });
}

export async function surveyWorkspaceAccess(careOnly: boolean, signal?: AbortSignal): Promise<Access> {
  const [donor, client] = await Promise.allSettled([
    careOnly ? Promise.resolve(null) : surveyRequest<Access>("DONOR", "/access", signal),
    surveyRequest<Access>("CLIENT", "/access", signal),
  ]);
  const donorAccess = donor.status === "fulfilled" ? donor.value : null;
  const clientAccess = client.status === "fulfilled" ? client.value : null;
  if (!donorAccess && !clientAccess) throw new Error("Survey access could not be verified. Try again.");
  return { DONOR: donorAccess?.DONOR ?? [], CLIENT: clientAccess?.CLIENT ?? [], timezone: donorAccess?.timezone ?? clientAccess!.timezone };
}

export async function downloadSurveyCsv(audience: Audience, path: string) {
  const response = await apiFetchResponse(surveyApiPath(audience, path));
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || "survey-responses.csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function message(error: unknown) { return error instanceof Error ? error.message : "Something went wrong. Try again."; }

function localFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

export function localInput(iso: string, timeZone: string) {
  return localFormatter(timeZone).format(new Date(iso)).replace(" ", "T");
}

export function localToIso(input: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) throw new Error("Choose a valid date and time.");
  const target = Date.parse(`${input}:00Z`);
  if (!Number.isFinite(target)) throw new Error("Choose a valid date and time.");
  const candidates = new Set<number>();
  for (const hours of [-24, 0, 24]) {
    const sample = target + hours * 3600_000;
    const wall = Date.parse(`${localInput(new Date(sample).toISOString(), timeZone)}:00Z`);
    const shifted = target - (wall - sample);
    if (localInput(new Date(shifted).toISOString(), timeZone) === input) candidates.add(shifted);
  }
  if (candidates.size !== 1) throw new Error("This local time is skipped or repeated due to daylight saving time. Choose another time.");
  return new Date([...candidates][0]).toISOString();
}

export function formatDate(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
