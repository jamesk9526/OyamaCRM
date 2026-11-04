import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ProductionError } from "../services/letter-production.js";
/** Legacy print installations remain usable before the additive Create tables are installed. */
export async function recordCreatePrintStatus(org: string, input: { artifactId?: string; generatedId?: string }, status: string) {
  try { await prisma.createDelivery.updateMany({ where: { organizationId: org, channel: "LETTER", ...(input.artifactId ? { providerId: input.artifactId } : { executionId: input.generatedId }) }, data: { status } }); }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") return; throw error; }
}
export async function assertCurrentCreateArtifact(org: string, artifactId: string) {
  try {
    const linked = await prisma.createDelivery.findFirst({ where: { organizationId: org, providerId: artifactId, channel: "LETTER" }, include: { release: true } });
    if (linked && (linked.release.status !== "RELEASED" || linked.status === "CANCELLED")) throw new ProductionError(409, "This campaign release was superseded or cancelled. Keep its PDF for history and approve the current campaign before new printing.");
  } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") return; throw error; }
}
