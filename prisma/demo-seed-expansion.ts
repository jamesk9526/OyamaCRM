/** Large-scale deterministic demo seed expansion for DonorCRM, Compassion CRM, and Events CRM. */
import {
  ActivityType,
  AutomationActionType,
  AutomationTrigger,
  CampaignCategory,
  CompassionAppointmentStatus,
  CompassionAppointmentType,
  CompassionCaseStatus,
  CompassionCaseType,
  CompassionClientStatus,
  CompassionFollowUpStatus,
  CompassionPriority,
  CompassionServiceType,
  ConstituentType,
  DonationStatus,
  DonorStatus,
  EmailCampaignStatus,
  EventGuestPaymentStatus,
  EventGuestRsvpStatus,
  EventStatus,
  EventType,
  EventVisibility,
  MeetingLocationType,
  MeetingStatus,
  MeetingType,
  OrderStatus,
  PaymentMethod,
  PrismaClient,
  RecurringFrequency,
  SponsorshipLevel,
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@prisma/client";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/** Marker string applied to seeded records so synthetic data is never mistaken for production data. */
const DEMO_MARKER = "[DEMO DATA - SYNTHETIC RECORD]";

/** Seed size profile supported by the deterministic demo generator. */
export type DemoSeedSize = "small" | "medium" | "large";

/** Caller-provided expansion options from the main Prisma seed script. */
export interface DemoSeedExpansionOptions {
  size: DemoSeedSize;
  seedKey: string;
  organizationId: string;
  adminUserId: string;
  staffUserId: string;
  campaignIds: string[];
  designationIds: string[];
}

/** Summary returned to the root seeding script for logging and verification output. */
export interface DemoSeedExpansionSummary {
  size: DemoSeedSize;
  seedKey: string;
  additionalConstituents: number;
  additionalDonations: number;
  additionalEvents: number;
  additionalOrders: number;
  additionalGuests: number;
  additionalClients: number;
  additionalAppointments: number;
  additionalServices: number;
  additionalFollowUps: number;
  additionalTasks: number;
  additionalActivities: number;
  additionalEmailCampaigns: number;
  additionalStewardRuns: number;
  additionalFeedbackTickets: number;
  importFixturesDir: string;
}

/** Count profile by seed size so environments can be tuned for realistic stress testing. */
interface DemoSeedProfile {
  additionalConstituents: number;
  targetAdditionalDonations: number;
  additionalEvents: number;
  ordersPerEvent: number;
  tablesPerEvent: number;
  additionalClients: number;
  appointmentsPerClientMin: number;
  appointmentsPerClientMax: number;
  servicesPerClientMin: number;
  servicesPerClientMax: number;
  followUpsPerClientMin: number;
  followUpsPerClientMax: number;
  additionalTasks: number;
  additionalMeetings: number;
  additionalActivities: number;
  additionalEmailCampaigns: number;
  stewardRunCount: number;
}

const DEMO_PROFILES: Record<DemoSeedSize, DemoSeedProfile> = {
  small: {
    additionalConstituents: 180,
    targetAdditionalDonations: 3500,
    additionalEvents: 12,
    ordersPerEvent: 24,
    tablesPerEvent: 8,
    additionalClients: 120,
    appointmentsPerClientMin: 1,
    appointmentsPerClientMax: 3,
    servicesPerClientMin: 1,
    servicesPerClientMax: 2,
    followUpsPerClientMin: 1,
    followUpsPerClientMax: 2,
    additionalTasks: 280,
    additionalMeetings: 120,
    additionalActivities: 1400,
    additionalEmailCampaigns: 24,
    stewardRunCount: 180,
  },
  medium: {
    additionalConstituents: 1200,
    targetAdditionalDonations: 18000,
    additionalEvents: 40,
    ordersPerEvent: 60,
    tablesPerEvent: 12,
    additionalClients: 650,
    appointmentsPerClientMin: 1,
    appointmentsPerClientMax: 4,
    servicesPerClientMin: 1,
    servicesPerClientMax: 3,
    followUpsPerClientMin: 1,
    followUpsPerClientMax: 3,
    additionalTasks: 1800,
    additionalMeetings: 480,
    additionalActivities: 9000,
    additionalEmailCampaigns: 72,
    stewardRunCount: 900,
  },
  large: {
    additionalConstituents: 4000,
    targetAdditionalDonations: 45000,
    additionalEvents: 120,
    ordersPerEvent: 110,
    tablesPerEvent: 16,
    additionalClients: 2200,
    appointmentsPerClientMin: 2,
    appointmentsPerClientMax: 5,
    servicesPerClientMin: 1,
    servicesPerClientMax: 4,
    followUpsPerClientMin: 1,
    followUpsPerClientMax: 4,
    additionalTasks: 6000,
    additionalMeetings: 1700,
    additionalActivities: 36500,
    additionalEmailCampaigns: 180,
    stewardRunCount: 3600,
  },
};

const FIRST_NAMES = [
  "Olivia", "Liam", "Emma", "Noah", "Ava", "Ethan", "Mia", "Lucas", "Sophia", "Mason",
  "Isabella", "Elijah", "Amelia", "James", "Harper", "Benjamin", "Evelyn", "Henry", "Abigail", "Alexander",
  "Charlotte", "Michael", "Ella", "Daniel", "Avery", "Matthew", "Scarlett", "Joseph", "Camila", "David",
  "Chloe", "Samuel", "Luna", "Sebastian", "Aria", "Jackson", "Penelope", "Owen", "Layla", "Wyatt",
];

const LAST_NAMES = [
  "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez",
  "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee",
  "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
  "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green",
];

const CITIES = ["Chicago", "Evanston", "Skokie", "Naperville", "Aurora", "Oak Park", "Glenview", "Wheaton", "Elmhurst", "Joliet"];

const REFERRAL_SOURCES = [
  "Community Partner",
  "Church Referral",
  "Walk In",
  "Hospital Social Worker",
  "Shelter Referral",
  "School Counselor",
  "Website Form",
  "Returning Client",
];

const OPPORTUNITY_ACTIONS = [
  "Schedule gratitude call within 48 hours",
  "Draft second-gift invitation email",
  "Invite to stewardship coffee visit",
  "Assign personalized impact update task",
  "Prepare monthly-giving conversion outreach",
  "Create sponsor follow-up action plan",
];

interface Rng {
  next: () => number;
  int: (min: number, max: number) => number;
  pick: <T>(items: T[]) => T;
  bool: (probability: number) => boolean;
}

/**
 * Executes the large-scale deterministic demo seed expansion.
 * The expansion adds stress-test-ready synthetic data while preserving existing baseline seed IDs.
 */
export async function seedDemoExpansion(
  prisma: PrismaClient,
  options: DemoSeedExpansionOptions
): Promise<DemoSeedExpansionSummary> {
  const profile = DEMO_PROFILES[options.size];
  const rng = createRng(`${options.seedKey}:${options.size}`);

  await cleanPreviousDemoExpansion(prisma, options.organizationId);

  const tagMap = await ensureDemoTags(prisma);

  const demoConstituents = buildDemoConstituents(options, profile, rng);
  const demoConstituentRows = demoConstituents.map(({ lifecycle, ...row }) => row);
  await createManyInChunks(prisma.constituent, demoConstituentRows, 500);

  const constituentTags = buildConstituentTags(demoConstituents, tagMap);
  await createManyInChunks(prisma.constituentTag, constituentTags, 1000);

  const demoEvents = buildDemoEvents(options, profile, rng);
  await createManyInChunks(prisma.event, demoEvents.events, 300);
  await createManyInChunks(prisma.ticketType, demoEvents.ticketTypes, 600);
  await createManyInChunks(prisma.eventTable, demoEvents.tables, 600);
  await createManyInChunks(prisma.eventSponsor, demoEvents.sponsors, 800);
  await createManyInChunks(prisma.eventOrder, demoEvents.orders, 800);
  await createManyInChunks(prisma.eventOrderItem, demoEvents.orderItems, 1200);
  await createManyInChunks(prisma.eventGuest, demoEvents.guests, 1200);
  await createManyInChunks(prisma.volunteerHour, demoEvents.volunteerHours, 1200);

  const demoDonations = buildDemoDonations(options, profile, demoConstituents, demoEvents.eventIds, rng);
  await createManyInChunks(prisma.donation, demoDonations, 1000);

  await updateGeneratedConstituentRollups(prisma, demoConstituents.map((c) => c.id), demoDonations);

  const operational = buildOperationalData(options, profile, demoConstituents, rng);
  await createManyInChunks(prisma.task, operational.tasks, 1000);
  await createManyInChunks(prisma.meeting, operational.meetings, 1000);
  await createManyInChunks(prisma.activity, operational.activities, 1500);

  const compassion = buildCompassionData(options, profile, rng);
  await createManyInChunks(prisma.compassionClient, compassion.clients, 1000);
  await createManyInChunks(prisma.compassionCase, compassion.cases, 1000);
  await createManyInChunks(prisma.compassionAppointment, compassion.appointments, 1000);
  await createManyInChunks(prisma.compassionService, compassion.services, 1000);
  await createManyInChunks(prisma.compassionFollowUp, compassion.followUps, 1000);
  await createManyInChunks(prisma.compassionActivity, compassion.activities, 1200);

  const communications = buildEmailCampaignData(options, profile, rng);
  await createManyInChunks(prisma.emailCampaign, communications, 800);

  const automations = await seedDemoAutomations(prisma, options);
  const steward = await seedStewardSignalsAndRuns(prisma, options, demoConstituents, automations, tagMap, profile, rng);
  const feedbackTickets = await seedWatchdogFeedbackTickets(prisma, options, rng);

  const importFixturesDir = await writeImportFixtures(profile, demoConstituents, compassion.clients, rng);
  await seedImportBatchAuditLogs(prisma, options, importFixturesDir, rng);

  return {
    size: options.size,
    seedKey: options.seedKey,
    additionalConstituents: demoConstituents.length,
    additionalDonations: demoDonations.length,
    additionalEvents: demoEvents.events.length,
    additionalOrders: demoEvents.orders.length,
    additionalGuests: demoEvents.guests.length,
    additionalClients: compassion.clients.length,
    additionalAppointments: compassion.appointments.length,
    additionalServices: compassion.services.length,
    additionalFollowUps: compassion.followUps.length,
    additionalTasks: operational.tasks.length,
    additionalActivities: operational.activities.length,
    additionalEmailCampaigns: communications.length,
    additionalStewardRuns: steward.runCount,
    additionalFeedbackTickets: feedbackTickets,
    importFixturesDir,
  };
}

/** Converts a string into a stable 32-bit unsigned integer seed. */
function hashStringToSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Builds a deterministic pseudo-random generator from a stable seed string. */
function createRng(seedKey: string): Rng {
  let state = hashStringToSeed(seedKey) || 1;

  const next = () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    pick<T>(items: T[]) {
      return items[Math.floor(next() * items.length)] as T;
    },
    bool(probability: number) {
      return next() < probability;
    },
  };
}

