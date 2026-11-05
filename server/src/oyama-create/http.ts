import type { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { CreateError, string } from "./domain.js";
import { ProductionError } from "../services/letter-production.js";
export const param = (req: Request, key = "id") => string(req.params[key]);
export const route = (work: (req: Request, res: Response, org: string, actor: string) => Promise<unknown>) => async (req: Request, res: Response, next: NextFunction) => {
  try {
    const org = req.user?.orgId, actor = req.user?.sub;
    if (!org || !actor) throw new CreateError(403, "An authenticated organization membership is required.");
    res.set("Cache-Control", "private, no-store");
    await work(req, res, org, actor);
  } catch (error) {
    if (error instanceof CreateError) { res.status(error.status).json({ error: { code: error.status === 409 ? "CREATE_CONFLICT" : "OYAMA_CREATE", message: error.message } }); return; }
    if (error instanceof ProductionError) { res.status(error.status).json({ error: { code: "CREATE_PRINT_READINESS", message: error.message } }); return; }
    if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034"].includes(error.code)) { res.status(409).json({ error: { code: "CREATE_CONFLICT", message: "This operation changed concurrently or already exists. Refresh before retrying." } }); return; }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021" && String(error.meta?.modelName || "").startsWith("CreateImport")) { res.status(503).json({error:{code:"CREATE_IMPORT_MIGRATION_REQUIRED",message:"Install the automatic-import database migration before importing content."}}); return; }
    next(error);
  }
};
