/**
 * Full donor + OyamaLetters demo seed.
 *
 * This seed is intentionally additive and idempotent. It creates a deterministic
 * demo org, users, address-complete donor records, donations, recipient lists,
 * active letter templates, generated letters, and print/mail queue examples.
 * It also backfills mailing addresses for any existing constituents that are
 * missing address fields so letters readiness checks can be tested reliably.
 */
import {
  ActivityType,
  CampaignCategory,
  ConstituentType,
  DonorStatus,
  DonationStatus,
  LetterCategory,
  LetterTemplateStatus,
  PaymentMethod,
  Prisma,
  PrismaClient,
  RecurringFrequency,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ORG_ID = "org_demo";
const ADMIN_EMAIL = "admin@hopefoundation.org";
const STAFF_EMAIL = "james@hopefoundation.org";

const DEMO_PREFIX = "letters_demo";

type Address = {
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
};

const addressPool: Address[] = [
  { addressLine1: "100 Lakeview Ave", city: "Chicago", state: "IL", zip: "60601", country: "US" },
  { addressLine1: "214 Maple Street", city: "Evanston", state: "IL", zip: "60201", country: "US" },
  { addressLine1: "88 Grant Place", city: "Oak Park", state: "IL", zip: "60302", country: "US" },
  { addressLine1: "451 Mission Road", city: "Naperville", state: "IL", zip: "60540", country: "US" },
  { addressLine1: "17 Prairie Lane", city: "Skokie", state: "IL", zip: "60076", country: "US" },
  { addressLine1: "905 North Harbor Dr", city: "Wilmette", state: "IL", zip: "60091", country: "US" },
  { addressLine1: "732 Sheridan Road", city: "Highland Park", state: "IL", zip: "60035", country: "US" },
  { addressLine1: "44 Community Way", city: "Glenview", state: "IL", zip: "60025", country: "US" },
];

const donorRows = [
  {
    id: `${DEMO_PREFIX}_con_01`,
    firstName: "Alicia",
    lastName: "Bennett",
    email: "alicia.bennett.letters@example.org",
    phone: "312-555-1101",
    type: ConstituentType.DONOR,
    donorStatus: DonorStatus.ACTIVE,
    employer: "Bennett Family Office",
    occupation: "Partner",
    tagIds: ["tag_major", "tag_newsletter"],
    address: addressPool[0],
  },
  {
    id: `${DEMO_PREFIX}_con_02`,
    firstName: "Owen",
    lastName: "Park",
    email: "owen.park.letters@example.org",
    phone: "312-555-1102",
    type: ConstituentType.DONOR,
    donorStatus: DonorStatus.MAJOR_DONOR,
    employer: "Park Design Studio",
    occupation: "Owner",
    tagIds: ["tag_major", "tag_gala"],
    address: addressPool[1],
  },
  {
    id: `${DEMO_PREFIX}_con_03`,
    firstName: "Nadia",
    lastName: "Rivera",
    email: "nadia.rivera.letters@example.org",
    phone: "312-555-1103",
    type: ConstituentType.MEMBER,
    donorStatus: DonorStatus.ACTIVE,
    employer: "Rivera Wellness",
    occupation: "Director",
    tagIds: ["tag_newsletter"],
    address: addressPool[2],
  },
  {
    id: `${DEMO_PREFIX}_con_04`,
    firstName: "Theo",
    lastName: "Wallace",
    email: "theo.wallace.letters@example.org",
    phone: "312-555-1104",
    type: ConstituentType.DONOR,
    donorStatus: DonorStatus.LAPSED,
    employer: "Wallace Logistics",
    occupation: "Operations Lead",
    tagIds: ["tag_newsletter"],
    address: addressPool[3],
  },
  {
    id: `${DEMO_PREFIX}_con_05`,
    firstName: "Priya",
    lastName: "Iyer",
    email: "priya.iyer.letters@example.org",
    phone: "312-555-1105",
    type: ConstituentType.BOARD_MEMBER,
    donorStatus: DonorStatus.MAJOR_DONOR,
    employer: "North Shore Trust",
    occupation: "Trust Officer",
    tagIds: ["tag_board", "tag_major"],
    address: addressPool[4],
  },
  {
    id: `${DEMO_PREFIX}_con_06`,
    firstName: "Caleb",
    lastName: "Morris",
    email: "caleb.morris.letters@example.org",
    phone: "312-555-1106",
    type: ConstituentType.VOLUNTEER,
    donorStatus: DonorStatus.NEW,
    employer: "Morris Electric",
    occupation: "Estimator",
    tagIds: ["tag_vol", "tag_newsletter"],
    address: addressPool[5],
  },
  {
    id: `${DEMO_PREFIX}_con_07`,
    firstName: "Grace",
    lastName: "Sato",
    email: "grace.sato.letters@example.org",
    phone: "312-555-1107",
    type: ConstituentType.DONOR,
    donorStatus: DonorStatus.ACTIVE,
    employer: "Sato Foods",
    occupation: "Controller",
    tagIds: ["tag_newsletter", "tag_gala"],
    address: addressPool[6],
  },
  {
    id: `${DEMO_PREFIX}_con_08`,
    firstName: "Malik",
    lastName: "Johnson",
    email: "malik.johnson.letters@example.org",
    phone: "312-555-1108",
    type: ConstituentType.DONOR,
    donorStatus: DonorStatus.ACTIVE,
    employer: "Johnson Builders",
    occupation: "Project Manager",
    tagIds: ["tag_newsletter"],
    address: addressPool[7],
  },
  {
    id: `${DEMO_PREFIX}_con_09`,
    firstName: "Iris",
    lastName: "Patel",
    email: "iris.patel.letters@example.org",
    phone: "312-555-1109",
    type: ConstituentType.DONOR,
    donorStatus: DonorStatus.ACTIVE,
    employer: "Patel Pediatrics",
    occupation: "Physician",
    tagIds: ["tag_newsletter"],
    address: { ...addressPool[0], addressLine1: "802 Hope Circle" },
  },
  {
    id: `${DEMO_PREFIX}_con_10`,
    firstName: "Samuel",
    lastName: "Brooks",
    email: "samuel.brooks.letters@example.org",
    phone: "312-555-1110",
    type: ConstituentType.SPONSOR,
    donorStatus: DonorStatus.MAJOR_DONOR,
    employer: "Brooks Manufacturing",
    occupation: "President",
    tagIds: ["tag_major", "tag_gala"],
    address: { ...addressPool[1], addressLine1: "610 Sponsor Plaza" },
  },
  {
    id: `${DEMO_PREFIX}_con_11`,
    firstName: "Mail",
    lastName: "Suppressed",
    email: "mail.suppressed.letters@example.org",
    phone: "312-555-1111",
    type: ConstituentType.DONOR,
    donorStatus: DonorStatus.ACTIVE,
    employer: "Suppression Test Household",
    occupation: "Demo Record",
    doNotMail: true,
    tagIds: ["tag_newsletter"],
    address: { ...addressPool[2], addressLine1: "404 Suppression Street" },
  },
  {
    id: `${DEMO_PREFIX}_con_12`,
    firstName: "Foundation",
    lastName: "Test",
    email: "foundation.test.letters@example.org",
    phone: "312-555-1112",
    type: ConstituentType.FOUNDATION,
    donorStatus: DonorStatus.NEW,
    employer: "Foundation Test Charitable Trust",
    occupation: "Institutional Donor",
    tagIds: ["tag_major"],
    address: { ...addressPool[3], addressLine1: "1200 Grantmaker Row", addressLine2: "Suite 410" },
  },
] as const;

function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function queueMetadata(printStatus: "NEEDS_REVIEW" | "QUEUED_FOR_PRINT" | "PRINTED", userId: string): Prisma.InputJsonValue {
  return {
    queue: {
      printStatus,
      reviewStatus: printStatus === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "APPROVED",
      priority: printStatus === "NEEDS_REVIEW" ? "HIGH" : "NORMAL",
      queuedForPrintAt: printStatus === "QUEUED_FOR_PRINT" ? new Date().toISOString() : undefined,
      updatedByUserId: userId,
      statusNote: "Seeded demo queue item",
    },
    seed: "donor-letters-demo",
  } as Prisma.InputJsonValue;
}

async function ensureOrganizationAndUsers() {
  const adminHash = await bcrypt.hash("admin123!", 12);
  const staffHash = await bcrypt.hash("staff123!", 12);

  const org = await prisma.organization.upsert({
    where: { id: ORG_ID },
    update: { name: "Hope Community Foundation" },
    create: {
      id: ORG_ID,
      name: "Hope Community Foundation",
      settings: {
        create: {
          fiscalYearStart: 1,
          currency: "USD",
          timezone: "America/Chicago",
          donorWorkspaceEnabled: true,
          compassionWorkspaceEnabled: true,
          lettersVisualBuilderEnabled: true,
          smtpFromName: "Hope Community Foundation",
          smtpFromEmail: "giving@hopecommunity.org",
        },
      },
    },
  });

  await prisma.organizationSettings.upsert({
    where: { organizationId: org.id },
    update: {
      donorWorkspaceEnabled: true,
      lettersVisualBuilderEnabled: true,
      smtpFromName: "Hope Community Foundation",
      smtpFromEmail: "giving@hopecommunity.org",
    },
    create: {
      organizationId: org.id,
      fiscalYearStart: 1,
      currency: "USD",
      timezone: "America/Chicago",
      donorWorkspaceEnabled: true,
      compassionWorkspaceEnabled: true,
      lettersVisualBuilderEnabled: true,
      smtpFromName: "Hope Community Foundation",
      smtpFromEmail: "giving@hopecommunity.org",
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: { passwordHash: adminHash, role: "admin", active: true },
    create: {
      organizationId: org.id,
      email: ADMIN_EMAIL,
      firstName: "Sarah",
      lastName: "Mitchell",
      role: "admin",
      passwordHash: adminHash,
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: STAFF_EMAIL },
    update: { passwordHash: staffHash, role: "manager", active: true },
    create: {
      organizationId: org.id,
      email: STAFF_EMAIL,
      firstName: "James",
      lastName: "Oyama",
      role: "manager",
      passwordHash: staffHash,
    },
  });

  return { org, admin, staff };
}

async function seedTags() {
  const tags = [
    { id: "tag_major", name: "Major Donor", color: "#16a34a", description: "High-capacity donor or institution." },
    { id: "tag_board", name: "Board Member", color: "#2563eb", description: "Current board member." },
    { id: "tag_vol", name: "Volunteer", color: "#9333ea", description: "Active volunteer." },
    { id: "tag_newsletter", name: "Newsletter", color: "#ea580c", description: "Receives general updates." },
    { id: "tag_gala", name: "Gala Attendee", color: "#0891b2", description: "Event attendee or sponsor prospect." },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { id: tag.id },
      update: { name: tag.name, color: tag.color, description: tag.description },
      create: tag,
    });
  }
}

