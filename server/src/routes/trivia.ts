/**
 * Event-scoped Trivia mode API routes.
 * Event owns identity and operations; normalized relational records own game state.
 */
import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import express, { type Request } from "express";
import rateLimit from "express-rate-limit";
import type { Prisma } from "@prisma/client";
import { requireAuth } from "../middleware/requireAuth.js";
import { createOrganizationEmailSender } from "../services/smtp-service.js";
import { evaluateRecipientEligibility, hashPublicEmailToken, isValidEmailAddress } from "../services/email-compliance.js";
import { prisma } from "../lib/prisma.js";
import { createEventTable, syncEventTableSeats } from "../services/event-table-service.js";

const router = express.Router();
const publicRouter = express.Router();
const EVENTS_PAGE_BUILDER_PLUGIN_KEY = "events-page-builder";
const accessClaimLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "TOO_MANY_ATTEMPTS", message: "Too many code attempts. Wait a few minutes and try again." } },
});
const publicRegistrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "TOO_MANY_REGISTRATIONS", message: "Too many registration attempts. Please contact the event organizer." } },
});
router.use("/public", publicRouter);
router.use(requireAuth);

type JsonObject = Record<string, unknown>;

interface StoreShape {
  organizations: Record<string, OrganizationTriviaStore>;
}

interface OrganizationTriviaStore {
  state: JsonObject;
  snapshotsByEventId: Record<string, JsonObject[]>;
  auditByEventId: Record<string, JsonObject[]>;
  accessPassesByEventId?: Record<string, TriviaAccessPass[]>;
  updatedAt: string;
}

type TriviaAccessRole = "host" | "checkin" | "scorekeeper" | "table_manager";

const TRIVIA_DISPLAY_STAGES = new Set([
  "welcome", "check_in_open", "check_in_closed", "round_intro", "question", "timer_only",
  "answer", "explanation", "leaderboard", "break", "final_question", "tiebreaker", "winner", "blank",
]);

interface TriviaAccessPass {
  id: string;
  label: string;
  role: TriviaAccessRole;
  codeHash: string;
  expiresAt: string;
  revokedAt: string | null;
  sessions: Array<{ tokenHash: string; expiresAt: string }>;
  createdAt: string;
}

const STORE_DIR = path.resolve(process.cwd(), "server", ".data");
const STORE_FILE = path.join(STORE_DIR, "trivia-store.json");
let legacyImportChecked = false;

function nowIso(): string {
  return new Date().toISOString();
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function resolveOrganizationId(req: Request): string {
  const orgId = typeof req.user?.orgId === "string" ? req.user.orgId.trim() : "";
  return orgId || "default-org";
}

function createEmptyState(): JsonObject {
  return {
    events: [],
    liveByEventId: {},
    scoreHistoryByEventId: {},
  };
}

function ensureOrgStore(store: StoreShape, organizationId: string): OrganizationTriviaStore {
  if (store.organizations[organizationId]) return store.organizations[organizationId];

  const created: OrganizationTriviaStore = {
    state: createEmptyState(),
    snapshotsByEventId: {},
    auditByEventId: {},
    accessPassesByEventId: {},
    updatedAt: nowIso(),
  };
  store.organizations[organizationId] = created;
  return created;
}

function triviaEventPageSlug(name: unknown): string {
  const base = String(name ?? "trivia-night")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44) || "trivia-night";
  return `${base}-${randomUUID().replace(/-/g, "").slice(0, 6)}`;
}

function boundedWholeNumber(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

function publicEventPagePath(config: unknown, eventId: string): string | null {
  if (!isObject(config) || !isObject(config.events)) return null;
  const entry = config.events[eventId];
  if (!isObject(entry) || entry.status !== "Published") return null;
  const slug = String(entry.pageSlug ?? "").trim();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? `/${slug}` : null;
}

/** Creates the durable Events record, team ticket, and published RSVP page used by a Trivia event. */
async function createTriviaEventStudioWorkspace(organizationId: string, incoming: JsonObject) {
  const setup = isObject(incoming.eventStudioSetup) ? incoming.eventStudioSetup : {};
  const name = String(incoming.name ?? "").trim().slice(0, 160);
  const venue = String(incoming.venue ?? "").trim().slice(0, 255);
  const hostName = String(incoming.hostName ?? "").trim().slice(0, 120);
  const startAt = new Date(String(incoming.startAt ?? ""));
  if (!name) throw new Error("A trivia event name is required.");
  if (Number.isNaN(startAt.getTime())) throw new Error("Choose a valid event date and time.");

  const maximumTables = boundedWholeNumber(setup.maximumTables, 30, 1, 500);
  const seatsPerTable = boundedWholeNumber(setup.seatsPerTable, 6, 1, 50);
  const requestedPrice = Number(setup.tablePrice ?? 0);
  const tablePrice = Number.isFinite(requestedPrice) ? Math.min(1_000_000, Math.max(0, requestedPrice)) : 0;
  const pageSlug = triviaEventPageSlug(name);
  const now = nowIso();

  return prisma.$transaction(async (tx) => {
    const eventStudio = await tx.event.create({
      data: {
        organizationId,
        name,
        description: hostName
          ? `Trivia night hosted by ${hostName}. Register a team through this public page.`
          : "Register a team for this trivia night.",
        type: "TRIVIA",
        status: "REGISTRATION_OPEN",
        visibility: "PUBLIC",
        location: venue || undefined,
        startDate: startAt,
        capacity: maximumTables * seatsPerTable,
        registrationGoal: maximumTables * seatsPerTable,
        internalNotes: "Created automatically from Oyama Trivia. Trivia owns game content; EventSTUDIO owns RSVPs, tables, seats, guests, and check-in.",
        active: true,
      },
    });

    await tx.ticketType.create({
      data: {
        eventId: eventStudio.id,
        name: "Team table",
        description: `Reserve one team table for up to ${seatsPerTable} players.`,
        price: tablePrice,
        capacity: maximumTables,
        available: maximumTables,
        isTable: true,
        seatsIncluded: seatsPerTable,
        minPerOrder: 1,
        maxPerOrder: 1,
        active: true,
      },
    });

    const existingSetting = await tx.pluginSetting.findUnique({
      where: { organizationId_pluginKey: { organizationId, pluginKey: EVENTS_PAGE_BUILDER_PLUGIN_KEY } },
      select: { config: true },
    });
    const existingConfig = isObject(existingSetting?.config) ? clone(existingSetting.config) : {};
    const existingEvents = isObject(existingConfig.events) ? existingConfig.events : {};
    const pageEntry = {
      pageSlug,
      status: "Published",
      lastPublishedAt: now,
      paymentPolicy: tablePrice > 0 ? "OfflineFollowUp" : "NoPaymentRequired",
      deploymentHistory: [{
        id: `deploy-${randomUUID().slice(0, 12)}`,
        action: "Published",
        status: "Published",
        pageSlug,
        deployedAt: now,
      }],
      updatedAt: now,
      sections: [
        { id: "hero", enabled: true, lockToEventData: true, content: { kicker: "Trivia night", primaryButtonText: "Reserve a team", primaryButtonLink: "#registration" } },
        { id: "event-details", enabled: true, lockToEventData: true },
        { id: "registration-form", enabled: true, lockToEventData: true, advanced: { anchorId: "registration" } },
        { id: "map-location", enabled: Boolean(venue), lockToEventData: true },
        { id: "share-buttons", enabled: true, lockToEventData: true },
        { id: "footer", enabled: true, lockToEventData: true },
      ],
    };
    const nextConfig = { ...existingConfig, events: { ...existingEvents, [eventStudio.id]: pageEntry } };

    await tx.pluginSetting.upsert({
      where: { organizationId_pluginKey: { organizationId, pluginKey: EVENTS_PAGE_BUILDER_PLUGIN_KEY } },
      create: {
        organizationId,
        pluginKey: EVENTS_PAGE_BUILDER_PLUGIN_KEY,
        enabled: true,
        config: nextConfig as unknown as Prisma.InputJsonValue,
      },
      update: {
        enabled: true,
        config: nextConfig as unknown as Prisma.InputJsonValue,
      },
    });

    return { eventStudio, pageSlug, publicPagePath: `/${pageSlug}` };
  });
}

function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeTableNumber(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!/^\d{1,4}$/.test(text)) return null;
  const number = Number.parseInt(text, 10);
  return number >= 1 && number <= 9999 ? String(number) : null;
}

function nextAvailableTableNumber(teams: JsonObject[], excludedTeamId?: string): string {
  const used = new Set(
    teams
      .filter((team) => team.id !== excludedTeamId)
      .map((team) => normalizeTableNumber(team.tableNumber))
      .filter((value): value is string => Boolean(value)),
  );
  for (let number = 1; number <= 9999; number += 1) {
    if (!used.has(String(number))) return String(number);
  }
  throw new Error("No table numbers are available.");
}

function normalizeRosterTableNumbers(teams: JsonObject[]): JsonObject[] {
  const normalized: JsonObject[] = [];
  const used = new Set<string>();
  for (const team of teams) {
    let tableNumber = normalizeTableNumber(team.tableNumber);
    if (!tableNumber || used.has(tableNumber)) tableNumber = nextAvailableTableNumber(normalized);
    used.add(tableNumber);
    normalized.push({ ...team, tableNumber });
  }
  return normalized;
}

const EVENTS_SYNC_COLORS = ["#34d399", "#38bdf8", "#f59e0b", "#f472b6", "#a78bfa", "#fb7185"];
const EVENTS_SYNC_ICONS = ["star", "bolt", "brain", "crown", "rocket", "shield"];

function splitEventsGuestName(value: unknown): { firstName: string; lastName: string } {
  const parts = String(value ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? "Guest", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function rosterSyncFingerprint(event: JsonObject | undefined): string {
  const teams = Array.isArray(event?.teams) ? event.teams.filter(isObject) : [];
  return JSON.stringify(teams.map((team) => ({
    id: team.id,
    name: team.name,
    tableNumber: team.tableNumber,
    players: team.players,
    playerCount: team.playerCount,
    checkInStatus: team.checkInStatus,
    checkedInAt: team.checkedInAt,
    tableHostName: team.tableHostName,
    contactEmail: team.contactEmail,
    contactPhone: team.contactPhone,
    notes: team.notes,
    eventsTableId: team.eventsTableId,
    eventsGuestIds: team.eventsGuestIds,
  })));
}

async function generateEventsGuestCheckinCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
    const existing = await prisma.eventGuest.findUnique({ where: { checkinCode: code }, select: { id: true } });
    if (!existing) return code;
  }
  return randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
}

