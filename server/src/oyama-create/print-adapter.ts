import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ProductionError } from "../services/letter-production.js";
/** Legacy print installations remain usable before the additive Create tables are installed. */
export async function recordCreatePrintStatus(org: string, input: { artifactId?: string; generatedId?: string }, status: string) {
  try {
    const parts = await prisma.createPrintArtifact.findMany({ where: { organizationId: org, ...(input.artifactId ? { renderJobId: input.artifactId } : { generatedLetterId: input.generatedId }) } });
    if (!parts.length) { await prisma.createDelivery.updateMany({ where: { organizationId: org, channel: "LETTER", ...(input.artifactId ? { providerId: input.artifactId } : { executionId: input.generatedId }) }, data: { status } }); return; }
    await prisma.createPrintArtifact.updateMany({ where: { id: { in: parts.map(part => part.id) }, organizationId: org }, data: { status } });
    const rank = ["PREPARED", "PRINT_REQUESTED", "PRINTED", "MAILED"];
    for (const deliveryId of new Set(parts.map(part => part.deliveryId))) {
      const all = await prisma.createPrintArtifact.findMany({ where: { deliveryId, organizationId: org } });
      const common = rank[Math.min(...all.map(part => Math.max(0, rank.indexOf(part.status))))];
      await prisma.createDelivery.updateMany({ where: { id: deliveryId, organizationId: org, status: { not: "CANCELLED" } }, data: { status: common } });
    }
  }
  catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") return; throw error; }
}
export async function assertCurrentCreateArtifact(org: string, artifactId: string) {
  try {
    const part = await prisma.createPrintArtifact.findFirst({ where: { organizationId: org, renderJobId: artifactId } });
    const linked = await prisma.createDelivery.findFirst({ where: { organizationId: org, ...(part ? { id: part.deliveryId } : { providerId: artifactId }), channel: "LETTER" }, include: { release: true } });
    if (linked && (linked.release.status !== "RELEASED" || linked.status === "CANCELLED")) throw new ProductionError(409, "This campaign release was superseded or cancelled. Keep its PDF for history and approve the current campaign before new printing.");
  } catch (error) { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") return; throw error; }
}