async function seedCampaignsAndDesignations(orgId: string) {
  const annual = await prisma.campaign.upsert({
    where: { id: `${DEMO_PREFIX}_campaign_annual_2026` },
    update: {
      organizationId: orgId,
      name: "2026 Annual Fund",
      active: true,
    },
    create: {
      id: `${DEMO_PREFIX}_campaign_annual_2026`,
      organizationId: orgId,
      name: "2026 Annual Fund",
      description: "Address-complete donor and letters test campaign.",
      category: CampaignCategory.ANNUAL_FUND,
      goal: 250000,
      startDate: utcDate(2026, 1, 1),
      endDate: utcDate(2026, 12, 31),
      active: true,
    },
  });

  const capital = await prisma.campaign.upsert({
    where: { id: `${DEMO_PREFIX}_campaign_capital` },
    update: {
      organizationId: orgId,
      name: "Community Center Capital Campaign",
      active: true,
    },
    create: {
      id: `${DEMO_PREFIX}_campaign_capital`,
      organizationId: orgId,
      name: "Community Center Capital Campaign",
      description: "Major gift and sponsor test campaign.",
      category: CampaignCategory.CAPITAL,
      goal: 1000000,
      startDate: utcDate(2026, 1, 1),
      endDate: utcDate(2027, 12, 31),
      active: true,
    },
  });

  const general = await prisma.designation.upsert({
    where: { id: `${DEMO_PREFIX}_des_general` },
    update: { name: "General Fund", active: true },
    create: {
      id: `${DEMO_PREFIX}_des_general`,
      name: "General Fund",
      description: "Unrestricted operating support.",
      active: true,
    },
  });

  const programs = await prisma.designation.upsert({
    where: { id: `${DEMO_PREFIX}_des_programs` },
    update: { name: "Family Programs", active: true },
    create: {
      id: `${DEMO_PREFIX}_des_programs`,
      name: "Family Programs",
      description: "Program-restricted giving.",
      active: true,
    },
  });

  const capitalFund = await prisma.designation.upsert({
    where: { id: `${DEMO_PREFIX}_des_capital` },
    update: { name: "Capital Projects", active: true },
    create: {
      id: `${DEMO_PREFIX}_des_capital`,
      name: "Capital Projects",
      description: "Building and infrastructure gifts.",
      active: true,
    },
  });

  return { annual, capital, general, programs, capitalFund };
}

