import { PrismaClient, ConstituentType, DonorStatus, PaymentMethod, DonationStatus, TaskType, TaskStatus, TaskPriority, CampaignCategory } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding OyamaCRM...");

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
        },
      },
    },
  });

  // Users
  const adminUser = await prisma.user.upsert({
    where: { email: "admin@hopefoundation.org" },
    update: {},
    create: {
      organizationId: org.id,
      email: "admin@hopefoundation.org",
      firstName: "Sarah",
      lastName: "Mitchell",
      role: "admin",
    },
  });

  const staffUser = await prisma.user.upsert({
    where: { email: "james@hopefoundation.org" },
    update: {},
    create: {
      organizationId: org.id,
      email: "james@hopefoundation.org",
      firstName: "James",
      lastName: "Oyama",
      role: "staff",
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

  console.log("✅ Seed complete!");
  console.log(`   Organization: ${org.name}`);
  console.log(`   Constituents: ${constituents.length}`);
  console.log(`   Donations:    ${donationData.length}`);
  console.log(`   Tasks:        ${taskData.length}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