async function syncTriviaEventFromOyamaEvents(
  organizationId: string,
  triviaEvent: JsonObject,
  options?: { force?: boolean },
): Promise<boolean> {
  const linkedEventId = String(triviaEvent.linkedEventsEventId ?? "").trim();
  if (!linkedEventId) return false;
  const lastSyncAt = new Date(String(triviaEvent.eventsLastSyncedAt ?? 0)).getTime();
  if (!options?.force && Number.isFinite(lastSyncAt) && Date.now() - lastSyncAt < 4_000) return false;

  const linkedEvent = await prisma.event.findFirst({
    where: { id: linkedEventId, organizationId },
    select: {
      id: true,
      name: true,
      location: true,
      startDate: true,
      tables: {
        orderBy: [{ tableNumber: "asc" }, { name: "asc" }],
        include: {
          guests: {
            orderBy: [{ seatNumber: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              checkedIn: true,
              checkedInAt: true,
              paymentStatus: true,
              source: true,
              order: { select: { id: true, totalAmount: true, status: true } },
            },
          },
        },
      },
    },
  });
  if (!linkedEvent) {
    triviaEvent.eventsSyncError = "The linked Oyama Events record is unavailable.";
    return true;
  }

  const currentTeams = Array.isArray(triviaEvent.teams) ? triviaEvent.teams.filter(isObject) : [];
  if (linkedEvent.tables.length === 0) {
    triviaEvent.linkedEventsEventName = linkedEvent.name;
    triviaEvent.eventsLastSyncedAt = nowIso();
    triviaEvent.eventsSyncError = null;
    return true;
  }

  const nextTeams = linkedEvent.tables.map((table, index) => {
    const tableNumber = String(table.tableNumber ?? index + 1);
    const current = currentTeams.find((team) => team.eventsTableId === table.id)
      ?? currentTeams.find((team) => normalizeTableNumber(team.tableNumber) === tableNumber);
    const players = table.guests.map((guest) => {
      const fullName = `${guest.firstName ?? ""} ${guest.lastName ?? ""}`.trim();
      return fullName || guest.email || `Guest ${table.guests.indexOf(guest) + 1}`;
    });
    const allCheckedIn = table.guests.length > 0 && table.guests.every((guest) => guest.checkedIn);
    const checkedInAt = table.guests
      .map((guest) => guest.checkedInAt?.toISOString() ?? null)
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1) ?? null;
    const paymentStatuses = new Set(table.guests.map((guest) => guest.paymentStatus));
    const paymentStatus = paymentStatuses.size === 0 || [...paymentStatuses].every((status) => status === "COMP" || status === "SPONSORED")
      ? "not_required"
      : [...paymentStatuses].every((status) => status === "PAID" || status === "COMP" || status === "SPONSORED")
        ? "paid"
        : "pending";
    const orders = new Map<string, number>();
    for (const guest of table.guests) {
      if (guest.order && !orders.has(guest.order.id)) orders.set(guest.order.id, Number(guest.order.totalAmount ?? 0));
    }

    return {
      ...current,
      id: String(current?.id ?? `trivia-team-events-${table.id}`),
      name: table.name,
      players,
      playerCount: players.length,
      score: Number(current?.score) || 0,
      bonusPoints: Number(current?.bonusPoints) || 0,
      active: table.status !== "ARCHIVED",
      color: String(current?.color ?? EVENTS_SYNC_COLORS[index % EVENTS_SYNC_COLORS.length]),
      icon: String(current?.icon ?? EVENTS_SYNC_ICONS[index % EVENTS_SYNC_ICONS.length]),
      sortOrder: index,
      checkInStatus: allCheckedIn ? "checked_in" : current?.checkInStatus === "late" ? "late" : "expected",
      checkedInAt: allCheckedIn ? checkedInAt : null,
      tableNumber,
      captainName: table.hostName ?? undefined,
      contactName: table.hostName ?? undefined,
      contactEmail: table.hostEmail ?? table.guests.find((guest) => guest.email)?.email ?? undefined,
      contactPhone: table.hostPhone ?? table.guests.find((guest) => guest.phone)?.phone ?? undefined,
      tableHostName: table.hostName ?? undefined,
      registrationSource: table.guests.some((guest) => guest.source === "GUEST_SELF_ENTRY" || guest.source === "TABLE_HOST") ? "public" : "staff",
      registrationCode: String(current?.registrationCode ?? randomInt(1000, 10000)),
      paymentStatus,
      paymentProvider: "offline",
      amountDue: [...orders.values()].reduce((total, amount) => total + amount, 0),
      payerName: table.hostName ?? undefined,
      payerEmail: table.hostEmail ?? undefined,
      notes: table.notes ?? undefined,
      eventsTableId: table.id,
      eventsGuestIds: table.guests.map((guest) => guest.id),
    };
  });

  triviaEvent.teams = normalizeRosterTableNumbers(nextTeams);
  triviaEvent.linkedEventsEventName = linkedEvent.name;
  triviaEvent.eventsLastSyncedAt = nowIso();
  triviaEvent.eventsSyncError = null;
  if (!String(triviaEvent.venue ?? "").trim() && linkedEvent.location) triviaEvent.venue = linkedEvent.location;
  return true;
}

async function syncTriviaEventToOyamaEvents(organizationId: string, triviaEvent: JsonObject): Promise<void> {
  const linkedEventId = String(triviaEvent.linkedEventsEventId ?? "").trim();
  if (!linkedEventId) return;
  const linkedEvent = await prisma.event.findFirst({
    where: { id: linkedEventId, organizationId },
    select: { id: true },
  });
  if (!linkedEvent) throw new Error("The linked Oyama Events record was not found.");

  const teams = normalizeRosterTableNumbers(Array.isArray(triviaEvent.teams) ? triviaEvent.teams.filter(isObject) : []);
  const eventTables = await prisma.eventTable.findMany({
    where: { eventId: linkedEventId },
    include: { guests: { orderBy: [{ seatNumber: "asc" }, { createdAt: "asc" }] } },
  });

  for (const [teamIndex, team] of teams.entries()) {
    const tableNumber = Number(normalizeTableNumber(team.tableNumber));
    let table = eventTables.find((candidate) => candidate.id === team.eventsTableId)
      ?? eventTables.find((candidate) => candidate.tableNumber === tableNumber)
      ?? null;
    const players = Array.isArray(team.players)
      ? team.players.map((player) => String(player).trim().slice(0, 120)).filter(Boolean).slice(0, 50)
      : [];
    const tableData = {
      name: String(team.name ?? `Table ${tableNumber}`).trim().slice(0, 120) || `Table ${tableNumber}`,
      capacity: Math.max(1, Math.min(50, Math.max(players.length, Number(team.playerCount) || 1))),
      tableNumber,
      hostName: String(team.tableHostName ?? team.captainName ?? "").trim().slice(0, 120) || null,
      hostEmail: String(team.contactEmail ?? "").trim().slice(0, 254) || null,
      hostPhone: String(team.contactPhone ?? "").trim().slice(0, 50) || null,
      notes: String(team.notes ?? "").trim().slice(0, 4000) || null,
    };

    if (!table) {
      table = await createEventTable({
        eventId: linkedEventId,
        ...tableData,
        shape: "round",
        xPosition: (teamIndex % 6) * 180,
        yPosition: Math.floor(teamIndex / 6) * 180,
      } as Parameters<typeof createEventTable>[0]);
      if (!table) throw new Error(`Table ${tableNumber} could not be created in Oyama Events.`);
      await prisma.eventTable.update({ where: { id: table.id }, data: { status: "EVENT_DAY" } });
      eventTables.push({ ...table, guests: table.guests } as typeof eventTables[number]);
    } else {
      await prisma.eventTable.update({ where: { id: table.id }, data: tableData });
      if (table.capacity !== tableData.capacity) await syncEventTableSeats(table.id);
    }

    const refreshedTable = await prisma.eventTable.findUnique({
      where: { id: table.id },
      include: {
        seats: { orderBy: { seatNumber: "asc" } },
        guests: { orderBy: [{ seatNumber: "asc" }, { createdAt: "asc" }] },
      },
    });
    if (!refreshedTable) continue;
    const previouslyMappedGuestIds = new Set(
      Array.isArray(team.eventsGuestIds) ? team.eventsGuestIds.map((id) => String(id)) : refreshedTable.guests.map((guest) => guest.id),
    );
    const mappedGuestIds: string[] = [];

    for (const [playerIndex, playerName] of players.entries()) {
      const existingGuest = refreshedTable.guests[playerIndex] ?? null;
      const seat = refreshedTable.seats[playerIndex] ?? null;
      const name = splitEventsGuestName(playerName);
      if (existingGuest) {
        await prisma.eventGuest.update({
          where: { id: existingGuest.id },
          data: {
            tableId: refreshedTable.id,
            seatId: seat?.id ?? null,
            seatNumber: seat?.seatNumber ?? playerIndex + 1,
            firstName: name.firstName,
            lastName: name.lastName || null,
            partyName: tableData.name,
            rsvpStatus: "CONFIRMED",
            checkedIn: team.checkInStatus === "checked_in",
            checkedInAt: team.checkInStatus === "checked_in" ? new Date(String(team.checkedInAt ?? nowIso())) : null,
          },
        });
        mappedGuestIds.push(existingGuest.id);
      } else {
        const guest = await prisma.eventGuest.create({
          data: {
            eventId: linkedEventId,
            tableId: refreshedTable.id,
            seatId: seat?.id,
            seatNumber: seat?.seatNumber ?? playerIndex + 1,
            firstName: name.firstName,
            lastName: name.lastName || undefined,
            checkinCode: await generateEventsGuestCheckinCode(),
            paymentStatus: "COMP",
            rsvpStatus: "CONFIRMED",
            partyName: tableData.name,
            source: "WALK_IN",
            checkedIn: team.checkInStatus === "checked_in",
            checkedInAt: team.checkInStatus === "checked_in" ? new Date(String(team.checkedInAt ?? nowIso())) : undefined,
            notes: "Synchronized from Oyama Trivia.",
          },
          select: { id: true },
        });
        mappedGuestIds.push(guest.id);
      }
    }

    const removedGuestIds = [...previouslyMappedGuestIds].filter((guestId) => !mappedGuestIds.includes(guestId));
    if (removedGuestIds.length > 0) {
      await prisma.eventGuest.updateMany({
        where: { id: { in: removedGuestIds }, eventId: linkedEventId, tableId: refreshedTable.id },
        data: { tableId: null, seatId: null, seatNumber: null },
      });
    }

    team.eventsTableId = refreshedTable.id;
    team.eventsGuestIds = mappedGuestIds;
  }
  triviaEvent.teams = teams;
  triviaEvent.eventsLastSyncedAt = nowIso();
  triviaEvent.eventsSyncError = null;
}

async function refreshAutomaticEventsLinks(
  organizationId: string,
  orgStore: OrganizationTriviaStore,
  options?: { force?: boolean; eventId?: string },
): Promise<boolean> {
  let changed = false;
  const events = getStateEvents(orgStore);
  for (const event of events) {
    if (options?.eventId && event.id !== options.eventId) continue;
    if (!String(event.linkedEventsEventId ?? "").trim()) continue;
    if (!options?.force && event.eventsSyncMode === "manual") continue;
    try {
      changed = await syncTriviaEventFromOyamaEvents(organizationId, event, { force: options?.force }) || changed;
    } catch (error) {
      event.eventsSyncError = error instanceof Error ? error.message : "Oyama Events roster sync failed.";
      changed = true;
    }
  }
  if (changed) {
    setStateEvents(orgStore, events);
    orgStore.updatedAt = nowIso();
  }
  return changed;
}

function escapeEmailHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function appPublicOrigin(): string {
  return String(process.env.NEXT_PUBLIC_APP_URL ?? process.env.FRONTEND_ORIGIN ?? "http://localhost:3000").trim().replace(/\/+$/, "");
}

async function createTriviaEmailPreferenceLinks(organizationId: string, email: string): Promise<{ unsubscribeUrl: string; preferencesUrl: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const subscription = await prisma.emailSubscription.upsert({
    where: { organizationId_email: { organizationId, email: normalizedEmail } },
    create: { organizationId, email: normalizedEmail, globalStatus: "UNKNOWN", source: "trivia-event-invitation" },
    update: {},
  });
  const rawToken = `${randomUUID()}${randomUUID()}`;
  await prisma.emailUnsubscribeToken.create({
    data: {
      organizationId,
      subscriptionId: subscription.id,
      tokenHash: hashPublicEmailToken(rawToken),
      email: normalizedEmail,
      category: "EVENT_INVITATION",
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
    },
  });
  return {
    unsubscribeUrl: `${appPublicOrigin()}/unsubscribe/${rawToken}`,
    preferencesUrl: `${appPublicOrigin()}/preferences/${rawToken}`,
  };
}

function triviaEmailFrame(title: string, body: string, footer = ""): string {
  return `<!doctype html><html><body style="margin:0;background:#07111f;font-family:Arial,sans-serif;color:#e2e8f0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#07111f;padding:24px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#0d1b2e;border:1px solid #334155"><tr><td style="padding:24px;border-bottom:3px solid #38bdf8"><div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#67e8f9">Oyama Trivia</div><h1 style="margin:8px 0 0;font-size:28px;color:#ffffff">${escapeEmailHtml(title)}</h1></td></tr><tr><td style="padding:24px;font-size:15px;line-height:1.65">${body}</td></tr>${footer ? `<tr><td style="padding:18px 24px;border-top:1px solid #334155;font-size:12px;line-height:1.5;color:#94a3b8">${footer}</td></tr>` : ""}</table></td></tr></table></body></html>`;
}