async function seedAddressCompleteDonors(orgId: string) {
  for (const row of donorRows) {
    const { address, tagIds, ...data } = row;
    const suppressedForMail = "doNotMail" in row ? row.doNotMail : false;
    await prisma.constituent.upsert({
      where: { id: row.id },
      update: {
        ...data,
        ...address,
        doNotMail: suppressedForMail,
        doNotContact: false,
      },
      create: {
        ...data,
        ...address,
        organizationId: orgId,
        doNotMail: suppressedForMail,
        doNotContact: false,
      },
    });

    for (const tagId of tagIds) {
      await prisma.constituentTag.upsert({
        where: { constituentId_tagId: { constituentId: row.id, tagId } },
        update: {},
        create: { constituentId: row.id, tagId },
      });
    }
  }
}

async function seedDonations(args: Awaited<ReturnType<typeof seedCampaignsAndDesignations>>) {
  const donations = [
    { id: `${DEMO_PREFIX}_don_01`, constituentId: `${DEMO_PREFIX}_con_01`, amount: 250, date: utcDate(2026, 5, 1), campaignId: args.annual.id, designationId: args.general.id, paymentMethod: PaymentMethod.CREDIT_CARD },
    { id: `${DEMO_PREFIX}_don_02`, constituentId: `${DEMO_PREFIX}_con_02`, amount: 5000, date: utcDate(2026, 5, 4), campaignId: args.capital.id, designationId: args.capitalFund.id, paymentMethod: PaymentMethod.CHECK },
    { id: `${DEMO_PREFIX}_don_03`, constituentId: `${DEMO_PREFIX}_con_03`, amount: 75, date: utcDate(2026, 5, 5), campaignId: args.annual.id, designationId: args.programs.id, paymentMethod: PaymentMethod.ONLINE },
    { id: `${DEMO_PREFIX}_don_04`, constituentId: `${DEMO_PREFIX}_con_04`, amount: 125, date: utcDate(2025, 1, 15), campaignId: args.annual.id, designationId: args.general.id, paymentMethod: PaymentMethod.CASH },
    { id: `${DEMO_PREFIX}_don_05`, constituentId: `${DEMO_PREFIX}_con_05`, amount: 7500, date: utcDate(2026, 4, 20), campaignId: args.capital.id, designationId: args.capitalFund.id, paymentMethod: PaymentMethod.WIRE },
    { id: `${DEMO_PREFIX}_don_06`, constituentId: `${DEMO_PREFIX}_con_06`, amount: 35, date: utcDate(2026, 5, 6), campaignId: args.annual.id, designationId: args.programs.id, paymentMethod: PaymentMethod.ONLINE },
    { id: `${DEMO_PREFIX}_don_07`, constituentId: `${DEMO_PREFIX}_con_07`, amount: 100, date: utcDate(2026, 5, 8), campaignId: args.annual.id, designationId: args.general.id, paymentMethod: PaymentMethod.ACH, isRecurring: true },
    { id: `${DEMO_PREFIX}_don_08`, constituentId: `${DEMO_PREFIX}_con_08`, amount: 100, date: utcDate(2026, 4, 8), campaignId: args.annual.id, designationId: args.general.id, paymentMethod: PaymentMethod.ACH, isRecurring: true },
    { id: `${DEMO_PREFIX}_don_09`, constituentId: `${DEMO_PREFIX}_con_09`, amount: 100, date: utcDate(2026, 3, 8), campaignId: args.annual.id, designationId: args.general.id, paymentMethod: PaymentMethod.ACH, isRecurring: true },
    { id: `${DEMO_PREFIX}_don_10`, constituentId: `${DEMO_PREFIX}_con_10`, amount: 15000, date: utcDate(2026, 5, 10), campaignId: args.capital.id, designationId: args.capitalFund.id, paymentMethod: PaymentMethod.CHECK },
    { id: `${DEMO_PREFIX}_don_11`, constituentId: `${DEMO_PREFIX}_con_11`, amount: 50, date: utcDate(2026, 5, 12), campaignId: args.annual.id, designationId: args.general.id, paymentMethod: PaymentMethod.ONLINE },
    { id: `${DEMO_PREFIX}_don_12`, constituentId: `${DEMO_PREFIX}_con_12`, amount: 25000, date: utcDate(2026, 5, 14), campaignId: args.capital.id, designationId: args.capitalFund.id, paymentMethod: PaymentMethod.WIRE },
    { id: `${DEMO_PREFIX}_don_pending`, constituentId: `${DEMO_PREFIX}_con_01`, amount: 500, date: utcDate(2026, 5, 20), campaignId: args.annual.id, designationId: args.general.id, paymentMethod: PaymentMethod.CHECK, status: DonationStatus.PENDING },
  ];

  for (const [index, row] of donations.entries()) {
    await prisma.donation.upsert({
      where: { id: row.id },
      update: {
        amount: row.amount,
        date: row.date,
        status: row.status ?? DonationStatus.COMPLETED,
        paymentMethod: row.paymentMethod,
        campaignId: row.campaignId,
        designationId: row.designationId,
        isRecurring: row.isRecurring ?? false,
        frequency: row.isRecurring ? RecurringFrequency.MONTHLY : null,
      },
      create: {
        id: row.id,
        constituentId: row.constituentId,
        amount: row.amount,
        date: row.date,
        status: row.status ?? DonationStatus.COMPLETED,
        paymentMethod: row.paymentMethod,
        campaignId: row.campaignId,
        designationId: row.designationId,
        isRecurring: row.isRecurring ?? false,
        frequency: row.isRecurring ? RecurringFrequency.MONTHLY : undefined,
        receiptNumber: row.status === DonationStatus.PENDING ? null : `LETTERS-DEMO-${String(index + 1).padStart(4, "0")}`,
        receiptSentAt: row.status === DonationStatus.PENDING ? null : row.date,
        acknowledgmentSentAt: index % 3 === 0 ? null : row.date,
      },
    });
  }
}