/** Cleans only expansion-generated records so baseline seed IDs remain intact for smoke tests. */
async function cleanPreviousDemoExpansion(prisma: PrismaClient, organizationId: string): Promise<void> {
  await prisma.customFieldValue.deleteMany({ where: { id: { startsWith: "demo_cfv_" } } });
  await prisma.customField.deleteMany({ where: { organizationId, key: { startsWith: "demoSteward" } } });

  await prisma.constituentTag.deleteMany({ where: { constituentId: { startsWith: "demo_con_" } } });

  await prisma.activity.deleteMany({ where: { id: { startsWith: "demo_act_" } } });
  await prisma.task.deleteMany({ where: { id: { startsWith: "demo_task_" } } });
  await prisma.meeting.deleteMany({ where: { id: { startsWith: "demo_meet_" } } });

  await prisma.donation.deleteMany({ where: { id: { startsWith: "demo_don_" } } });

  await prisma.eventGuest.deleteMany({ where: { id: { startsWith: "demo_guest_" } } });
  await prisma.eventOrderItem.deleteMany({ where: { id: { startsWith: "demo_item_" } } });
  await prisma.eventOrder.deleteMany({ where: { id: { startsWith: "demo_ord_" } } });
  await prisma.eventSponsor.deleteMany({ where: { id: { startsWith: "demo_spon_" } } });
  await prisma.eventTable.deleteMany({ where: { id: { startsWith: "demo_tbl_" } } });
  await prisma.ticketType.deleteMany({ where: { id: { startsWith: "demo_tkt_" } } });
  await prisma.volunteerHour.deleteMany({ where: { id: { startsWith: "demo_vh_" } } });
  await prisma.event.deleteMany({ where: { id: { startsWith: "demo_evt_" } } });

  await prisma.compassionActivity.deleteMany({ where: { id: { startsWith: "demo_cact_" } } });
  await prisma.compassionFollowUp.deleteMany({ where: { id: { startsWith: "demo_fup_" } } });
  await prisma.compassionService.deleteMany({ where: { id: { startsWith: "demo_srv_" } } });
  await prisma.compassionAppointment.deleteMany({ where: { id: { startsWith: "demo_appt_" } } });
  await prisma.compassionCase.deleteMany({ where: { id: { startsWith: "demo_case_" } } });
  await prisma.compassionClient.deleteMany({ where: { id: { startsWith: "demo_cli_" } } });

  await prisma.emailCampaign.deleteMany({ where: { id: { startsWith: "demo_mail_" } } });

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { action: { startsWith: "DEMO_" } },
        { entityId: { startsWith: "demo_auto_" } },
      ],
    },
  });

  await prisma.automationAction.deleteMany({ where: { automationId: { startsWith: "demo_auto_" } } });
  await prisma.automation.deleteMany({ where: { id: { startsWith: "demo_auto_" } } });

  await prisma.constituent.deleteMany({ where: { id: { startsWith: "demo_con_" } } });
}

/** Creates demo tags used for lifecycle segmentation, stewardship analytics, and import edge-case testing. */
async function ensureDemoTags(prisma: PrismaClient): Promise<Record<string, string>> {
  const tags = [
    { id: "tag_demo_data", name: "Demo Data", color: "#64748b" },
    { id: "tag_demo_recurring", name: "Recurring Donor (Demo)", color: "#16a34a" },
    { id: "tag_demo_lapse_risk", name: "Lapse Risk (Demo)", color: "#f97316" },
    { id: "tag_demo_high_opportunity", name: "High Opportunity (Demo)", color: "#2563eb" },
    { id: "tag_demo_mail_only", name: "Mail Only (Demo)", color: "#7c3aed" },
    { id: "tag_demo_table_host", name: "Table Host (Demo)", color: "#0891b2" },
    { id: "tag_demo_incomplete_contact", name: "Incomplete Contact (Demo)", color: "#ef4444" },
  ] as const;

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { id: tag.id },
      update: { name: tag.name, color: tag.color, description: `${DEMO_MARKER} Seeded demo segment tag.` },
      create: {
        id: tag.id,
        name: tag.name,
        color: tag.color,
        description: `${DEMO_MARKER} Seeded demo segment tag.`,
      },
    });
  }

  return Object.fromEntries(tags.map((t) => [t.id, t.id]));
}

interface DemoConstituentSeed {
  id: string;
  organizationId: string;
  type: ConstituentType;
  donorStatus: DonorStatus;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  city: string;
  state: string;
  zip: string;
  notes: string;
  externalId: string;
  doNotEmail: boolean;
  doNotCall: boolean;
  doNotMail: boolean;
  emailOptOut: boolean;
  engagementScore: number;
  lifecycle: string;
}

/** Generates varied donor lifecycle data with explicit demo markers and deterministic edge cases. */
function buildDemoConstituents(
  options: DemoSeedExpansionOptions,
  profile: DemoSeedProfile,
  rng: Rng
): DemoConstituentSeed[] {
  const data: DemoConstituentSeed[] = [];

  for (let i = 0; i < profile.additionalConstituents; i += 1) {
    const idx = i + 1;
    const id = `demo_con_${String(idx).padStart(5, "0")}`;
    const firstName = FIRST_NAMES[idx % FIRST_NAMES.length] as string;
    const lastName = LAST_NAMES[(idx * 3) % LAST_NAMES.length] as string;
    const city = CITIES[(idx * 5) % CITIES.length] as string;
    const lifecycleCode = idx % 8;

    let lifecycle = "active";
    let donorStatus: DonorStatus = "ACTIVE";
    let type: ConstituentType = "DONOR";
    let doNotEmail = false;
    let doNotCall = false;
    let doNotMail = false;
    let emailOptOut = false;

    if (lifecycleCode === 0) {
      lifecycle = "new";
      donorStatus = "NEW";
    } else if (lifecycleCode === 1) {
      lifecycle = "recurring";
      donorStatus = "ACTIVE";
    } else if (lifecycleCode === 2) {
      lifecycle = "major";
      donorStatus = "MAJOR_DONOR";
      type = rng.bool(0.4) ? "SPONSOR" : "DONOR";
    } else if (lifecycleCode === 3) {
      lifecycle = "lapsed";
      donorStatus = "LAPSED";
    } else if (lifecycleCode === 4) {
      lifecycle = "mail_only";
      donorStatus = "ACTIVE";
      doNotEmail = true;
      emailOptOut = true;
    } else if (lifecycleCode === 5) {
      lifecycle = "event_sponsor_table_host";
      donorStatus = "MAJOR_DONOR";
      type = "SPONSOR";
    } else if (lifecycleCode === 6) {
      lifecycle = "incomplete_contact";
      donorStatus = "ACTIVE";
      doNotCall = rng.bool(0.4);
      doNotMail = rng.bool(0.2);
    }

    const malformedEmail = idx % 37 === 0;
    const missingEmail = lifecycle === "mail_only" || (lifecycle === "incomplete_contact" && rng.bool(0.7));
    const email = missingEmail
      ? null
      : malformedEmail
        ? `${firstName.toLowerCase()}.${lastName.toLowerCase()}-invalid-email`
        : `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${idx}@demo.oyamacrm.invalid`;

    const missingPhone = lifecycle === "incomplete_contact" && rng.bool(0.75);
    const phone = missingPhone ? null : `312-555-${String(1000 + (idx % 9000)).padStart(4, "0")}`;
    const mobile = rng.bool(0.4) && !missingPhone ? `773-555-${String(1000 + ((idx * 7) % 9000)).padStart(4, "0")}` : null;

    const externalId = idx % 43 === 0
      ? `DEMO-DUP-${String(Math.floor(idx / 43)).padStart(3, "0")}`
      : `DEMO-EXT-${String(idx).padStart(6, "0")}`;

    const duplicateNameFirst = idx % 97 === 0 ? "Jordan" : firstName;
    const duplicateNameLast = idx % 97 === 0 ? "Taylor" : lastName;

    data.push({
      id,
      organizationId: options.organizationId,
      type,
      donorStatus,
      firstName: duplicateNameFirst,
      lastName: duplicateNameLast,
      email,
      phone,
      mobile,
      city,
      state: "IL",
      zip: `60${String(100 + (idx % 850)).padStart(3, "0")}`,
      notes: `${DEMO_MARKER} Synthetic donor profile for ${lifecycle} lifecycle testing.`,
      externalId,
      doNotEmail,
      doNotCall,
      doNotMail,
      emailOptOut,
      engagementScore: computeEngagementScoreForLifecycle(lifecycle, rng),
      lifecycle,
    });
  }

  return data;
}

/** Maps lifecycle category to deterministic engagement score ranges for dashboards and filters. */
function computeEngagementScoreForLifecycle(lifecycle: string, rng: Rng): number {
  if (lifecycle === "new") return rng.int(18, 55);
  if (lifecycle === "recurring") return rng.int(62, 90);
  if (lifecycle === "major") return rng.int(75, 99);
  if (lifecycle === "lapsed") return rng.int(8, 42);
  if (lifecycle === "mail_only") return rng.int(35, 70);
  if (lifecycle === "event_sponsor_table_host") return rng.int(78, 99);
  if (lifecycle === "incomplete_contact") return rng.int(20, 58);
  return rng.int(40, 80);
}

/** Builds lifecycle-based tag assignments including high-opportunity and lapse-risk cohorts. */
function buildConstituentTags(
  constituents: DemoConstituentSeed[],
  tagMap: Record<string, string>
): Array<{ constituentId: string; tagId: string }> {
  const rows: Array<{ constituentId: string; tagId: string }> = [];

  for (const constituent of constituents) {
    rows.push({ constituentId: constituent.id, tagId: tagMap.tag_demo_data });

    if (constituent.lifecycle === "recurring") rows.push({ constituentId: constituent.id, tagId: tagMap.tag_demo_recurring });
    if (constituent.lifecycle === "lapsed") rows.push({ constituentId: constituent.id, tagId: tagMap.tag_demo_lapse_risk });
    if (constituent.lifecycle === "mail_only") rows.push({ constituentId: constituent.id, tagId: tagMap.tag_demo_mail_only });
    if (constituent.lifecycle === "event_sponsor_table_host") rows.push({ constituentId: constituent.id, tagId: tagMap.tag_demo_table_host });
    if (constituent.lifecycle === "incomplete_contact") rows.push({ constituentId: constituent.id, tagId: tagMap.tag_demo_incomplete_contact });
    if (constituent.lifecycle === "major" || constituent.lifecycle === "event_sponsor_table_host") {
      rows.push({ constituentId: constituent.id, tagId: tagMap.tag_demo_high_opportunity });
    }
  }

  return rows;
}