async function sendTriviaRegistrationConfirmation(params: {
  organizationId: string;
  event: JsonObject;
  settings: JsonObject;
  team: JsonObject;
}): Promise<{ status: "sent" | "skipped" | "failed"; detail: string }> {
  const email = String(params.team.contactEmail ?? "").trim().toLowerCase();
  if (!isValidEmailAddress(email)) return { status: "skipped", detail: "No valid confirmation email was supplied." };
  try {
    const eligibility = await evaluateRecipientEligibility({
      organizationId: params.organizationId,
      purpose: "TRANSACTIONAL",
      candidates: [{ email }],
    });
    if (!eligibility.recipients.includes(email)) {
      const decision = eligibility.decisions.find((item) => item.email === email);
      return { status: "skipped", detail: decision?.ineligibilityReason ?? "This address is not eligible for email." };
    }
    const members = Array.isArray(params.team.players) ? params.team.players.map((name) => String(name)).filter(Boolean) : [];
    const amountDue = Math.max(0, Number(params.team.amountDue) || 0);
    const currency = String(params.settings.currency ?? "USD");
    const paymentUrl = typeof params.settings.paymentUrl === "string" && /^https:\/\//i.test(params.settings.paymentUrl) ? params.settings.paymentUrl : "";
    const body = [
      `<p style="margin-top:0">Hello ${escapeEmailHtml(params.team.tableHostName ?? params.team.captainName ?? "Table host")},</p>`,
      `<p>Your RSVP for <strong style="color:#fff">${escapeEmailHtml(params.event.name)}</strong> was successful.</p>`,
      `<div style="margin:20px 0;padding:18px;background:#081321;border-left:4px solid #38bdf8"><div><strong>Team:</strong> ${escapeEmailHtml(params.team.name)}</div><div><strong>Table number:</strong> ${escapeEmailHtml(params.team.tableNumber)}</div><div><strong>Check-in code:</strong> <span style="font-size:24px;letter-spacing:5px;color:#67e8f9">${escapeEmailHtml(params.team.registrationCode)}</span></div><div><strong>Seats:</strong> ${escapeEmailHtml(params.team.playerCount)}</div>${amountDue > 0 ? `<div><strong>Amount due:</strong> ${escapeEmailHtml(currency)} ${amountDue.toFixed(2)}</div>` : ""}</div>`,
      members.length ? `<p><strong>Table members</strong><br>${members.map(escapeEmailHtml).join("<br>")}</p>` : "",
      `<p>${escapeEmailHtml(params.settings.confirmationMessage ?? "Your table is registered.")}</p>`,
      paymentUrl && amountDue > 0 ? `<p><a href="${escapeEmailHtml(paymentUrl)}" style="display:inline-block;padding:12px 18px;background:#38bdf8;color:#07111f;text-decoration:none;font-weight:bold">Continue to payment</a></p>` : "",
      `<p style="color:#cbd5e1">${escapeEmailHtml(params.settings.paymentInstructions ?? "")}</p>`,
    ].join("");
    const sender = await createOrganizationEmailSender(params.organizationId);
    await sender.send({
      to: email,
      subject: `RSVP confirmed: ${String(params.event.name ?? "Trivia Night")}`,
      text: `Your RSVP for ${String(params.event.name ?? "Trivia Night")} was successful.\nTeam: ${String(params.team.name ?? "")}\nTable: ${String(params.team.tableNumber ?? "")}\nCheck-in code: ${String(params.team.registrationCode ?? "")}\nMembers: ${members.join(", ") || "Not listed"}\n${amountDue > 0 ? `Amount due: ${currency} ${amountDue.toFixed(2)}\n` : ""}${paymentUrl ? `Payment: ${paymentUrl}\n` : ""}`,
      html: triviaEmailFrame("Your table is confirmed", body),
      fromNameOverride: String(params.event.name ?? "Oyama Trivia"),
    });
    return { status: "sent", detail: `Confirmation sent to ${email}.` };
  } catch (error) {
    return { status: "failed", detail: error instanceof Error ? error.message : "The confirmation email could not be sent." };
  }
}

function makeAccessCode(store: StoreShape): string {
  const activeHashes = new Set<string>();
  const now = Date.now();
  for (const orgStore of Object.values(store.organizations)) {
    for (const passes of Object.values(orgStore.accessPassesByEventId ?? {})) {
      for (const pass of passes) {
        if (!pass.revokedAt && new Date(pass.expiresAt).getTime() > now) activeHashes.add(pass.codeHash);
      }
    }
  }
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const code = String(randomInt(1000, 10_000));
    if (!activeHashes.has(hashSecret(code))) return code;
  }
  throw new Error("No four-digit access code is currently available.");
}

const TRIVIA_MEDIA_TYPES: Record<string, { extension: string; maxBytes: number }> = {
  "image/jpeg": { extension: "jpg", maxBytes: 5 * 1024 * 1024 }, "image/png": { extension: "png", maxBytes: 5 * 1024 * 1024 }, "image/webp": { extension: "webp", maxBytes: 5 * 1024 * 1024 }, "image/gif": { extension: "gif", maxBytes: 5 * 1024 * 1024 },
  "audio/mpeg": { extension: "mp3", maxBytes: 12 * 1024 * 1024 }, "audio/ogg": { extension: "ogg", maxBytes: 12 * 1024 * 1024 }, "audio/wav": { extension: "wav", maxBytes: 12 * 1024 * 1024 }, "audio/mp4": { extension: "m4a", maxBytes: 12 * 1024 * 1024 },
  "video/mp4": { extension: "mp4", maxBytes: 12 * 1024 * 1024 }, "video/webm": { extension: "webm", maxBytes: 12 * 1024 * 1024 },
};

function isAccessRole(value: unknown): value is TriviaAccessRole {
  return value === "host" || value === "checkin" || value === "scorekeeper" || value === "table_manager";
}

function getAccessPasses(orgStore: OrganizationTriviaStore, eventId: string): TriviaAccessPass[] {
  if (!orgStore.accessPassesByEventId) orgStore.accessPassesByEventId = {};
  return orgStore.accessPassesByEventId[eventId] ?? [];
}

function publicEventSnapshot(event: JsonObject, live: JsonObject, role: TriviaAccessRole): JsonObject {
  const rounds = Array.isArray(event.rounds) ? event.rounds.filter(isObject).map((round) => ({
    id: round.id, title: round.title, description: round.description, roundType: round.roundType,
    questions: Array.isArray(round.questions) ? round.questions.filter(isObject).map((question) => ({
      id: question.id, prompt: question.prompt, options: Array.isArray(question.options) ? question.options : [],
      questionType: question.questionType, mediaUrl: question.mediaUrl, timeLimitSec: question.timeLimitSec,
    })) : [],
  })) : [];
  const teams = Array.isArray(event.teams) ? event.teams.filter(isObject).map((team) => ({
    id: team.id, name: team.name, players: role === "table_manager" || role === "host" ? team.players : [], playerCount: team.playerCount, active: team.active,
    color: team.color, icon: team.icon, sortOrder: team.sortOrder, checkInStatus: team.checkInStatus, checkedInAt: team.checkedInAt,
    tableNumber: team.tableNumber, captainName: role === "table_manager" || role === "host" ? team.captainName : undefined,
    contactName: role === "table_manager" || role === "host" ? team.contactName : undefined,
    contactPhone: role === "table_manager" || role === "host" ? team.contactPhone : undefined,
    contactEmail: role === "table_manager" || role === "host" ? team.contactEmail : undefined,
    tableHostName: role === "table_manager" || role === "host" ? team.tableHostName : undefined,
    registrationSource: role === "table_manager" || role === "host" ? team.registrationSource : undefined,
    registrationCode: role === "checkin" || role === "table_manager" || role === "host" ? team.registrationCode : undefined,
    paymentChoice: role === "table_manager" || role === "host" ? team.paymentChoice : undefined,
    paymentStatus: role === "table_manager" || role === "host" ? team.paymentStatus : undefined,
    paymentProvider: role === "table_manager" || role === "host" ? team.paymentProvider : undefined,
    amountDue: role === "table_manager" || role === "host" ? team.amountDue : undefined,
    payerName: role === "table_manager" || role === "host" ? team.payerName : undefined,
    payerEmail: role === "table_manager" || role === "host" ? team.payerEmail : undefined,
    notes: role === "table_manager" || role === "host" ? team.notes : undefined,
    score: team.score, bonusPoints: team.bonusPoints,
  })) : [];
  return { id: event.id, name: event.name, venue: event.venue, hostName: event.hostName, status: event.status, rounds, teams, displaySettings: event.displaySettings, live };
}

async function resolvePublicPass(req: Request, eventId: string): Promise<{ store: StoreShape; organizationId: string; orgStore: OrganizationTriviaStore; pass: TriviaAccessPass } | null> {
  const token = String(req.header("x-trivia-access") ?? "").trim();
  if (!token) return null;
  const store = await loadStore();
  const tokenHash = hashSecret(token);
  const now = Date.now();
  for (const [organizationId, orgStore] of Object.entries(store.organizations)) {
    const pass = getAccessPasses(orgStore, eventId).find((candidate) =>
      !candidate.revokedAt && new Date(candidate.expiresAt).getTime() > now && candidate.sessions.some((session) => session.tokenHash === tokenHash && new Date(session.expiresAt).getTime() > now),
    );
    if (pass) return { store, organizationId, orgStore, pass };
  }
  return null;
}

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return clone(value ?? {}) as Prisma.InputJsonValue;
}

