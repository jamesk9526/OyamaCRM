/**
 * Prisma client singleton for OyamaCRM.
 * Exports a single shared `PrismaClient` instance to avoid exhausting
 * the database connection pool during hot reloads in development.
 * In production a fresh instance is always created on startup.
 * @module lib/prisma
 */
import { Prisma, PrismaClient } from "@prisma/client";
import { aiMutationContext } from "../ai-access/mutation-context.js";
import { CreateError } from "../oyama-create/domain.js";
import { tenantContext } from "./tenant-context.js";

// Prevent multiple instances during hot reload in development
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const constituentReadActions = new Set(["findUnique", "findFirst", "findMany", "count", "aggregate", "groupBy"]);

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

  // Closed constituent accounts are invisible by default everywhere that uses
  // the shared database client. An explicit closedAt predicate is reserved for
  // narrowly scoped account-recovery/administration code.
  client.$use(async (params, next) => {
    const tenant = tenantContext.getStore();
    if (tenant && params.model && ["Household", "Tag", "Designation"].includes(params.model)) {
      params.args ??= {};
      if (["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy", "update", "updateMany", "delete", "deleteMany", "upsert"].includes(params.action)) params.args.where = { ...params.args.where, organizationId: tenant };
      if (params.action === "create") params.args.data = { ...params.args.data, organizationId: tenant };
      if (params.action === "createMany") params.args.data = (Array.isArray(params.args.data) ? params.args.data : [params.args.data]).map((data: Record<string, unknown>) => ({ ...data, organizationId: tenant }));
      if (params.action === "upsert") params.args.create = { ...params.args.create, organizationId: tenant };
      for (const field of ["data", "update"]) if (!Array.isArray(params.args[field]) && params.args[field]?.organizationId && params.args[field].organizationId !== tenant) throw new CreateError(403, "A record cannot be moved to another organization.");
    }
    const context = aiMutationContext.getStore();
    if (context && params.model && ["update", "updateMany", "delete", "deleteMany"].includes(params.action)) {
      const guard = context.guards.find(item => item.model === params.model && !item.consumed && params.args?.where?.id === item.id);
      if (guard) {
        const stamp = guard.expected.updatedAt;
        const revision = guard.expected.revision;
        const fields = Prisma.dmmf.datamodel.models.find(model => model.name === params.model)?.fields || [];
        const scalar = Object.fromEntries(Object.entries(guard.expected).filter(([key, value]) => fields.some(field => field.name === key && field.kind !== "object" && field.type !== "Json") && (value === null || typeof value !== "object" || value instanceof Date)));
        const expected = { ...scalar, ...(stamp ? { updatedAt: stamp } : {}), ...(revision !== undefined ? { revision } : {}) };
        const original = params.args.where;
        params.args.where = { ...original, AND: [...(original.AND ? Array.isArray(original.AND) ? original.AND : [original.AND] : []), expected] };
        let result;
        try { result = await next(params); }
        catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") throw new CreateError(409, "The record changed before the AI command could save. Fetch its current version.");
          throw error;
        }
        if (result && typeof result === "object" && "count" in result && result.count !== 1) throw new CreateError(409, "The record changed before the AI command could save. Fetch the current record and prepare a new request.");
        guard.consumed = true;
        return result;
      }
    }
    if (params.model === "Constituent" && constituentReadActions.has(params.action)) {
      params.args ??= {};
      const where = params.args.where ?? {};
      if (!Object.prototype.hasOwnProperty.call(where, "closedAt")) {
        params.args.where = { ...where, closedAt: null };
      }
    }
    if (params.model === "LetterTemplate" && (constituentReadActions.has(params.action) || ["findUniqueOrThrow", "findFirstOrThrow", "update", "updateMany", "delete", "deleteMany", "upsert"].includes(params.action))) {
      params.args ??= {};
      const where = params.args.where ?? {};
      // Create's working copies are only addressable through their owning content.
      if (typeof where.createContentId !== "string") params.args.where = { ...where, createContentId: null };
    }
    return next(params);
  });

  return client;
}

/**
 * The application-wide Prisma client.
 * In development it is cached on `globalThis` so Next.js / ts-node hot reloads
 * reuse the same connection pool.  In production a new instance is created.
 * Query, warn, and error events are logged in non-production environments.
 */
export const prisma =
  globalForPrisma.prisma ||
  createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
