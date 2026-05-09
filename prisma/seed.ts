/** Main Prisma seed script for baseline records plus configurable large-scale demo expansion. */
import {
  PrismaClient,
  ConstituentType,
  DonorStatus,
  PaymentMethod,
  DonationStatus,
  TaskType,
  TaskStatus,
  TaskPriority,
  CampaignCategory,
  EventType,
  AutomationTrigger,
  AutomationActionType,
  ActivityType,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedDemoExpansion, type DemoSeedSize } from "./demo-seed-expansion";

const prisma = new PrismaClient();

/** Parses CLI args/env vars for demo dataset size and deterministic seed key. */
function parseDemoSeedOptions(argv: string[]): { size: DemoSeedSize; seedKey: string } {
  let sizeArg: string | undefined;
  let seedKeyArg: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--size" && argv[i + 1]) {
      sizeArg = argv[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith("--size=")) {
      sizeArg = token.slice("--size=".length);
      continue;
    }
    if (token === "--seed" && argv[i + 1]) {
      seedKeyArg = argv[i + 1];
      i += 1;
      continue;
    }
    if (token.startsWith("--seed=")) {
      seedKeyArg = token.slice("--seed=".length);
      continue;
    }
  }

  const rawSize = (sizeArg ?? process.env.DEMO_SEED_SIZE ?? "small").toLowerCase();
  const size: DemoSeedSize = rawSize === "medium" || rawSize === "large" ? rawSize : "small";
  const seedKey = seedKeyArg ?? process.env.DEMO_SEED_KEY ?? "oyamacrm-demo-seed-v1";

  return { size, seedKey };
}

