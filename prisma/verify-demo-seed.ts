/** Verifies that deterministic demo seed records and import fixtures exist for a healthy demo environment. */
import { PrismaClient } from "@prisma/client";
import { access } from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();

/**
 * Runs lightweight checks against seeded demo markers and key model counts.
 * Exits with non-zero code when required demo artifacts are missing.
 */
async function main() {
  const checks = await Promise.all([
    prisma.constituent.count({ where: { id: { startsWith: "demo_con_" } } }),
    prisma.donation.count({ where: { id: { startsWith: "demo_don_" } } }),
    prisma.event.count({ where: { id: { startsWith: "demo_evt_" } } }),
    prisma.eventGuest.count({ where: { id: { startsWith: "demo_guest_" } } }),
    prisma.compassionClient.count({ where: { id: { startsWith: "demo_cli_" } } }),
    prisma.compassionAppointment.count({ where: { id: { startsWith: "demo_appt_" } } }),
    prisma.emailCampaign.count({ where: { id: { startsWith: "demo_mail_" } } }),
    prisma.automation.count({ where: { id: { startsWith: "demo_auto_" } } }),
    prisma.auditLog.count({ where: { action: "STEWARD_PATH_RUN", entityId: { startsWith: "demo_auto_" } } }),
    prisma.customField.count({ where: { key: { startsWith: "demoSteward" } } }),
    prisma.customFieldValue.count({ where: { id: { startsWith: "demo_cfv_" } } }),
  ]);

  const [
    demoConstituents,
    demoDonations,
    demoEvents,
    demoGuests,
    demoClients,
    demoAppointments,
    demoEmails,
    demoAutomations,
    demoStewardRuns,
    demoStewardFields,
    demoStewardValues,
  ] = checks;

  const importDir = path.join(process.cwd(), "prisma", "demo-imports");
  const fixtureFiles = ["donors-clean.csv", "donors-messy.csv", "clients-messy.csv", "manifest.json"];

  for (const file of fixtureFiles) {
    await access(path.join(importDir, file));
  }

  const failures: string[] = [];
  if (demoConstituents === 0) failures.push("No demo constituents found.");
  if (demoDonations === 0) failures.push("No demo donations found.");
  if (demoEvents === 0) failures.push("No demo events found.");
  if (demoGuests === 0) failures.push("No demo event guests found.");
  if (demoClients === 0) failures.push("No demo compassion clients found.");
  if (demoAppointments === 0) failures.push("No demo compassion appointments found.");
  if (demoEmails === 0) failures.push("No demo email campaigns found.");
  if (demoAutomations === 0) failures.push("No demo automations found.");
  if (demoStewardRuns === 0) failures.push("No demo steward run-history logs found.");
  if (demoStewardFields === 0 || demoStewardValues === 0) failures.push("No demo steward signal field/value data found.");

  console.log("Demo verification summary:");
  console.log(`  Demo constituents: ${demoConstituents}`);
  console.log(`  Demo donations: ${demoDonations}`);
  console.log(`  Demo events: ${demoEvents}`);
  console.log(`  Demo guests: ${demoGuests}`);
  console.log(`  Demo clients: ${demoClients}`);
  console.log(`  Demo appointments: ${demoAppointments}`);
  console.log(`  Demo email campaigns: ${demoEmails}`);
  console.log(`  Demo automations: ${demoAutomations}`);
  console.log(`  Demo steward runs: ${demoStewardRuns}`);
  console.log(`  Demo steward fields: ${demoStewardFields}`);
  console.log(`  Demo steward values: ${demoStewardValues}`);
  console.log(`  Import fixture directory: ${importDir}`);

  if (failures.length > 0) {
    console.error("Demo verification failed:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log("Demo verification passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
