import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { CreateError } from "../oyama-create/domain.js";
import { connectionConfig, type ConnectionConfig } from "./config.js";

export const MCP_SETUP_KEY = "chatgpt-mcp-setup";
type SavedSetup = { origin: string; enabled: boolean; revision: number };
export function publicOrigin(value: unknown) {
  if (typeof value !== "string" || value.length > 512) throw new CreateError(400, "Use this installation's public HTTPS domain.");
  let url: URL; try { url = new URL(value); } catch { throw new CreateError(400, "Use this installation's public HTTPS domain."); }
  const local = process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.search || url.hash || url.pathname !== "/" || (!local && (url.port || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(url.hostname) || /(?:^|\.)(?:localhost|local|internal|invalid)$/.test(url.hostname)))) throw new CreateError(400, "Use a public HTTPS origin, without a path or credentials.");
  return url.origin;
}
function stored(value: unknown): SavedSetup | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  try { if (!Number.isInteger(v.revision) || typeof v.enabled !== "boolean") return null; return { origin: publicOrigin(v.origin), enabled: v.enabled, revision: Number(v.revision) }; } catch { return null; }
}
function requestOrigin(req?: Request) {
  if (!req) return undefined;
  const forwarded = req.app?.get("trust proxy") ? req.get("x-forwarded-host") : undefined;
  try { return publicOrigin(`${req.protocol}://${forwarded || req.get("host")}`); } catch { return undefined; }
}
export async function readSetup(org: string) {
  const row = await prisma.pluginSetting.findUnique({ where: { organizationId_pluginKey: { organizationId: org, pluginKey: MCP_SETUP_KEY } } });
  return { row, saved: stored(row?.config) };
}
/** Saved setup is organization-scoped. Request hosts can select only previously saved origins. */
export async function effectiveConnectionConfig(req?: Request, org?: string): Promise<ConnectionConfig> {
  const base = connectionConfig();
  const hint = base.originConfigured ? base.origin : requestOrigin(req);
  const found = org ? (await readSetup(org)).saved : null;
  const rows = !org ? await prisma.pluginSetting.findMany({ where: { pluginKey: MCP_SETUP_KEY, enabled: true }, take: 1000 }) : [];
  const matching = rows.map(row => stored(row.config)).filter((value): value is SavedSetup => !!value && value.enabled && value.origin === hint);
  const selected = found || matching[0];
  const origin = selected?.origin || hint || base.origin;
  const mismatch = !!(selected && hint && selected.origin !== hint);
  const enabled = process.env.CHATGPT_FORCE_DISABLED !== "true" && !mismatch && (found ? found.enabled : matching.length > 0 || base.enabled);
  return { ...base, origin, originConfigured: !!selected || base.originConfigured, resource: `${origin}/api/chatgpt/mcp`, source: selected ? "settings" : base.originConfigured ? "environment" : "unconfigured", enabled };
}
export async function saveSetup(req: Request, input: Record<string, unknown>) {
  if (process.env.CHATGPT_FORCE_DISABLED === "true") throw new CreateError(403, "The server operator has locked ChatGPT setup. Ask them to remove CHATGPT_FORCE_DISABLED before enabling it.");
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new CreateError(400, "Provide the connection setup values as a JSON object.");
  const origin = publicOrigin(input.origin), base = connectionConfig(), browserOrigin = req.get("origin");
  const expected = base.originConfigured ? base.origin : requestOrigin(req);
  if (!expected || origin !== expected || (browserOrigin && publicOrigin(browserOrigin) !== origin)) throw new CreateError(400, "The domain must match this installation's trusted public address. Open the configured domain or correct the deployment's public URL.");
  if (typeof input.enabled !== "boolean") throw new CreateError(400, "Choose whether ChatGPT is enabled.");
  const { row, saved } = await readSetup(req.user!.orgId), revision = saved?.revision || 0;
  if (input.revision !== revision) throw new CreateError(409, "Connection setup changed. Reload before saving.");
  const config: SavedSetup = { origin, enabled: input.enabled, revision: revision + 1 };
  try {
    if (!row) await prisma.pluginSetting.create({ data: { organizationId: req.user!.orgId, pluginKey: MCP_SETUP_KEY, enabled: config.enabled, config } });
    else { const changed = await prisma.pluginSetting.updateMany({ where: { id: row.id, updatedAt: row.updatedAt }, data: { enabled: config.enabled, config, updatedAt: new Date(Math.max(Date.now(), row.updatedAt.getTime() + 1)) } }); if (!changed.count) throw new CreateError(409, "Connection setup changed. Reload before saving."); }
  } catch (e) { if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new CreateError(409, "Connection setup changed. Reload before saving."); throw e; }
  return config;
}
