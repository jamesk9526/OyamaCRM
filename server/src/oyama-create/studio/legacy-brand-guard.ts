import type { Request, Response, NextFunction } from "express";
import { assertLegacyBrandWrite } from "./brand-routes.js";
import { CreateError } from "../domain.js";

export async function legacyBrandGuard(req: Request, res: Response, next: NextFunction) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) { next(); return; }
  if (!req.user?.orgId) { res.status(403).json({ error: { code: "ORG_REQUIRED", message: "An organization membership is required." } }); return; }
  try { await assertLegacyBrandWrite(req.user.orgId); next(); }
  catch (error) {
    if (error instanceof CreateError) { res.status(error.status).json({ error: { code: "BRAND_REVIEW_REQUIRED", message: error.message }, href: "/oyama-create/library/brand" }); return; }
    next(error);
  }
}