function validDate(value: unknown, fallback = new Date()): Date {
  const parsed = new Date(String(value ?? ""));
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

/** Hydrates the existing trivia API shape from event-scoped relational rows. */
async function loadRelationalStore(): Promise<StoreShape> {
  const configurations = await prisma.triviaConfiguration.findMany({
    include: {
      event: { select: { id: true, organizationId: true, name: true, location: true, startDate: true } },
      rounds: { orderBy: { sortOrder: "asc" }, include: { questions: { orderBy: { sortOrder: "asc" } } } },
      teams: { orderBy: { sortOrder: "asc" } },
      scoreActions: { orderBy: { createdAt: "desc" } },
      snapshots: { orderBy: { createdAt: "desc" } },
      auditEvents: { orderBy: { createdAt: "desc" } },
      accessPasses: { include: { sessions: true } },
    },
  });
  const store: StoreShape = { organizations: {} };
  for (const configuration of configurations) {
    const orgStore = ensureOrgStore(store, configuration.event.organizationId);
    const base = isObject(configuration.payload) ? clone(configuration.payload) : {};
    const triviaEvent: JsonObject = {
      ...base,
      id: configuration.eventId,
      legacyTriviaId: configuration.legacyTriviaId ?? undefined,
      name: configuration.event.name,
      venue: configuration.event.location ?? "",
      startAt: configuration.event.startDate.toISOString(),
      status: configuration.status,
      hostName: configuration.hostName ?? "",
      linkedEventsEventId: configuration.eventId,
      linkedEventsEventName: configuration.event.name,
      eventsSyncMode: "automatic",
      rounds: configuration.rounds.map((round) => ({
        ...(isObject(round.payload) ? clone(round.payload) : {}),
        id: round.id,
        title: round.title,
        description: round.description ?? "",
        roundType: round.roundType,
        questions: round.questions.map((question) => ({
          ...(isObject(question.payload) ? clone(question.payload) : {}),
          id: question.id,
          prompt: question.prompt,
          scoringAnswer: question.answer,
          points: question.points,
          timeLimitSec: question.timerSeconds,
        })),
      })),
      teams: configuration.teams.map((team) => ({
        ...(isObject(team.payload) ? clone(team.payload) : {}),
        id: team.id,
        name: team.gameName ?? (isObject(team.payload) ? String(team.payload.name ?? "Team") : "Team"),
        score: team.score,
        bonusPoints: team.bonusPoints,
        sortOrder: team.sortOrder,
        eventsTableId: team.eventTableId ?? undefined,
      })),
    };
    const events = getStateEvents(orgStore);
    events.push(triviaEvent);
    setStateEvents(orgStore, events);
    setLive(orgStore, configuration.eventId, isObject(configuration.liveState) ? clone(configuration.liveState) : getLive(orgStore, configuration.eventId));
    setScoreHistory(orgStore, configuration.eventId, configuration.scoreActions.map((action) => isObject(action.payload) ? clone(action.payload) : {}));
    orgStore.snapshotsByEventId[configuration.eventId] = configuration.snapshots.map((snapshot) => isObject(snapshot.payload) ? clone(snapshot.payload) : {});
    orgStore.auditByEventId[configuration.eventId] = configuration.auditEvents.map((audit) => ({ id: audit.id, eventId: configuration.eventId, type: audit.type, message: audit.message, createdAt: audit.createdAt.toISOString(), metadata: isObject(audit.metadata) ? clone(audit.metadata) : {} }));
    if (!orgStore.accessPassesByEventId) orgStore.accessPassesByEventId = {};
    orgStore.accessPassesByEventId[configuration.eventId] = configuration.accessPasses.map((pass) => ({ id: pass.id, label: pass.label, role: pass.role as TriviaAccessRole, codeHash: pass.codeHash, expiresAt: pass.expiresAt.toISOString(), revokedAt: pass.revokedAt?.toISOString() ?? null, createdAt: pass.createdAt.toISOString(), sessions: pass.sessions.map((session) => ({ tokenHash: session.tokenHash, expiresAt: session.expiresAt.toISOString() })) }));
    orgStore.updatedAt = configuration.updatedAt.toISOString();
  }
  return store;
}

/** Imports the retired file store once when no relational Trivia rows exist. */
async function importLegacyStoreIfNeeded(): Promise<void> {
  if (legacyImportChecked) return;
  legacyImportChecked = true;
  let legacy: StoreShape | null = null;
  try {
    const parsed = JSON.parse(await readFile(STORE_FILE, "utf8")) as unknown;
    if (isObject(parsed) && isObject(parsed.organizations)) legacy = { organizations: parsed.organizations as StoreShape["organizations"] };
  } catch { legacy = null; }
  const merged = await loadRelationalStore();
  if (legacy) for (const [organizationId, legacyOrgStore] of Object.entries(legacy.organizations)) {
    const orgStore = ensureOrgStore(merged, organizationId);
    for (const event of getStateEvents(legacyOrgStore)) {
      const existingEventId = String(event.linkedEventsEventId ?? "").trim();
      const legacyId = String(event.id ?? "").trim();
      const alreadyImported = getStateEvents(orgStore).some((candidate) => candidate.id === existingEventId || candidate.legacyTriviaId === legacyId);
      if (alreadyImported) continue;
      const linked = existingEventId ? await prisma.event.findFirst({ where: { id: existingEventId, organizationId }, select: { id: true } }) : null;
      const eventRecord = linked ?? await prisma.event.create({ data: { organizationId, name: String(event.name ?? "Trivia Night").slice(0, 160), type: "TRIVIA", status: "DRAFT", visibility: "PUBLIC", location: String(event.venue ?? "").trim().slice(0, 255) || undefined, startDate: validDate(event.startAt), active: true } });
      event.legacyTriviaId = legacyId && legacyId !== eventRecord.id ? legacyId : undefined;
      event.id = eventRecord.id;
      event.linkedEventsEventId = eventRecord.id;
      event.linkedEventsEventName = String(event.name ?? eventRecord.id);
      setStateEvents(orgStore, [...getStateEvents(orgStore), event]);
      const legacyLive = getStateRecord(legacyOrgStore, "liveByEventId")[legacyId];
      if (isObject(legacyLive)) setLive(orgStore, eventRecord.id, clone(legacyLive));
      const legacyHistory = getStateRecord(legacyOrgStore, "scoreHistoryByEventId")[legacyId];
      if (Array.isArray(legacyHistory)) setScoreHistory(orgStore, eventRecord.id, legacyHistory.filter(isObject).map(clone));
      orgStore.snapshotsByEventId[eventRecord.id] = (legacyOrgStore.snapshotsByEventId[legacyId] ?? []).map(clone);
      orgStore.auditByEventId[eventRecord.id] = (legacyOrgStore.auditByEventId[legacyId] ?? []).map(clone);
      if (!orgStore.accessPassesByEventId) orgStore.accessPassesByEventId = {};
      orgStore.accessPassesByEventId[eventRecord.id] = (legacyOrgStore.accessPassesByEventId?.[legacyId] ?? []).map(clone);
    }
  }
  const configuredIds = new Set(Object.values(merged.organizations).flatMap((orgStore) => getStateEvents(orgStore).map((event) => String(event.linkedEventsEventId ?? event.id))));
  const unconfiguredEvents = await prisma.event.findMany({ where: { type: "TRIVIA", id: { notIn: [...configuredIds] } }, select: { id: true, organizationId: true, name: true, location: true, startDate: true } });
  for (const event of unconfiguredEvents) {
    const orgStore = ensureOrgStore(merged, event.organizationId);
    setStateEvents(orgStore, [...getStateEvents(orgStore), { id: event.id, name: event.name, venue: event.location ?? "", hostName: "", startAt: event.startDate.toISOString(), status: "draft", rounds: [], teams: [], scoringRules: { defaultQuestionPoints: 10, allowPartialCredit: true, allowNegativeScores: false, finalWagerEnabled: true, tieBreakerMode: "single_question" }, displaySettings: { highContrast: false, showTeamColors: true, largeText: false, showTimer: true, showRoundTitle: true, showQuestionNumber: true, showSponsorRotation: false, sponsorRotationSeconds: 12, blankScreenMessage: "" }, linkedEventsEventId: event.id, linkedEventsEventName: event.name, eventsSyncMode: "automatic", createdAt: nowIso(), updatedAt: nowIso() }]);
  }
  if (legacy || unconfiguredEvents.length) await persistStore(merged);
}

async function loadStore(): Promise<StoreShape> {
  await importLegacyStoreIfNeeded();
  return loadRelationalStore();
}

/** Persists API state into normalized, event-scoped Trivia records. */
async function persistStore(store: StoreShape): Promise<void> {
  for (const [organizationId, orgStore] of Object.entries(store.organizations)) {
    const events = getStateEvents(orgStore);
    const persistedEventIds: string[] = [];
    for (const event of events) {
      const eventId = String(event.linkedEventsEventId ?? event.id ?? "").trim();
      if (!eventId) continue;
      const ownedEvent = await prisma.event.findFirst({ where: { id: eventId, organizationId }, select: { id: true } });
      if (!ownedEvent) continue;
      persistedEventIds.push(eventId);
      const rounds = Array.isArray(event.rounds) ? event.rounds.filter(isObject) : [];
      const teams = Array.isArray(event.teams) ? event.teams.filter(isObject) : [];
      const payload = clone(event);
      delete payload.id; delete payload.name; delete payload.venue; delete payload.startAt; delete payload.rounds; delete payload.teams; delete payload.status; delete payload.hostName; delete payload.linkedEventsEventId; delete payload.linkedEventsEventName;
      const configuration = await prisma.triviaConfiguration.upsert({
        where: { eventId },
        create: { eventId, legacyTriviaId: String(event.legacyTriviaId ?? "").trim() || (String(event.id ?? "") !== eventId ? String(event.id) : undefined), status: String(event.status ?? "draft"), hostName: String(event.hostName ?? "").trim() || null, payload: jsonValue(payload), liveState: jsonValue(getLive(orgStore, String(event.id ?? eventId))) },
        update: { legacyTriviaId: String(event.legacyTriviaId ?? "").trim() || undefined, status: String(event.status ?? "draft"), hostName: String(event.hostName ?? "").trim() || null, payload: jsonValue(payload), liveState: jsonValue(getLive(orgStore, String(event.id ?? eventId))) },
      });
      await prisma.$transaction([
        prisma.triviaRound.deleteMany({ where: { configurationId: configuration.id } }),
        prisma.triviaTeam.deleteMany({ where: { configurationId: configuration.id } }),
        prisma.triviaScoreAction.deleteMany({ where: { configurationId: configuration.id } }),
        prisma.triviaSnapshot.deleteMany({ where: { configurationId: configuration.id } }),
        prisma.triviaAuditEvent.deleteMany({ where: { configurationId: configuration.id } }),
        prisma.triviaAccessPass.deleteMany({ where: { configurationId: configuration.id } }),
      ]);
      for (const [roundIndex, round] of rounds.entries()) {
        const questions = Array.isArray(round.questions) ? round.questions.filter(isObject) : [];
        const roundPayload = clone(round); delete roundPayload.questions;
        await prisma.triviaRound.create({ data: { id: String(round.id), configurationId: configuration.id, title: String(round.title ?? `Round ${roundIndex + 1}`), description: String(round.description ?? "") || null, roundType: String(round.roundType ?? "standard"), sortOrder: roundIndex, payload: jsonValue(roundPayload), questions: { create: questions.map((question, questionIndex) => ({ id: String(question.id), prompt: String(question.prompt ?? ""), answer: String(question.scoringAnswer ?? question.audienceAnswer ?? ""), points: Number.isFinite(Number(question.points)) ? Math.trunc(Number(question.points)) : 0, timerSeconds: Number.isFinite(Number(question.timeLimitSec)) ? Math.trunc(Number(question.timeLimitSec)) : 30, sortOrder: questionIndex, payload: jsonValue(question) })) } } });
      }
      const tableIds = new Set((await prisma.eventTable.findMany({ where: { eventId }, select: { id: true } })).map((table) => table.id));
      for (const [teamIndex, team] of teams.entries()) await prisma.triviaTeam.create({ data: { id: String(team.id), configurationId: configuration.id, eventTableId: tableIds.has(String(team.eventsTableId ?? "")) ? String(team.eventsTableId) : null, gameName: String(team.name ?? "").trim() || null, score: Math.trunc(Number(team.score) || 0), bonusPoints: Math.trunc(Number(team.bonusPoints) || 0), sortOrder: teamIndex, payload: jsonValue(team) } });
      for (const action of getScoreHistory(orgStore, String(event.id ?? eventId))) await prisma.triviaScoreAction.create({ data: { id: String(action.id), configurationId: configuration.id, teamId: String(action.teamId ?? "") || null, delta: Math.trunc(Number(action.delta) || 0), createdAt: validDate(action.createdAt), payload: jsonValue(action) } });
      for (const snapshot of orgStore.snapshotsByEventId[String(event.id ?? eventId)] ?? []) await prisma.triviaSnapshot.create({ data: { id: String(snapshot.id), configurationId: configuration.id, label: String(snapshot.label ?? "Snapshot"), createdAt: validDate(snapshot.createdAt), payload: jsonValue(snapshot) } });
      for (const audit of orgStore.auditByEventId[String(event.id ?? eventId)] ?? []) await prisma.triviaAuditEvent.create({ data: { id: String(audit.id), configurationId: configuration.id, type: String(audit.type ?? "manual"), message: String(audit.message ?? "Trivia activity"), createdAt: validDate(audit.createdAt), metadata: jsonValue(audit.metadata) } });
      for (const pass of getAccessPasses(orgStore, String(event.id ?? eventId))) await prisma.triviaAccessPass.create({ data: { id: pass.id, configurationId: configuration.id, label: pass.label, role: pass.role, codeHash: pass.codeHash, expiresAt: validDate(pass.expiresAt), revokedAt: pass.revokedAt ? validDate(pass.revokedAt) : null, createdAt: validDate(pass.createdAt), sessions: { create: pass.sessions.map((session) => ({ tokenHash: session.tokenHash, expiresAt: validDate(session.expiresAt) })) } } });
    }
    await prisma.triviaConfiguration.deleteMany({ where: { event: { organizationId }, ...(persistedEventIds.length ? { eventId: { notIn: persistedEventIds } } : {}) } });
  }
}

function pushAudit(orgStore: OrganizationTriviaStore, eventId: string, type: string, message: string, metadata?: JsonObject) {
  const existing = orgStore.auditByEventId[eventId] ?? [];
  orgStore.auditByEventId[eventId] = [
    {
      id: `audit-${randomUUID().slice(0, 12)}`,
      eventId,
      type,
      message,
      createdAt: nowIso(),
      metadata: metadata ?? {},
    },
    ...existing,
  ].slice(0, 500);
}

function getStateEvents(orgStore: OrganizationTriviaStore): JsonObject[] {
  const maybeState = orgStore.state;
  const events = isObject(maybeState) && Array.isArray(maybeState.events) ? maybeState.events : [];
  return events.filter(isObject);
}

function setStateEvents(orgStore: OrganizationTriviaStore, events: JsonObject[]) {
  if (!isObject(orgStore.state)) {
    orgStore.state = createEmptyState();
  }
  orgStore.state.events = events;
}

function getStateRecord(orgStore: OrganizationTriviaStore, key: string): Record<string, unknown> {
  if (!isObject(orgStore.state) || !isObject(orgStore.state[key])) {
    if (!isObject(orgStore.state)) orgStore.state = createEmptyState();
    orgStore.state[key] = {};
  }
  return orgStore.state[key] as Record<string, unknown>;
}

function getScoreHistory(orgStore: OrganizationTriviaStore, eventId: string): JsonObject[] {
  const scoreById = getStateRecord(orgStore, "scoreHistoryByEventId");
  const history = scoreById[eventId];
  return Array.isArray(history) ? history.filter(isObject) : [];
}

function setScoreHistory(orgStore: OrganizationTriviaStore, eventId: string, history: JsonObject[]) {
  const scoreById = getStateRecord(orgStore, "scoreHistoryByEventId");
  scoreById[eventId] = history;
}

function getLive(orgStore: OrganizationTriviaStore, eventId: string): JsonObject {
  const liveById = getStateRecord(orgStore, "liveByEventId");
  if (!isObject(liveById[eventId])) {
    liveById[eventId] = {
      activeRoundId: "",
      activeQuestionIndex: 0,
      stage: "welcome",
      timerDefaultSec: 30,
      timerRemainingSec: 30,
      timerRunning: false,
      leaderboardVisible: false,
      answerRevealed: false,
      displayOpenedAt: null,
      winnerTeamId: null,
      lastHostAction: "Ready",
      updatedAt: nowIso(),
    };
  }
  return liveById[eventId] as JsonObject;
}

function setLive(orgStore: OrganizationTriviaStore, eventId: string, value: JsonObject) {
  const liveById = getStateRecord(orgStore, "liveByEventId");
  liveById[eventId] = value;
}

function findPublishedEventBySlug(store: StoreShape, slug: string): { organizationId: string; orgStore: OrganizationTriviaStore; event: JsonObject; settings: JsonObject } | null {
  const normalized = slug.toLowerCase().trim();
  for (const [organizationId, orgStore] of Object.entries(store.organizations)) {
    for (const event of getStateEvents(orgStore)) {
      const settings = isObject(event.registrationSettings) ? event.registrationSettings : {};
      if (settings.enabled === true && String(settings.publicSlug ?? "").toLowerCase() === normalized) return { organizationId, orgStore, event, settings };
    }
  }
  return null;
}

function publicRegistrationPayload(event: JsonObject, settings: JsonObject): JsonObject {
  const teams = Array.isArray(event.teams) ? event.teams.filter(isObject) : [];
  const maximumTables = Math.max(1, Number(settings.maximumTables) || 30);
  const maximumSeatsPerTable = Math.max(1, Number(settings.maximumSeatsPerTable) || 8);
  const paymentMode = ["free", "per_seat", "per_table", "mixed"].includes(String(settings.paymentMode)) ? settings.paymentMode : "free";
  const paymentProvider = ["offline", "stripe", "paypal"].includes(String(settings.paymentProvider)) ? settings.paymentProvider : "offline";
  const onlinePaymentReady = paymentMode === "free" || paymentProvider === "offline" || (typeof settings.paymentUrl === "string" && /^https:\/\//i.test(settings.paymentUrl));
  return {
    event: {
      id: event.id, name: event.name, venue: event.venue, hostName: event.hostName, startAt: event.startAt,
    },
    registration: {
      signupOpen: settings.signupOpen === true && onlinePaymentReady,
      publicSlug: settings.publicSlug,
      headline: settings.headline ?? event.name,
      description: settings.description ?? "",
      accentColor: settings.accentColor ?? "#38bdf8",
      contactEmail: settings.contactEmail ?? "",
      maximumTables,
      maximumSeatsPerTable,
      collectMemberNames: settings.collectMemberNames !== false,
      paymentMode,
      seatPrice: Math.max(0, Number(settings.seatPrice) || 0),
      tablePrice: Math.max(0, Number(settings.tablePrice) || 0),
      currency: String(settings.currency ?? "USD").toUpperCase().slice(0, 3),
      paymentProvider,
      paymentUrl: typeof settings.paymentUrl === "string" && /^https:\/\//i.test(settings.paymentUrl) ? settings.paymentUrl : "",
      paymentInstructions: settings.paymentInstructions ?? "",
      confirmationMessage: settings.confirmationMessage ?? "Your team is registered.",
    },
    availability: {
      registeredTables: teams.filter((team) => team.active !== false).length,
      remainingTables: Math.max(0, maximumTables - teams.filter((team) => team.active !== false).length),
    },
  };
}

publicRouter.get("/registration/:slug", async (req, res) => {
  const store = await loadStore();
  const match = findPublishedEventBySlug(store, String(req.params.slug ?? ""));
  if (!match) { res.status(404).json({ error: { code: "NOT_FOUND", message: "This trivia registration page is not published." } }); return; }
  res.json(publicRegistrationPayload(match.event, match.settings));
});

publicRouter.post("/registration/:slug", publicRegistrationLimiter, async (req, res) => {
  const store = await loadStore();
  const match = findPublishedEventBySlug(store, String(req.params.slug ?? ""));
  if (!match) { res.status(404).json({ error: { code: "NOT_FOUND", message: "This trivia registration page is not published." } }); return; }
  const { organizationId, event, settings, orgStore } = match;
  if (settings.signupOpen !== true) { res.status(409).json({ error: { code: "REGISTRATION_CLOSED", message: "Registration is currently closed." } }); return; }
  const teams = Array.isArray(event.teams) ? event.teams.filter(isObject) : [];
  const maximumTables = Math.max(1, Number(settings.maximumTables) || 30);
  if (teams.filter((team) => team.active !== false).length >= maximumTables) {
    res.status(409).json({ error: { code: "EVENT_FULL", message: "All available trivia tables are currently reserved." } }); return;
  }
  const teamName = String(req.body?.teamName ?? "").trim().slice(0, 100);
  const tableHostName = String(req.body?.tableHostName ?? "").trim().slice(0, 100);
  const contactEmail = String(req.body?.contactEmail ?? "").trim().toLowerCase().slice(0, 160);
  const contactPhone = String(req.body?.contactPhone ?? "").trim().slice(0, 40);
  const payerName = String(req.body?.payerName ?? tableHostName).trim().slice(0, 100);
  const payerEmail = String(req.body?.payerEmail ?? contactEmail).trim().toLowerCase().slice(0, 160);
  const maximumSeats = Math.max(1, Number(settings.maximumSeatsPerTable) || 8);
  const memberNames = Array.isArray(req.body?.members)
    ? req.body.members.map((item: unknown) => String(item).trim().slice(0, 100)).filter(Boolean).slice(0, maximumSeats)
    : [];
  const requestedSeats = Math.max(1, Math.min(maximumSeats, Math.max(Number(req.body?.seatCount) || 1, memberNames.length)));
  if (!teamName || !tableHostName || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Team name, table host, and a valid contact email are required." } }); return;
  }
  const paymentMode = ["free", "per_seat", "per_table", "mixed"].includes(String(settings.paymentMode)) ? String(settings.paymentMode) : "free";
  const configuredProvider = ["stripe", "paypal"].includes(String(settings.paymentProvider)) ? String(settings.paymentProvider) : "offline";
  if (paymentMode !== "free" && configuredProvider !== "offline" && !(typeof settings.paymentUrl === "string" && /^https:\/\//i.test(settings.paymentUrl))) {
    res.status(409).json({ error: { code: "PAYMENT_NOT_READY", message: "Online registration is temporarily closed while the organizer finishes payment setup." } });
    return;
  }
  const requestedChoice = req.body?.paymentChoice === "table" ? "table" : "seat";
  const paymentChoice = paymentMode === "per_table" ? "table" : paymentMode === "per_seat" ? "seat" : paymentMode === "mixed" ? requestedChoice : "seat";
  const amountDue = paymentMode === "free" ? 0 : paymentChoice === "table"
    ? Math.max(0, Number(settings.tablePrice) || 0)
    : Math.max(0, Number(settings.seatPrice) || 0) * requestedSeats;
  const usedCodes = new Set(teams.map((team) => String(team.registrationCode ?? "")));
  let registrationCode = "";
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = String(randomInt(1000, 10_000));
    if (!usedCodes.has(candidate)) { registrationCode = candidate; break; }
  }
  if (!registrationCode) { res.status(503).json({ error: { code: "CODE_UNAVAILABLE", message: "Registration is temporarily unavailable. Please try again." } }); return; }
  const provider = configuredProvider;
  const teamId = `team-${randomUUID().slice(0, 12)}`;
  const tableNumber = nextAvailableTableNumber(teams);
  const team: JsonObject = {
    id: teamId, name: teamName, players: memberNames, playerCount: requestedSeats, score: 0, bonusPoints: 0,
    active: true, color: "#38bdf8", icon: "star", sortOrder: teams.length, checkInStatus: "expected", checkedInAt: null,
    tableNumber, captainName: tableHostName, tableHostName, contactName: tableHostName,
    contactEmail, contactPhone, registrationSource: "public", registrationCode, paymentChoice,
    paymentStatus: amountDue > 0 ? "pending" : "not_required", paymentProvider: provider, amountDue, payerName, payerEmail,
    notes: String(req.body?.notes ?? "").trim().slice(0, 500),
  };
  teams.push(team);
  event.teams = teams;
  event.updatedAt = nowIso();
  orgStore.updatedAt = nowIso();
  pushAudit(orgStore, String(event.id ?? ""), "check_in", `Public registration received for ${teamName}`, { teamId, registrationCode, amountDue, paymentChoice });
  if (String(event.linkedEventsEventId ?? "").trim()) {
    try {
      await syncTriviaEventToOyamaEvents(organizationId, event);
      await syncTriviaEventFromOyamaEvents(organizationId, event, { force: true });
      pushAudit(orgStore, String(event.id ?? ""), "sync", "Public RSVP synchronized to Oyama Events", { teamId });
    } catch (error) {
      event.eventsSyncError = error instanceof Error ? error.message : "Oyama Events roster sync failed.";
      pushAudit(orgStore, String(event.id ?? ""), "sync", "Public RSVP saved but Oyama Events sync failed", { teamId, error: String(event.eventsSyncError) });
    }
  }
  await persistStore(store);
  const emailResult = await sendTriviaRegistrationConfirmation({ organizationId, event, settings, team });
  pushAudit(orgStore, String(event.id ?? ""), "manual", `RSVP confirmation email ${emailResult.status}`, { teamId, email: contactEmail, detail: emailResult.detail });
  await persistStore(store);
  res.status(201).json({
    registration: { teamId, teamName, tableHostName, registrationCode, tableNumber: team.tableNumber, seatCount: requestedSeats, amountDue, currency: String(settings.currency ?? "USD"), paymentStatus: team.paymentStatus },
    payment: { provider, checkoutUrl: amountDue > 0 && typeof settings.paymentUrl === "string" && /^https:\/\//i.test(settings.paymentUrl) ? settings.paymentUrl : "", instructions: settings.paymentInstructions ?? "" },
    confirmationMessage: settings.confirmationMessage ?? "Your team is registered.",
    email: {
      status: emailResult.status,
      detail: emailResult.status === "sent" ? emailResult.detail : emailResult.status === "skipped" ? emailResult.detail : "Your RSVP succeeded, but the confirmation email could not be sent. Save your check-in code.",
    },
  });
});

async function claimTemporaryAccess(req: Request, eventId?: string): Promise<{ accessToken: string; eventId: string; pass: TriviaAccessPass } | null> {
  const store = await loadStore();
  const codeHash = hashSecret(String(req.body?.code ?? "").trim().toUpperCase());
  const now = Date.now();
  for (const orgStore of Object.values(store.organizations)) {
    const eventEntries = eventId
      ? [[eventId, getAccessPasses(orgStore, eventId)] as const]
      : Object.entries(orgStore.accessPassesByEventId ?? {});
    for (const [candidateEventId, passes] of eventEntries) {
      const pass = passes.find((candidate) => candidate.codeHash === codeHash && !candidate.revokedAt && new Date(candidate.expiresAt).getTime() > now);
      if (!pass) continue;
      const token = randomBytes(24).toString("base64url");
      pass.sessions = [...pass.sessions.filter((session) => new Date(session.expiresAt).getTime() > now), { tokenHash: hashSecret(token), expiresAt: pass.expiresAt }].slice(-8);
      orgStore.updatedAt = nowIso();
      await persistStore(store);
      return { accessToken: token, eventId: candidateEventId, pass };
    }
  }
  return null;
}

/** Claims a four-digit event-night code without exposing CRM credentials. */
publicRouter.post("/claim", accessClaimLimiter, async (req, res) => {
  const claimed = await claimTemporaryAccess(req);
  if (claimed) {
    res.json({ accessToken: claimed.accessToken, eventId: claimed.eventId, role: claimed.pass.role, label: claimed.pass.label, expiresAt: claimed.pass.expiresAt });
    return;
  }
  res.status(401).json({ error: { code: "INVALID_EVENT_ACCESS", message: "That four-digit event code is invalid or expired." } });
});

/** Event-specific claim remains compatible with previously shared remote URLs. */
publicRouter.post("/events/:eventId/claim", accessClaimLimiter, async (req, res) => {
  const claimed = await claimTemporaryAccess(req, String(req.params.eventId ?? ""));
  if (claimed) {
    res.json({ accessToken: claimed.accessToken, eventId: claimed.eventId, role: claimed.pass.role, label: claimed.pass.label, expiresAt: claimed.pass.expiresAt });
    return;
  }
  res.status(401).json({ error: { code: "INVALID_EVENT_ACCESS", message: "That temporary access code is invalid or expired." } });
});

publicRouter.get("/events/:eventId/session", async (req, res) => {
  const eventId = String(req.params.eventId ?? "");
  const access = await resolvePublicPass(req, eventId);
  if (!access) {
    res.status(401).json({ error: { code: "INVALID_EVENT_ACCESS", message: "Temporary event access is required." } });
    return;
  }
  const eventsRosterChanged = await refreshAutomaticEventsLinks(access.organizationId, access.orgStore, { eventId });
  if (eventsRosterChanged) await persistStore(access.store);
  const event = getStateEvents(access.orgStore).find((item) => item.id === eventId);
  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Trivia event not found." } });
    return;
  }
  res.json({ role: access.pass.role, label: access.pass.label, expiresAt: access.pass.expiresAt, event: publicEventSnapshot(event, getLive(access.orgStore, eventId), access.pass.role) });
});

publicRouter.post("/events/:eventId/actions", async (req, res) => {
  const eventId = String(req.params.eventId ?? "");
  const access = await resolvePublicPass(req, eventId);
  if (!access) {
    res.status(401).json({ error: { code: "INVALID_EVENT_ACCESS", message: "Temporary event access is required." } });
    return;
  }
  const event = getStateEvents(access.orgStore).find((item) => item.id === eventId);
  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Trivia event not found." } });
    return;
  }
  const action = String(req.body?.action ?? "");
  const payload = isObject(req.body?.payload) ? req.body.payload : {};
  const live = getLive(access.orgStore, eventId);
  let rosterChanged = false;
  if (action === "score_adjust" && (access.pass.role === "scorekeeper" || access.pass.role === "host")) {
    const teams = Array.isArray(event.teams) ? event.teams.filter(isObject) : [];
    const index = teams.findIndex((team) => team.id === payload.teamId);
    const delta = Math.max(-100, Math.min(100, Number(payload.delta) || 0));
    if (index < 0 || delta === 0) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose a team and a non-zero score adjustment." } }); return; }
    const previousScore = Number(teams[index].score) || 0;
    const scoringRules = isObject(event.scoringRules) ? event.scoringRules : {};
    const nextScore = scoringRules.allowNegativeScores === true ? previousScore + delta : Math.max(0, previousScore + delta);
    const appliedDelta = nextScore - previousScore;
    if (appliedDelta === 0) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "That adjustment would not change the score." } }); return; }
    teams[index] = { ...teams[index], score: nextScore };
    event.teams = teams;
    pushAudit(access.orgStore, eventId, "score", `Remote score adjustment ${appliedDelta >= 0 ? "+" : ""}${appliedDelta}`, { teamId: String(payload.teamId), delta: appliedDelta, previousScore, nextScore });
  } else if (action === "check_in" && (access.pass.role === "checkin" || access.pass.role === "table_manager" || access.pass.role === "host")) {
    const teams = Array.isArray(event.teams) ? event.teams.filter(isObject) : [];
    const index = teams.findIndex((team) => team.id === payload.teamId);
    if (index < 0) { res.status(404).json({ error: { code: "NOT_FOUND", message: "Team not found." } }); return; }
    const status = payload.status === "late" ? "late" : "checked_in";
    teams[index] = { ...teams[index], checkInStatus: status, active: true, checkedInAt: nowIso() };
    event.teams = teams;
    rosterChanged = true;
    pushAudit(access.orgStore, eventId, "check_in", `${teams[index].name ?? "Team"} checked in`, { teamId: String(payload.teamId), status });
  } else if (action === "add_team" && (access.pass.role === "table_manager" || access.pass.role === "host")) {
    const teams = Array.isArray(event.teams) ? event.teams.filter(isObject) : [];
    const name = String(payload.name ?? "").trim().slice(0, 100);
    const memberNames = Array.isArray(payload.players)
      ? payload.players.map((item: unknown) => String(item).trim().slice(0, 100)).filter(Boolean).slice(0, 30)
      : [];
    if (!name) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Team name is required." } }); return; }
    const requestedTableNumber = payload.tableNumber === undefined || String(payload.tableNumber).trim() === ""
      ? nextAvailableTableNumber(teams)
      : normalizeTableNumber(payload.tableNumber);
    if (!requestedTableNumber) { res.status(400).json({ error: { code: "INVALID_TABLE_NUMBER", message: "Table number must be a whole number from 1 to 9999." } }); return; }
    if (teams.some((team) => normalizeTableNumber(team.tableNumber) === requestedTableNumber)) {
      res.status(409).json({ error: { code: "DUPLICATE_TABLE_NUMBER", message: `Table ${requestedTableNumber} is already assigned to another team.` } }); return;
    }
    teams.push({
      id: `team-${randomUUID().slice(0, 12)}`, name, players: memberNames, playerCount: memberNames.length || 1,
      score: 0, bonusPoints: 0, active: true, color: "#38bdf8", icon: "star", sortOrder: teams.length,
      checkInStatus: "expected", checkedInAt: null, tableNumber: requestedTableNumber,
      captainName: String(payload.tableHostName ?? "").trim().slice(0, 100),
      tableHostName: String(payload.tableHostName ?? "").trim().slice(0, 100),
      contactName: String(payload.contactName ?? "").trim().slice(0, 100),
      contactEmail: String(payload.contactEmail ?? "").trim().slice(0, 160),
      contactPhone: String(payload.contactPhone ?? "").trim().slice(0, 40),
      registrationSource: "staff", paymentStatus: "pending", amountDue: 0, notes: String(payload.notes ?? "").trim().slice(0, 500),
    });
    event.teams = teams;
    rosterChanged = true;
    pushAudit(access.orgStore, eventId, "check_in", `${name} added from table manager remote`, { teamId: String(teams.at(-1)?.id ?? "") });
  } else if (action === "update_team" && (access.pass.role === "table_manager" || access.pass.role === "host")) {
    const teams = Array.isArray(event.teams) ? event.teams.filter(isObject) : [];
    const index = teams.findIndex((team) => team.id === payload.teamId);
    if (index < 0) { res.status(404).json({ error: { code: "NOT_FOUND", message: "Team not found." } }); return; }
    const current = teams[index];
    const players = Array.isArray(payload.players)
      ? payload.players.map((item: unknown) => String(item).trim().slice(0, 100)).filter(Boolean).slice(0, 30)
      : current.players;
    const allowedPaymentStatuses = new Set(["not_required", "pending", "partial", "paid", "waived"]);
    const requestedTableNumber = payload.tableNumber === undefined ? normalizeTableNumber(current.tableNumber) : normalizeTableNumber(payload.tableNumber);
    if (!requestedTableNumber) { res.status(400).json({ error: { code: "INVALID_TABLE_NUMBER", message: "Table number must be a whole number from 1 to 9999." } }); return; }
    if (teams.some((team) => team.id !== payload.teamId && normalizeTableNumber(team.tableNumber) === requestedTableNumber)) {
      res.status(409).json({ error: { code: "DUPLICATE_TABLE_NUMBER", message: `Table ${requestedTableNumber} is already assigned to another team.` } }); return;
    }
    teams[index] = {
      ...current,
      name: typeof payload.name === "string" ? payload.name.trim().slice(0, 100) || current.name : current.name,
      players,
      playerCount: Array.isArray(players) ? players.length : current.playerCount,
      tableNumber: requestedTableNumber,
      tableHostName: typeof payload.tableHostName === "string" ? payload.tableHostName.trim().slice(0, 100) : current.tableHostName,
      captainName: typeof payload.tableHostName === "string" ? payload.tableHostName.trim().slice(0, 100) : current.captainName,
      contactName: typeof payload.contactName === "string" ? payload.contactName.trim().slice(0, 100) : current.contactName,
      contactEmail: typeof payload.contactEmail === "string" ? payload.contactEmail.trim().slice(0, 160) : current.contactEmail,
      contactPhone: typeof payload.contactPhone === "string" ? payload.contactPhone.trim().slice(0, 40) : current.contactPhone,
      notes: typeof payload.notes === "string" ? payload.notes.trim().slice(0, 500) : current.notes,
      paymentStatus: typeof payload.paymentStatus === "string" && allowedPaymentStatuses.has(payload.paymentStatus) ? payload.paymentStatus : current.paymentStatus,
    };
    event.teams = teams;
    rosterChanged = true;
    pushAudit(access.orgStore, eventId, "manual", `${teams[index].name ?? "Team"} updated from table manager remote`, { teamId: String(payload.teamId) });
  } else if (["set_stage", "set_round", "next_question", "previous_question", "timer_start", "timer_pause", "timer_reset"].includes(action) && access.pass.role === "host") {
    const rounds = Array.isArray(event.rounds) ? event.rounds.filter(isObject) : [];
    const nextLive: JsonObject = { ...live };
    if (action === "set_stage") {
      if (typeof payload.stage !== "string" || !TRIVIA_DISPLAY_STAGES.has(payload.stage)) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose a valid projector stage." } }); return; }
      nextLive.stage = payload.stage;
    }
    if (action === "set_round") {
      if (typeof payload.roundId !== "string" || !rounds.some((round) => round.id === payload.roundId)) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose a valid round." } }); return; }
      nextLive.activeRoundId = payload.roundId; nextLive.activeQuestionIndex = 0; nextLive.stage = "round_intro"; nextLive.timerRunning = false; nextLive.answerRevealed = false;
    }
    if (action === "next_question" || action === "previous_question") {
      const round = rounds.find((item) => item.id === nextLive.activeRoundId);
      const questions = Array.isArray(round?.questions) ? round.questions.filter(isObject) : [];
      if (questions.length === 0) { res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "The active round has no questions." } }); return; }
      const currentIndex = Number(nextLive.activeQuestionIndex ?? 0);
      nextLive.activeQuestionIndex = action === "next_question" ? Math.min(questions.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
      nextLive.stage = round?.roundType === "final_wager" ? "final_question" : round?.roundType === "tiebreaker" ? "tiebreaker" : "question";
      const question = questions[Number(nextLive.activeQuestionIndex)];
      const configuredSeconds = Number(question?.timeLimitSec);
      const seconds = Number.isFinite(configuredSeconds) && configuredSeconds >= 0 ? configuredSeconds : 30;
      nextLive.timerDefaultSec = seconds; nextLive.timerRemainingSec = seconds; nextLive.timerRunning = false; nextLive.answerRevealed = false;
    }
    if (action === "timer_start") nextLive.timerRunning = Number(nextLive.timerDefaultSec) > 0;
    if (action === "timer_pause") nextLive.timerRunning = false;
    if (action === "timer_reset") { const round = rounds.find((item) => item.id === nextLive.activeRoundId); const question = Array.isArray(round?.questions) ? round.questions[Number(nextLive.activeQuestionIndex ?? 0)] : null; const configuredSeconds = Number(isObject(question) ? question.timeLimitSec : 30); const seconds = Number.isFinite(configuredSeconds) && configuredSeconds >= 0 ? configuredSeconds : 30; nextLive.timerDefaultSec = seconds; nextLive.timerRemainingSec = seconds; nextLive.timerRunning = false; }
    nextLive.lastHostAction = `Remote ${action.replace(/_/g, " ")}`;
    nextLive.updatedAt = nowIso();
    setLive(access.orgStore, eventId, nextLive);
    pushAudit(access.orgStore, eventId, "manual", `Remote control: ${action}`, { accessPassId: access.pass.id });
  } else {
    res.status(403).json({ error: { code: "EVENT_ACCESS_DENIED", message: "This temporary sign-in cannot perform that action." } });
    return;
  }
  event.updatedAt = nowIso();
  access.orgStore.updatedAt = nowIso();
  if (rosterChanged && String(event.linkedEventsEventId ?? "").trim()) {
    try {
      await syncTriviaEventToOyamaEvents(access.organizationId, event);
      await syncTriviaEventFromOyamaEvents(access.organizationId, event, { force: true });
      pushAudit(access.orgStore, eventId, "sync", "Roster changes synchronized to Oyama Events");
    } catch (error) {
      event.eventsSyncError = error instanceof Error ? error.message : "Oyama Events roster sync failed.";
      pushAudit(access.orgStore, eventId, "sync", "Oyama Events roster sync failed", { error: String(event.eventsSyncError) });
    }
  }
  await persistStore(access.store);
  res.json({ event: publicEventSnapshot(event, getLive(access.orgStore, eventId), access.pass.role) });
});

