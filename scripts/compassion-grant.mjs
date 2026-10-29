/** Explicit local bootstrap; platform administrator roles never silently gain chart access. */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const [email, role = "ADMIN"] = process.argv.slice(2).filter((value) => value !== "--");
const roles = ["ADMIN", "RECEPTION", "CASEWORKER", "CLINICIAN", "PHYSICIAN", "READONLY"];
if (!email || !roles.includes(role)) throw new Error("Usage: pnpm compassion:grant -- email@example.org ADMIN|RECEPTION|CASEWORKER|CLINICIAN|PHYSICIAN|READONLY");
const database = new PrismaClient({ log: [] });
try {
  const user = await database.user.findUnique({ where: { email }, select: { id: true, organizationId: true, active: true } });
  if (!user?.active) throw new Error("Active platform account not found.");
  await database.$transaction(async (tx) => {
    await tx.compassionMembership.upsert({ where: { organizationId_userId: { organizationId: user.organizationId, userId: user.id } }, create: { organizationId: user.organizationId, userId: user.id, role }, update: { active: true, role } });
    await tx.compassionAudit.create({ data: { organizationId: user.organizationId, actorId: user.id, action: "MEMBERSHIP_BOOTSTRAPPED", entityId: user.id, metadata: { role, source: "local-operator-cli" } } });
  });
  console.log(`Compassion membership granted: ${role}. Platform permissions were not changed.`);
} finally { await database.$disconnect(); }