interface DemoEventSeedBundle {
  events: Array<{
    id: string;
    organizationId: string;
    name: string;
    description: string;
    type: EventType;
    status: EventStatus;
    visibility: EventVisibility;
    location: string;
    city: string;
    state: string;
    zip: string;
    startDate: Date;
    endDate: Date;
    registrationDeadline: Date;
    capacity: number;
    registrationGoal: number;
    revenueGoal: number;
    ownerId: string;
    internalNotes: string;
    active: boolean;
  }>;
  ticketTypes: Array<{
    id: string;
    eventId: string;
    name: string;
    description: string;
    price: number;
    capacity: number;
    available: number;
    sortOrder: number;
    active: boolean;
    isTable: boolean;
    seatsIncluded: number;
    minPerOrder: number;
    maxPerOrder: number | null;
  }>;
  tables: Array<{
    id: string;
    eventId: string;
    name: string;
    capacity: number;
    notes: string;
    tableNumber: number;
    isSponsored: boolean;
    hostName: string | null;
    xPosition: number;
    yPosition: number;
    shape: string;
  }>;
  sponsors: Array<{
    id: string;
    eventId: string;
    constituentId: string;
    level: SponsorshipLevel;
    amount: number;
    benefits: string;
    logoUrl: null;
    websiteUrl: null;
    notes: string;
  }>;
  orders: Array<{
    id: string;
    eventId: string;
    constituentId: string;
    orderNumber: string;
    status: OrderStatus;
    totalAmount: number;
    feeAmount: number;
    paymentMethod: PaymentMethod;
    transactionId: string;
    paidAt: Date | null;
    notes: string;
  }>;
  orderItems: Array<{
    id: string;
    orderId: string;
    ticketTypeId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  guests: Array<{
    id: string;
    eventId: string;
    orderId: string;
    constituentId: string | null;
    ticketTypeId: string;
    tableId: string | null;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    checkedIn: boolean;
    checkedInAt: Date | null;
    checkinCode: string;
    paymentStatus: EventGuestPaymentStatus;
    rsvpStatus: EventGuestRsvpStatus;
    mealPreference: string | null;
    seatNumber: number | null;
    partyName: string | null;
    dietaryRestrictions: string | null;
    specialNeeds: string | null;
    notes: string;
  }>;
  volunteerHours: Array<{
    id: string;
    constituentId: string;
    eventId: string;
    hours: number;
    description: string;
    date: Date;
  }>;
  eventIds: string[];
}

/** Creates event ecosystem records including sponsors, ticketing, orders, guests, and table assignments. */
function buildDemoEvents(
  options: DemoSeedExpansionOptions,
  profile: DemoSeedProfile,
  rng: Rng
): DemoEventSeedBundle {
  const events: DemoEventSeedBundle["events"] = [];
  const ticketTypes: DemoEventSeedBundle["ticketTypes"] = [];
  const tables: DemoEventSeedBundle["tables"] = [];
  const sponsors: DemoEventSeedBundle["sponsors"] = [];
  const orders: DemoEventSeedBundle["orders"] = [];
  const orderItems: DemoEventSeedBundle["orderItems"] = [];
  const guests: DemoEventSeedBundle["guests"] = [];
  const volunteerHours: DemoEventSeedBundle["volunteerHours"] = [];
  const eventIds: string[] = [];

  let ticketSeq = 1;
  let tableSeq = 1;
  let sponsorSeq = 1;
  let orderSeq = 1;
  let itemSeq = 1;
  let guestSeq = 1;
  let volunteerSeq = 1;

  const sponsorDonorIds = Array.from({ length: Math.max(12, Math.floor(profile.additionalConstituents / 8)) }, (_v, idx) => {
    const idNum = (idx % profile.additionalConstituents) + 1;
    return `demo_con_${String(idNum).padStart(5, "0")}`;
  });

  for (let i = 0; i < profile.additionalEvents; i += 1) {
    const idx = i + 1;
    const eventId = `demo_evt_${String(idx).padStart(4, "0")}`;
    eventIds.push(eventId);

    const type = ([
      "GALA", "WORKSHOP", "CULTIVATION", "STEWARDSHIP", "RUN_WALK", "VOLUNTEER", "ONLINE", "CONFERENCE",
    ] as EventType[])[idx % 8] as EventType;

    const startDate = new Date(Date.UTC(2025 + Math.floor(idx / 24), idx % 12, rng.int(1, 24), rng.int(9, 19), 0, 0));
    const endDate = new Date(startDate.getTime() + rng.int(2, 6) * 60 * 60 * 1000);

    const status = startDate.getTime() < Date.now() - 24 * 60 * 60 * 1000
      ? (rng.bool(0.75) ? "COMPLETED" : "IN_PROGRESS")
      : (rng.bool(0.5) ? "REGISTRATION_OPEN" : "PUBLISHED");

    const capacity = rng.int(120, 680);

    events.push({
      id: eventId,
      organizationId: options.organizationId,
      name: `Community Impact ${type.replace(/_/g, " ")} ${startDate.getUTCFullYear()} #${idx} (Demo)`,
      description: `${DEMO_MARKER} Synthetic event for operational stress testing and check-in workflows.`,
      type,
      status,
      visibility: rng.bool(0.88) ? "PUBLIC" : "PRIVATE",
      location: `${rng.pick(["Hope Center Hall", "Riverfront Pavilion", "Community Campus", "Downtown Ballroom"])}`,
      city: rng.pick(CITIES),
      state: "IL",
      zip: `60${String(200 + (idx % 700)).padStart(3, "0")}`,
      startDate,
      endDate,
      registrationDeadline: new Date(startDate.getTime() - rng.int(5, 40) * 24 * 60 * 60 * 1000),
      capacity,
      registrationGoal: Math.max(80, Math.floor(capacity * 0.85)),
      revenueGoal: rng.int(35000, 260000),
      ownerId: idx % 2 === 0 ? options.staffUserId : options.adminUserId,
      internalNotes: `${DEMO_MARKER} Event supports search, check-in, table, and reporting demo paths.`,
      active: true,
    });

    const individualTicketId = `demo_tkt_${String(ticketSeq++).padStart(6, "0")}`;
    const vipTicketId = `demo_tkt_${String(ticketSeq++).padStart(6, "0")}`;
    const tableTicketId = `demo_tkt_${String(ticketSeq++).padStart(6, "0")}`;

    ticketTypes.push(
      {
        id: individualTicketId,
        eventId,
        name: "Individual Ticket",
        description: `${DEMO_MARKER} Standard admission ticket.`,
        price: rng.int(45, 160),
        capacity: Math.floor(capacity * 0.6),
        available: Math.floor(capacity * 0.45),
        sortOrder: 0,
        active: true,
        isTable: false,
        seatsIncluded: 1,
        minPerOrder: 1,
        maxPerOrder: 8,
      },
      {
        id: vipTicketId,
        eventId,
        name: "VIP Ticket",
        description: `${DEMO_MARKER} VIP admission with priority seating.`,
        price: rng.int(180, 460),
        capacity: Math.floor(capacity * 0.2),
        available: Math.floor(capacity * 0.1),
        sortOrder: 1,
        active: true,
        isTable: false,
        seatsIncluded: 1,
        minPerOrder: 1,
        maxPerOrder: 4,
      },
      {
        id: tableTicketId,
        eventId,
        name: "Table Host Package",
        description: `${DEMO_MARKER} Hosted table package for eight guests.`,
        price: rng.int(1800, 6800),
        capacity: Math.floor(capacity / 8),
        available: Math.floor(capacity / 12),
        sortOrder: 2,
        active: true,
        isTable: true,
        seatsIncluded: 8,
        minPerOrder: 1,
        maxPerOrder: 2,
      }
    );

    for (let t = 0; t < profile.tablesPerEvent; t += 1) {
      const tableId = `demo_tbl_${String(tableSeq++).padStart(6, "0")}`;
      const sponsored = rng.bool(0.22);
      tables.push({
        id: tableId,
        eventId,
        name: `Table ${t + 1}`,
        capacity: 8,
        notes: `${DEMO_MARKER} Synthetic seating table for assignment testing.`,
        tableNumber: t + 1,
        isSponsored: sponsored,
        hostName: sponsored ? `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}` : null,
        xPosition: (t % 4) * 120,
        yPosition: Math.floor(t / 4) * 120,
        shape: rng.bool(0.8) ? "round" : "rectangle",
      });
    }

    const sponsorCount = rng.int(2, 5);
    for (let s = 0; s < sponsorCount; s += 1) {
      sponsors.push({
        id: `demo_spon_${String(sponsorSeq++).padStart(6, "0")}`,
        eventId,
        constituentId: sponsorDonorIds[(idx * 3 + s) % sponsorDonorIds.length] as string,
        level: (["GOLD", "SILVER", "BRONZE", "PLATINUM"] as SponsorshipLevel[])[s % 4] as SponsorshipLevel,
        amount: rng.int(2500, 35000),
        benefits: `${DEMO_MARKER} Logo placement, table package, and recognition package.`,
        logoUrl: null,
        websiteUrl: null,
        notes: `${DEMO_MARKER} Synthetic sponsorship for event reporting tests.`,
      });
    }

    const eventTableIds = tables.filter((tbl) => tbl.eventId === eventId).map((tbl) => tbl.id);
    const ticketPool = [individualTicketId, vipTicketId, tableTicketId];

    for (let o = 0; o < profile.ordersPerEvent; o += 1) {
      const orderId = `demo_ord_${String(orderSeq++).padStart(7, "0")}`;
      const constituentOrdinal = ((idx * profile.ordersPerEvent + o) % profile.additionalConstituents) + 1;
      const constituentId = `demo_con_${String(constituentOrdinal).padStart(5, "0")}`;
      const ticketTypeId = ticketPool[(o + idx) % ticketPool.length] as string;
      const isTablePackage = ticketTypeId === tableTicketId;
      const quantity = isTablePackage ? 1 : rng.int(1, 4);
      const unitPrice = ticketTypeId === vipTicketId ? rng.int(220, 420) : ticketTypeId === tableTicketId ? rng.int(2400, 6200) : rng.int(55, 180);
      const totalAmount = unitPrice * quantity;
      const confirmed = rng.bool(0.86);

      orders.push({
        id: orderId,
        eventId,
        constituentId,
        orderNumber: `DEMO-ORD-${String(orderSeq).padStart(8, "0")}`,
        status: confirmed ? "CONFIRMED" : rng.bool(0.5) ? "PENDING" : "CANCELLED",
        totalAmount,
        feeAmount: Number((totalAmount * 0.028).toFixed(2)),
        paymentMethod: rng.pick(["ONLINE", "CREDIT_CARD", "CHECK", "ACH"] as PaymentMethod[]),
        transactionId: confirmed ? `demo_txn_${orderId}` : "",
        paidAt: confirmed ? new Date(startDate.getTime() - rng.int(1, 45) * 24 * 60 * 60 * 1000) : null,
        notes: `${DEMO_MARKER} Synthetic event order for ticketing and reconciliation tests.`,
      });

      orderItems.push({
        id: `demo_item_${String(itemSeq++).padStart(7, "0")}`,
        orderId,
        ticketTypeId,
        quantity,
        unitPrice,
        totalPrice: totalAmount,
      });

      const guestCount = isTablePackage ? 8 : quantity;
      for (let g = 0; g < guestCount; g += 1) {
        const guestNameFirst = rng.pick(FIRST_NAMES);
        const guestNameLast = rng.pick(LAST_NAMES);
        const checkedIn = confirmed && statusToCheckedInProbability(status, rng);
        const tableId = eventTableIds.length > 0 && rng.bool(0.7) ? eventTableIds[(g + o) % eventTableIds.length] ?? null : null;

        guests.push({
          id: `demo_guest_${String(guestSeq++).padStart(8, "0")}`,
          eventId,
          orderId,
          constituentId: g === 0 ? constituentId : null,
          ticketTypeId,
          tableId,
          firstName: guestNameFirst,
          lastName: guestNameLast,
          email: `${guestNameFirst.toLowerCase()}.${guestNameLast.toLowerCase()}.${guestSeq}@demo.oyamacrm.invalid`,
          phone: rng.bool(0.75) ? `708-555-${String(1000 + (guestSeq % 9000)).padStart(4, "0")}` : null,
          checkedIn,
          checkedInAt: checkedIn ? new Date(startDate.getTime() + rng.int(5, 90) * 60 * 1000) : null,
          checkinCode: `DEMOCHK${String(guestSeq).padStart(7, "0")}`,
          paymentStatus: confirmed ? (rng.bool(0.9) ? "PAID" : "SPONSORED") : rng.bool(0.5) ? "DUE" : "PENDING_CHECK",
          rsvpStatus: confirmed ? "CONFIRMED" : rng.bool(0.35) ? "DECLINED" : "PENDING",
          mealPreference: rng.bool(0.45) ? rng.pick(["Vegetarian", "Vegan", "Gluten Free", "Standard"]) : null,
          seatNumber: tableId ? ((g % 8) + 1) : null,
          partyName: rng.bool(0.4) ? `${rng.pick(LAST_NAMES)} Family` : null,
          dietaryRestrictions: rng.bool(0.18) ? "Allergy note on file" : null,
          specialNeeds: rng.bool(0.08) ? "Mobility seating requested" : null,
          notes: `${DEMO_MARKER} Synthetic guest for check-in, seating, and RSVP flows.`,
        });
      }
    }

    const volunteerCount = rng.int(6, 18);
    for (let v = 0; v < volunteerCount; v += 1) {
      const constituentId = `demo_con_${String(((idx * 7 + v) % profile.additionalConstituents) + 1).padStart(5, "0")}`;
      volunteerHours.push({
        id: `demo_vh_${String(volunteerSeq++).padStart(7, "0")}`,
        constituentId,
        eventId,
        hours: Number((rng.int(2, 9) + rng.next()).toFixed(2)),
        description: `${DEMO_MARKER} Volunteer support for setup, guest services, and cleanup.`,
        date: new Date(startDate.getTime() - rng.int(0, 2) * 24 * 60 * 60 * 1000),
      });
    }
  }

  return {
    events,
    ticketTypes,
    tables,
    sponsors,
    orders,
    orderItems,
    guests,
    volunteerHours,
    eventIds,
  };
}

/** Decides whether a confirmed guest is checked in based on realistic event attendance behavior. */
function statusToCheckedInProbability(status: EventStatus, rng: Rng): boolean {
  if (status === "COMPLETED") return rng.bool(0.86);
  if (status === "IN_PROGRESS") return rng.bool(0.58);
  return rng.bool(0.18);
}

/** Generates donation history that includes recurring, major, lapsed, pending, failed, and event-linked gifts. */
function buildDemoDonations(
  options: DemoSeedExpansionOptions,
  profile: DemoSeedProfile,
  constituents: DemoConstituentSeed[],
  eventIds: string[],
  rng: Rng
): Array<{
  id: string;
  constituentId: string;
  campaignId: string;
  designationId: string;
  eventId: string | null;
  amount: number;
  feeAmount: number;
  date: Date;
  paymentMethod: PaymentMethod;
  status: DonationStatus;
  checkNumber: string | null;
  transactionId: string;
  isRecurring: boolean;
  frequency: RecurringFrequency | null;
  nextGiftDate: Date | null;
  receiptNumber: string | null;
  taxDeductible: boolean;
  notes: string;
}> {
  const donations: Array<{
    id: string;
    constituentId: string;
    campaignId: string;
    designationId: string;
    eventId: string | null;
    amount: number;
    feeAmount: number;
    date: Date;
    paymentMethod: PaymentMethod;
    status: DonationStatus;
    checkNumber: string | null;
    transactionId: string;
    isRecurring: boolean;
    frequency: RecurringFrequency | null;
    nextGiftDate: Date | null;
    receiptNumber: string | null;
    taxDeductible: boolean;
    notes: string;
  }> = [];

  const byLifecycle = new Map<string, DemoConstituentSeed[]>();
  for (const constituent of constituents) {
    const list = byLifecycle.get(constituent.lifecycle) ?? [];
    list.push(constituent);
    byLifecycle.set(constituent.lifecycle, list);
  }

  const recurring = byLifecycle.get("recurring") ?? constituents;
  const major = byLifecycle.get("major") ?? constituents;
  const lapsed = byLifecycle.get("lapsed") ?? constituents;
  const newDonors = byLifecycle.get("new") ?? constituents;
  const activeGeneral = constituents.filter((c) => c.lifecycle === "active" || c.lifecycle === "mail_only" || c.lifecycle === "incomplete_contact");

  for (let i = 0; i < profile.targetAdditionalDonations; i += 1) {
    const idx = i + 1;
    const lifecycleBucket = i % 10;
    let donor = activeGeneral[i % activeGeneral.length] as DemoConstituentSeed;

    if (lifecycleBucket <= 3) donor = recurring[i % recurring.length] as DemoConstituentSeed;
    if (lifecycleBucket === 4 || lifecycleBucket === 5) donor = activeGeneral[i % activeGeneral.length] as DemoConstituentSeed;
    if (lifecycleBucket === 6 || lifecycleBucket === 7) donor = major[i % major.length] as DemoConstituentSeed;
    if (lifecycleBucket === 8) donor = lapsed[i % lapsed.length] as DemoConstituentSeed;
    if (lifecycleBucket === 9) donor = newDonors[i % newDonors.length] as DemoConstituentSeed;

    const isRecurring = donor.lifecycle === "recurring" && rng.bool(0.72);
    const status = rng.bool(0.9) ? "COMPLETED" : rng.bool(0.55) ? "PENDING" : rng.bool(0.6) ? "FAILED" : "REFUNDED";

    const amount = amountByLifecycle(donor.lifecycle, rng);
    const campaignId = options.campaignIds[idx % options.campaignIds.length] as string;
    const designationId = options.designationIds[(idx * 3) % options.designationIds.length] as string;
    const linkedToEvent = eventIds.length > 0 && rng.bool(0.15);
    const eventId = linkedToEvent ? eventIds[idx % eventIds.length] as string : null;

    let giftDate = randomDateBetween(rng, new Date("2021-01-01T00:00:00Z"), new Date());
    if (donor.lifecycle === "lapsed") {
      giftDate = randomDateBetween(rng, new Date("2021-01-01T00:00:00Z"), new Date("2024-03-01T00:00:00Z"));
    }
    if (donor.lifecycle === "new") {
      giftDate = randomDateBetween(rng, new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), new Date());
    }

    donations.push({
      id: `demo_don_${String(idx).padStart(8, "0")}`,
      constituentId: donor.id,
      campaignId,
      designationId,
      eventId,
      amount,
      feeAmount: Number((amount * 0.028).toFixed(2)),
      date: giftDate,
      paymentMethod: paymentMethodByLifecycle(donor.lifecycle, rng),
      status,
      checkNumber: rng.bool(0.12) ? `DEMO-CHK-${String(idx).padStart(8, "0")}` : null,
      transactionId: `demo_txn_don_${String(idx).padStart(8, "0")}`,
      isRecurring,
      frequency: isRecurring ? "MONTHLY" : null,
      nextGiftDate: isRecurring ? new Date(giftDate.getTime() + 30 * 24 * 60 * 60 * 1000) : null,
      receiptNumber: status === "COMPLETED" ? `DEMO-RCP-${String(idx).padStart(9, "0")}` : null,
      taxDeductible: true,
      notes: `${DEMO_MARKER} Synthetic giving history record for dashboard, filters, and reporting stress tests.`,
    });
  }

