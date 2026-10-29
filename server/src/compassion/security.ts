import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "./database.js";

export const CARE_ROLES = ["ADMIN", "RECEPTION", "CASEWORKER", "CLINICIAN", "PHYSICIAN", "READONLY"] as const;
export type CareRole = typeof CARE_ROLES[number];
export type CareCapability = "records" | "schedule" | "casework" | "clinical" | "sign" | "import" | "export" | "manage" | "messages";
const capabilities: Record<CareRole, readonly CareCapability[]> = {
  ADMIN: ["records", "schedule", "casework", "clinical", "import", "export", "manage", "messages"],
  RECEPTION: ["records", "schedule", "messages"],
  CASEWORKER: ["records", "schedule", "casework", "messages"],
  CLINICIAN: ["records", "schedule", "casework", "clinical", "messages"],
  PHYSICIAN: ["records", "schedule", "casework", "clinical", "sign", "messages"],
  READONLY: ["records"],
};
export function hasCareCapability(role: string, capability: CareCapability): boolean {
  return CARE_ROLES.includes(role as CareRole) && capabilities[role as CareRole].includes(capability);
}
export function careCapabilities(role: string): readonly CareCapability[] {
  return capabilities[role as CareRole] ?? [];
}
export function org(req: Request): string {
  if (!req.user?.orgId) throw new Error("Authenticated organization required");
  return req.user.orgId;
}
export async function resolveOrganizationId({ req }: { req?: Request; requestedOrganizationId?: unknown }): Promise<string | null> {
  return req?.user?.orgId ?? null;
}
export async function requireCareMembership(req: Request, res: Response, next: NextFunction) {
  const user = req.user;
  if (!user?.orgId) { res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Sign in to Compassion." } }); return; }
  const [account, membership] = await Promise.all([
    prisma.user.findFirst({ where: { id: user.sub, organizationId: user.orgId, active: true }, select: { id: true } }),
    prisma.compassionMembership.findUnique({ where: { organizationId_userId: { organizationId: user.orgId, userId: user.sub } } }),
  ]);
  if (!account || !membership?.active || !CARE_ROLES.includes(membership.role as CareRole)) {
    res.status(403).json({ error: { code: "COMPASSION_ACCESS_REQUIRED", message: "An active Compassion membership is required. Contact your client-care administrator." } }); return;
  }
  res.locals.careRole = membership.role;
  res.locals.careCapabilities = careCapabilities(membership.role);
  res.setHeader("Cache-Control", "no-store");
  next();
}
export function requireCare(capability: CareCapability) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!hasCareCapability(String(res.locals.careRole), capability)) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: "Your Compassion role does not permit this action." } }); return;
    }
    next();
  };
}
export function encryptionReady(): boolean { return /^[a-f\d]{64}$/i.test(process.env.COMPASSION_ENCRYPTION_KEY ?? ""); }
function key(): Buffer {
  if (!encryptionReady()) throw new Error("Configure COMPASSION_ENCRYPTION_KEY before storing protected records.");
  return Buffer.from(process.env.COMPASSION_ENCRYPTION_KEY!, "hex");
}
export function seal(value: string, context: string): string {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(".");
}
export function unseal(value: string, context: string): string {
  const [version, iv, tag, ciphertext] = value.split(".");
  if (version !== "v1") throw new Error("Unsupported protected record version");
  const cipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  cipher.setAAD(Buffer.from(context)); cipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([cipher.update(Buffer.from(ciphertext, "base64")), cipher.final()]).toString("utf8");
}
export function digest(value: string | Buffer): string { return createHash("sha256").update(value).digest("hex"); }
export function accessToken(): string { return randomBytes(32).toString("base64url"); }
export async function audit(req: Request, action: string, entityId?: string, metadata?: Record<string, string | number | boolean | null>) {
  await prisma.compassionAudit.create({ data: { organizationId: org(req), actorId: req.user?.sub, action, entityId, metadata } });
}
/** Recovered core routes use a dedicated, durable audit sink with no medical content. */
export async function logAudit(input: { action: string; entityId?: string; organizationId?: string; userId?: string; [key: string]: unknown }) {
  if (!input.organizationId) throw new Error("Missing care audit organization");
  await prisma.compassionAudit.create({ data: { organizationId: input.organizationId, actorId: input.userId, action: input.action, entityId: input.entityId } });
}