router.get("/state", async (req, res) => {
  const store = await loadStore();
  const organizationId = resolveOrganizationId(req);
  const orgStore = ensureOrgStore(store, organizationId);
  if (await refreshAutomaticEventsLinks(organizationId, orgStore)) await persistStore(store);
  res.json({ state: orgStore.state, updatedAt: orgStore.updatedAt });
});

router.put("/state", async (req, res) => {
  const store = await loadStore();
  const organizationId = resolveOrganizationId(req);
  const orgStore = ensureOrgStore(store, organizationId);
  const incomingState = isObject(req.body?.state) ? clone(req.body.state) : createEmptyState();
  // A browser can save builder changes while a public signup or remote is writing the
  // roster. Preserve the newer server roster so a stale whole-state sync cannot erase it.
  const incomingEvents = Array.isArray(incomingState.events) ? incomingState.events.filter(isObject) : [];
  const currentEvents = getStateEvents(orgStore);
  incomingState.events = incomingEvents.map((incomingEvent: JsonObject) => {
    const currentEvent = currentEvents.find((candidate) => candidate.id === incomingEvent.id);
    if (!currentEvent) return { ...incomingEvent, teams: normalizeRosterTableNumbers(Array.isArray(incomingEvent.teams) ? incomingEvent.teams.filter(isObject) : []) };
    const currentUpdatedAt = new Date(String(currentEvent.updatedAt ?? 0)).getTime();
    const incomingUpdatedAt = new Date(String(incomingEvent.updatedAt ?? 0)).getTime();
    const reconciled = currentUpdatedAt > incomingUpdatedAt ? { ...incomingEvent, teams: clone(Array.isArray(currentEvent.teams) ? currentEvent.teams : []), updatedAt: currentEvent.updatedAt } : incomingEvent;
    const linkedFields = currentEvent.linkedEventsEventId && !incomingEvent.linkedEventsEventId ? {
      linkedEventsEventId: currentEvent.linkedEventsEventId,
      linkedEventsEventName: currentEvent.linkedEventsEventName,
      eventsSyncMode: currentEvent.eventsSyncMode,
      eventsLastSyncedAt: currentEvent.eventsLastSyncedAt,
      eventsSyncError: currentEvent.eventsSyncError,
      eventsPublicPagePath: currentEvent.eventsPublicPagePath,
    } : {};
    return { ...reconciled, ...linkedFields, teams: normalizeRosterTableNumbers(Array.isArray(reconciled.teams) ? reconciled.teams.filter(isObject) : []) };
  });
  const linkedRosterChanges = (incomingState.events as JsonObject[]).filter((event) => {
    const current = currentEvents.find((candidate) => candidate.id === event.id);
    return Boolean(event.linkedEventsEventId) && rosterSyncFingerprint(current) !== rosterSyncFingerprint(event);
  });
  orgStore.state = incomingState;
  for (const event of linkedRosterChanges) {
    try {
      await syncTriviaEventToOyamaEvents(organizationId, event);
      await syncTriviaEventFromOyamaEvents(organizationId, event, { force: true });
      pushAudit(orgStore, String(event.id ?? ""), "sync", "Trivia roster synchronized to Oyama Events");
    } catch (error) {
      event.eventsSyncError = error instanceof Error ? error.message : "Oyama Events roster sync failed.";
      pushAudit(orgStore, String(event.id ?? ""), "sync", "Oyama Events roster sync failed", { error: String(event.eventsSyncError) });
    }
  }
  orgStore.updatedAt = nowIso();
  await persistStore(store);
  res.json({ state: orgStore.state, updatedAt: orgStore.updatedAt });
});