  return donations;
}

/** Returns payment method distribution matching donor lifecycle behavior. */
function paymentMethodByLifecycle(lifecycle: string, rng: Rng): PaymentMethod {
  if (lifecycle === "major" || lifecycle === "event_sponsor_table_host") return rng.pick(["WIRE", "CHECK", "STOCK"] as PaymentMethod[]);
  if (lifecycle === "mail_only") return rng.pick(["CHECK", "ACH"] as PaymentMethod[]);
  if (lifecycle === "recurring") return rng.pick(["CREDIT_CARD", "ONLINE", "ACH"] as PaymentMethod[]);
  return rng.pick(["ONLINE", "CREDIT_CARD", "CHECK", "ACH", "CASH"] as PaymentMethod[]);
}

/** Returns realistic gift amount ranges by lifecycle segment. */
function amountByLifecycle(lifecycle: string, rng: Rng): number {
  if (lifecycle === "major" || lifecycle === "event_sponsor_table_host") return rng.int(5000, 85000);
  if (lifecycle === "recurring") return rng.int(20, 350);
  if (lifecycle === "new") return rng.int(25, 700);
  if (lifecycle === "lapsed") return rng.int(40, 1800);
  return rng.int(30, 5200);
}

/** Updates denormalized rollup fields so dashboard/report metrics remain source-of-truth aligned. */
async function updateGeneratedConstituentRollups(
  prisma: PrismaClient,
  constituentIds: string[],
  seededDonations: Array<{ constituentId: string; amount: number; date: Date; status: DonationStatus }>
): Promise<void> {
  const byConstituent = new Map<string, Array<{ amount: number; date: Date; status: DonationStatus }>>();
  for (const donation of seededDonations) {
    const list = byConstituent.get(donation.constituentId) ?? [];
    list.push({ amount: donation.amount, date: donation.date, status: donation.status });
    byConstituent.set(donation.constituentId, list);
  }

  const updates = constituentIds.map((constituentId) => {
    const list = (byConstituent.get(constituentId) ?? []).filter((item) => item.status === "COMPLETED");
    const sorted = list.sort((a, b) => b.date.getTime() - a.date.getTime());

    const total = list.reduce((sum, item) => sum + item.amount, 0);
    const ytd = list
      .filter((item) => item.date.getUTCFullYear() === new Date().getUTCFullYear())
      .reduce((sum, item) => sum + item.amount, 0);

    const firstGift = list.length > 0 ? list[list.length - 1]?.date ?? null : null;
    const lastGift = sorted[0]?.date ?? null;
    const lastGiftAmount = sorted[0]?.amount ?? null;

    return prisma.constituent.update({
      where: { id: constituentId },
      data: {
        totalLifetimeGiving: Number(total.toFixed(2)),
        totalYtdGiving: Number(ytd.toFixed(2)),
        giftCount: list.length,
        firstGiftDate: firstGift,
        lastGiftDate: lastGift,
        lastGiftAmount: lastGiftAmount !== null ? Number(lastGiftAmount.toFixed(2)) : null,
      },
    });
  });

  await executeInTransactionChunks(prisma, updates, 120);
}

