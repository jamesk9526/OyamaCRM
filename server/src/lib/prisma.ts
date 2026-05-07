/**
 * Prisma client singleton for OyamaCRM.
 * Exports a single shared `PrismaClient` instance to avoid exhausting
 * the database connection pool during hot reloads in development.
 * In production a fresh instance is always created on startup.
 * @module lib/prisma
 */
import { PrismaClient } from "@prisma/client";

// Prevent multiple instances during hot reload in development
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/**
 * The application-wide Prisma client.
 * In development it is cached on `globalThis` so Next.js / ts-node hot reloads
 * reuse the same connection pool.  In production a new instance is created.
 * Query, warn, and error events are logged in non-production environments.
 */
export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
