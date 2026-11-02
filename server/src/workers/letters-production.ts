/** Dedicated process: pnpm letters:worker (or the PM2 oyama-letter-production app). */
import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { processNextLetterJob } from "../services/letter-production.js";
import { renderProductionLetter } from "../services/letter-production-renderer.js";

let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) process.once(signal, () => { stopping = true; });
async function main() {
  while (!stopping) {
    try {
      await prisma.letterRenderJob.updateMany({ where: { status: "RENDERING", leaseUntil: { lt: new Date() }, attempts: { gte: 3 } }, data: { status: "FAILED", error: "The worker stopped repeatedly. Review and retry this item.", leaseToken: null, leaseUntil: null } });
      if (await processNextLetterJob(renderProductionLetter)) continue;
    } catch (error) { console.error("[letter-worker]", error instanceof Error ? error.message : "Worker failure"); }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  await prisma.$disconnect();
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