interface OperationalSeedBundle {
  tasks: Array<{
    id: string;
    constituentId: string | null;
    assigneeId: string;
    createdById: string;
    title: string;
    description: string;
    type: TaskType;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: Date;
    completedAt: Date | null;
  }>;
  meetings: Array<{
    id: string;
    organizationId: string;
    title: string;
    type: MeetingType;
    status: MeetingStatus;
    startTime: Date;
    endTime: Date;
    timezone: string;
    locationType: MeetingLocationType;
    location: string;
    purpose: string;
    notes: string;
    privateNotes: string;
    outcome: string;
    followUpNeeded: boolean;
    constituentId: string | null;
    assignedStaffId: string;
    createdById: string;
    completedAt: Date | null;
    canceledAt: Date | null;
  }>;
  activities: Array<{
    id: string;
    constituentId: string | null;
    donationId: string | null;
    taskId: string | null;
    meetingId: string | null;
    userId: string;
    eventId: string | null;
    type: ActivityType;
    description: string;
    metadata: object;
    createdAt: Date;
  }>;
}

/** Seeds tasks, meetings, and timeline notes used for filters, pagination, and AI retrieval tests. */
function buildOperationalData(
  options: DemoSeedExpansionOptions,
  profile: DemoSeedProfile,
  constituents: DemoConstituentSeed[],
  rng: Rng
): OperationalSeedBundle {
  const tasks: OperationalSeedBundle["tasks"] = [];
  const meetings: OperationalSeedBundle["meetings"] = [];
  const activities: OperationalSeedBundle["activities"] = [];

  for (let i = 0; i < profile.additionalTasks; i += 1) {
    const idx = i + 1;
    const constituent = constituents[idx % constituents.length] as DemoConstituentSeed;
    const dueDate = randomDateBetween(rng, new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), new Date(Date.now() + 40 * 24 * 60 * 60 * 1000));
    const completed = rng.bool(0.38);

    tasks.push({
      id: `demo_task_${String(idx).padStart(7, "0")}`,
      constituentId: rng.bool(0.88) ? constituent.id : null,
      assigneeId: idx % 2 === 0 ? options.staffUserId : options.adminUserId,
      createdById: idx % 3 === 0 ? options.staffUserId : options.adminUserId,
      title: `${DEMO_MARKER} ${rng.pick(OPPORTUNITY_ACTIONS)}`,
      description: `${DEMO_MARKER} Synthetic stewardship workflow task used to test lists, filters, and automation follow-up behavior.`,
      type: rng.pick(["CALL", "EMAIL", "MAIL", "FOLLOW_UP", "THANK_YOU", "MEETING"] as TaskType[]),
      status: completed ? "COMPLETED" : rng.bool(0.16) ? "IN_PROGRESS" : "PENDING",
      priority: constituent.lifecycle === "lapsed" || constituent.lifecycle === "major" ? "HIGH" : rng.pick(["LOW", "MEDIUM", "HIGH"] as TaskPriority[]),
      dueDate,
      completedAt: completed ? new Date(dueDate.getTime() - rng.int(1, 5) * 60 * 60 * 1000) : null,
    });
  }

  for (let i = 0; i < profile.additionalMeetings; i += 1) {
    const idx = i + 1;
    const constituent = constituents[(idx * 5) % constituents.length] as DemoConstituentSeed;
    const startTime = randomDateBetween(rng, new Date(Date.now() - 210 * 24 * 60 * 60 * 1000), new Date(Date.now() + 120 * 24 * 60 * 60 * 1000));
    const durationHours = rng.int(1, 2);
    const completed = startTime.getTime() < Date.now() && rng.bool(0.72);
    const canceled = !completed && rng.bool(0.08);

    meetings.push({
      id: `demo_meet_${String(idx).padStart(7, "0")}`,
      organizationId: options.organizationId,
      title: `${DEMO_MARKER} Stewardship Meeting #${idx}`,
      type: rng.pick(["DONOR_VISIT", "PHONE_CALL", "LUNCH_MEETING", "THANK_YOU_VISIT", "VIDEO_CALL"] as MeetingType[]),
      status: canceled ? "CANCELED" : completed ? "COMPLETED" : "SCHEDULED",
      startTime,
      endTime: new Date(startTime.getTime() + durationHours * 60 * 60 * 1000),
      timezone: "America/Chicago",
      locationType: rng.pick(["IN_PERSON", "PHONE", "VIDEO", "AT_EVENT", "AT_OFFICE"] as MeetingLocationType[]),
      location: rng.pick(["Main Office", "Virtual", "Community Hall", "Phone Outreach", "Donor Home"]),
      purpose: `${DEMO_MARKER} Synthetic donor stewardship and relationship review.`,
      notes: `${DEMO_MARKER} Detailed meeting notes generated for search and RAG retrieval testing. Discussed giving cadence, communication preferences, and follow-up commitments.`,
      privateNotes: `${DEMO_MARKER} Internal-only synthetic note with role-sensitive context for permission checks.`,
      outcome: completed ? "Next step assigned" : "Pending",
      followUpNeeded: rng.bool(0.65),
      constituentId: constituent.id,
      assignedStaffId: idx % 2 === 0 ? options.staffUserId : options.adminUserId,
      createdById: options.adminUserId,
      completedAt: completed ? new Date(startTime.getTime() + durationHours * 60 * 60 * 1000) : null,
      canceledAt: canceled ? new Date(startTime.getTime() - 60 * 60 * 1000) : null,
    });
  }

  for (let i = 0; i < profile.additionalActivities; i += 1) {
    const idx = i + 1;
    const constituent = constituents[(idx * 11) % constituents.length] as DemoConstituentSeed;
    activities.push({
      id: `demo_act_${String(idx).padStart(8, "0")}`,
      constituentId: constituent.id,
      donationId: null,
      taskId: null,
      meetingId: null,
      userId: idx % 2 === 0 ? options.staffUserId : options.adminUserId,
      eventId: null,
      type: rng.pick(["NOTE", "CALL", "EMAIL_SENT", "MEETING", "TASK_COMPLETED"] as ActivityType[]),
      description: `${DEMO_MARKER} Synthetic timeline note #${idx}. Stewardship context: ${rng.pick(OPPORTUNITY_ACTIONS)}.`,
      metadata: {
        demo: true,
        synthetic: true,
        lifecycle: constituent.lifecycle,
        confidence: rng.int(55, 98),
      },
      createdAt: randomDateBetween(rng, new Date(Date.now() - 360 * 24 * 60 * 60 * 1000), new Date()),
    });
  }

  return { tasks, meetings, activities };
}

interface CompassionSeedBundle {
  clients: Array<{
    id: string;
    organizationId: string;
    constituentId: null;
    firstName: string;
    lastName: string;
    preferredName: string | null;
    email: string | null;
    phone: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string;
    state: string;
    zip: string;
    dateOfBirth: Date | null;
    clientStatus: CompassionClientStatus;
    assignedStaffId: string;
    intakeDate: Date;
    referralSource: string;
    privateNotes: string;
  }>;
  cases: Array<{
    id: string;
    organizationId: string;
    clientId: string;
    caseNumber: string;
    caseStatus: CompassionCaseStatus;
    caseType: CompassionCaseType;
    openedAt: Date;
    closedAt: Date | null;
    assignedStaffId: string;
    priority: CompassionPriority;
    summary: string;
    privateNotes: string;
  }>;
  appointments: Array<{
    id: string;
    organizationId: string;
    clientId: string;
    caseId: string;
    appointmentType: CompassionAppointmentType;
    status: CompassionAppointmentStatus;
    startTime: Date;
    endTime: Date;
    timezone: string;
    location: string;
    assignedStaffId: string;
    notes: string;
    outcome: string | null;
    followUpNeeded: boolean;
  }>;
  services: Array<{
    id: string;
    organizationId: string;
    clientId: string;
    caseId: string;
    serviceType: CompassionServiceType;
    serviceDate: Date;
    quantity: number;
    notes: string;
    providedById: string;
  }>;
  followUps: Array<{
    id: string;
    organizationId: string;
    clientId: string;
    caseId: string;
    appointmentId: string | null;
    title: string;
    dueDate: Date;
    status: CompassionFollowUpStatus;
    priority: CompassionPriority;
    assignedStaffId: string;
    notes: string;
    completedAt: Date | null;
  }>;
  activities: Array<{
    id: string;
    organizationId: string;
    clientId: string;
    caseId: string;
    appointmentId: string | null;
    activityType: string;
    description: string;
    performedById: string;
    metadata: object;
    createdAt: Date;
  }>;
}