async function recalculateGivingRollups() {
  for (const donor of donorRows) {
    const [lifetime, ytd, firstGift, lastGift] = await Promise.all([
      prisma.donation.aggregate({
        where: { constituentId: donor.id, status: DonationStatus.COMPLETED },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.donation.aggregate({
        where: {
          constituentId: donor.id,
          status: DonationStatus.COMPLETED,
          date: { gte: utcDate(2026, 1, 1), lte: utcDate(2026, 12, 31) },
        },
        _sum: { amount: true },
      }),
      prisma.donation.findFirst({
        where: { constituentId: donor.id, status: DonationStatus.COMPLETED },
        orderBy: { date: "asc" },
        select: { date: true },
      }),
      prisma.donation.findFirst({
        where: { constituentId: donor.id, status: DonationStatus.COMPLETED },
        orderBy: { date: "desc" },
        select: { amount: true, date: true },
      }),
    ]);

    const giftCount = lifetime._count.id;
    const totalLifetimeGiving = Number(lifetime._sum.amount ?? 0);
    await prisma.constituent.update({
      where: { id: donor.id },
      data: {
        totalLifetimeGiving,
        totalYtdGiving: Number(ytd._sum.amount ?? 0),
        giftCount,
        firstGiftDate: firstGift?.date ?? null,
        lastGiftDate: lastGift?.date ?? null,
        lastGiftAmount: lastGift?.amount ?? null,
        engagementScore: Math.min(100, 35 + giftCount * 8 + Math.floor(Math.log10(totalLifetimeGiving + 1) * 12)),
      },
    });
  }
}

async function backfillAddressesForEveryConstituent() {
  const rows = await prisma.constituent.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      addressLine1: true,
      city: true,
      state: true,
      zip: true,
      country: true,
    },
  });

  let updated = 0;
  for (const [index, row] of rows.entries()) {
    if (row.addressLine1?.trim() && row.city?.trim() && row.state?.trim() && row.zip?.trim() && row.country?.trim()) {
      continue;
    }
    const base = addressPool[index % addressPool.length];
    await prisma.constituent.update({
      where: { id: row.id },
      data: {
        addressLine1: row.addressLine1?.trim() || `${1000 + index} Demo Address Lane`,
        city: row.city?.trim() || base.city,
        state: row.state?.trim() || base.state,
        zip: row.zip?.trim() || base.zip,
        country: row.country?.trim() || base.country,
      },
    });
    updated += 1;
  }

  return updated;
}

