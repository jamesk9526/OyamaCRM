/** Explicitly scoped, resumable migration. Source executions and PDFs are never rewritten. */
import "dotenv/config";
import type { Request } from "express";
import { prisma } from "../lib/prisma.js";
import { importSource } from "./imports.js";
const args = process.argv.slice(2);
const option = (key: string) => args[args.indexOf(key) + 1];
async function main() {
  const organizationId = option("--organization"), userId = option("--user");
  if (!args.includes("--organization") || !args.includes("--user") || !organizationId || !userId) throw new Error("Usage: pnpm create:backfill --organization ORG_ID --user ADMIN_USER_ID [--apply]. Default is a read-only inventory.");
  const actor = await prisma.user.findFirst({ where: { id: userId, organizationId, active: true, role: "admin" } });
  if (!actor) throw new Error("Choose an active administrator belonging to the selected organization.");
  const req = { user: { sub: actor.id, orgId: organizationId, role: actor.role, email: actor.email } } as Request;
  const counts = { email: 0, letter: 0, existing: 0, imported: 0 };
  for (const channel of ["EMAIL", "LETTER"] as const) {
    let cursor: string | undefined;
    for (;;) {
      const input = { where: { organizationId }, orderBy: { id: "asc" as const }, take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) };
      const sources = channel === "EMAIL" ? await prisma.emailCampaign.findMany({ ...input, select: { id: true } }) : await prisma.letterTemplate.findMany({ ...input, where: { organizationId, crmScope: "DONOR" }, select: { id: true } });
      if (!sources.length) break;
      for (const source of sources) {
        counts[channel === "EMAIL" ? "email" : "letter"]++;
        const bound = await prisma.createVariant.findFirst({ where: { organizationId, channel, legacyId: source.id }, select: { id: true } });
        if (bound) { counts.existing++; continue; }
        if (args.includes("--apply")) { await importSource(req, organizationId, actor.id, channel, source.id); counts.imported++; }
      }
      cursor = sources[sources.length - 1].id;
    }
  }
  const generatedLetters = await prisma.generatedLetter.count({ where: { organizationId } });
  console.log(JSON.stringify({ organizationId, mode: args.includes("--apply") ? "APPLIED" : "READ_ONLY_INVENTORY", ...counts, generatedLettersPreserved: generatedLetters, note: "Generated letters and delivery history remain attached through original source IDs. Only verified companion IDs are grouped. Rerunning skips existing bindings." }, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Backfill failed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
