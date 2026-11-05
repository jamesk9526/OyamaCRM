import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { CreateError } from "../oyama-create/domain.js";
import { pendingOperationStatuses } from "../ai-access/contracts.js";
import { LEGACY_TOOLS } from "../ai-access/catalog.js";
export const MCP_POLICY_KEY = "chatgpt-mcp-policy";
export const DEFAULT_MCP_POLICY = { enabled: true, allowLetterRead: true, allowLetterDrafts: false, allowImageGeneration: false, allowReports: true, defaultDateBasis: "calendar" as "calendar" | "fiscal", allowDateBasisOverride: false, maxReportRows: 100 };
export type McpPolicy = typeof DEFAULT_MCP_POLICY;
export function normalizeMcpPolicy(value: unknown): McpPolicy {
  const v = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return { enabled: v.enabled !== false, allowLetterRead: v.allowLetterRead !== false, allowLetterDrafts: v.allowLetterDrafts === true, allowImageGeneration: v.allowImageGeneration === true, allowReports: v.allowReports !== false, defaultDateBasis: v.defaultDateBasis === "fiscal" ? "fiscal" : "calendar", allowDateBasisOverride: v.allowDateBasisOverride === true, maxReportRows: typeof v.maxReportRows === "number" && Number.isInteger(v.maxReportRows) ? Math.min(500, Math.max(10, v.maxReportRows)) : 100 };
}
export async function readMcpPolicy(org: string) {
  const row = await prisma.pluginSetting.findUnique({ where: { organizationId_pluginKey: { organizationId: org, pluginKey: MCP_POLICY_KEY } } });
  const config = row?.config as { revision?: number; policy?: unknown } | null;
  return { row, revision: Number.isInteger(config?.revision) ? config!.revision! : 0, policy: normalizeMcpPolicy(config?.policy) };
}
export async function saveMcpPolicy(org: string, revision: unknown, input: unknown) {
  const current = await readMcpPolicy(org);
  if (revision !== current.revision) throw new CreateError(409, "MCP controls changed in another session. Reload before saving.");
  if (!input || typeof input !== "object" || JSON.stringify(input) === "{}") throw new CreateError(400, "Provide the MCP controls.");
  for (const key of Object.keys(input)) if (!(key in DEFAULT_MCP_POLICY)) throw new CreateError(400, "Unknown MCP control.");
  const fields = input as Record<string, unknown>;
  for (const key of ["enabled", "allowLetterRead", "allowLetterDrafts", "allowReports", "allowDateBasisOverride"]) if (typeof fields[key] !== "boolean") throw new CreateError(400, "Choose on or off for every access control.");
  if (fields.allowImageGeneration !== undefined && typeof fields.allowImageGeneration !== "boolean") throw new CreateError(400, "Choose on or off for image generation.");
  const policy = normalizeMcpPolicy({ ...current.policy, ...fields });
  if (!["calendar", "fiscal"].includes(String(fields.defaultDateBasis)) || !Number.isInteger(fields.maxReportRows) || Number(fields.maxReportRows) < 10 || Number(fields.maxReportRows) > 500) throw new CreateError(400, "Choose a reporting calendar and a row limit from 10 to 500.");
  const config = { revision: current.revision + 1, policy };
  try {
    await prisma.$transaction(async tx => {
      if (!current.row) await tx.pluginSetting.create({ data: { organizationId: org, pluginKey: MCP_POLICY_KEY, enabled: true, config } });
      else {
        const stamp = new Date(Math.max(Date.now(), current.row.updatedAt.getTime() + 1));
        const changed = await tx.pluginSetting.updateMany({ where: { id: current.row.id, updatedAt: current.row.updatedAt }, data: { config, updatedAt: stamp } });
        if (!changed.count) throw new CreateError(409, "MCP controls changed in another session. Reload before saving.");
      }
      const blocked = Object.values(LEGACY_TOOLS).filter(tool => !tool.read && (tool.scope === "letters.write" && !policy.allowLetterDrafts || tool.capability === "images.generate" && !policy.allowImageGeneration)).map(tool => tool.capability);
      if (!policy.enabled || blocked.length) await tx.aiOperation.updateMany({ where: { organizationId: org, status: { in: pendingOperationStatuses }, ...(policy.enabled ? { capability: { in: blocked } } : {}) }, data: { status: "CANCELLED", finishedAt: new Date(), reviewReason: "Organization MCP access was reduced before execution." } });
      if (!policy.enabled || !policy.allowLetterDrafts || !policy.allowImageGeneration) await tx.chatGptImageJob.updateMany({ where: { organizationId: org, status: "QUEUED" }, data: { status: "FAILED", prompt: null, error: "Organization MCP access was reduced before execution." } });
    });
  } catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new CreateError(409, "MCP controls were saved concurrently. Reload before saving."); throw e; }
  return { revision: config.revision, policy };
}
export function toolAllowed(scope: string, policy: McpPolicy) {
  return policy.enabled && (scope === "letters.read" ? policy.allowLetterRead : scope === "letters.write" ? policy.allowLetterDrafts : scope === "reports.read" ? policy.allowReports : false);
}
