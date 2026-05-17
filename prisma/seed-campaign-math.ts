/**
 * Deterministic campaign-math demo seed.
 *
 * Use with:
 *   pnpm db:reset:campaign-math
 *
 * This dataset keeps donation amounts small, whole-number, and deterministic
 * so campaign list/detail math can be validated quickly.
 */
import {
  PrismaClient,
  CampaignCategory,
  ConstituentType,
  DonorStatus,
  DonationStatus,
  PaymentMethod,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

async function main() {
  console.log("Seeding deterministic campaign-math demo dataset...");

  const adminHash = await bcrypt.hash("admin123!", 10);
  const staffHash = await bcrypt.hash("staff123!", 10);

  const organization = await prisma.organization.create({
    data: {
      id: "org_math_demo",
      name: "Hope Community Foundation",
      settings: {
        create: {
          fiscalYearStart: 1,
          currency: "USD",
          timezone: "America/Chicago",
          smtpFromName: "Hope Community Foundation",
          smtpFromEmail: "giving@hopecommunity.org",
        },
      },
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      id: "usr_admin_math",
      organizationId: organization.id,
      email: "admin@hopefoundation.org",
      firstName: "Sarah",
      lastName: "Mitchell",
      role: "admin",
      passwordHash: adminHash,
      active: true,
    },
  });

  await prisma.user.create({
    data: {
      id: "usr_staff_math",
      organizationId: organization.id,
      email: "staff@hopefoundation.org",
      firstName: "Jordan",
      lastName: "Lee",
      role: "staff",
      passwordHash: staffHash,
      active: true,
    },
  });

  await prisma.designation.createMany({
    data: [
      { id: "des_general_math", name: "General Fund", description: "General operations" },
      { id: "des_capital_math", name: "Capital Projects", description: "Facilities and buildings" },
    ],
  });

  const constituents = [
    { id: "con_math_01", firstName: "Avery", lastName: "Stone", email: "avery.stone@example.org" },
    { id: "con_math_02", firstName: "Noah", lastName: "Wells", email: "noah.wells@example.org" },
    { id: "con_math_03", firstName: "Mia", lastName: "Hart", email: "mia.hart@example.org" },
    { id: "con_math_04", firstName: "Liam", lastName: "Grant", email: "liam.grant@example.org" },
    { id: "con_math_05", firstName: "Emma", lastName: "Reed", email: "emma.reed@example.org" },
    { id: "con_math_06", firstName: "Lucas", lastName: "Bennett", email: "lucas.bennett@example.org" },
  ];

  await prisma.constituent.createMany({
    data: constituents.map((person) => ({
      id: person.id,
      organizationId: organization.id,
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      type: ConstituentType.DONOR,
      donorStatus: DonorStatus.ACTIVE,
      city: "Austin",
      state: "TX",
      zip: "78701",
    })),
  });

  const newCenterCampaign = await prisma.campaign.create({
    data: {
      id: "camp_new_center_math",
      organizationId: organization.id,
      name: "New Community Center",
      description: "Capital campaign to build our new community center.",
      category: CampaignCategory.CAPITAL,
      goal: 5000,
      startDate: utcDate(2024, 7, 1),
      endDate: utcDate(2026, 6, 30),
      active: true,
    },
  });

  const annualCampaign = await prisma.campaign.create({
    data: {
      id: "camp_annual_2026_math",
      organizationId: organization.id,
      name: "Annual Fund 2026",
      description: "General annual operating support for 2026.",
      category: CampaignCategory.ANNUAL_FUND,
      goal: 3000,
      startDate: utcDate(2026, 1, 1),
      endDate: utcDate(2026, 12, 31),
      active: true,
    },
  });

  const donationRows: Array<{
    id: string;
    constituentId: string;
    campaignId: string;
    designationId: string;
    amount: number;
    date: Date;
    status: DonationStatus;
    paymentMethod: PaymentMethod;
  }> = [
    // New Community Center - 2024 completed
    { id: "don_math_nc_2024_01", constituentId: "con_math_01", campaignId: newCenterCampaign.id, designationId: "des_capital_math", amount: 300, date: utcDate(2024, 8, 15), status: DonationStatus.COMPLETED, paymentMethod: PaymentMethod.CHECK },
    { id: "don_math_nc_2024_02", constituentId: "con_math_02", campaignId: newCenterCampaign.id, designationId: "des_capital_math", amount: 500, date: utcDate(2024, 11, 10), status: DonationStatus.COMPLETED, paymentMethod: PaymentMethod.CREDIT_CARD },

    // New Community Center - 2025 completed
    { id: "don_math_nc_2025_01", constituentId: "con_math_03", campaignId: newCenterCampaign.id, designationId: "des_capital_math", amount: 700, date: utcDate(2025, 3, 20), status: DonationStatus.COMPLETED, paymentMethod: PaymentMethod.ACH },
    { id: "don_math_nc_2025_02", constituentId: "con_math_04", campaignId: newCenterCampaign.id, designationId: "des_capital_math", amount: 900, date: utcDate(2025, 9, 12), status: DonationStatus.COMPLETED, paymentMethod: PaymentMethod.WIRE },

    // New Community Center - 2026 completed (sum = 4200)
    { id: "don_math_nc_2026_01", constituentId: "con_math_01", campaignId: newCenterCampaign.id, designationId: "des_capital_math", amount: 300, date: utcDate(2026, 1, 10), status: DonationStatus.COMPLETED, paymentMethod: PaymentMethod.CHECK },
    { id: "don_math_nc_2026_02", constituentId: "con_math_02", campaignId: newCenterCampaign.id, designationId: "des_capital_math", amount: 400, date: utcDate(2026, 2, 10), status: DonationStatus.COMPLETED, paymentMethod: PaymentMethod.CREDIT_CARD },
    { id: "don_math_nc_2026_03", constituentId: "con_math_03", campaignId: newCenterCampaign.id, designationId: "des_capital_math", amount: 500, date: utcDate(2026, 3, 10), status: DonationStatus.COMPLETED, paymentMethod: PaymentMethod.ACH },
    { id: "don_math_nc_2026_04", constituentId: "con_math_04", campaignId: newCenterCampaign.id, designationId: "des_capital_math", amount: 600, date: utcDate(2026, 4, 10), status: DonationStatus.COMPLETED, paymentMethod: PaymentMethod.CASH },
    { id: "don_math_nc_2026_05", constituentId: "con_math_05", campaignId: newCenterCampaign.id, designationId: "des_capital_math", amount: 700, date: utcDate(2026, 5, 10), status: DonationStatus.COMPLETED, paymentMethod: PaymentMethod.ONLINE },
    { id: "don_math_nc_2026_06", constituentId: "con_math_06", campaignId: newCenterCampaign.id, designationId: "des_capital_math", amount: 800, date: utcDate(2026, 6, 10), status: DonationStatus.COMPLETED, paymentMethod: PaymentMethod.WIRE },
    { id: "don_math_nc_2026_07", constituentId: "con_math_01", campaignId: newCenterCampaign.id, designationId: "des_capital_math", amount: 400, date: utcDate(2026, 6, 15), status: DonationStatus.COMPLETED, paymentMethod: PaymentMethod.CHECK },
    { id: "don_math_nc_2026_08", constituentId: "con_math_02", campaignId: newCenterCampaign.id, designationId: "des_capital_math", amount: 500, date: utcDate(2026, 6, 20), status: DonationStatus.COMPLETED, paymentMethod: PaymentMethod.ACH },

    // New Community Center - 2026 non-completed (for snapshot status mix)
    { id: "don_math_nc_2026_p_01", constituentId: "con_math_03", campaignId: newCenterCampaign.id, designationId: "des_capital_math", amount: 250, date: utcDate(2026, 6, 21), status: DonationStatus.PENDING, paymentMethod: PaymentMethod.CREDIT_CARD },
    { id: "don_math_nc_2026_p_02", constituentId: "con_math_04", campaignId: newCenterCampaign.id, designationId: "des_capital_math", amount: 150, date: utcDate(2026, 6, 22), status: DonationStatus.PENDING, paymentMethod: PaymentMethod.ONLINE },
    { id: "don_math_nc_2026_f_01", constituentId: "con_math_05", campaignId: newCenterCampaign.id, designationId: "des_capital_math", amount: 200, date: utcDate(2026, 6, 23), status: DonationStatus.FAILED, paymentMethod: PaymentMethod.CREDIT_CARD },
    { id: "don_math_nc_2026_r_01", constituentId: "con_math_06", campaignId: newCenterCampaign.id, designationId: "des_capital_math", amount: 100, date: utcDate(2026, 6, 24), status: DonationStatus.REFUNDED, paymentMethod: PaymentMethod.CHECK },

    // Annual Fund 2026 - separate campaign math control
    { id: "don_math_af_2026_01", constituentId: "con_math_01", campaignId: annualCampaign.id, designationId: "des_general_math", amount: 200, date: utcDate(2026, 1, 5), status: DonationStatus.COMPLETED, paymentMethod: PaymentMethod.CASH },
    { id: "don_math_af_2026_02", constituentId: "con_math_02", campaignId: annualCampaign.id, designationId: "des_general_math", amount: 300, date: utcDate(2026, 2, 5), status: DonationStatus.COMPLETED, paymentMethod: PaymentMethod.CREDIT_CARD },
    { id: "don_math_af_2026_03", constituentId: "con_math_03", campaignId: annualCampaign.id, designationId: "des_general_math", amount: 400, date: utcDate(2026, 3, 5), status: DonationStatus.COMPLETED, paymentMethod: PaymentMethod.ACH },
    { id: "don_math_af_2026_04", constituentId: "con_math_04", campaignId: annualCampaign.id, designationId: "des_general_math", amount: 500, date: utcDate(2026, 4, 5), status: DonationStatus.PENDING, paymentMethod: PaymentMethod.ONLINE },
  ];

  await prisma.donation.createMany({
    data: donationRows.map((row, index) => ({
      ...row,
      taxDeductible: true,
      receiptNumber: row.status === DonationStatus.COMPLETED ? `MATH-REC-${String(index + 1).padStart(4, "0")}` : null,
    })),
  });

  // Update constituent rollups from deterministic ledger totals.
  for (const constituent of constituents) {
    const [lifetime, ytd, lastGift] = await Promise.all([
      prisma.donation.aggregate({
        where: { constituentId: constituent.id, status: DonationStatus.COMPLETED },
        _sum: { amount: true },
        _count: { _all: true },
        _min: { date: true },
      }),
      prisma.donation.aggregate({
        where: {
          constituentId: constituent.id,
          status: DonationStatus.COMPLETED,
          date: {
            gte: utcDate(2026, 1, 1),
            lt: utcDate(2027, 1, 1),
          },
        },
        _sum: { amount: true },
      }),
      prisma.donation.findFirst({
        where: { constituentId: constituent.id, status: DonationStatus.COMPLETED },
        orderBy: { date: "desc" },
        select: { amount: true, date: true },
      }),
    ]);

    await prisma.constituent.update({
      where: { id: constituent.id },
      data: {
        totalLifetimeGiving: Number(lifetime._sum.amount ?? 0),
        totalYtdGiving: Number(ytd._sum.amount ?? 0),
        giftCount: Number(lifetime._count._all ?? 0),
        firstGiftDate: lifetime._min.date ?? null,
        lastGiftDate: lastGift?.date ?? null,
        lastGiftAmount: Number(lastGift?.amount ?? 0),
        engagementScore: Number(lifetime._count._all ?? 0) * 10,
      },
    });
  }

  const newCenter2026Completed = donationRows
    .filter((row) => row.campaignId === newCenterCampaign.id && row.status === DonationStatus.COMPLETED && row.date.getUTCFullYear() === 2026)
    .reduce((sum, row) => sum + row.amount, 0);

  const newCenterAllYearsCompleted = donationRows
    .filter((row) => row.campaignId === newCenterCampaign.id && row.status === DonationStatus.COMPLETED)
    .reduce((sum, row) => sum + row.amount, 0);

  console.log("Seed complete.");
  console.log(`Organization: ${organization.name}`);
  console.log(`Admin login: admin@hopefoundation.org / admin123!`);
  console.log("Expected campaign math checks:");
  console.log(`- New Community Center 2026 completed raised: $${newCenter2026Completed}`);
  console.log(`- New Community Center all-years completed raised: $${newCenterAllYearsCompleted}`);
  console.log("- New Community Center 2026 status counts: 8 completed, 2 pending, 1 failed, 1 refunded");
}

main()
  .catch((error) => {
    console.error("campaign-math seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