async function seedLetterAssets(orgId: string, userId: string) {
  const header = await prisma.letterHeaderPreset.upsert({
    where: { id: `${DEMO_PREFIX}_header_default` },
    update: {
      organizationId: orgId,
      name: "Demo Letterhead",
      isDefault: true,
      isActive: true,
    },
    create: {
      id: `${DEMO_PREFIX}_header_default`,
      organizationId: orgId,
      name: "Demo Letterhead",
      logoAlignment: "LEFT",
      showOrganizationName: true,
      showTagline: true,
      showAddress: true,
      showPhone: true,
      showWebsite: true,
      isDefault: true,
      isActive: true,
    },
  });

  const footer = await prisma.letterFooterPreset.upsert({
    where: { id: `${DEMO_PREFIX}_footer_default` },
    update: {
      organizationId: orgId,
      name: "Demo Footer",
      isDefault: true,
      isActive: true,
    },
    create: {
      id: `${DEMO_PREFIX}_footer_default`,
      organizationId: orgId,
      name: "Demo Footer",
      showOrganizationName: true,
      showAddress: true,
      showPhone: true,
      showEmail: true,
      showWebsite: true,
      showTaxId: true,
      showPageNumber: true,
      customText: "Thank you for strengthening families in our community.",
      isDefault: true,
      isActive: true,
    },
  });

  const signature = await prisma.letterSignatureBlock.upsert({
    where: { id: `${DEMO_PREFIX}_signature_default` },
    update: {
      organizationId: orgId,
      name: "Sarah Mitchell",
      signerName: "Sarah Mitchell",
      signerTitle: "Executive Director",
      isDefault: true,
      isActive: true,
    },
    create: {
      id: `${DEMO_PREFIX}_signature_default`,
      organizationId: orgId,
      name: "Sarah Mitchell",
      signerName: "Sarah Mitchell",
      signerTitle: "Executive Director",
      closingPhrase: "With gratitude,",
      typedSignature: "Sarah Mitchell",
      email: "giving@hopecommunity.org",
      phone: "312-555-0199",
      isDefault: true,
      isActive: true,
    },
  });

  const templates = [
    {
      id: `${DEMO_PREFIX}_template_thank_you`,
      name: "Demo Thank You With Gift Fields",
      category: LetterCategory.THANK_YOU,
      printSubject: "Thank you for your gift",
      printBody: [
        "<p>{{donor.salutation}}</p>",
        "<p>Thank you for your generous gift of {{gift.amount}} on {{gift.date}} to {{gift.fund}}.</p>",
        "<p>Your support of {{organization.name}} helps us serve families with practical care and lasting encouragement.</p>",
        "<p>{{donor.addressBlock}}</p>",
      ].join(""),
      emailSubject: "Thank you for your gift",
      emailBody: "<p>Thank you, {{donor.firstName}}, for your gift of {{gift.amount}}.</p>",
      mergeFieldsUsed: ["donor.salutation", "gift.amount", "gift.date", "gift.fund", "organization.name", "donor.addressBlock"],
    },
    {
      id: `${DEMO_PREFIX}_template_pdf_only_no_address`,
      name: "Demo PDF Only No Address Required",
      category: LetterCategory.GENERAL,
      printSubject: "Community update",
      printBody: "<p>Hello {{donor.firstName}},</p><p>Here is a short update from {{organization.name}}. This template intentionally avoids mailing-address fields.</p>",
      emailSubject: "Community update",
      emailBody: "<p>Hello {{donor.firstName}}, here is a short update.</p>",
      mergeFieldsUsed: ["donor.firstName", "organization.name"],
    },
    {
      id: `${DEMO_PREFIX}_template_year_end`,
      name: "Demo Year-End Receipt Summary",
      category: LetterCategory.END_OF_YEAR,
      printSubject: "Your {{year}} giving summary",
      printBody: [
        "<p>{{donor.salutation}}</p>",
        "<p>Thank you for giving {{year.totalGiving}} across {{year.numberOfGifts}} gifts in {{year}}.</p>",
        "<p>First gift: {{year.firstGiftDate}}. Most recent gift: {{year.lastGiftDate}}.</p>",
      ].join(""),
      emailSubject: "Your giving summary",
      emailBody: "<p>Your {{year}} giving total is {{year.totalGiving}}.</p>",
      mergeFieldsUsed: ["donor.salutation", "year.totalGiving", "year.numberOfGifts", "year", "year.firstGiftDate", "year.lastGiftDate"],
    },
  ];

  for (const template of templates) {
    await prisma.letterTemplate.upsert({
      where: { id: template.id },
      update: {
        organizationId: orgId,
        name: template.name,
        category: template.category,
        status: LetterTemplateStatus.ACTIVE,
        printSubject: template.printSubject,
        printBody: template.printBody,
        emailSubject: template.emailSubject,
        emailBody: template.emailBody,
        headerPresetId: header.id,
        footerPresetId: footer.id,
        signatureBlockId: signature.id,
        mergeFieldsUsed: template.mergeFieldsUsed,
        updatedByUserId: userId,
      },
      create: {
        id: template.id,
        organizationId: orgId,
        name: template.name,
        description: "Seeded template for donor and OyamaLetters QA.",
        category: template.category,
        status: LetterTemplateStatus.ACTIVE,
        printSubject: template.printSubject,
        printBody: template.printBody,
        emailSubject: template.emailSubject,
        emailBody: template.emailBody,
        headerPresetId: header.id,
        footerPresetId: footer.id,
        signatureBlockId: signature.id,
        mergeFieldsUsed: template.mergeFieldsUsed,
        crmScope: "DONOR",
        createdByUserId: userId,
        updatedByUserId: userId,
      },
    });
  }

  return { header, footer, signature, templates };
}