router.get("/events", async (req, res) => {
  const store = await loadStore();
  const organizationId = resolveOrganizationId(req);
  const orgStore = ensureOrgStore(store, organizationId);
  if (await refreshAutomaticEventsLinks(organizationId, orgStore)) await persistStore(store);
  res.json({ events: getStateEvents(orgStore) });
});

router.post("/events", async (req, res) => {
  const store = await loadStore();
  const organizationId = resolveOrganizationId(req);
  const orgStore = ensureOrgStore(store, organizationId);
  const events = getStateEvents(orgStore);
  const now = nowIso();
  const incoming = isObject(req.body) ? clone(req.body) : {};
  const requestedEventId = typeof incoming.id === "string" && incoming.id.trim() ? incoming.id : `trivia-event-${randomUUID().slice(0, 12)}`;

  let eventStudio: Awaited<ReturnType<typeof createTriviaEventStudioWorkspace>> | null = null;
  if (!String(incoming.linkedEventsEventId ?? "").trim()) {
    try {
      eventStudio = await createTriviaEventStudioWorkspace(organizationId, incoming);
    } catch (error) {
      res.status(400).json({
        error: {
          code: "CONNECTED_EVENT_CREATE_FAILED",
          message: error instanceof Error ? error.message : "The connected EventSTUDIO workspace could not be created.",
        },
      });
      return;
    }
  }
  const eventId = String(incoming.linkedEventsEventId ?? eventStudio?.eventStudio.id ?? requestedEventId);

  const nextEvent: JsonObject = {
    ...incoming,
    eventStudioSetup: undefined,
    id: eventId,
    ...(requestedEventId !== eventId ? { legacyTriviaId: requestedEventId } : {}),
    rounds: Array.isArray(incoming.rounds) ? incoming.rounds : [],
    teams: normalizeRosterTableNumbers(Array.isArray(incoming.teams) ? incoming.teams.filter(isObject) : []),
    createdAt: typeof incoming.createdAt === "string" ? incoming.createdAt : now,
    updatedAt: now,
    ...(eventStudio ? {
      linkedEventsEventId: eventStudio.eventStudio.id,
      linkedEventsEventName: eventStudio.eventStudio.name,
      eventsSyncMode: "automatic",
      eventsLastSyncedAt: now,
      eventsSyncError: null,
      eventsPublicPagePath: eventStudio.publicPagePath,
    } : {}),
  };

  const idx = events.findIndex((event) => event.id === eventId);
  if (idx >= 0) events[idx] = nextEvent;
  else events.unshift(nextEvent);

  setStateEvents(orgStore, events);
  getLive(orgStore, eventId);
  if (!orgStore.snapshotsByEventId[eventId]) orgStore.snapshotsByEventId[eventId] = [];
  if (!orgStore.auditByEventId[eventId]) orgStore.auditByEventId[eventId] = [];
  if (getScoreHistory(orgStore, eventId).length === 0) setScoreHistory(orgStore, eventId, []);

  orgStore.updatedAt = now;
  pushAudit(orgStore, eventId, "manual", eventStudio ? "Trivia and EventSTUDIO workspaces created and linked" : "Event created or updated");
  await persistStore(store);
  res.status(idx >= 0 ? 200 : 201).json({
    event: nextEvent,
    eventStudio: eventStudio ? { id: eventStudio.eventStudio.id, publicPagePath: eventStudio.publicPagePath } : null,
  });
});