/** Creates privacy-safe Compassion CRM client data without linking to donor records by default. */
function buildCompassionData(
  options: DemoSeedExpansionOptions,
  profile: DemoSeedProfile,
  rng: Rng
): CompassionSeedBundle {
  const clients: CompassionSeedBundle["clients"] = [];
  const cases: CompassionSeedBundle["cases"] = [];
  const appointments: CompassionSeedBundle["appointments"] = [];
  const services: CompassionSeedBundle["services"] = [];
  const followUps: CompassionSeedBundle["followUps"] = [];
  const activities: CompassionSeedBundle["activities"] = [];

  let caseSeq = 1;
  let apptSeq = 1;
  let serviceSeq = 1;
  let followSeq = 1;
  let activitySeq = 1;

  for (let i = 0; i < profile.additionalClients; i += 1) {
    const idx = i + 1;
    const clientId = `demo_cli_${String(idx).padStart(6, "0")}`;
    const firstName = FIRST_NAMES[(idx * 7) % FIRST_NAMES.length] as string;
    const lastName = LAST_NAMES[(idx * 13) % LAST_NAMES.length] as string;
    const intakeDate = randomDateBetween(rng, new Date("2023-01-01T00:00:00Z"), new Date());

    const clientStatus = (["ACTIVE", "ACTIVE", "ACTIVE", "PENDING", "INACTIVE", "GRADUATED"] as CompassionClientStatus[])[idx % 6] as CompassionClientStatus;

    clients.push({
      id: clientId,
      organizationId: options.organizationId,
      constituentId: null,
      firstName,
      lastName,
      preferredName: rng.bool(0.35) ? firstName : null,
      email: rng.bool(0.12) ? null : `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${idx}@client.demo.oyamacrm.invalid`,
      phone: rng.bool(0.2) ? null : `630-555-${String(1000 + (idx % 9000)).padStart(4, "0")}`,
      addressLine1: `${100 + (idx % 5000)} ${rng.pick(["Maple", "Oak", "Cedar", "Pine", "River", "Lake"])} St`,
      addressLine2: rng.bool(0.16) ? `Apt ${rng.int(1, 40)}` : null,
      city: rng.pick(CITIES),
      state: "IL",
      zip: `60${String(300 + (idx % 600)).padStart(3, "0")}`,
      dateOfBirth: rng.bool(0.22) ? null : randomDateBetween(rng, new Date("1978-01-01T00:00:00Z"), new Date("2008-12-31T00:00:00Z")),
      clientStatus,
      assignedStaffId: idx % 2 === 0 ? options.staffUserId : options.adminUserId,
      intakeDate,
      referralSource: rng.pick(REFERRAL_SOURCES),
      privateNotes: `${DEMO_MARKER} Privacy-safe fictional client record. Not linked to donor profile by default.`,
    });

    const caseId = `demo_case_${String(caseSeq).padStart(7, "0")}`;
    const caseType = rng.pick([
      "PREGNANCY_SUPPORT",
      "PARENTING",
      "MATERIAL_ASSISTANCE",
      "RESOURCE_REFERRAL",
      "COUNSELING",
      "FOLLOW_UP",
    ] as CompassionCaseType[]);

    const openedAt = new Date(intakeDate.getTime() + rng.int(0, 14) * 24 * 60 * 60 * 1000);
    const closed = rng.bool(0.28);

    cases.push({
      id: caseId,
      organizationId: options.organizationId,
      clientId,
      caseNumber: `DEMO-CASE-${String(caseSeq).padStart(7, "0")}`,
      caseStatus: closed ? "CLOSED" : rng.bool(0.2) ? "PENDING" : "OPEN",
      caseType,
      openedAt,
      closedAt: closed ? new Date(openedAt.getTime() + rng.int(30, 240) * 24 * 60 * 60 * 1000) : null,
      assignedStaffId: idx % 2 === 0 ? options.staffUserId : options.adminUserId,
      priority: rng.pick(["LOW", "MEDIUM", "HIGH", "URGENT"] as CompassionPriority[]),
      summary: `${DEMO_MARKER} Fictional case summary for operational workflow testing.`,
      privateNotes: `${DEMO_MARKER} Internal-only case notes.`,
    });

    const apptCount = rng.int(profile.appointmentsPerClientMin, profile.appointmentsPerClientMax);
    for (let a = 0; a < apptCount; a += 1) {
      const appointmentType = caseType === "PREGNANCY_SUPPORT"
        ? rng.pick(["INTAKE", "PREGNANCY_TEST", "ULTRASOUND", "FOLLOW_UP"] as CompassionAppointmentType[])
        : rng.pick(["INTAKE", "PARENTING_CLASS", "RESOURCE_REFERRAL", "FOLLOW_UP", "CASE_REVIEW"] as CompassionAppointmentType[]);

      const startTime = randomDateBetween(rng, new Date("2024-01-01T00:00:00Z"), new Date(Date.now() + 60 * 24 * 60 * 60 * 1000));
      const completed = startTime.getTime() < Date.now() && rng.bool(0.72);
      const appointmentId = `demo_appt_${String(apptSeq).padStart(7, "0")}`;

      appointments.push({
        id: appointmentId,
        organizationId: options.organizationId,
        clientId,
        caseId,
        appointmentType,
        status: completed ? "COMPLETED" : rng.bool(0.15) ? "CANCELLED" : "SCHEDULED",
        startTime,
        endTime: new Date(startTime.getTime() + rng.int(30, 90) * 60 * 1000),
        timezone: "America/Chicago",
        location: rng.pick(["Compassion Center", "Telehealth", "Partner Clinic", "Resource Room"]),
        assignedStaffId: idx % 2 === 0 ? options.staffUserId : options.adminUserId,
        notes: `${DEMO_MARKER} Fictional appointment note including prep checklist and support context.`,
        outcome: completed ? "Completed with follow-up guidance." : null,
        followUpNeeded: rng.bool(0.58),
      });

      const serviceType = appointmentType === "PREGNANCY_TEST"
        ? "PREGNANCY_TEST"
        : appointmentType === "ULTRASOUND"
          ? "ULTRASOUND"
          : rng.pick(["DIAPERS", "CLOTHING", "FORMULA", "COUNSELING", "NUTRITION_SUPPORT", "OTHER"] as CompassionServiceType[]);

      if (rng.bool(0.82)) {
        services.push({
          id: `demo_srv_${String(serviceSeq).padStart(7, "0")}`,
          organizationId: options.organizationId,
          clientId,
          caseId,
          serviceType,
          serviceDate: new Date(startTime.getTime() + rng.int(0, 3) * 24 * 60 * 60 * 1000),
          quantity: rng.int(1, 6),
          notes: `${DEMO_MARKER} Fictional service delivery record for reporting and timeline tests.`,
          providedById: idx % 2 === 0 ? options.staffUserId : options.adminUserId,
        });
        serviceSeq += 1;
      }

      if (rng.bool(0.66)) {
        const dueDate = new Date(startTime.getTime() + rng.int(3, 30) * 24 * 60 * 60 * 1000);
        const completedFollow = dueDate.getTime() < Date.now() && rng.bool(0.35);
        followUps.push({
          id: `demo_fup_${String(followSeq).padStart(7, "0")}`,
          organizationId: options.organizationId,
          clientId,
          caseId,
          appointmentId,
          title: `${DEMO_MARKER} Follow-up check for support continuity`,
          dueDate,
          status: completedFollow ? "COMPLETED" : rng.bool(0.2) ? "IN_PROGRESS" : "PENDING",
          priority: rng.pick(["LOW", "MEDIUM", "HIGH"] as CompassionPriority[]),
          assignedStaffId: idx % 2 === 0 ? options.staffUserId : options.adminUserId,
          notes: `${DEMO_MARKER} Fictional follow-up action for client support workflow testing.`,
          completedAt: completedFollow ? new Date(dueDate.getTime() - 2 * 60 * 60 * 1000) : null,
        });
        followSeq += 1;
      }

      activities.push({
        id: `demo_cact_${String(activitySeq).padStart(8, "0")}`,
        organizationId: options.organizationId,
        clientId,
        caseId,
        appointmentId,
        activityType: completed ? "APPOINTMENT_COMPLETED" : "APPOINTMENT_SCHEDULED",
        description: `${DEMO_MARKER} Fictional Compassion timeline activity for privacy-safe workflow testing.`,
        performedById: idx % 2 === 0 ? options.staffUserId : options.adminUserId,
        metadata: {
          demo: true,
          synthetic: true,
          safe: true,
          notes: "No real client data.",
        },
        createdAt: startTime,
      });
      activitySeq += 1;
      apptSeq += 1;
    }

    caseSeq += 1;
  }

  return { clients, cases, appointments, services, followUps, activities };
}

/** Creates synthetic communication campaigns for list views, filtering, and analytics testing. */
function buildEmailCampaignData(
  options: DemoSeedExpansionOptions,
  profile: DemoSeedProfile,
  rng: Rng
): Array<{
  id: string;
  organizationId: string;
  name: string;
  subject: string;
  previewText: string;
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  bodyHtml: string;
  bodyText: string;
  templateJson: string;
  status: EmailCampaignStatus;
  scheduledAt: Date | null;
  sentAt: Date | null;
  audienceFilter: string;
  totalRecipients: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
}> {
  const rows: Array<{
    id: string;
    organizationId: string;
    name: string;
    subject: string;
    previewText: string;
    fromName: string;
    fromEmail: string;
    replyToEmail: string;
    bodyHtml: string;
    bodyText: string;
    templateJson: string;
    status: EmailCampaignStatus;
    scheduledAt: Date | null;
    sentAt: Date | null;
    audienceFilter: string;
    totalRecipients: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
  }> = [];

  for (let i = 0; i < profile.additionalEmailCampaigns; i += 1) {
    const idx = i + 1;
    const status = (["DRAFT", "SCHEDULED", "SENT", "SENT", "SENT", "CANCELLED"] as EmailCampaignStatus[])[idx % 6] as EmailCampaignStatus;
    const sentAt = status === "SENT" ? randomDateBetween(rng, new Date("2024-01-01T00:00:00Z"), new Date()) : null;
    const scheduledAt = status === "SCHEDULED" ? new Date(Date.now() + rng.int(1, 14) * 24 * 60 * 60 * 1000) : null;
    const recipients = rng.int(180, 2600);
    const delivered = status === "SENT" ? Math.floor(recipients * rng.int(88, 99) / 100) : 0;
    const opened = status === "SENT" ? Math.floor(delivered * rng.int(22, 58) / 100) : 0;
    const clicked = status === "SENT" ? Math.floor(opened * rng.int(8, 28) / 100) : 0;

    rows.push({
      id: `demo_mail_${String(idx).padStart(6, "0")}`,
      organizationId: options.organizationId,
      name: `${DEMO_MARKER} Donor Outreach Campaign ${idx}`,
      subject: `Demo stewardship update #${idx}`,
      previewText: `${DEMO_MARKER} Synthetic campaign preview text for filtering and reporting tests.`,
      fromName: "OyamaCRM Demo",
      fromEmail: "noreply@demo.oyamacrm.invalid",
      replyToEmail: "support@demo.oyamacrm.invalid",
      bodyHtml: `<p>${DEMO_MARKER} Synthetic email body.</p>`,
      bodyText: `${DEMO_MARKER} Synthetic email body text.`,
      templateJson: JSON.stringify({
        demo: true,
        blocks: ["header", "body", "cta"],
      }),
      status,
      scheduledAt,
      sentAt,
      audienceFilter: JSON.stringify({
        tags: ["Demo Data"],
        donorStatus: ["ACTIVE", "LAPSED", "NEW"],
      }),
      totalRecipients: recipients,
      delivered,
      opened,
      clicked,
      bounced: status === "SENT" ? Math.floor(recipients * rng.int(1, 7) / 100) : 0,
      unsubscribed: status === "SENT" ? Math.floor(recipients * rng.int(0, 2) / 100) : 0,
    });
  }

  return rows;
}