async function seedRecipientLists(orgId: string, userId: string) {
  const lists = [
    {
      id: `${DEMO_PREFIX}_list_active_addressed`,
      name: "Demo Addressed Active Donors",
      description: "Address-complete active donors for batch letters.",
      memberIds: [`${DEMO_PREFIX}_con_01`, `${DEMO_PREFIX}_con_03`, `${DEMO_PREFIX}_con_07`, `${DEMO_PREFIX}_con_08`, `${DEMO_PREFIX}_con_09`],
    },
    {
      id: `${DEMO_PREFIX}_list_major_gifts`,
      name: "Demo Major Gift Prospects",
      description: "Major donors, sponsors, and institutional records for campaign letters.",
      memberIds: [`${DEMO_PREFIX}_con_02`, `${DEMO_PREFIX}_con_05`, `${DEMO_PREFIX}_con_10`, `${DEMO_PREFIX}_con_12`],
    },
    {
      id: `${DEMO_PREFIX}_list_suppression_check`,
      name: "Demo Suppression Check",
      description: "Includes one do-not-mail record to test skipped reasons.",
      memberIds: [`${DEMO_PREFIX}_con_01`, `${DEMO_PREFIX}_con_11`, `${DEMO_PREFIX}_con_12`],
    },
  ];

  for (const list of lists) {
    await prisma.emailRecipientList.upsert({
      where: { id: list.id },
      update: {
        organizationId: orgId,
        name: list.name,
        description: list.description,
        createdById: userId,
      },
      create: {
        id: list.id,
        organizationId: orgId,
        name: list.name,
        description: list.description,
        createdById: userId,
      },
    });

    for (const constituentId of list.memberIds) {
      const constituent = donorRows.find((row) => row.id === constituentId);
      if (!constituent) continue;
      await prisma.emailRecipientListMember.upsert({
        where: { listId_email: { listId: list.id, email: constituent.email } },
        update: {
          firstName: constituent.firstName,
          lastName: constituent.lastName,
        },
        create: {
          listId: list.id,
          email: constituent.email,
          firstName: constituent.firstName,
          lastName: constituent.lastName,
        },
      });
    }
  }
}