router.get("/events/:eventId", async (req, res) => {
  const store = await loadStore();
  const organizationId = resolveOrganizationId(req);
  const orgStore = ensureOrgStore(store, organizationId);
  const eventId = String(req.params.eventId ?? "");
  if (await refreshAutomaticEventsLinks(organizationId, orgStore, { eventId })) await persistStore(store);
  const event = getStateEvents(orgStore).find((item) => item.id === eventId);

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Trivia event not found." } });
    return;
  }

  res.json({ event, live: getLive(orgStore, eventId), scoreHistory: getScoreHistory(orgStore, eventId) });
});

/** Lists eligible Oyama Events records and the active Trivia roster link. */
router.get("/events/:eventId/events-link", async (req, res) => {
  const store = await loadStore();
  const organizationId = resolveOrganizationId(req);
  const orgStore = ensureOrgStore(store, organizationId);
  const eventId = String(req.params.eventId ?? "");
  const event = getStateEvents(orgStore).find((item) => item.id === eventId);
  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Trivia event not found." } });
    return;
  }
  const [availableEvents, pageSetting] = await Promise.all([
    prisma.event.findMany({
      where: { organizationId, active: true },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        startDate: true,
        location: true,
        _count: { select: { tables: true, guests: true } },
      },
      orderBy: [{ startDate: "desc" }, { name: "asc" }],
      take: 100,
    }),
    prisma.pluginSetting.findUnique({
      where: { organizationId_pluginKey: { organizationId, pluginKey: EVENTS_PAGE_BUILDER_PLUGIN_KEY } },
      select: { config: true },
    }),
  ]);
  const configuredPublicPath = String(event.linkedEventsEventId ?? "").trim()
    ? publicEventPagePath(pageSetting?.config, String(event.linkedEventsEventId))
    : null;
  res.json({
    link: {
      oyamaEventId: event.linkedEventsEventId ?? "",
      oyamaEventName: event.linkedEventsEventName ?? "",
      syncMode: event.eventsSyncMode ?? "automatic",
      lastSyncedAt: event.eventsLastSyncedAt ?? null,
      error: event.eventsSyncError ?? null,
      publicPagePath: configuredPublicPath ?? event.eventsPublicPagePath ?? null,
    },
    availableEvents,
  });
});

/** Links Trivia to the durable EventSTUDIO table and guest roster. */
router.patch("/events/:eventId/events-link", async (req, res) => {
  const store = await loadStore();
  const organizationId = resolveOrganizationId(req);
  const orgStore = ensureOrgStore(store, organizationId);
  const eventId = String(req.params.eventId ?? "");
  const event = getStateEvents(orgStore).find((item) => item.id === eventId);
  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Trivia event not found." } });
    return;
  }
  const oyamaEventId = String(req.body?.oyamaEventId ?? "").trim();
  if (!oyamaEventId) {
    event.linkedEventsEventId = undefined;
    event.linkedEventsEventName = undefined;
    event.eventsLastSyncedAt = null;
    event.eventsSyncError = null;
    event.updatedAt = nowIso();
    pushAudit(orgStore, eventId, "sync", "Oyama Events roster link removed");
    orgStore.updatedAt = nowIso();
    await persistStore(store);
    res.json({ event });
    return;
  }
  const linkedEvent = await prisma.event.findFirst({
    where: { id: oyamaEventId, organizationId, active: true },
    select: { id: true, name: true, _count: { select: { tables: true } } },
  });
  if (!linkedEvent) {
    res.status(404).json({ error: { code: "EVENT_NOT_FOUND", message: "Choose an active Oyama Events record from this organization." } });
    return;
  }

  const live = getLive(orgStore, eventId);
  const history = getScoreHistory(orgStore, eventId);
  const snapshots = orgStore.snapshotsByEventId[eventId] ?? [];
  snapshots.unshift({
    id: `snapshot-${randomUUID().slice(0, 12)}`,
    eventId,
    label: "Before linking to Oyama Events",
    capturedAt: nowIso(),
    event: clone(event),
    live: clone(live),
    scoreHistory: clone(history),
  });
  orgStore.snapshotsByEventId[eventId] = snapshots.slice(0, 50);

  event.linkedEventsEventId = linkedEvent.id;
  event.linkedEventsEventName = linkedEvent.name;
  event.eventsSyncMode = req.body?.syncMode === "manual" ? "manual" : "automatic";
  if (linkedEvent._count.tables === 0 && Array.isArray(event.teams) && event.teams.length > 0) {
    await syncTriviaEventToOyamaEvents(organizationId, event);
  }
  await syncTriviaEventFromOyamaEvents(organizationId, event, { force: true });
  event.updatedAt = nowIso();
  orgStore.updatedAt = nowIso();
  pushAudit(orgStore, eventId, "sync", `Linked roster to Oyama Events: ${linkedEvent.name}`, { oyamaEventId: linkedEvent.id });
  await persistStore(store);
  res.json({ event });
});

/** Performs a reviewed immediate roster synchronization in either direction. */
router.post("/events/:eventId/events-sync", async (req, res) => {
  const store = await loadStore();
  const organizationId = resolveOrganizationId(req);
  const orgStore = ensureOrgStore(store, organizationId);
  const eventId = String(req.params.eventId ?? "");
  const event = getStateEvents(orgStore).find((item) => item.id === eventId);
  if (!event || !String(event.linkedEventsEventId ?? "").trim()) {
    res.status(404).json({ error: { code: "EVENT_LINK_REQUIRED", message: "Link this trivia night to Oyama Events first." } });
    return;
  }
  const direction = req.body?.direction === "to_events" ? "to_events" : "from_events";
  if (direction === "to_events") await syncTriviaEventToOyamaEvents(organizationId, event);
  await syncTriviaEventFromOyamaEvents(organizationId, event, { force: true });
  event.updatedAt = nowIso();
  orgStore.updatedAt = nowIso();
  pushAudit(orgStore, eventId, "sync", direction === "to_events" ? "Trivia roster sent to Oyama Events" : "Roster refreshed from Oyama Events");
  await persistStore(store);
  res.json({ event, direction, syncedAt: event.eventsLastSyncedAt });
});

/** Uploads presentation media for image, audio, and video trivia questions. */
router.post("/media", async (req, res) => {
  const organizationId = resolveOrganizationId(req).replace(/[^a-zA-Z0-9_-]/g, "_");
  const fileName = String(req.body?.fileName ?? "").trim();
  const mimeType = String(req.body?.mimeType ?? "").trim().toLowerCase();
  const dataBase64 = String(req.body?.dataBase64 ?? "").trim();
  const spec = TRIVIA_MEDIA_TYPES[mimeType];
  if (!fileName || !dataBase64 || !spec) { res.status(400).json({ error: { code: "INVALID_MEDIA", message: "Upload a supported image, audio, or video file." } }); return; }
  const buffer = Buffer.from(dataBase64.includes(",") ? dataBase64.split(",").pop() ?? "" : dataBase64, "base64");
  if (!buffer.byteLength) { res.status(400).json({ error: { code: "INVALID_MEDIA", message: "The media file could not be read." } }); return; }
  if (buffer.byteLength > spec.maxBytes) { res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: `${mimeType.startsWith("video/") || mimeType.startsWith("audio/") ? "Audio and video" : "Images"} must be ${Math.round(spec.maxBytes / 1024 / 1024)}MB or smaller.` } }); return; }
  const safeName = `${randomUUID()}.${spec.extension}`;
  const uploadDir = path.resolve(process.cwd(), "public", "uploads", "trivia-media", organizationId);
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, safeName), buffer);
  res.status(201).json({ url: `/uploads/trivia-media/${organizationId}/${safeName}`, fileName, mimeType, sizeBytes: buffer.byteLength });
});