/** Seeds automation workflows used for workflow testing and Steward Path trigger coverage. */
async function seedDemoAutomations(
  prisma: PrismaClient,
  options: DemoSeedExpansionOptions
): Promise<string[]> {
  const definitions = [
    {
      id: "demo_auto_lapse_recovery",
      name: "Demo Lapse Recovery Path",
      description: `${DEMO_MARKER} Detect lapsed donors and create reconnect workflow tasks.`,
      trigger: "TASK_DUE" as AutomationTrigger,
      triggerConfig: { lifecycle: "lapsed", minDaysSinceGift: 365 },
      actions: [
        { type: "CREATE_TASK" as AutomationActionType, order: 0, config: { title: "Call lapsed donor" } },
        { type: "ADD_TAG" as AutomationActionType, order: 1, config: { tag: "Lapse Risk (Demo)" } },
      ],
    },
    {
      id: "demo_auto_major_gift_stewardship",
      name: "Demo Major Gift Stewardship",
      description: `${DEMO_MARKER} Trigger post-gift stewardship for major donations.`,
      trigger: "DONATION_RECEIVED" as AutomationTrigger,
      triggerConfig: { majorGiftMinAmount: 5000 },
      actions: [
        { type: "CREATE_TASK" as AutomationActionType, order: 0, config: { title: "Schedule major donor follow-up" } },
        { type: "SEND_EMAIL" as AutomationActionType, order: 1, config: { template: "major-gift-thank-you-demo" } },
      ],
    },
    {
      id: "demo_auto_new_donor_welcome",
      name: "Demo New Donor Welcome",
      description: `${DEMO_MARKER} New donor welcome journey with stewardship and tagging.`,
      trigger: "CONSTITUENT_CREATED" as AutomationTrigger,
      triggerConfig: { firstDonationOnly: true },
      actions: [
        { type: "SEND_EMAIL" as AutomationActionType, order: 0, config: { template: "welcome-demo" } },
        { type: "ADD_TAG" as AutomationActionType, order: 1, config: { tag: "Recurring Donor (Demo)" } },
      ],
    },
    {
      id: "demo_auto_pledge_timeline",
      name: "Demo Pledge Timeline Follow-Up",
      description: `${DEMO_MARKER} Pledge timeline reminders for pledge commitments.`,
      trigger: "PLEDGE_CREATED" as AutomationTrigger,
      triggerConfig: { frequency: "MONTHLY" },
      actions: [
        { type: "CREATE_TASK" as AutomationActionType, order: 0, config: { title: "Review pledge schedule" } },
      ],
    },
  ];

  for (const def of definitions) {
    await prisma.automation.create({
      data: {
        id: def.id,
        organizationId: options.organizationId,
        name: def.name,
        description: def.description,
        trigger: def.trigger,
        triggerConfig: def.triggerConfig,
        enabled: true,
      },
    });

    for (const action of def.actions) {
      await prisma.automationAction.create({
        data: {
          automationId: def.id,
          type: action.type,
          order: action.order,
          config: action.config,
        },
      });
    }
  }

  return definitions.map((d) => d.id);
}

/** Seeds steward signal fields, values, and run-history audit logs used by Steward Paths and opportunity dashboards. */
async function seedStewardSignalsAndRuns(
  prisma: PrismaClient,
  options: DemoSeedExpansionOptions,
  constituents: DemoConstituentSeed[],
  automationIds: string[],
  tagMap: Record<string, string>,
  profile: DemoSeedProfile,
  rng: Rng
): Promise<{ runCount: number }> {
  const stewardFields = [
    {
      id: "demo_cf_generosity",
      organizationId: options.organizationId,
      entityType: "constituent",
      name: "Steward Generosity Score (Demo)",
      key: "demoStewardGenerosityScore",
      fieldType: "number",
      description: `${DEMO_MARKER} Synthetic generosity scoring field.`,
    },
    {
      id: "demo_cf_lapse",
      organizationId: options.organizationId,
      entityType: "constituent",
      name: "Steward Lapse Risk (Demo)",
      key: "demoStewardLapseRisk",
      fieldType: "select",
      options: JSON.stringify(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
      description: `${DEMO_MARKER} Synthetic lapse risk bucket.`,
    },
    {
      id: "demo_cf_opportunity",
      organizationId: options.organizationId,
      entityType: "constituent",
      name: "Steward Opportunity Score (Demo)",
      key: "demoStewardOpportunityScore",
      fieldType: "number",
      description: `${DEMO_MARKER} Synthetic opportunity score field.`,
    },
    {
      id: "demo_cf_recommendation",
      organizationId: options.organizationId,
      entityType: "constituent",
      name: "Steward Opportunity Recommendation (Demo)",
      key: "demoStewardOpportunityRecommendation",
      fieldType: "textarea",
      description: `${DEMO_MARKER} Synthetic recommendation narrative for AI/RAG testing.`,
    },
  ] as const;

  for (const field of stewardFields) {
    await prisma.customField.create({
      data: {
        id: field.id,
        organizationId: field.organizationId,
        entityType: field.entityType,
        name: field.name,
        key: field.key,
        fieldType: field.fieldType,
        options: "options" in field ? field.options : null,
        required: false,
        description: field.description,
        placeholder: "",
        defaultValue: "",
        sortOrder: 0,
        active: true,
      },
    });
  }

  const customFieldValues: Array<{ id: string; fieldId: string; entityId: string; entityType: string; value: string }> = [];
  const highOpportunityConstituents: string[] = [];

  let valueSeq = 1;
  for (const constituent of constituents) {
    const generosityScore = constituent.lifecycle === "major" || constituent.lifecycle === "event_sponsor_table_host"
      ? rng.int(80, 99)
      : constituent.lifecycle === "lapsed"
        ? rng.int(15, 55)
        : rng.int(30, 92);

    const lapseRisk = constituent.lifecycle === "lapsed"
      ? (rng.bool(0.5) ? "HIGH" : "CRITICAL")
      : constituent.lifecycle === "new"
        ? "MEDIUM"
        : rng.pick(["LOW", "MEDIUM", "HIGH"]);

    const opportunityScore = constituent.lifecycle === "major" || constituent.lifecycle === "event_sponsor_table_host"
      ? rng.int(75, 99)
      : constituent.lifecycle === "recurring"
        ? rng.int(62, 95)
        : rng.int(24, 84);

    if (opportunityScore >= 78) {
      highOpportunityConstituents.push(constituent.id);
    }

    const recommendation = `${DEMO_MARKER} Recommended next step: ${rng.pick(OPPORTUNITY_ACTIONS)}. Confidence ${rng.int(62, 96)}%.`;

    customFieldValues.push(
      {
        id: `demo_cfv_${String(valueSeq++).padStart(9, "0")}`,
        fieldId: "demo_cf_generosity",
        entityId: constituent.id,
        entityType: "constituent",
        value: String(generosityScore),
      },
      {
        id: `demo_cfv_${String(valueSeq++).padStart(9, "0")}`,
        fieldId: "demo_cf_lapse",
        entityId: constituent.id,
        entityType: "constituent",
        value: lapseRisk,
      },
      {
        id: `demo_cfv_${String(valueSeq++).padStart(9, "0")}`,
        fieldId: "demo_cf_opportunity",
        entityId: constituent.id,
        entityType: "constituent",
        value: String(opportunityScore),
      },
      {
        id: `demo_cfv_${String(valueSeq++).padStart(9, "0")}`,
        fieldId: "demo_cf_recommendation",
        entityId: constituent.id,
        entityType: "constituent",
        value: recommendation,
      }
    );
  }

  await createManyInChunks(prisma.customFieldValue, customFieldValues, 1200);

  const opportunityTags = highOpportunityConstituents.map((constituentId) => ({
    constituentId,
    tagId: tagMap.tag_demo_high_opportunity,
  }));
  await createManyInChunks(prisma.constituentTag, opportunityTags, 1000);

  const runLogs: Array<{
    id: string;
    organizationId: string;
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    metadata: object;
    createdAt: Date;
  }> = [];

  for (let i = 0; i < profile.stewardRunCount; i += 1) {
    const idx = i + 1;
    const automationId = automationIds[idx % automationIds.length] as string;
    const constituent = constituents[(idx * 5) % constituents.length] as DemoConstituentSeed;

    const actionsAttempted = rng.int(1, 3);
    const actionsSucceeded = rng.int(Math.max(0, actionsAttempted - 1), actionsAttempted);

    runLogs.push({
      id: `demo_run_${String(idx).padStart(9, "0")}`,
      organizationId: options.organizationId,
      userId: idx % 2 === 0 ? options.staffUserId : options.adminUserId,
      action: "STEWARD_PATH_RUN",
      entity: "Automation",
      entityId: automationId,
      metadata: {
        demo: true,
        runId: `demo-run-${String(idx).padStart(9, "0")}`,
        automationId,
        automationName: "Demo Steward Path",
        trigger: rng.pick(["DONATION_RECEIVED", "TASK_DUE", "PLEDGE_CREATED", "CONSTITUENT_CREATED"]),
        source: rng.pick(["api", "scheduler", "manual"]),
        constituentId: constituent.id,
        actionsAttempted,
        actionsSucceeded,
        results: Array.from({ length: actionsAttempted }, (_v, actionIdx) => ({
          actionId: `${automationId}-action-${actionIdx + 1}`,
          type: rng.pick(["CREATE_TASK", "ADD_TAG", "SEND_EMAIL", "ASSIGN_USER"]),
          success: actionIdx < actionsSucceeded,
          message: actionIdx < actionsSucceeded ? "Completed" : "Validation prevented auto-send",
        })),
      },
      createdAt: randomDateBetween(rng, new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), new Date()),
    });
  }

  await createManyInChunks(prisma.auditLog, runLogs, 1000);

  return { runCount: runLogs.length };
}