async function seedGeneratedLetters(orgId: string, userId: string) {
  const rows = [
    {
      id: `${DEMO_PREFIX}_generated_review_01`,
      templateId: `${DEMO_PREFIX}_template_thank_you`,
      constituentId: `${DEMO_PREFIX}_con_01`,
      donationId: `${DEMO_PREFIX}_don_01`,
      category: LetterCategory.THANK_YOU,
      metadataJson: queueMetadata("NEEDS_REVIEW", userId),
    },
    {
      id: `${DEMO_PREFIX}_generated_print_01`,
      templateId: `${DEMO_PREFIX}_template_thank_you`,
      constituentId: `${DEMO_PREFIX}_con_02`,
      donationId: `${DEMO_PREFIX}_don_02`,
      category: LetterCategory.THANK_YOU,
      metadataJson: queueMetadata("QUEUED_FOR_PRINT", userId),
    },
    {
      id: `${DEMO_PREFIX}_generated_year_end_01`,
      templateId: `${DEMO_PREFIX}_template_year_end`,
      constituentId: `${DEMO_PREFIX}_con_05`,
      donationId: `${DEMO_PREFIX}_don_05`,
      category: LetterCategory.END_OF_YEAR,
      metadataJson: queueMetadata("NEEDS_REVIEW", userId),
    },
  ];

  for (const row of rows) {
    const constituent = donorRows.find((donor) => donor.id === row.constituentId);
    const body = `<p>Dear ${constituent?.firstName ?? "Friend"},</p><p>This seeded generated letter is ready for PDF, print queue, and donor profile testing.</p>`;
    await prisma.generatedLetter.upsert({
      where: { id: row.id },
      update: {
        organizationId: orgId,
        templateId: row.templateId,
        constituentId: row.constituentId,
        donationId: row.donationId,
        category: row.category,
        mergedPrintSubject: "Seeded generated letter",
        mergedPrintBody: body,
        metadataJson: row.metadataJson,
        generatedByUserId: userId,
      },
      create: {
        id: row.id,
        organizationId: orgId,
        templateId: row.templateId,
        constituentId: row.constituentId,
        donationId: row.donationId,
        category: row.category,
        status: "GENERATED",
        mergedPrintSubject: "Seeded generated letter",
        mergedPrintBody: body,
        mergedEmailBody: body,
        emailSubject: "Seeded generated letter",
        metadataJson: row.metadataJson,
        generatedByUserId: userId,
      },
    });
  }
}

async function seedTasksAndActivity(userId: string, staffId: string) {
  const tasks = [
    {
      id: `${DEMO_PREFIX}_task_thank_you`,
      title: "Review seeded thank-you letters",
      description: "Use OyamaLetters Generate and Queue to validate batch PDFs and print review behavior.",
      type: TaskType.THANK_YOU,
      status: TaskStatus.PENDING,
      priority: TaskPriority.HIGH,
      constituentId: `${DEMO_PREFIX}_con_01`,
      generatedLetterId: `${DEMO_PREFIX}_generated_review_01`,
    },
    {
      id: `${DEMO_PREFIX}_task_lapsed`,
      title: "Call lapsed donor from letters demo",
      description: "Validate donor profile tasks, timeline, and follow-up workflow.",
      type: TaskType.CALL,
      status: TaskStatus.IN_PROGRESS,
      priority: TaskPriority.MEDIUM,
      constituentId: `${DEMO_PREFIX}_con_04`,
      generatedLetterId: null,
    },
  ];

  for (const task of tasks) {
    await prisma.task.upsert({
      where: { id: task.id },
      update: {
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        generatedLetterId: task.generatedLetterId,
      },
      create: {
        ...task,
        organizationId: ORG_ID,
        assigneeId: staffId,
        createdById: userId,
        dueDate: utcDate(2026, 6, 15),
      },
    });
  }

  const activities = [
    {
      id: `${DEMO_PREFIX}_activity_donation`,
      constituentId: `${DEMO_PREFIX}_con_01`,
      donationId: `${DEMO_PREFIX}_don_01`,
      userId,
      type: ActivityType.DONATION,
      description: "Seeded donation recorded for letters merge testing.",
    },
    {
      id: `${DEMO_PREFIX}_activity_letter`,
      constituentId: `${DEMO_PREFIX}_con_01`,
      taskId: `${DEMO_PREFIX}_task_thank_you`,
      userId,
      type: ActivityType.NOTE,
      description: "Seeded generated letter is waiting for print review.",
    },
  ];

  for (const activity of activities) {
    await prisma.activity.upsert({
      where: { id: activity.id },
      update: {
        description: activity.description,
        type: activity.type,
      },
      create: {
        ...activity,
        createdAt: new Date(),
      },
    });
  }
}