/** Sends reviewed public-registration invitations to one address or a pasted list. */
router.post("/events/:eventId/registration-invitations", async (req, res) => {
  const store = await loadStore();
  const organizationId = resolveOrganizationId(req);
  const orgStore = ensureOrgStore(store, organizationId);
  const eventId = String(req.params.eventId ?? "");
  const event = getStateEvents(orgStore).find((item) => item.id === eventId);
  if (!event) { res.status(404).json({ error: { code: "NOT_FOUND", message: "Trivia event not found." } }); return; }
  const settings = isObject(event.registrationSettings) ? event.registrationSettings : {};
  if (settings.enabled !== true || !String(settings.publicSlug ?? "").trim()) {
    res.status(409).json({ error: { code: "PUBLIC_PAGE_REQUIRED", message: "Publish the public registration page before sending invitations." } });
    return;
  }
  if (req.body?.confirmedPermission !== true) {
    res.status(400).json({ error: { code: "PERMISSION_CONFIRMATION_REQUIRED", message: "Confirm that these recipients may receive this event invitation." } });
    return;
  }
  const rawRecipients = Array.isArray(req.body?.recipients) ? req.body.recipients : [];
  const parsed: Array<{ email: string; name: string }> = rawRecipients.slice(0, 200).map((item: unknown) => {
    if (isObject(item)) return { email: String(item.email ?? "").trim().toLowerCase(), name: String(item.name ?? "").trim().slice(0, 100) };
    return { email: String(item ?? "").trim().toLowerCase(), name: "" };
  });
  if (parsed.length === 0) { res.status(400).json({ error: { code: "RECIPIENTS_REQUIRED", message: "Add at least one invitation recipient." } }); return; }
  const eligibility = await evaluateRecipientEligibility({
    organizationId,
    purpose: "EVENT_PROMOTION",
    candidates: parsed.map((recipient) => ({ email: recipient.email })),
  });
  const signupUrl = `${appPublicOrigin()}/trivia/${encodeURIComponent(String(settings.publicSlug))}`;
  const subject = String(req.body?.subject ?? `You're invited: ${String(event.name ?? "Trivia Night")}`).trim().slice(0, 180);
  const customMessage = String(req.body?.message ?? "Reserve your table or seats using the registration link below.").trim().slice(0, 2000);
  const sender = eligibility.recipients.length > 0 ? await createOrganizationEmailSender(organizationId) : null;
  const results: Array<{ email: string; status: "sent" | "skipped" | "failed"; detail: string }> = eligibility.decisions
    .filter((decision) => !eligibility.recipients.includes(decision.email))
    .map((decision) => ({ email: decision.email, status: "skipped", detail: decision.ineligibilityReason ?? "Recipient is not eligible." }));
  for (const email of eligibility.recipients) {
    const recipient = parsed.find((item) => item.email === email);
    try {
      const links = await createTriviaEmailPreferenceLinks(organizationId, email);
      const greeting = recipient?.name ? `Hello ${escapeEmailHtml(recipient.name)},` : "Hello,";
      const body = [
        `<p style="margin-top:0">${greeting}</p>`,
        `<p>${escapeEmailHtml(customMessage).replace(/\n/g, "<br>")}</p>`,
        `<div style="margin:20px 0;padding:16px;background:#081321;border-left:4px solid #38bdf8"><div><strong>Event:</strong> ${escapeEmailHtml(event.name)}</div><div><strong>When:</strong> ${escapeEmailHtml(event.startAt ? new Date(String(event.startAt)).toLocaleString() : "See event page")}</div><div><strong>Where:</strong> ${escapeEmailHtml(event.venue ?? "See event page")}</div></div>`,
        `<p><a href="${escapeEmailHtml(signupUrl)}" style="display:inline-block;padding:13px 20px;background:#38bdf8;color:#07111f;text-decoration:none;font-weight:bold">Register or reserve a table</a></p>`,
        `<p>If the button does not open, copy this address:<br><a href="${escapeEmailHtml(signupUrl)}" style="color:#67e8f9">${escapeEmailHtml(signupUrl)}</a></p>`,
      ].join("");
      const footer = `<a href="${escapeEmailHtml(links.preferencesUrl)}" style="color:#cbd5e1">Manage email preferences</a> · <a href="${escapeEmailHtml(links.unsubscribeUrl)}" style="color:#cbd5e1">Unsubscribe from event invitations</a>`;
      await sender?.send({
        to: email,
        subject,
        text: `${recipient?.name ? `Hello ${recipient.name},\n\n` : ""}${customMessage}\n\n${String(event.name ?? "Trivia Night")}\n${event.startAt ? new Date(String(event.startAt)).toLocaleString() : ""}\n${String(event.venue ?? "")}\n\nRegister: ${signupUrl}\n\nManage preferences: ${links.preferencesUrl}\nUnsubscribe: ${links.unsubscribeUrl}`,
        html: triviaEmailFrame(String(event.name ?? "Trivia Night"), body, footer),
        fromNameOverride: String(event.name ?? "Oyama Trivia"),
      });
      results.push({ email, status: "sent", detail: "Provider accepted the invitation." });
    } catch (error) {
      results.push({ email, status: "failed", detail: error instanceof Error ? error.message : "Email provider rejected the invitation." });
    }
  }
  const sent = results.filter((result) => result.status === "sent").length;
  const skipped = results.filter((result) => result.status === "skipped").length;
  const failed = results.filter((result) => result.status === "failed").length;
  pushAudit(orgStore, eventId, "manual", `Registration invitations: ${sent} sent, ${skipped} skipped, ${failed} failed`, { subject, sent, skipped, failed });
  orgStore.updatedAt = nowIso();
  await persistStore(store);
  res.json({ sent, skipped, failed, signupUrl, results });
});

/** Creates a revocable temporary sign-in for an event-night role. The code is returned only once. */
router.post("/events/:eventId/access-passes", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  if (!getStateEvents(orgStore).some((item) => item.id === eventId)) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Trivia event not found." } });
    return;
  }
  const role = req.body?.role;
  if (!isAccessRole(role)) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose host, checkin, scorekeeper, or table_manager." } });
    return;
  }
  const durationHours = Math.min(24, Math.max(1, Number(req.body?.durationHours) || 12));
  const code = makeAccessCode(store);
  const pass: TriviaAccessPass = {
    id: `trivia-pass-${randomUUID().slice(0, 12)}`,
    label: String(req.body?.label ?? `${role} temporary sign-in`).trim().slice(0, 80) || `${role} temporary sign-in`,
    role,
    codeHash: hashSecret(code),
    expiresAt: new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString(),
    revokedAt: null,
    sessions: [],
    createdAt: nowIso(),
  };
  if (!orgStore.accessPassesByEventId) orgStore.accessPassesByEventId = {};
  orgStore.accessPassesByEventId[eventId] = [pass, ...getAccessPasses(orgStore, eventId)].slice(0, 30);
  orgStore.updatedAt = nowIso();
  pushAudit(orgStore, eventId, "manual", `Temporary ${role} sign-in created`, { passId: pass.id, expiresAt: pass.expiresAt });
  await persistStore(store);
  res.status(201).json({ pass: { id: pass.id, label: pass.label, role: pass.role, expiresAt: pass.expiresAt, createdAt: pass.createdAt, code } });
});

router.get("/events/:eventId/access-passes", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  res.json({ passes: getAccessPasses(orgStore, eventId).map((pass) => ({ id: pass.id, label: pass.label, role: pass.role, expiresAt: pass.expiresAt, revokedAt: pass.revokedAt, createdAt: pass.createdAt, activeSessions: pass.sessions.filter((session) => new Date(session.expiresAt).getTime() > Date.now()).length })) });
});

router.delete("/events/:eventId/access-passes/:passId", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  const pass = getAccessPasses(orgStore, eventId).find((item) => item.id === String(req.params.passId ?? ""));
  if (!pass) { res.status(404).json({ error: { code: "NOT_FOUND", message: "Temporary sign-in not found." } }); return; }
  pass.revokedAt = nowIso();
  pass.sessions = [];
  orgStore.updatedAt = nowIso();
  pushAudit(orgStore, eventId, "manual", `Temporary ${pass.role} sign-in revoked`, { passId: pass.id });
  await persistStore(store);
  res.json({ ok: true });
});

router.patch("/events/:eventId", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  const events = getStateEvents(orgStore);
  const idx = events.findIndex((item) => item.id === eventId);

  if (idx < 0) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Trivia event not found." } });
    return;
  }

  const current = events[idx];
  const patch = isObject(req.body) ? req.body : {};
  const nextEvent: JsonObject = {
    ...current,
    ...patch,
    id: eventId,
    teams: normalizeRosterTableNumbers(Array.isArray(patch.teams) ? patch.teams.filter(isObject) : Array.isArray(current.teams) ? current.teams.filter(isObject) : []),
    updatedAt: nowIso(),
  };
  events[idx] = nextEvent;
  setStateEvents(orgStore, events);
  orgStore.updatedAt = nowIso();
  pushAudit(orgStore, eventId, "status", "Event updated");
  await persistStore(store);
  res.json({ event: nextEvent });
});

router.get("/events/:eventId/live", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  res.json({ live: getLive(orgStore, String(req.params.eventId ?? "")) });
});

router.patch("/events/:eventId/live", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  const patch = isObject(req.body) ? req.body : {};
  const current = getLive(orgStore, eventId);
  const merged = { ...current, ...patch, updatedAt: nowIso() };
  setLive(orgStore, eventId, merged);
  orgStore.updatedAt = nowIso();
  pushAudit(orgStore, eventId, "manual", "Live state updated");
  await persistStore(store);
  res.json({ live: merged });
});

router.post("/events/:eventId/score-actions", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  const payload = isObject(req.body) ? req.body : {};
  const action = {
    id: `score-action-${randomUUID().slice(0, 12)}`,
    eventId,
    teamId: String(payload.teamId ?? ""),
    roundId: typeof payload.roundId === "string" ? payload.roundId : null,
    questionId: typeof payload.questionId === "string" ? payload.questionId : null,
    actionType: typeof payload.actionType === "string" ? payload.actionType : "manual",
    delta: Number.isFinite(payload.delta) ? Number(payload.delta) : 0,
    reason: typeof payload.reason === "string" ? payload.reason : "Manual score adjustment",
    previousScore: Number.isFinite(payload.previousScore) ? Number(payload.previousScore) : 0,
    newScore: Number.isFinite(payload.newScore) ? Number(payload.newScore) : 0,
    createdAt: nowIso(),
  };

  const history = getScoreHistory(orgStore, eventId);
  setScoreHistory(orgStore, eventId, [...history, action]);

  const live = getLive(orgStore, eventId);
  setLive(orgStore, eventId, {
    ...live,
    lastHostAction: action.reason,
    lastScoreActionAt: action.createdAt,
    lastScoreActionSummary: `${action.actionType} ${action.delta >= 0 ? `+${action.delta}` : action.delta} (${action.reason})`,
    updatedAt: nowIso(),
  });

  orgStore.updatedAt = nowIso();
  pushAudit(orgStore, eventId, "score", `Score action ${action.id}`, { teamId: String(action.teamId) });
  await persistStore(store);
  res.status(201).json({ action });
});

router.post("/events/:eventId/score-actions/:actionId/undo", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  const actionId = String(req.params.actionId ?? "");

  const history = getScoreHistory(orgStore, eventId);
  const next = history.filter((entry) => entry.id !== actionId);
  if (next.length === history.length) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Score action not found." } });
    return;
  }

  setScoreHistory(orgStore, eventId, next);
  orgStore.updatedAt = nowIso();
  pushAudit(orgStore, eventId, "score", `Undid score action ${actionId}`);
  await persistStore(store);
  res.json({ ok: true });
});

router.get("/events/:eventId/audit", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  res.json({ audit: orgStore.auditByEventId[eventId] ?? [] });
});

router.post("/events/:eventId/snapshot", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  const events = getStateEvents(orgStore);
  const event = events.find((item) => item.id === eventId);

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Trivia event not found." } });
    return;
  }

  const snapshot = {
    id: `snapshot-${randomUUID().slice(0, 12)}`,
    eventId,
    label: typeof req.body?.label === "string" && req.body.label.trim() ? req.body.label.trim() : "Manual snapshot",
    capturedAt: nowIso(),
    event: clone(event),
    live: clone(getLive(orgStore, eventId)),
    scoreHistory: clone(getScoreHistory(orgStore, eventId)),
  };

  const previous = orgStore.snapshotsByEventId[eventId] ?? [];
  orgStore.snapshotsByEventId[eventId] = [snapshot, ...previous].slice(0, 100);
  orgStore.updatedAt = nowIso();
  pushAudit(orgStore, eventId, "snapshot", `Snapshot created: ${snapshot.label}`, { snapshotId: snapshot.id });
  await persistStore(store);
  res.status(201).json({ snapshot });
});

router.get("/events/:eventId/snapshots", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  res.json({ snapshots: orgStore.snapshotsByEventId[eventId] ?? [] });
});

router.post("/events/:eventId/recover", async (req, res) => {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, resolveOrganizationId(req));
  const eventId = String(req.params.eventId ?? "");
  const snapshotId = String(req.body?.snapshotId ?? "").trim();

  if (!snapshotId) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "snapshotId is required." } });
    return;
  }

  const snapshots = orgStore.snapshotsByEventId[eventId] ?? [];
  const snapshot = snapshots.find((item) => item.id === snapshotId);
  if (!snapshot || !isObject(snapshot.event) || !isObject(snapshot.live) || !Array.isArray(snapshot.scoreHistory)) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Snapshot not found." } });
    return;
  }

  const events = getStateEvents(orgStore);
  const idx = events.findIndex((item) => item.id === eventId);
  if (idx >= 0) events[idx] = clone(snapshot.event as JsonObject);
  else events.unshift(clone(snapshot.event as JsonObject));
  setStateEvents(orgStore, events);
  setLive(orgStore, eventId, clone(snapshot.live as JsonObject));
  setScoreHistory(orgStore, eventId, clone(snapshot.scoreHistory as JsonObject[]));

  orgStore.updatedAt = nowIso();
  pushAudit(orgStore, eventId, "recover", `Recovered snapshot ${snapshotId}`, { snapshotId });
  await persistStore(store);
  res.json({ state: orgStore.state, recoveredSnapshotId: snapshotId });
});

export default router;