async function main() {
  const demoOptions = parseDemoSeedOptions(process.argv.slice(2));
  console.log("🌱 Seeding OyamaCRM...");
  console.log(`   Demo profile: ${demoOptions.size}`);
  console.log(`   Demo seed key: ${demoOptions.seedKey}`);

  const adminHash = await bcrypt.hash("admin123!", 12);
  const staffHash = await bcrypt.hash("staff123!", 12);

  // Organization
  const org = await prisma.organization.upsert({
    where: { id: "org_demo" },
    update: {},
    create: {
      id: "org_demo",
      name: "Hope Community Foundation",
      settings: {
        create: {
          fiscalYearStart: 1,
          currency: "USD",
          timezone: "America/Chicago",
          smtpHost: "smtp.mailtrap.io",
          smtpPort: 587,
          smtpSecure: false,
          smtpUser: "",
          smtpPass: "",
          smtpFromName: "Hope Community Foundation",
          smtpFromEmail: "giving@hopecommunity.org",
        },
      },
    },
  });

  // Users
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@hopefoundation.org" },
    update: { passwordHash: adminHash },
    create: {
      organizationId: org.id,
      email: "admin@hopefoundation.org",
      firstName: "Sarah",
      lastName: "Mitchell",
      role: "admin",
      passwordHash: adminHash,
    },
  });

  const staffUser = await prisma.user.upsert({
    where: { email: "james@hopefoundation.org" },
    update: { passwordHash: staffHash, role: "manager" },
    create: {
      organizationId: org.id,
      email: "james@hopefoundation.org",
      firstName: "James",
      lastName: "Oyama",
      role: "manager",
      passwordHash: staffHash,
    },
  });

  // Read-only staff member for testing role restrictions
  const readonlyHash = await bcrypt.hash("readonly123!", 12);
  await prisma.user.upsert({
    where: { email: "viewer@hopefoundation.org" },
    update: { passwordHash: readonlyHash },
    create: {
      organizationId: org.id,
      email: "viewer@hopefoundation.org",
      firstName: "Viewer",
      lastName: "User",
      role: "readonly",
      passwordHash: readonlyHash,
    },
  });

  // Staff-level user for testing
  await prisma.user.upsert({
    where: { email: "staff@hopefoundation.org" },
    update: { passwordHash: staffHash },
    create: {
      organizationId: org.id,
      email: "staff@hopefoundation.org",
      firstName: "Staff",
      lastName: "Member",
      role: "staff",
      passwordHash: staffHash,
    },
  });

  // Tags
  const tags = await Promise.all([
    prisma.tag.upsert({ where: { id: "tag_major" }, update: {}, create: { id: "tag_major", name: "Major Donor", color: "#16a34a" } }),
    prisma.tag.upsert({ where: { id: "tag_board" }, update: {}, create: { id: "tag_board", name: "Board Member", color: "#2563eb" } }),
    prisma.tag.upsert({ where: { id: "tag_vol" }, update: {}, create: { id: "tag_vol", name: "Volunteer", color: "#9333ea" } }),
    prisma.tag.upsert({ where: { id: "tag_newsletter" }, update: {}, create: { id: "tag_newsletter", name: "Newsletter", color: "#ea580c" } }),
    prisma.tag.upsert({ where: { id: "tag_gala" }, update: {}, create: { id: "tag_gala", name: "Gala Attendee", color: "#0891b2" } }),
  ]);

  // Campaigns
  const annualCampaign = await prisma.campaign.upsert({
    where: { id: "camp_annual_2025" },
    update: {},
    create: {
      id: "camp_annual_2025",
      organizationId: org.id,
      name: "Annual Fund 2025",
      description: "Our main annual fundraising campaign supporting all core programs.",
      category: CampaignCategory.ANNUAL_FUND,
      goal: 150000,
      startDate: new Date("2025-01-01"),
      endDate: new Date("2025-12-31"),
      active: true,
    },
  });

  const capitalCampaign = await prisma.campaign.upsert({
    where: { id: "camp_capital_2025" },
    update: {},
    create: {
      id: "camp_capital_2025",
      organizationId: org.id,
      name: "New Community Center",
      description: "Capital campaign to build our new community center.",
      category: CampaignCategory.CAPITAL,
      goal: 500000,
      startDate: new Date("2024-07-01"),
      endDate: new Date("2026-06-30"),
      active: true,
    },
  });

  const annualCampaign2026 = await prisma.campaign.upsert({
    where: { id: "camp_annual_2026" },
    update: {},
    create: {
      id: "camp_annual_2026",
      organizationId: org.id,
      name: "Annual Fund 2026",
      description: "Primary 2026 annual campaign for unrestricted and program support.",
      category: CampaignCategory.ANNUAL_FUND,
      goal: 300000,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-12-31"),
      active: true,
    },
  });

  // Constituents
  const constituents = [
    {
      id: "con_01",
      firstName: "Margaret",
      lastName: "Chen",
      email: "margaret.chen@email.com",
      phone: "312-555-0101",
      city: "Chicago",
      state: "IL",
      zip: "60601",
      type: ConstituentType.DONOR,
      donorStatus: DonorStatus.MAJOR_DONOR,
      employer: "Chen Capital Group",
      totalLifetimeGiving: 42500,
      totalYtdGiving: 10000,
      giftCount: 12,
      engagementScore: 92,
      firstGiftDate: new Date("2018-03-15"),
      lastGiftDate: new Date("2025-02-10"),
      lastGiftAmount: 10000,
      tagIds: ["tag_major", "tag_gala"],
    },
    {
      id: "con_02",
      firstName: "Robert",
      lastName: "Adeyemi",
      email: "rob.adeyemi@gmail.com",
      phone: "773-555-0202",
      city: "Evanston",
      state: "IL",
      zip: "60201",
      type: ConstituentType.BOARD_MEMBER,
      donorStatus: DonorStatus.ACTIVE,
      employer: "Adeyemi & Associates Law",
      totalLifetimeGiving: 28000,
      totalYtdGiving: 5000,
      giftCount: 8,
      engagementScore: 85,
      firstGiftDate: new Date("2019-11-01"),
      lastGiftDate: new Date("2025-01-15"),
      lastGiftAmount: 5000,
      tagIds: ["tag_board", "tag_major"],
    },
    {
      id: "con_03",
      firstName: "Linda",
      lastName: "Kowalski",
      email: "lkowalski@northshore.net",
      phone: "847-555-0303",
      city: "Wilmette",
      state: "IL",
      zip: "60091",
      type: ConstituentType.DONOR,
      donorStatus: DonorStatus.ACTIVE,
      totalLifetimeGiving: 8750,
      totalYtdGiving: 1500,
      giftCount: 15,
      engagementScore: 74,
      firstGiftDate: new Date("2017-06-22"),
      lastGiftDate: new Date("2025-03-01"),
      lastGiftAmount: 500,
      tagIds: ["tag_newsletter", "tag_gala"],
    },
    {
      id: "con_04",
      firstName: "Marcus",
      lastName: "Thompson",
      email: "mthompson@outlook.com",
      phone: "312-555-0404",
      city: "Chicago",
      state: "IL",
      zip: "60607",
      type: ConstituentType.VOLUNTEER,
      donorStatus: DonorStatus.ACTIVE,
      employer: "Midwest Medical Center",
      totalLifetimeGiving: 2400,
      totalYtdGiving: 600,
      giftCount: 6,
      engagementScore: 81,
      firstGiftDate: new Date("2021-01-10"),
      lastGiftDate: new Date("2025-04-05"),
      lastGiftAmount: 200,
      tagIds: ["tag_vol", "tag_newsletter"],
    },
    {
      id: "con_05",
      firstName: "Patricia",
      lastName: "O'Brien",
      email: "patricia.obrien@icloud.com",
      phone: "630-555-0505",
      city: "Naperville",
      state: "IL",
      zip: "60540",
      type: ConstituentType.DONOR,
      donorStatus: DonorStatus.LAPSED,
      totalLifetimeGiving: 3200,
      totalYtdGiving: 0,
      giftCount: 9,
      engagementScore: 28,
      firstGiftDate: new Date("2016-08-14"),
      lastGiftDate: new Date("2023-12-15"),
      lastGiftAmount: 250,
      tagIds: ["tag_newsletter"],
    },
    {
      id: "con_06",
      firstName: "David",
      lastName: "Nguyen",
      email: "d.nguyen@techstartup.io",
      phone: "312-555-0606",
      city: "Chicago",
      state: "IL",
      zip: "60611",
      type: ConstituentType.PROSPECT,
      donorStatus: DonorStatus.NEW,
      employer: "TechStartup Inc.",
      totalLifetimeGiving: 0,
      totalYtdGiving: 0,
      giftCount: 0,
      engagementScore: 42,
      firstGiftDate: null,
      lastGiftDate: null,
      lastGiftAmount: null,
      tagIds: ["tag_gala"],
    },
    {
      id: "con_07",
      firstName: "Susan",
      lastName: "Fitzgerald",
      email: "sfitzgerald@yahoo.com",
      phone: "847-555-0707",
      city: "Skokie",
      state: "IL",
      zip: "60076",
      type: ConstituentType.DONOR,
      donorStatus: DonorStatus.ACTIVE,
      totalLifetimeGiving: 5500,
      totalYtdGiving: 1000,
      giftCount: 11,
      engagementScore: 67,
      firstGiftDate: new Date("2018-12-01"),
      lastGiftDate: new Date("2025-04-20"),
      lastGiftAmount: 500,
      tagIds: ["tag_newsletter"],
    },
    {
      id: "con_08",
      firstName: "James",
      lastName: "Williams",
      email: "jwilliams@corporation.com",
      phone: "312-555-0808",
      city: "Chicago",
      state: "IL",
      zip: "60654",
      type: ConstituentType.SPONSOR,
      donorStatus: DonorStatus.ACTIVE,
      employer: "Williams Corporation",
      totalLifetimeGiving: 75000,
      totalYtdGiving: 25000,
      giftCount: 5,
      engagementScore: 95,
      firstGiftDate: new Date("2020-03-01"),
      lastGiftDate: new Date("2025-04-01"),
      lastGiftAmount: 25000,
      tagIds: ["tag_major", "tag_gala"],
    },
  ];

  for (const c of constituents) {
    const { tagIds, ...data } = c;
    const constituent = await prisma.constituent.upsert({
      where: { id: c.id },
      update: {},
      create: {
        ...data,
        organizationId: org.id,
        firstGiftDate: data.firstGiftDate ?? undefined,
        lastGiftDate: data.lastGiftDate ?? undefined,
        lastGiftAmount: data.lastGiftAmount ?? undefined,
      },
    });
    // Add tags
    for (const tagId of tagIds) {
      await prisma.constituentTag.upsert({
        where: { constituentId_tagId: { constituentId: constituent.id, tagId } },
        update: {},
        create: { constituentId: constituent.id, tagId },
      });
    }
  }

  // Designations (funds)
  const generalFund = await prisma.designation.upsert({
    where: { id: "des_general" },
    update: {},
    create: { id: "des_general", name: "General Fund", description: "Unrestricted operating support" },
  });

  const youthFund = await prisma.designation.upsert({
    where: { id: "des_youth" },
    update: {},
    create: { id: "des_youth", name: "Youth Programs", description: "After-school and summer programs" },
  });

  const capitalFund = await prisma.designation.upsert({
    where: { id: "des_capital" },
    update: {},
    create: { id: "des_capital", name: "Capital Projects", description: "Building and infrastructure" },
  });

  // Donations (recent history)
  const donationData = [
    { id: "don_01", constituentId: "con_01", amount: 10000, date: new Date("2025-02-10"), campaignId: annualCampaign.id, designationId: generalFund.id, paymentMethod: PaymentMethod.CHECK },
    { id: "don_02", constituentId: "con_02", amount: 5000, date: new Date("2025-01-15"), campaignId: annualCampaign.id, designationId: generalFund.id, paymentMethod: PaymentMethod.CREDIT_CARD },
    { id: "don_03", constituentId: "con_03", amount: 500, date: new Date("2025-03-01"), campaignId: annualCampaign.id, designationId: youthFund.id, paymentMethod: PaymentMethod.ONLINE },
    { id: "don_04", constituentId: "con_04", amount: 200, date: new Date("2025-04-05"), campaignId: annualCampaign.id, designationId: generalFund.id, paymentMethod: PaymentMethod.CREDIT_CARD },
    { id: "don_05", constituentId: "con_07", amount: 500, date: new Date("2025-04-20"), campaignId: annualCampaign.id, designationId: youthFund.id, paymentMethod: PaymentMethod.ONLINE },
    { id: "don_06", constituentId: "con_08", amount: 25000, date: new Date("2025-04-01"), campaignId: capitalCampaign.id, designationId: capitalFund.id, paymentMethod: PaymentMethod.WIRE },
    { id: "don_07", constituentId: "con_01", amount: 5000, date: new Date("2024-06-15"), campaignId: capitalCampaign.id, designationId: capitalFund.id, paymentMethod: PaymentMethod.CHECK },
    { id: "don_08", constituentId: "con_03", amount: 250, date: new Date("2025-01-20"), campaignId: annualCampaign.id, designationId: generalFund.id, paymentMethod: PaymentMethod.CREDIT_CARD },
    { id: "don_09", constituentId: "con_07", amount: 250, date: new Date("2025-02-14"), campaignId: annualCampaign.id, designationId: generalFund.id, paymentMethod: PaymentMethod.ONLINE },
    { id: "don_10", constituentId: "con_02", amount: 2500, date: new Date("2024-12-31"), campaignId: capitalCampaign.id, designationId: capitalFund.id, paymentMethod: PaymentMethod.CHECK },
  ];

  for (const d of donationData) {
    await prisma.donation.upsert({
      where: { id: d.id },
      update: {},
      create: {
        ...d,
        status: DonationStatus.COMPLETED,
        taxDeductible: true,
        receiptNumber: `RCP-2025-${d.id.replace("don_", "")}`,
      },
    });
  }

  // High-volume 2026 demo donation stream to simulate an active nonprofit.
  // This intentionally creates many gifts and ensures completed revenue is > $250k.
  const donationData2026: Array<{
    id: string;
    constituentId: string;
    amount: number;
    date: Date;
    campaignId: string;
    designationId: string;
    paymentMethod: PaymentMethod;
    status: DonationStatus;
    taxDeductible: boolean;
    receiptNumber?: string;
  }> = [];

  const coreDonorIds = ["con_01", "con_02", "con_03", "con_04", "con_06", "con_07", "con_08"];
  const paymentMethods = [
    PaymentMethod.CREDIT_CARD,
    PaymentMethod.ONLINE,
    PaymentMethod.CHECK,
    PaymentMethod.ACH,
    PaymentMethod.WIRE,
    PaymentMethod.CASH,
  ];
  const designationIds = [generalFund.id, youthFund.id, capitalFund.id];

  let smallCounter = 1;
  let midCounter = 1;
  let majorCounter = 1;
  let pendingCounter = 1;

  for (let month = 0; month < 12; month++) {
    // 40 small recurring gifts per month (480/year)
    for (let i = 0; i < 40; i++) {
      const seq = smallCounter++;
      const donorId = coreDonorIds[(month + i) % coreDonorIds.length];
      const amount = 60 + ((month * 37 + i * 29) % 340); // 60 - 399
      const day = ((i * 3) % 27) + 1;
      const method = paymentMethods[(month + i) % paymentMethods.length];
      const designationId = designationIds[(month + i) % designationIds.length];

      donationData2026.push({
        id: `don_2026_s_${String(seq).padStart(4, "0")}`,
        constituentId: donorId,
        amount,
        date: new Date(Date.UTC(2026, month, day, 15, 0, 0)),
        campaignId: annualCampaign2026.id,
        designationId,
        paymentMethod: method,
        status: DonationStatus.COMPLETED,
        taxDeductible: true,
        receiptNumber: `RCP-2026-S-${String(seq).padStart(4, "0")}`,
      });
    }

    // 5 mid-level gifts per month (60/year)
    for (let i = 0; i < 5; i++) {
      const seq = midCounter++;
      const donorId = coreDonorIds[(month * 2 + i) % coreDonorIds.length];
      const amount = 800 + ((month * 191 + i * 211) % 3200); // 800 - 3999
      const day = 8 + i * 4;
      const method = paymentMethods[(month + i + 2) % paymentMethods.length];
      const designationId = designationIds[(month + i + 1) % designationIds.length];

      donationData2026.push({
        id: `don_2026_m_${String(seq).padStart(4, "0")}`,
        constituentId: donorId,
        amount,
        date: new Date(Date.UTC(2026, month, day, 16, 30, 0)),
        campaignId: annualCampaign2026.id,
        designationId,
        paymentMethod: method,
        status: DonationStatus.COMPLETED,
        taxDeductible: true,
        receiptNumber: `RCP-2026-M-${String(seq).padStart(4, "0")}`,
      });
    }

    // 1 major gift per month (12/year)
    {
      const seq = majorCounter++;
      const donorId = coreDonorIds[(month * 3) % coreDonorIds.length];
      const amount = 9000 + ((month * 1379) % 12000); // 9,000 - 20,999
      const method = month % 2 === 0 ? PaymentMethod.WIRE : PaymentMethod.CHECK;

      donationData2026.push({
        id: `don_2026_g_${String(seq).padStart(4, "0")}`,
        constituentId: donorId,
        amount,
        date: new Date(Date.UTC(2026, month, 24, 18, 0, 0)),
        campaignId: capitalCampaign.id,
        designationId: capitalFund.id,
        paymentMethod: method,
        status: DonationStatus.COMPLETED,
        taxDeductible: true,
        receiptNumber: `RCP-2026-G-${String(seq).padStart(4, "0")}`,
      });
    }

    // 2 non-completed gifts per month for realistic pipeline/failure states
    for (let i = 0; i < 2; i++) {
      const seq = pendingCounter++;
      const donorId = coreDonorIds[(month + i + 3) % coreDonorIds.length];
      const amount = 75 + ((month * 41 + i * 17) % 500);
      const status = i % 2 === 0 ? DonationStatus.PENDING : DonationStatus.FAILED;

      donationData2026.push({
        id: `don_2026_p_${String(seq).padStart(4, "0")}`,
        constituentId: donorId,
        amount,
        date: new Date(Date.UTC(2026, month, 27 + i, 14, 0, 0)),
        campaignId: annualCampaign2026.id,
        designationId: generalFund.id,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        status,
        taxDeductible: true,
      });
    }
  }

  // Replace generated 2026 records on each run to keep demo data deterministic.
  await prisma.donation.deleteMany({ where: { id: { startsWith: "don_2026_" } } });

  // Insert in chunks to keep createMany payload sizes safe.
  const chunkSize = 200;
  for (let i = 0; i < donationData2026.length; i += chunkSize) {
    await prisma.donation.createMany({
      data: donationData2026.slice(i, i + chunkSize),
    });
  }

  // Sync constituent giving rollups from donation ledger so donation records remain source-of-truth.
  const orgConstituents = await prisma.constituent.findMany({
    where: { organizationId: org.id },
    select: { id: true },
  });

  const startOf2026 = new Date("2026-01-01T00:00:00.000Z");
  const endOf2026 = new Date("2027-01-01T00:00:00.000Z");

  for (const constituent of orgConstituents) {
    const [lifetimeAgg, ytdAgg, lastGift] = await Promise.all([
      prisma.donation.aggregate({
        where: { constituentId: constituent.id, status: DonationStatus.COMPLETED },
        _sum: { amount: true },
        _count: true,
        _min: { date: true },
      }),
      prisma.donation.aggregate({
        where: {
          constituentId: constituent.id,
          status: DonationStatus.COMPLETED,
          date: { gte: startOf2026, lt: endOf2026 },
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
        totalLifetimeGiving: Number(lifetimeAgg._sum.amount ?? 0),
        totalYtdGiving: Number(ytdAgg._sum.amount ?? 0),
        giftCount: lifetimeAgg._count,
        firstGiftDate: lifetimeAgg._min.date ?? null,
        lastGiftDate: lastGift?.date ?? null,
        lastGiftAmount: Number(lastGift?.amount ?? 0),
      },
    });
  }

  const completed2026Total = donationData2026
    .filter((d) => d.status === DonationStatus.COMPLETED)
    .reduce((sum, d) => sum + d.amount, 0);

  // Tasks
  const taskData = [
    { id: "task_01", title: "Send thank you to Margaret Chen", type: TaskType.THANK_YOU, constituentId: "con_01", assigneeId: staffUser.id, createdById: adminUser.id, dueDate: new Date("2025-05-10"), status: TaskStatus.PENDING, priority: TaskPriority.HIGH },
    { id: "task_02", title: "Follow up with David Nguyen re: capital campaign", type: TaskType.FOLLOW_UP, constituentId: "con_06", assigneeId: staffUser.id, createdById: adminUser.id, dueDate: new Date("2025-05-15"), status: TaskStatus.PENDING, priority: TaskPriority.HIGH },
    { id: "task_03", title: "Call Patricia O'Brien to re-engage", type: TaskType.CALL, constituentId: "con_05", assigneeId: staffUser.id, createdById: adminUser.id, dueDate: new Date("2025-05-20"), status: TaskStatus.PENDING, priority: TaskPriority.MEDIUM },
    { id: "task_04", title: "Send annual report to board members", type: TaskType.EMAIL, assigneeId: adminUser.id, createdById: adminUser.id, dueDate: new Date("2025-05-07"), status: TaskStatus.PENDING, priority: TaskPriority.HIGH },
    { id: "task_05", title: "Update major donor profiles", type: TaskType.OTHER, assigneeId: staffUser.id, createdById: adminUser.id, dueDate: new Date("2025-05-30"), status: TaskStatus.PENDING, priority: TaskPriority.LOW },
    { id: "task_06", title: "Process donation batch", type: TaskType.OTHER, assigneeId: staffUser.id, createdById: adminUser.id, dueDate: new Date("2025-04-30"), status: TaskStatus.COMPLETED, priority: TaskPriority.MEDIUM },
  ];

  for (const t of taskData) {
    const { constituentId, ...rest } = t;
    await prisma.task.upsert({
      where: { id: t.id },
      update: {},
      create: {
        ...rest,
        constituentId: constituentId ?? undefined,
      },
    });
  }

  // Events
  const eventData = [
    {
      id: "evt_gala_2025",
      name: "Annual Gala 2025",
      type: EventType.GALA,
      location: "The Grand Ballroom, Chicago, IL",
      startDate: new Date("2025-10-18T18:00:00"),
      endDate: new Date("2025-10-18T22:00:00"),
      registrationGoal: 350,
      active: true,
    },
    {
      id: "evt_volunteer_day",
      name: "Spring Volunteer Day",
      type: EventType.VOLUNTEER,
      location: "Riverside Community Park",
      startDate: new Date("2025-04-12T09:00:00"),
      endDate: new Date("2025-04-12T15:00:00"),
      registrationGoal: 100,
      active: true,
    },
  ];

  for (const e of eventData) {
    await prisma.event.upsert({
      where: { id: e.id },
      update: {},
      create: {
        ...e,
        organizationId: org.id,
      },
    });
  }

  // Automation presets seeded as ready-to-use workflows
  const automationData = [
    {
      id: "auto_thank_you_donation",
      name: "Donation Thank-You",
      description: "When a donation is received, send thank-you email and create follow-up task.",
      trigger: AutomationTrigger.DONATION_RECEIVED,
      enabled: true,
      actions: [
        { type: AutomationActionType.SEND_EMAIL, order: 0, config: { template: "thank-you" } },
        { type: AutomationActionType.CREATE_TASK, order: 1, config: { title: "Call donor within 48 hours" } },
      ],
    },
    {
      id: "auto_new_constituent_welcome",
      name: "New Constituent Welcome",
      description: "Welcome flow for new constituents and apply newsletter tag.",
      trigger: AutomationTrigger.CONSTITUENT_CREATED,
      enabled: true,
      actions: [
        { type: AutomationActionType.SEND_EMAIL, order: 0, config: { template: "welcome" } },
        { type: AutomationActionType.ADD_TAG, order: 1, config: { tag: "Newsletter" } },
      ],
    },
  ];

  for (const a of automationData) {
    await prisma.automation.upsert({
      where: { id: a.id },
      update: {
        name: a.name,
        description: a.description,
        trigger: a.trigger,
        enabled: a.enabled,
      },
      create: {
        id: a.id,
        organizationId: org.id,
        name: a.name,
        description: a.description,
        trigger: a.trigger,
        enabled: a.enabled,
      },
    });

    // Replace action list on each seed run to keep presets deterministic
    await prisma.automationAction.deleteMany({ where: { automationId: a.id } });
    for (const action of a.actions) {
      await prisma.automationAction.create({
        data: {
          automationId: a.id,
          type: action.type,
          order: action.order,
          config: action.config as object,
        },
      });
    }
  }

  // Baseline activity timeline records for phase-02 profile timeline support
  const activitySeed = [
    {
      id: "act_con_01_created",
      constituentId: "con_01",
      userId: adminUser.id,
      type: ActivityType.NOTE,
      description: "Constituent profile created.",
      createdAt: new Date("2025-01-02T09:00:00"),
    },
    {
      id: "act_don_01",
      constituentId: "con_01",
      donationId: "don_01",
      userId: staffUser.id,
      type: ActivityType.DONATION,
      description: "Recorded donation of $10,000.00",
      createdAt: new Date("2025-02-10T12:15:00"),
    },
  ];
  for (const a of activitySeed) {
    await prisma.activity.upsert({
      where: { id: a.id },
      update: {},
      create: a,
    });
  }

  // Large-scale expansion adds deterministic synthetic records for stress testing,
  // search, analytics, workflows, and import-validation edge-case coverage.
  const expansion = await seedDemoExpansion(prisma, {
    size: demoOptions.size,
    seedKey: demoOptions.seedKey,
    organizationId: org.id,
    adminUserId: adminUser.id,
    staffUserId: staffUser.id,
    campaignIds: [annualCampaign.id, capitalCampaign.id, annualCampaign2026.id],
    designationIds: [generalFund.id, youthFund.id, capitalFund.id],
  });

  console.log("✅ Seed complete!");
  console.log(`   Organization: ${org.name}`);
  console.log(`   Constituents: ${constituents.length}`);
  console.log(`   Donations:    ${donationData.length + donationData2026.length} (${donationData2026.length} generated for 2026)`);
  console.log(`   2026 Revenue: $${completed2026Total.toLocaleString()} (completed gifts only)`);
  console.log(`   Tasks:        ${taskData.length}`);
  console.log(`   Events:       ${eventData.length}`);
  console.log(`   Automations:  ${automationData.length}`);
  console.log("   --- Demo Expansion ---");
  console.log(`   + Constituents: ${expansion.additionalConstituents}`);
  console.log(`   + Donations:    ${expansion.additionalDonations}`);
  console.log(`   + Events:       ${expansion.additionalEvents}`);
  console.log(`   + Orders:       ${expansion.additionalOrders}`);
  console.log(`   + Guests:       ${expansion.additionalGuests}`);
  console.log(`   + Clients:      ${expansion.additionalClients}`);
  console.log(`   + Appointments: ${expansion.additionalAppointments}`);
  console.log(`   + Services:     ${expansion.additionalServices}`);
  console.log(`   + Follow-ups:   ${expansion.additionalFollowUps}`);
  console.log(`   + Tasks:        ${expansion.additionalTasks}`);
  console.log(`   + Activities:   ${expansion.additionalActivities}`);
  console.log(`   + Campaigns:    ${expansion.additionalEmailCampaigns} email campaigns`);
  console.log(`   + Steward runs: ${expansion.additionalStewardRuns}`);
  console.log(`   Import fixtures: ${expansion.importFixturesDir}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