async function seedWorkflowAndBranding(orgId: string) {
  await prisma.pluginSetting.upsert({
    where: {
      organizationId_pluginKey: {
        organizationId: orgId,
        pluginKey: "letters-workflow-settings",
      },
    },
    update: {
      config: {
        autoQueueBatchToPrint: true,
        requirePrintApproval: true,
        defaultPriority: "NORMAL",
        mailingSlaDays: 7,
        allowDirectMailQueue: false,
        enableAddressValidationGate: true,
        pdfFallbackMode: "SERVER_RENDER",
        notes: "Seeded policy for testing review-first print queue behavior.",
      },
      enabled: true,
    },
    create: {
      organizationId: orgId,
      pluginKey: "letters-workflow-settings",
      enabled: true,
      config: {
        autoQueueBatchToPrint: true,
        requirePrintApproval: true,
        defaultPriority: "NORMAL",
        mailingSlaDays: 7,
        allowDirectMailQueue: false,
        enableAddressValidationGate: true,
        pdfFallbackMode: "SERVER_RENDER",
        notes: "Seeded policy for testing review-first print queue behavior.",
      },
    },
  });

  await prisma.pluginSetting.upsert({
    where: {
      organizationId_pluginKey: {
        organizationId: orgId,
        pluginKey: "organization-branding",
      },
    },
    update: {
      enabled: true,
      config: {
        organizationName: "Hope Community Foundation",
        tagline: "Practical care. Lasting hope.",
        addressLine1: "100 Lakeview Ave",
        city: "Chicago",
        state: "IL",
        zip: "60601",
        phone: "312-555-0199",
        website: "https://hopecommunity.example.org",
        taxId: "12-3456789",
        missionStatement: "Hope Community Foundation strengthens families through practical care, trusted relationships, and community generosity.",
      },
    },
    create: {
      organizationId: orgId,
      pluginKey: "organization-branding",
      enabled: true,
      config: {
        organizationName: "Hope Community Foundation",
        tagline: "Practical care. Lasting hope.",
        addressLine1: "100 Lakeview Ave",
        city: "Chicago",
        state: "IL",
        zip: "60601",
        phone: "312-555-0199",
        website: "https://hopecommunity.example.org",
        taxId: "12-3456789",
        missionStatement: "Hope Community Foundation strengthens families through practical care, trusted relationships, and community generosity.",
      },
    },
  });
}

async function main() {
  console.log("Seeding donor + OyamaLetters full demo data...");

  const { org, admin, staff } = await ensureOrganizationAndUsers();
  await seedTags();
  const campaignAndFunds = await seedCampaignsAndDesignations(org.id);
  await seedAddressCompleteDonors(org.id);
  await seedDonations(campaignAndFunds);
  await recalculateGivingRollups();
  const backfilledAddressCount = await backfillAddressesForEveryConstituent();
  await seedWorkflowAndBranding(org.id);
  await seedLetterAssets(org.id, admin.id);
  await seedRecipientLists(org.id, admin.id);
  await seedGeneratedLetters(org.id, admin.id);
  await seedTasksAndActivity(admin.id, staff.id);

  const [constituentCount, missingAddressCount, templateCount, generatedCount, listCount] = await Promise.all([
    prisma.constituent.count({ where: { organizationId: org.id } }),
    prisma.constituent.count({
      where: {
        organizationId: org.id,
        OR: [
          { addressLine1: null },
          { city: null },
          { state: null },
          { zip: null },
        ],
      },
    }),
    prisma.letterTemplate.count({ where: { organizationId: org.id, id: { startsWith: `${DEMO_PREFIX}_` } } }),
    prisma.generatedLetter.count({ where: { organizationId: org.id, id: { startsWith: `${DEMO_PREFIX}_` } } }),
    prisma.emailRecipientList.count({ where: { organizationId: org.id, id: { startsWith: `${DEMO_PREFIX}_` } } }),
  ]);

  console.log("Donor + OyamaLetters demo seed complete.");
  console.log(`  Organization: ${org.name}`);
  console.log(`  Login: ${ADMIN_EMAIL} / admin123!`);
  console.log(`  Address-complete demo donors: ${donorRows.length}`);
  console.log(`  Total org constituents: ${constituentCount}`);
  console.log(`  Existing constituents backfilled with addresses: ${backfilledAddressCount}`);
  console.log(`  Constituents still missing address parts: ${missingAddressCount}`);
  console.log(`  Letter templates: ${templateCount}`);
  console.log(`  Generated letters: ${generatedCount}`);
  console.log(`  Recipient lists: ${listCount}`);
}

main()
  .catch((error) => {
    console.error("Donor + OyamaLetters demo seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
