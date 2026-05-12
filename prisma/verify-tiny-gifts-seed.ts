/** Verifies tiny-gifts debug seed integrity, including default demo users and donation totals. */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REQUIRED_USER_EMAILS = [
  "admin@hopefoundation.org",
  "james@hopefoundation.org",
  "viewer@hopefoundation.org",
  "staff@hopefoundation.org",
] as const;

/** Runs deterministic checks for tiny-gifts mode and exits non-zero on mismatch. */
async function main() {
  const users = await prisma.user.findMany({
    where: { email: { in: [...REQUIRED_USER_EMAILS] } },
    select: { email: true },
  });

  const completedTinyDonations = await prisma.donation.findMany({
    where: { id: { startsWith: "don_" }, status: "COMPLETED" },
    select: { id: true, amount: true },
  });

  const donationIds = completedTinyDonations.map((row) => row.id).sort();
  const expectedDonationIds = Array.from({ length: 10 }, (_, index) => `don_${String(index + 1).padStart(2, "0")}`);

  const donationTotal = completedTinyDonations.reduce((sum, row) => sum + Number(row.amount), 0);
  const missingUsers = REQUIRED_USER_EMAILS.filter((email) => !users.some((u) => u.email === email));

  const failures: string[] = [];

  if (missingUsers.length > 0) {
    failures.push(`Missing demo users: ${missingUsers.join(", ")}`);
  }

  if (completedTinyDonations.length !== 10) {
    failures.push(`Expected 10 completed tiny donations, found ${completedTinyDonations.length}.`);
  }

  if (donationTotal !== 55) {
    failures.push(`Expected tiny donation total of $55.00, found $${donationTotal.toFixed(2)}.`);
  }

  if (JSON.stringify(donationIds) !== JSON.stringify(expectedDonationIds)) {
    failures.push("Expected completed tiny donation IDs don_01..don_10.");
  }

  console.log("Tiny-gifts seed verification summary:");
  console.log(`  Demo users found: ${users.length}/${REQUIRED_USER_EMAILS.length}`);
  console.log(`  Completed tiny donations: ${completedTinyDonations.length}`);
  console.log(`  Completed tiny donation total: $${donationTotal.toFixed(2)}`);

  if (failures.length > 0) {
    console.error("Tiny-gifts seed verification failed:");
    for (const failure of failures) {
      console.error(`  - ${failure}`);
    }
    process.exit(1);
  }

  console.log("Tiny-gifts seed verification passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