/** Creates deterministic import fixture files with clean, messy, duplicate, and malformed rows. */
async function writeImportFixtures(
  profile: DemoSeedProfile,
  demoConstituents: DemoConstituentSeed[],
  demoClients: CompassionSeedBundle["clients"],
  rng: Rng
): Promise<string> {
  const outDir = path.join(process.cwd(), "prisma", "demo-imports");
  await mkdir(outDir, { recursive: true });

  const donorRows = demoConstituents.slice(0, Math.min(profile.additionalConstituents, 280));
  const clientRows = demoClients.slice(0, Math.min(profile.additionalClients, 180));

  const cleanDonorCsv = [
    "sourceId,firstName,lastName,email,phone,city,state,status,segment",
    ...donorRows.slice(0, 120).map((row) => [
      row.externalId,
      row.firstName,
      row.lastName,
      row.email ?? "",
      row.phone ?? "",
      row.city,
      row.state,
      row.donorStatus,
      row.lifecycle,
    ].map(csvEscape).join(",")),
  ].join("\n");

  const messyDonorCsv = [
    "sourceId,firstName,lastName,email,phone,city,state,status,segment",
    ...donorRows.slice(0, 90).map((row) => [
      row.externalId,
      row.firstName,
      row.lastName,
      row.email ?? "",
      row.phone ?? "",
      row.city,
      row.state,
      row.donorStatus,
      row.lifecycle,
    ].map(csvEscape).join(",")),
    // Duplicate sourceId + duplicate identity
    "DEMO-DUP-ERR-001,Jordan,Taylor,jordan.taylor@demo.oyamacrm.invalid,312-555-9191,Chicago,IL,ACTIVE,duplicate",
    "DEMO-DUP-ERR-001,Jordan,Taylor,jordan.taylor@demo.oyamacrm.invalid,312-555-9191,Chicago,IL,ACTIVE,duplicate",
    // Invalid email
    "DEMO-BAD-EMAIL-001,Avery,Lopez,avery.lopez-at-demo.invalid,773-555-8181,Evanston,IL,NEW,bad_email",
    // Missing phone + missing city
    "DEMO-MISSING-001,Casey,Nguyen,casey.nguyen@demo.oyamacrm.invalid,,,IL,ACTIVE,missing_values",
    // Garbage metadata row
    "DEMO-GARBAGE-001,Text,Aurora,False,Active,No,Not Applicable,ACTIVE,metadata",
    // Intentionally malformed CSV row to test parser resilience
    "DEMO-MALFORMED-001,Unclosed,Quote,broken@example.com,312-555-0000,Chicago,IL,ACTIVE,broken",
    "DEMO-MALFORMED-002,\"broken field,missing close,312-555-1111,Chicago,IL,ACTIVE,broken",
  ].join("\n");

  const messyClientCsv = [
    "externalSourceId,fullName,email,homePhone,status,location,birthdate,notes",
    ...clientRows.slice(0, 90).map((row, idx) => [
      `DEMO-CLI-${String(idx + 1).padStart(5, "0")}`,
      `${row.firstName} ${row.lastName}`,
      row.email ?? "",
      row.phone ?? "",
      row.clientStatus,
      row.city,
      row.dateOfBirth ? row.dateOfBirth.toISOString().slice(0, 10) : "",
      `${DEMO_MARKER} Client import sample`,
    ].map(csvEscape).join(",")),
    // Duplicate + malformed patterns seen in real exports
    "DEMO-CLI-DUP-1,Miranda Abrisz(Miranda),miranda.abrisz@client.demo.oyamacrm.invalid,630-555-0101,ACTIVE,Aurora,1998-07-04,duplicate nickname format",
    "DEMO-CLI-DUP-1,Miranda Abrisz (Mira),miranda.abrisz@client.demo.oyamacrm.invalid,630-555-0101,ACTIVE,Aurora,1998-07-04,duplicate source id",
    "DEMO-CLI-BAD-1,Text,Aurora,False,Active,No,Not Applicable,metadata row",
    "DEMO-CLI-BAD-2,Invalid Email Person,invalid_email_here,630-555-0202,ACTIVE,Chicago,1992-10-10,bad email",
    "DEMO-CLI-BAD-3,Missing Name,,630-555-0303,ACTIVE,Chicago,1989-03-09,missing email",
    "DEMO-CLI-MALFORMED,\"Name with broken quote,broken@client.demo.oyamacrm.invalid,630-555-0404,ACTIVE,Chicago,1990-01-01,malformed",
  ].join("\n");

  const manifest = {
    marker: DEMO_MARKER,
    generatedAt: new Date().toISOString(),
    profile: profile,
    files: [
      { file: "donors-clean.csv", purpose: "Baseline clean donor import regression" },
      { file: "donors-messy.csv", purpose: "Duplicate + malformed + invalid donor import edge cases" },
      { file: "clients-messy.csv", purpose: "Compassion import validation edge cases" },
    ],
    expectedIssues: [
      "Duplicate source IDs",
      "Duplicate person rows",
      "Invalid emails",
      "Missing phone/city",
      "Metadata-style garbage rows",
      "Malformed CSV quote rows",
    ],
  };

  await writeFile(path.join(outDir, "donors-clean.csv"), cleanDonorCsv, "utf8");
  await writeFile(path.join(outDir, "donors-messy.csv"), messyDonorCsv, "utf8");
  await writeFile(path.join(outDir, "clients-messy.csv"), messyClientCsv, "utf8");
  await writeFile(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

  return outDir;
}

/** Writes import-related demo audit logs so import history and diagnostics views have realistic records. */
async function seedImportBatchAuditLogs(
  prisma: PrismaClient,
  options: DemoSeedExpansionOptions,
  fixturesDir: string,
  rng: Rng
): Promise<void> {
  const logs = [
    {
      id: "demo_import_log_001",
      organizationId: options.organizationId,
      userId: options.adminUserId,
      action: "DEMO_IMPORT_BATCH_CREATED",
      entity: "ImportBatch",
      entityId: "demo-import-batch-001",
      metadata: {
        demo: true,
        fixture: path.join(fixturesDir, "donors-clean.csv"),
        totalRows: 120,
        validRows: 120,
        skippedRows: 0,
      },
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
    {
      id: "demo_import_log_002",
      organizationId: options.organizationId,
      userId: options.staffUserId,
      action: "DEMO_IMPORT_BATCH_FAILED_VALIDATION",
      entity: "ImportBatch",
      entityId: "demo-import-batch-002",
      metadata: {
        demo: true,
        fixture: path.join(fixturesDir, "donors-messy.csv"),
        totalRows: 98,
        validRows: 83,
        skippedRows: 15,
        issues: [
          "duplicate_source_id",
          "invalid_email",
          "malformed_csv_row",
          "missing_required_field",
        ],
      },
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
    {
      id: "demo_import_log_003",
      organizationId: options.organizationId,
      userId: options.adminUserId,
      action: "DEMO_IMPORT_BATCH_COMPASSION_VALIDATION",
      entity: "ImportBatch",
      entityId: "demo-import-batch-003",
      metadata: {
        demo: true,
        fixture: path.join(fixturesDir, "clients-messy.csv"),
        totalRows: 96,
        validRows: 81,
        skippedRows: 15,
        issues: ["garbage_name_pattern", "invalid_email", "duplicate_external_id", "malformed_csv_quote"],
        confidence: rng.int(75, 95),
      },
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
  ];

  await createManyInChunks(prisma.auditLog, logs, 200);
}

/** Seeds a small set of cross-CRM feedback tickets for Watchdog triage demonstrations. */
async function seedWatchdogFeedbackTickets(
  prisma: PrismaClient,
  options: DemoSeedExpansionOptions,
  rng: Rng
): Promise<number> {
  const demoTickets = [
    {
      id: "demo_wd_ticket_000001",
      organizationId: options.organizationId,
      ticketNumber: "WD-900001",
      type: "bug_report",
      status: "new",
      priority: "high",
      crmScope: "donor",
      pageUrl: "https://demo.oyamacrm.invalid/donations",
      routePath: "/donations",
      pageTitle: "Donations",
      submittedByUserId: options.staffUserId,
      submittedByName: "Demo Staff User",
      submittedByEmail: "staff@demo.oyamacrm.invalid",
      whatTryingToDo: `${DEMO_MARKER} Trying to create a donation and attach a designation.`,
      whatHappened: `${DEMO_MARKER} Form validation flagged amount incorrectly when designation changed.`,
      expectedResult: `${DEMO_MARKER} Amount should persist and save without re-entry.`,
      extraComments: `${DEMO_MARKER} Reproduced on Chrome and Edge in synthetic demo workspace.`,
      browserInfo: "DemoBrowser/1.0",
      deviceInfo: "Windows Demo VM",
      appVersion: "demo-seed",
      environment: "development",
      assignedDeveloperId: options.adminUserId,
      assignedToPersonId: null,
      developerNotes: `${DEMO_MARKER} Triage seeded for dashboard visibility.`,
      resolutionNotes: null,
      resolvedAt: null,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    },
    {
      id: "demo_wd_ticket_000002",
      organizationId: options.organizationId,
      ticketNumber: "WD-900002",
      type: "feature_request",
      status: "in_review",
      priority: "normal",
      crmScope: "compassion",
      pageUrl: "https://demo.oyamacrm.invalid/compassion/clients",
      routePath: "/compassion/clients",
      pageTitle: "Compassion Clients",
      submittedByUserId: options.staffUserId,
      submittedByName: "Demo Staff User",
      submittedByEmail: "staff@demo.oyamacrm.invalid",
      whatTryingToDo: null,
      whatHappened: null,
      expectedResult: null,
      extraComments: `${DEMO_MARKER} Include column preference persistence for caseworkers.`,
      featureTitle: "Client list column presets",
      featureProblem: `${DEMO_MARKER} Staff reset visible columns every shift.`,
      featureAudience: "Compassion caseworkers",
      featureRequestedChange: `${DEMO_MARKER} Save and apply named column presets per user.`,
      importance: "important",
      browserInfo: "DemoBrowser/1.0",
      deviceInfo: "Windows Demo VM",
      appVersion: "demo-seed",
      environment: "development",
      assignedDeveloperId: options.adminUserId,
      assignedToPersonId: null,
      developerNotes: `${DEMO_MARKER} Product review queued in planning.`,
      resolutionNotes: null,
      resolvedAt: null,
      createdAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
    },
    {
      id: "demo_wd_ticket_000003",
      organizationId: options.organizationId,
      ticketNumber: "WD-900003",
      type: "data_issue",
      status: "resolved",
      priority: "urgent",
      crmScope: "events",
      pageUrl: "https://demo.oyamacrm.invalid/events/reports",
      routePath: "/events/reports",
      pageTitle: "Events Reports",
      submittedByUserId: options.adminUserId,
      submittedByName: "Demo Admin User",
      submittedByEmail: "admin@demo.oyamacrm.invalid",
      whatTryingToDo: `${DEMO_MARKER} Comparing ticket revenue totals across event reports.`,
      whatHappened: `${DEMO_MARKER} One chart lagged by one day due to stale cache in demo mode.`,
      expectedResult: `${DEMO_MARKER} Dashboard and export totals should match instantly.`,
      extraComments: `${DEMO_MARKER} Synthetic resolved issue for triage status examples.`,
      browserInfo: "DemoBrowser/1.0",
      deviceInfo: "Windows Demo VM",
      appVersion: "demo-seed",
      environment: "development",
      assignedDeveloperId: options.adminUserId,
      assignedToPersonId: null,
      developerNotes: `${DEMO_MARKER} Cache warm-up now runs before report render.`,
      resolutionNotes: `${DEMO_MARKER} Fixed by invalidating stale aggregate cache before query.`,
      resolvedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      createdAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
    },
  ].map((ticket) => ({
    ...ticket,
    updatedAt: new Date(ticket.createdAt.getTime() + rng.int(1, 72) * 60 * 60 * 1000),
  }));

  await createManyInChunks(prisma.watchdogFeedbackTicket, demoTickets, 200);
  return demoTickets.length;
}

/** Escapes CSV values for deterministic fixture generation. */
function csvEscape(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }
  return value;
}

/** Returns deterministic random date in [from, to]. */
function randomDateBetween(rng: Rng, from: Date, to: Date): Date {
  const start = from.getTime();
  const end = to.getTime();
  return new Date(start + Math.floor(rng.next() * (end - start + 1)));
}

/** Executes a model createMany operation in fixed-size chunks to avoid oversized payloads. */
async function createManyInChunks<T extends object>(
  model: { createMany: (args: { data: T[]; skipDuplicates?: boolean }) => Promise<unknown> },
  rows: T[],
  chunkSize: number
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    await model.createMany({
      data: rows.slice(i, i + chunkSize),
      skipDuplicates: true,
    });
  }
}

/** Executes mutation promises in transaction chunks to avoid parameter limits. */
async function executeInTransactionChunks(
  prisma: PrismaClient,
  operations: Array<ReturnType<PrismaClient["constituent"]["update"]>>,
  chunkSize: number
): Promise<void> {
  for (let i = 0; i < operations.length; i += chunkSize) {
    await prisma.$transaction(operations.slice(i, i + chunkSize));
  }
}
