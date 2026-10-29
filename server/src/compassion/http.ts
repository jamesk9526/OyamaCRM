import type { Request, Response, RequestHandler } from "express";
import { atomic, prisma } from "./database.js";
import { org, requireCare, hasCareCapability, type CareCapability } from "./security.js";

export class CareError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CareError(400, "VALIDATION_ERROR", message);
}
export function text(value: unknown, max = 10000): string {
  check(typeof value === "string" && value.trim().length > 0 && value.length <= max, `Enter text between 1 and ${max} characters.`);
  return value.trim();
}
export function date(value: unknown): Date {
  check(typeof value === "string" && Number.isFinite(Date.parse(value)), "Enter a valid date and time."); return new Date(value);
}
export function integer(value: unknown, min: number, max: number): number {
  check(typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max, `Enter a whole number between ${min} and ${max}.`); return value;
}
export async function client(req: Request, id: string) {
  const row = await prisma.compassionClient.findFirst({ where: { id, organizationId: org(req) } });
  if (!row) throw new CareError(404, "NOT_FOUND", "Client not found."); return row;
}
export function route(capability: CareCapability, handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler[] {
  return [requireCare(capability), async (req, res, next) => {
    try {
      if (["GET", "HEAD"].includes(req.method)) { await handler(req, res); return; }
      const json = res.json.bind(res); let result: unknown;
      res.json = ((value: unknown) => { result = value; return res; }) as Response["json"];
      try { await atomic(org(req), async () => {
        const membership = await prisma.compassionMembership.findUnique({ where: { organizationId_userId: { organizationId: org(req), userId: req.user!.sub } } });
        if (!membership?.active || !hasCareCapability(membership.role, capability)) throw new CareError(403, "MEMBERSHIP_CHANGED", "Your client-care access has changed. Refresh the workspace.");
        await handler(req, res);
      }); }
      finally { res.json = json; }
      json(result);
    } catch (error) {
      if (error instanceof CareError) { res.status(error.status).json({ error: { code: error.code, message: error.message } }); return; }
      next(error);
    }
  }];
}
