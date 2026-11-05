import type { AccessMode } from "./catalog.js";

export type AccessRule = {
  mode: AccessMode;
  records?: "all" | "own" | "selected";
  campaignIds?: string[];
  eventIds?: string[];
  fields?: string[];
  customFieldIds?: string[];
};
export type RuleSet = Record<string, AccessRule>;
export type AccessLimits = { maxRows: number; maxBatch: number; maxRecipients: number; maxExport: number; dailyImages: number };
export type AccessDocument = {
  version: 1;
  organization: RuleSet;
  roles: Record<string, RuleSet>;
  users: Record<string, RuleSet>;
  connections: Record<string, RuleSet>;
  limits: AccessLimits;
};
export type ConsentSnapshot = { version: 1; policyRevision: number; capabilities: RuleSet; constraints: Record<string, AccessRule[]>; limits: AccessLimits };
export type AccessDecision = { capability: string; mode: AccessMode; reasons: string[]; constraints: AccessRule[]; limits: AccessLimits };
export const DEFAULT_LIMITS: AccessLimits = { maxRows: 100, maxBatch: 25, maxRecipients: 500, maxExport: 1000, dailyImages: 10 };
export const pendingOperationStatuses = ["PENDING", "QUEUED", "SCHEDULED"];
export const emptyAccessDocument = (): AccessDocument => ({ version: 1, organization: {}, roles: {}, users: {}, connections: {}, limits: { ...DEFAULT_LIMITS } });
export type OperationInput = { fields?: Record<string, unknown>; id?: string; eventId?: string; grantId?: string; pathId?: string; siteId?: string; key?: string; expectedVersion?: string; requestKey?: string; preview?: boolean };
