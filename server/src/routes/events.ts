/**
 * Events routes.
 * Provides event management, ticket types, orders, guests, and dashboard metrics.
 *
 * @module routes/events
 */
import { Router, type Request } from "express";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { readPaymentGatewayPublicSettings, type PaymentGatewayPublicSettings } from "../services/payment-gateway-settings.js";
import type { EventGuestPaymentStatus, EventGuestRsvpStatus, Prisma } from "@prisma/client";

const router = Router();
const EVENTS_MANAGER_INTEGRATIONS_PLUGIN_KEY = "events-manager-integrations";
const EVENTS_PAGE_BUILDER_PLUGIN_KEY = "events-page-builder";
const MAX_SEATS_PER_PUBLIC_REGISTRATION = 50;
const MAX_CHECKIN_CODE_GENERATION_ATTEMPTS = 10;
const RESERVED_EVENT_PUBLIC_SLUGS = new Set([
  "api",
  "apps",
  "automations",
  "board",
  "campaigns",
  "communications",
  "compassion",
  "constituents",
  "contacts-manager",
  "custom-fields",
  "data-tools",
  "donations",
  "email-builder",
  "events",
  "features",
  "grants",
  "help",
  "help-content",
  "hrm",
  "icons",
  "letters-printables",
  "livecom",
  "login",
  "meetings",
  "modules",
  "offline",
  "ogentic",
  "password",
  "payments",
  "preferences",
  "quickbooks-sync",
  "reports",
  "settings",
  "setup",
  "steward-ai-workspace",
  "steward-paths",
  "steward-signals",
  "tasks",
  "unsubscribe",
  "volunteers",
  "watchdog",
  "webmaster",
  "workspace",
  "page-builder",
  "templates",
  "tickets",
  "guests",
  "tables",
  "hosts",
  "sponsors",
  "orders",
  "emails",
  "follow-up",
  "fundraising",
  "files",
  "check-in",
]);
const EMAIL_PROVIDER_PLUGIN_KEY = "email-provider";

type EmailProviderType = "standard_smtp" | "microsoft_365_smtp" | "microsoft_graph";

interface EventsManagerEmailProviderSnapshot {
  provider: EmailProviderType;
  graphConnected: boolean;
  microsoftMailbox: string;
  microsoftTenantConfigured: boolean;
  microsoftClientConfigured: boolean;
  smtpHostOverride: string;
  smtpPortOverride: number;
  smtpSecureOverride: boolean;
}

interface EventsManagerSmtpSnapshot {
  host: string;
  hostConfigured: boolean;
  port: number;
  secure: boolean;
  userConfigured: boolean;
  fromName: string;
  fromEmail: string;
}

interface EventsManagerIntegrationSourcePreview {
  paymentGateway: PaymentGatewayPublicSettings;
  emailProvider: EventsManagerEmailProviderSnapshot;
  smtp: EventsManagerSmtpSnapshot;
}

interface EventsManagerIntegrationSnapshot extends EventsManagerIntegrationSourcePreview {
  source: "donor_crm";
  importedAt: string;
  importedByUserId: string | null;
}

type EventPageBuilderStatus = "Draft" | "Published";

type StoredEventPageSectionId =
  | "hero"
  | "countdown"
  | "event-details"
  | "registration-form"
  | "table-host-signup"
  | "sponsorship-levels"
  | "donation-goal"
  | "donation-form"
  | "progress-meter"
  | "speaker-program"
  | "auction-preview"
  | "live-appeal"
  | "volunteer-callout"
  | "video"
  | "image-gallery"
  | "impact-story"
  | "cta-banner"
  | "documents"
  | "schedule"
  | "faq"
  | "map-location"
  | "sponsor-logos"
  | "share-buttons"
  | "footer";

interface StoredEventPageBuilderSection {
  id: StoredEventPageSectionId;
  enabled: boolean;
  lockToEventData: boolean;
  content?: {
    kicker?: string;
    title?: string;
    subtitle?: string;
    primaryButtonText?: string;
    primaryButtonLink?: string;
    secondaryButtonText?: string;
    secondaryButtonLink?: string;
    heading?: string;
    body?: string;
    buttonText?: string;
    buttonLink?: string;
    mediaUrl?: string;
    documentLabel?: string;
    documentUrl?: string;
  };
  design?: {
    backgroundType?: "image" | "color" | "video";
    backgroundImageUrl?: string;
    backgroundColor?: string;
    overlayOpacity?: number;
    showScrollIndicator?: boolean;
    accentColor?: string;
    textAlign?: "left" | "center";
    compact?: boolean;
  };
  advanced?: {
    anchorId?: string;
    customCssClass?: string;
  };
}

interface StoredEventPageBuilderEntry {
  pageSlug: string;
  status: EventPageBuilderStatus;
  lastPublishedAt: string | null;
  updatedAt: string;
  sections?: StoredEventPageBuilderSection[];
}

interface StoredEventPageBuilderConfig {
  events: Record<string, StoredEventPageBuilderEntry>;
}

function normalizeEmailProviderSnapshot(config: unknown): EventsManagerEmailProviderSnapshot {
  const raw = config && typeof config === "object" && !Array.isArray(config)
    ? (config as Record<string, unknown>)
    : {};
  const providerRaw = String(raw.provider ?? "standard_smtp").trim();
  const provider: EmailProviderType = providerRaw === "microsoft_365_smtp"
    ? "microsoft_365_smtp"
    : providerRaw === "microsoft_graph"
      ? "microsoft_graph"
      : "standard_smtp";

  const portCandidate = Number.parseInt(String(raw.smtpPortOverride ?? 587), 10);

  return {
    provider,
    graphConnected: Boolean(raw.graphConnected),
    microsoftMailbox: String(raw.microsoftMailbox ?? "").trim(),
    microsoftTenantConfigured: String(raw.microsoftTenantId ?? "").trim().length > 0,
    microsoftClientConfigured: String(raw.microsoftClientId ?? "").trim().length > 0,
    smtpHostOverride: String(raw.smtpHostOverride ?? "").trim(),
    smtpPortOverride: Number.isFinite(portCandidate) ? Math.min(Math.max(portCandidate, 1), 65535) : 587,
    smtpSecureOverride: Boolean(raw.smtpSecureOverride),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function slugifyEventPagePath(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function defaultEventPageSlug(eventName: string): string {
  const slug = slugifyEventPagePath(eventName);
  if (!slug) return "event-page";
  if (RESERVED_EVENT_PUBLIC_SLUGS.has(slug)) return `${slug}-event`;
  return slug;
}

function sanitizeEventPageSlug(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const slug = slugifyEventPagePath(value);
  if (!slug || slug.length > 120) return null;
  if (RESERVED_EVENT_PUBLIC_SLUGS.has(slug)) return null;
  return slug;
}

function normalizeEventPageStatus(value: unknown): EventPageBuilderStatus {
  return value === "Published" ? "Published" : "Draft";
}

const ALLOWED_EVENT_PAGE_SECTION_IDS = new Set<StoredEventPageSectionId>([
  "hero",
  "countdown",
  "event-details",
  "registration-form",
  "table-host-signup",
  "sponsorship-levels",
  "donation-goal",
  "donation-form",
  "progress-meter",
  "speaker-program",
  "auction-preview",
  "live-appeal",
  "volunteer-callout",
  "video",
  "image-gallery",
  "impact-story",
  "cta-banner",
  "documents",
  "schedule",
  "faq",
  "map-location",
  "sponsor-logos",
  "share-buttons",
  "footer",
]);

function safePageBuilderText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed || undefined;
}

function sanitizeEventPageBuilderSections(value: unknown): StoredEventPageBuilderSection[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const seen = new Set<StoredEventPageSectionId>();
  const sections: StoredEventPageBuilderSection[] = [];

  for (const rawSection of value) {
    if (!isRecord(rawSection)) continue;
    const id = String(rawSection.id ?? "").trim() as StoredEventPageSectionId;
    if (!ALLOWED_EVENT_PAGE_SECTION_IDS.has(id) || seen.has(id)) continue;
    seen.add(id);

    const rawContent = isRecord(rawSection.content) ? rawSection.content : {};
    const rawDesign = isRecord(rawSection.design) ? rawSection.design : {};
    const rawAdvanced = isRecord(rawSection.advanced) ? rawSection.advanced : {};
    const backgroundTypeRaw = String(rawDesign.backgroundType ?? "image");
    const overlayCandidate = Number(rawDesign.overlayOpacity ?? 62);
    const textAlignRaw = String(rawDesign.textAlign ?? "left");

    sections.push({
      id,
      enabled: rawSection.enabled !== false,
      lockToEventData: rawSection.lockToEventData !== false,
      content: {
        kicker: safePageBuilderText(rawContent.kicker, 120),
        title: safePageBuilderText(rawContent.title, 160),
        subtitle: safePageBuilderText(rawContent.subtitle, 160),
        primaryButtonText: safePageBuilderText(rawContent.primaryButtonText, 80),
        primaryButtonLink: safePageBuilderText(rawContent.primaryButtonLink, 240),
        secondaryButtonText: safePageBuilderText(rawContent.secondaryButtonText, 80),
        secondaryButtonLink: safePageBuilderText(rawContent.secondaryButtonLink, 240),
        heading: safePageBuilderText(rawContent.heading, 180),
        body: safePageBuilderText(rawContent.body, 2000),
        buttonText: safePageBuilderText(rawContent.buttonText, 80),
        buttonLink: safePageBuilderText(rawContent.buttonLink, 240),
        mediaUrl: safePageBuilderText(rawContent.mediaUrl, 800),
        documentLabel: safePageBuilderText(rawContent.documentLabel, 120),
        documentUrl: safePageBuilderText(rawContent.documentUrl, 800),
      },
      design: {
        backgroundType: backgroundTypeRaw === "color" || backgroundTypeRaw === "video" ? backgroundTypeRaw : "image",
        backgroundImageUrl: safePageBuilderText(rawDesign.backgroundImageUrl, 800),
        backgroundColor: safePageBuilderText(rawDesign.backgroundColor, 32),
        overlayOpacity: Number.isFinite(overlayCandidate) ? Math.min(90, Math.max(0, Math.round(overlayCandidate))) : 62,
        showScrollIndicator: rawDesign.showScrollIndicator !== false,
        accentColor: safePageBuilderText(rawDesign.accentColor, 32),
        textAlign: textAlignRaw === "center" ? "center" : "left",
        compact: Boolean(rawDesign.compact),
      },
      advanced: {
        anchorId: safePageBuilderText(rawAdvanced.anchorId, 80),
        customCssClass: safePageBuilderText(rawAdvanced.customCssClass, 160),
      },
    });
  }

  return sections.length > 0 ? sections : undefined;
}

function toIsoOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function sanitizeEventPageUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 500) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function extractEventPageSlugFromUrl(value: unknown): string | null {
  const sanitizedUrl = sanitizeEventPageUrl(value);
  if (!sanitizedUrl) return null;

  const parsed = new URL(sanitizedUrl);
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  if (segments[0] === "events" && segments[1]) {
    return sanitizeEventPageSlug(segments[1]);
  }

  return sanitizeEventPageSlug(segments[segments.length - 1]);
}

function normalizeAbsoluteOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return null;
  }
}

function resolveEventPageOrigin(req: Request): string {
  const configuredOrigin = normalizeAbsoluteOrigin(process.env.NEXT_PUBLIC_APP_URL ?? "")
    ?? normalizeAbsoluteOrigin(process.env.FRONTEND_ORIGIN ?? "");
  if (configuredOrigin) return configuredOrigin;

  const forwardedProto = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0]?.trim().toLowerCase();
  const forwardedHost = String(req.headers["x-forwarded-host"] ?? "").split(",")[0]?.trim();
  const host = forwardedHost || String(req.headers.host ?? "").trim();
  const protocol = forwardedProto === "https" || forwardedProto === "http"
    ? forwardedProto
    : (req.secure ? "https" : "http");

  if (host) {
    return `${protocol}://${host}`;
  }

  return "http://localhost:3000";
}

function buildEventPageUrl(origin: string, pageSlug: string): string {
  const normalizedOrigin = origin.replace(/\/$/, "");
  return `${normalizedOrigin}/${pageSlug}`;
}

function readStoredEventPageBuilderConfig(config: unknown): StoredEventPageBuilderConfig {
  if (!isRecord(config)) {
    return { events: {} };
  }

  const rawEvents = isRecord(config.events) ? config.events : {};
  const events: Record<string, StoredEventPageBuilderEntry> = {};

  for (const [eventId, rawValue] of Object.entries(rawEvents)) {
    if (!isRecord(rawValue)) continue;

    const pageSlug = sanitizeEventPageSlug(rawValue.pageSlug) ?? extractEventPageSlugFromUrl(rawValue.pageUrl);
    if (!pageSlug) continue;

    events[eventId] = {
      pageSlug,
      status: normalizeEventPageStatus(rawValue.status),
      lastPublishedAt: toIsoOrNull(rawValue.lastPublishedAt),
      updatedAt: toIsoOrNull(rawValue.updatedAt) ?? new Date().toISOString(),
      sections: sanitizeEventPageBuilderSections(rawValue.sections),
    };
  }

  return { events };
}

function findEventPageEntryBySlug(
  config: StoredEventPageBuilderConfig,
  pageSlug: string,
): { eventId: string; entry: StoredEventPageBuilderEntry } | null {
  for (const [eventId, entry] of Object.entries(config.events)) {
    if (entry.pageSlug === pageSlug) {
      return { eventId, entry };
    }
  }
  return null;
}

function readStoredIntegrationSnapshot(config: unknown): EventsManagerIntegrationSnapshot | null {
  if (!isRecord(config)) return null;
  const source = String(config.source ?? "").trim();
  if (source !== "donor_crm") return null;
  return config as unknown as EventsManagerIntegrationSnapshot;
}

interface PublicRegistrationAttendeeInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dietaryRestrictions?: string;
  specialNeeds?: string;
}

interface NormalizedPublicRegistrationAttendee {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dietaryRestrictions: string;
  specialNeeds: string;
}

function normalizeTextInput(value: unknown, maxLength = 120): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

function isValidPublicRegistrationEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function generatePublicOrderNumber(prefix = "PUB"): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

async function generateUniqueCheckinCode(tx: Prisma.TransactionClient = prisma): Promise<string> {
  for (let attempts = 0; attempts < MAX_CHECKIN_CODE_GENERATION_ATTEMPTS; attempts++) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const existing = await tx.eventGuest.findUnique({ where: { checkinCode: code } });
    if (!existing) return code;
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`.toUpperCase().slice(-10);
}

function parsePublicRegistrationAttendeeInput(value: Record<string, unknown>): PublicRegistrationAttendeeInput {
  return {
    firstName: typeof value.firstName === "string" ? value.firstName : undefined,
    lastName: typeof value.lastName === "string" ? value.lastName : undefined,
    email: typeof value.email === "string" ? value.email : undefined,
    phone: typeof value.phone === "string" ? value.phone : undefined,
    dietaryRestrictions: typeof value.dietaryRestrictions === "string" ? value.dietaryRestrictions : undefined,
    specialNeeds: typeof value.specialNeeds === "string" ? value.specialNeeds : undefined,
  };
}

function normalizePublicRegistrationAttendees(
  body: Record<string, unknown>,
  requestedSeats: number,
): NormalizedPublicRegistrationAttendee[] {
  const rawAttendees = Array.isArray(body.attendees) ? body.attendees : [];
  const sourceAttendees: PublicRegistrationAttendeeInput[] = rawAttendees.length > 0
    ? rawAttendees.filter(isRecord).map(parsePublicRegistrationAttendeeInput)
    : [parsePublicRegistrationAttendeeInput(body)];
  const sanitized = sourceAttendees.slice(0, requestedSeats).map((attendee) => ({
    firstName: normalizeTextInput(attendee.firstName, 80),
    lastName: normalizeTextInput(attendee.lastName, 80),
    email: normalizeTextInput(attendee.email, 160).toLowerCase(),
    phone: normalizeTextInput(attendee.phone, 40),
    dietaryRestrictions: normalizeTextInput(attendee.dietaryRestrictions, 500),
    specialNeeds: normalizeTextInput(attendee.specialNeeds, 500),
  }));

  return sanitized;
}

function hasRequiredPublicRegistrationBuyerFields(
  buyer: NormalizedPublicRegistrationAttendee | undefined,
): buyer is NormalizedPublicRegistrationAttendee {
  return Boolean(
    buyer?.firstName
    && buyer.lastName
    && buyer.email
    && isValidPublicRegistrationEmail(buyer.email),
  );
}

/** Builds placeholder names for extra seats when public table registrations omit each attendee's details. */
function createGuestNameFallback(index: number, partyName: string) {
  return {
    firstName: `Guest ${index + 1}`,
    lastName: partyName,
  };
}

/** GET /api/events/public/page/:pageSlug — Public event page payload resolved by configured slug. */
router.get("/public/page/:pageSlug", async (req, res) => {
  const pageSlug = sanitizeEventPageSlug(req.params.pageSlug);
  if (!pageSlug) {
    res.status(400).json({
      error: {
        code: "INVALID_SLUG",
        message: "Event page slug must contain letters, numbers, or hyphens and cannot use reserved application routes.",
      },
    });
    return;
  }

  const settingRows = await prisma.pluginSetting.findMany({
    where: {
      pluginKey: EVENTS_PAGE_BUILDER_PLUGIN_KEY,
      enabled: true,
    },
    select: {
      organizationId: true,
      config: true,
    },
  });

  const matches: Array<{ organizationId: string; eventId: string; status: EventPageBuilderStatus; sections?: StoredEventPageBuilderSection[] }> = [];
  for (const row of settingRows) {
    const config = readStoredEventPageBuilderConfig(row.config);
    const found = findEventPageEntryBySlug(config, pageSlug);
    if (!found) continue;
    matches.push({
      organizationId: row.organizationId,
      eventId: found.eventId,
      status: found.entry.status,
      sections: found.entry.sections,
    });
  }

  if (matches.length > 1) {
    res.status(409).json({
      error: {
        code: "SLUG_CONFLICT",
        message: "This slug is currently mapped to multiple event pages. Please use a unique slug.",
      },
    });
    return;
  }

  let match = matches[0] ?? null;

  if (!match) {
    const fallbackEvents = await prisma.event.findMany({
      where: {
        active: true,
        visibility: "PUBLIC",
      },
      select: {
        id: true,
        organizationId: true,
        name: true,
      },
    });

    const fallbackMatches = fallbackEvents.filter((event) => defaultEventPageSlug(event.name) === pageSlug);

    if (fallbackMatches.length > 1) {
      res.status(409).json({
        error: {
          code: "SLUG_CONFLICT",
          message: "This slug maps to multiple default event pages. Save a custom unique slug in Event Page Builder.",
        },
      });
      return;
    }

    if (fallbackMatches.length === 1) {
      match = {
        organizationId: fallbackMatches[0].organizationId,
        eventId: fallbackMatches[0].id,
        status: "Draft",
        sections: undefined,
      };
    }
  }

  if (!match) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Public event page not found." } });
    return;
  }

  if (match.status !== "Published") {
    res.status(404).json({ error: { code: "NOT_PUBLISHED", message: "This event page is not published." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: {
      id: match.eventId,
      organizationId: match.organizationId,
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      location: true,
      address: true,
      city: true,
      state: true,
      zip: true,
      virtualUrl: true,
      startDate: true,
      endDate: true,
      registrationDeadline: true,
      registrationGoal: true,
      revenueGoal: true,
      capacity: true,
      active: true,
    },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found." } });
    return;
  }

  const [ticketTypes, sponsors, attendanceTotal, checkedInTotal, orderAggregate, donationAggregate] = await Promise.all([
    prisma.ticketType.findMany({
      where: { eventId: event.id, active: true },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        capacity: true,
        available: true,
        isTable: true,
        seatsIncluded: true,
      },
      orderBy: [{ isTable: "desc" }, { price: "asc" }],
    }),
    prisma.eventSponsor.findMany({
      where: { eventId: event.id },
      select: {
        id: true,
        level: true,
        amount: true,
        logoUrl: true,
        websiteUrl: true,
        constituent: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { amount: "desc" },
      take: 24,
    }),
    prisma.eventGuest.count({ where: { eventId: event.id } }),
    prisma.eventGuest.count({ where: { eventId: event.id, checkedIn: true } }),
    prisma.eventOrder.aggregate({
      where: {
        eventId: event.id,
        status: "CONFIRMED",
      },
      _sum: { totalAmount: true },
      _count: { id: true },
    }),
    prisma.donation.aggregate({
      where: {
        eventId: event.id,
        status: "COMPLETED",
      },
      _sum: { amount: true },
      _count: { id: true },
    }),
  ]);

  const revenueFromOrders = Number(orderAggregate._sum.totalAmount ?? 0);
  const revenueFromDonations = Number(donationAggregate._sum.amount ?? 0);
  const totalRevenue = revenueFromOrders + revenueFromDonations;
  const revenueGoal = event.revenueGoal == null ? null : Number(event.revenueGoal);
  const attendanceRate = attendanceTotal > 0 ? Math.round((checkedInTotal / attendanceTotal) * 100) : 0;
  const revenueProgress = revenueGoal && revenueGoal > 0
    ? Math.min(100, Math.round((totalRevenue / revenueGoal) * 100))
    : null;

  const origin = resolveEventPageOrigin(req);

  res.json({
    event: {
      ...event,
      revenueGoal,
    },
    ticketTypes,
    sponsors,
    report: {
      attendance: {
        total: attendanceTotal,
        checkedIn: checkedInTotal,
        noShows: Math.max(attendanceTotal - checkedInTotal, 0),
        attendanceRate,
        goal: event.registrationGoal ?? null,
        progress: event.registrationGoal && event.registrationGoal > 0
          ? Math.min(100, Math.round((attendanceTotal / event.registrationGoal) * 100))
          : null,
      },
      revenue: {
        total: totalRevenue,
        fromOrders: revenueFromOrders,
        fromDonations: revenueFromDonations,
        orderCount: Number(orderAggregate._count.id ?? 0),
        donationCount: Number(donationAggregate._count.id ?? 0),
        goal: revenueGoal,
        progress: revenueProgress,
      },
    },
    pageSlug,
    pageUrl: buildEventPageUrl(origin, pageSlug),
    status: match.status,
    sections: match.sections ?? null,
  });
});

/** POST /api/events/public/page/:pageSlug/register — Public self-registration for a published event page. */
router.post("/public/page/:pageSlug/register", async (req, res) => {
  const pageSlug = sanitizeEventPageSlug(req.params.pageSlug);
  if (!pageSlug) {
    res.status(400).json({
      error: {
        code: "INVALID_SLUG",
        message: "Event page slug must contain letters, numbers, or hyphens and cannot use reserved application routes.",
      },
    });
    return;
  }

  const settingRows = await prisma.pluginSetting.findMany({
    where: {
      pluginKey: EVENTS_PAGE_BUILDER_PLUGIN_KEY,
      enabled: true,
    },
    select: {
      organizationId: true,
      config: true,
    },
  });

  const matches: Array<{ organizationId: string; eventId: string; status: EventPageBuilderStatus }> = [];
  for (const row of settingRows) {
    const config = readStoredEventPageBuilderConfig(row.config);
    const found = findEventPageEntryBySlug(config, pageSlug);
    if (!found) continue;
    matches.push({
      organizationId: row.organizationId,
      eventId: found.eventId,
      status: found.entry.status,
    });
  }

  if (matches.length > 1) {
    res.status(409).json({
      error: {
        code: "SLUG_CONFLICT",
        message: "This slug is currently mapped to multiple event pages. Please use a unique slug.",
      },
    });
    return;
  }

  const match = matches[0] ?? null;
  if (!match) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Public event page not found." } });
    return;
  }

  if (match.status !== "Published") {
    res.status(404).json({ error: { code: "NOT_PUBLISHED", message: "This event page is not published." } });
    return;
  }

  const body = isRecord(req.body) ? req.body : {};
  const ticketTypeId = normalizeTextInput(body.ticketTypeId, 120);
  const requestedTicketUnits = Math.max(1, Math.min(10, Number(body.quantity ?? 1) || 1));
  const consentAccepted = body.consentAccepted === true;

  if (!ticketTypeId) {
    res.status(400).json({ error: { code: "INVALID_INPUT", message: "A ticket type is required." } });
    return;
  }

  if (!consentAccepted) {
    res.status(400).json({ error: { code: "CONSENT_REQUIRED", message: "Registration consent is required." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: {
      id: match.eventId,
      organizationId: match.organizationId,
      active: true,
      visibility: "PUBLIC",
    },
    select: {
      id: true,
      organizationId: true,
      name: true,
      startDate: true,
      registrationDeadline: true,
      capacity: true,
    },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found." } });
    return;
  }

  if (event.registrationDeadline && event.registrationDeadline.getTime() < Date.now()) {
    res.status(409).json({ error: { code: "REGISTRATION_CLOSED", message: "Registration is closed for this event." } });
    return;
  }

  const ticketType = await prisma.ticketType.findFirst({
    where: {
      id: ticketTypeId,
      eventId: event.id,
      active: true,
    },
    select: {
      id: true,
      name: true,
      price: true,
      capacity: true,
      isTable: true,
      seatsIncluded: true,
      minPerOrder: true,
      maxPerOrder: true,
    },
  });

  if (!ticketType) {
    res.status(404).json({ error: { code: "TICKET_NOT_FOUND", message: "Ticket type not found." } });
    return;
  }

  const maxPerOrder = ticketType.maxPerOrder ?? 10;
  const ticketUnits = Math.max(ticketType.minPerOrder, Math.min(maxPerOrder, requestedTicketUnits));
  const seatsPerTicket = ticketType.isTable ? Math.max(1, ticketType.seatsIncluded ?? 1) : 1;
  const requestedSeats = Math.min(MAX_SEATS_PER_PUBLIC_REGISTRATION, ticketUnits * seatsPerTicket);
  const attendees = normalizePublicRegistrationAttendees(body, requestedSeats);
  const buyer = attendees[0];

  if (!hasRequiredPublicRegistrationBuyerFields(buyer)) {
    res.status(400).json({
      error: {
        code: "INVALID_ATTENDEE",
        message: "First name, last name, and a valid email are required for the primary registrant.",
      },
    });
    return;
  }

  const [eventGuestCount, ticketGuestCount] = await Promise.all([
    prisma.eventGuest.count({ where: { eventId: event.id } }),
    prisma.eventGuest.count({ where: { eventId: event.id, ticketTypeId: ticketType.id } }),
  ]);

  if (event.capacity != null && event.capacity > 0 && eventGuestCount + requestedSeats > event.capacity) {
    res.status(409).json({ error: { code: "EVENT_CAPACITY_REACHED", message: "Not enough event capacity remains for this registration." } });
    return;
  }

  if (ticketType.capacity != null && ticketType.capacity > 0 && ticketGuestCount + requestedSeats > ticketType.capacity) {
    res.status(409).json({ error: { code: "TICKET_CAPACITY_REACHED", message: "Not enough ticket capacity remains for this registration." } });
    return;
  }

  const unitPrice = Number(ticketType.price ?? 0);
  const totalAmount = unitPrice * ticketUnits;
  const paymentStatus: EventGuestPaymentStatus = totalAmount > 0 ? "DUE" : "COMP";
  const orderStatus = totalAmount > 0 ? "PENDING" : "CONFIRMED";
  const orderNumber = generatePublicOrderNumber();
  const partyName = `${buyer.firstName} ${buyer.lastName}`.trim();

  const result = await prisma.$transaction(async (tx: typeof prisma) => {
    const existingConstituent = await tx.constituent.findFirst({
      where: {
        organizationId: event.organizationId,
        email: buyer.email,
      },
      orderBy: { createdAt: "asc" },
    });

    const constituent = existingConstituent
      ? await tx.constituent.update({
        where: { id: existingConstituent.id },
        data: {
          firstName: buyer.firstName,
          lastName: buyer.lastName,
          phone: buyer.phone || existingConstituent.phone || undefined,
        },
      })
      : await tx.constituent.create({
        data: {
          organizationId: event.organizationId,
          firstName: buyer.firstName,
          lastName: buyer.lastName,
          email: buyer.email,
          phone: buyer.phone || undefined,
          notes: `Created from public event registration for ${event.name}.`,
        },
      });

    const order = await tx.eventOrder.create({
      data: {
        eventId: event.id,
        constituentId: constituent.id,
        orderNumber,
        status: orderStatus,
        totalAmount,
        feeAmount: 0,
        paymentMethod: "ONLINE",
        paidAt: totalAmount === 0 ? new Date() : undefined,
        notes: "Public event page registration.",
        items: {
          create: [{
            ticketTypeId: ticketType.id,
            quantity: ticketUnits,
            unitPrice,
            totalPrice: totalAmount,
          }],
        },
      },
      include: {
        items: { include: { ticketType: true } },
      },
    });

    const guests = [];
    for (let index = 0; index < requestedSeats; index++) {
      const attendee = attendees[index] ?? {};
      const fallbackName = createGuestNameFallback(index, partyName);
      const checkinCode = await generateUniqueCheckinCode(tx);
      guests.push(await tx.eventGuest.create({
        data: {
          eventId: event.id,
          orderId: order.id,
          constituentId: index === 0 ? constituent.id : undefined,
          ticketTypeId: ticketType.id,
          firstName: attendee.firstName || (index === 0 ? buyer.firstName : fallbackName.firstName),
          lastName: attendee.lastName || (index === 0 ? buyer.lastName : fallbackName.lastName),
          email: attendee.email || (index === 0 ? buyer.email : undefined),
          phone: attendee.phone || undefined,
          checkinCode,
          paymentStatus,
          rsvpStatus: "CONFIRMED",
          partyName,
          dietaryRestrictions: attendee.dietaryRestrictions || undefined,
          specialNeeds: attendee.specialNeeds || undefined,
          notes: "Registered from public event page.",
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          checkinCode: true,
          paymentStatus: true,
          rsvpStatus: true,
        },
      }));
    }

    await tx.activity.create({
      data: {
        constituentId: constituent.id,
        eventId: event.id,
        type: "EVENT_REGISTRATION",
        description: `Registered for event: ${event.name} via public event page (${ticketUnits} ticket${ticketUnits === 1 ? "" : "s"}, ${requestedSeats} seat${requestedSeats === 1 ? "" : "s"}).`,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber,
          source: "api/events:public-page-register",
          pageSlug,
          ticketTypeId: ticketType.id,
          ticketUnits,
          requestedSeats,
        },
      },
    });

    return { order, guests };
  });

  res.status(201).json({
    order: {
      id: result.order.id,
      orderNumber: result.order.orderNumber,
      status: result.order.status,
      totalAmount: Number(result.order.totalAmount),
      ticketType: {
        id: ticketType.id,
        name: ticketType.name,
      },
    },
    guests: result.guests,
    message: totalAmount > 0
      ? "Registration saved. Payment collection is not connected yet, so staff will follow up."
      : "Registration confirmed.",
  });
});

async function buildEventsManagerIntegrationSourcePreview(
  organizationId: string,
): Promise<EventsManagerIntegrationSourcePreview> {
  const [paymentGateway, emailProviderSetting, organizationSettings] = await Promise.all([
    readPaymentGatewayPublicSettings(organizationId),
    prisma.pluginSetting.findUnique({
      where: {
        organizationId_pluginKey: {
          organizationId,
          pluginKey: EMAIL_PROVIDER_PLUGIN_KEY,
        },
      },
      select: { config: true },
    }),
    prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: {
        smtpHost: true,
        smtpPort: true,
        smtpSecure: true,
        smtpUser: true,
        smtpFromName: true,
        smtpFromEmail: true,
      },
    }),
  ]);

  const smtpHost = String(organizationSettings?.smtpHost ?? "").trim();
  const smtpPort = organizationSettings?.smtpPort ?? 587;

  return {
    paymentGateway,
    emailProvider: normalizeEmailProviderSnapshot(emailProviderSetting?.config),
    smtp: {
      host: smtpHost,
      hostConfigured: smtpHost.length > 0,
      port: smtpPort,
      secure: Boolean(organizationSettings?.smtpSecure),
      userConfigured: String(organizationSettings?.smtpUser ?? "").trim().length > 0,
      fromName: String(organizationSettings?.smtpFromName ?? "").trim(),
      fromEmail: String(organizationSettings?.smtpFromEmail ?? "").trim(),
    },
  };
}

// All event routes require authentication.
router.use(requireAuth);

// Event operations are mapped to view/edit permissions; deletes are treated as edit actions.
router.use((req, res, next) => {
  if (req.method === "GET") {
    return requirePermission("view:events")(req, res, next);
  }
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH" || req.method === "DELETE") {
    return requirePermission("edit:events")(req, res, next);
  }
  return next();
});

/**
 * GET /api/events/manager-integrations
 * Admin-only view of current DonorCRM payment/email source settings and latest imported snapshot.
 */
router.get("/manager-integrations", requireRole("admin"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  try {
    const [sourcePreview, snapshotSetting] = await Promise.all([
      buildEventsManagerIntegrationSourcePreview(organizationId),
      prisma.pluginSetting.findUnique({
        where: {
          organizationId_pluginKey: {
            organizationId,
            pluginKey: EVENTS_MANAGER_INTEGRATIONS_PLUGIN_KEY,
          },
        },
        select: { config: true, updatedAt: true },
      }),
    ]);

    const importedSnapshot = readStoredIntegrationSnapshot(snapshotSetting?.config);

    res.json({
      sourcePreview,
      importedSnapshot,
      lastImportedAt: importedSnapshot?.importedAt ?? null,
      snapshotUpdatedAt: snapshotSetting?.updatedAt ?? null,
    });
  } catch (error) {
    console.error("[Events] manager-integrations GET failed:", error);
    res.status(500).json({
      error: {
        code: "EVENT_MANAGER_INTEGRATIONS_READ_FAILED",
        message: "Failed to load Events manager integration settings.",
      },
    });
  }
});

/**
 * POST /api/events/manager-integrations/import
 * Admin-only import snapshot from DonorCRM payment/email settings into Events manager context.
 */
router.post("/manager-integrations/import", requireRole("admin"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  try {
    const sourcePreview = await buildEventsManagerIntegrationSourcePreview(organizationId);
    const snapshot: EventsManagerIntegrationSnapshot = {
      source: "donor_crm",
      importedAt: new Date().toISOString(),
      importedByUserId: req.user?.sub ?? null,
      ...sourcePreview,
    };

    await prisma.pluginSetting.upsert({
      where: {
        organizationId_pluginKey: {
          organizationId,
          pluginKey: EVENTS_MANAGER_INTEGRATIONS_PLUGIN_KEY,
        },
      },
      create: {
        organizationId,
        pluginKey: EVENTS_MANAGER_INTEGRATIONS_PLUGIN_KEY,
        enabled: true,
        config: snapshot as unknown as Prisma.InputJsonValue,
      },
      update: {
        enabled: true,
        config: snapshot as unknown as Prisma.InputJsonValue,
      },
    });

    await logAudit({
      action: "EVENTS_MANAGER_INTEGRATIONS_IMPORTED",
      entity: "PluginSetting",
      entityId: organizationId,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        paymentCurrency: snapshot.paymentGateway.currency,
        stripeEnabled: snapshot.paymentGateway.stripe.enabled,
        paypalEnabled: snapshot.paymentGateway.paypal.enabled,
        emailProvider: snapshot.emailProvider.provider,
        graphConnected: snapshot.emailProvider.graphConnected,
        smtpHostConfigured: snapshot.smtp.hostConfigured,
        smtpUserConfigured: snapshot.smtp.userConfigured,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ importedSnapshot: snapshot });
  } catch (error) {
    console.error("[Events] manager-integrations import failed:", error);
    res.status(500).json({
      error: {
        code: "EVENT_MANAGER_INTEGRATIONS_IMPORT_FAILED",
        message: "Failed to import DonorCRM integration settings into Events manager.",
      },
    });
  }
});

/** GET /api/events/:eventId/page-builder-config — Event page URL and publish metadata for one scoped event. */
router.get("/:eventId/page-builder-config", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
    select: { id: true, name: true },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const setting = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: EVENTS_PAGE_BUILDER_PLUGIN_KEY,
      },
    },
    select: { config: true },
  });

  const config = readStoredEventPageBuilderConfig(setting?.config);
  const entry = config.events[event.id];
  const baseOrigin = resolveEventPageOrigin(req);
  const pageSlug = entry?.pageSlug ?? defaultEventPageSlug(event.name);

  res.json({
    eventId: event.id,
    pageSlug,
    pageUrl: buildEventPageUrl(baseOrigin, pageSlug),
    baseOrigin,
    status: entry?.status ?? "Draft",
    lastPublishedAt: entry?.lastPublishedAt ?? null,
    sections: entry?.sections ?? null,
  });
});

/** PATCH /api/events/:eventId/page-builder-config — Persist event page URL and publish metadata for one scoped event. */
router.patch("/:eventId/page-builder-config", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
    select: { id: true, name: true },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const setting = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: EVENTS_PAGE_BUILDER_PLUGIN_KEY,
      },
    },
    select: { config: true },
  });

  const config = readStoredEventPageBuilderConfig(setting?.config);
  const previous = config.events[event.id];
  const baseOrigin = resolveEventPageOrigin(req);

  let nextPageSlug: string;
  if (req.body.pageSlug === undefined && req.body.pageUrl === undefined) {
    nextPageSlug = previous?.pageSlug ?? defaultEventPageSlug(event.name);
  } else if (req.body.pageSlug !== undefined) {
    const sanitizedSlug = sanitizeEventPageSlug(req.body.pageSlug);
    if (!sanitizedSlug) {
      res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: "pageSlug must contain letters, numbers, or hyphens and cannot use reserved application routes.",
        },
      });
      return;
    }
    nextPageSlug = sanitizedSlug;
  } else {
    const extractedLegacySlug = extractEventPageSlugFromUrl(req.body.pageUrl);
    if (!extractedLegacySlug) {
      res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: "pageUrl must be a valid absolute http(s) URL containing a slug path.",
        },
      });
      return;
    }
    nextPageSlug = extractedLegacySlug;
  }

  const allPageBuilderSettings = await prisma.pluginSetting.findMany({
    where: {
      pluginKey: EVENTS_PAGE_BUILDER_PLUGIN_KEY,
      enabled: true,
    },
    select: {
      organizationId: true,
      config: true,
    },
  });

  let slugConflict: { organizationId: string; eventId: string } | null = null;
  for (const row of allPageBuilderSettings) {
    const rowConfig = readStoredEventPageBuilderConfig(row.config);
    for (const [otherEventId, otherEntry] of Object.entries(rowConfig.events)) {
      if (otherEntry.pageSlug !== nextPageSlug) continue;
      const isSameEvent = row.organizationId === organizationId && otherEventId === event.id;
      if (isSameEvent) continue;

      slugConflict = {
        organizationId: row.organizationId,
        eventId: otherEventId,
      };
      break;
    }
    if (slugConflict) break;
  }

  if (slugConflict) {
    res.status(409).json({
      error: {
        code: "SLUG_CONFLICT",
        message: "pageSlug is already used by another event page. Choose a different slug.",
      },
    });
    return;
  }

  const nextStatus = req.body.status === undefined
    ? (previous?.status ?? "Draft")
    : normalizeEventPageStatus(req.body.status);

  const nextLastPublishedAt = req.body.lastPublishedAt === undefined
    ? (previous?.lastPublishedAt ?? null)
    : req.body.lastPublishedAt === null
      ? null
      : toIsoOrNull(req.body.lastPublishedAt);

  const nextSections = req.body.sections === undefined
    ? previous?.sections
    : sanitizeEventPageBuilderSections(req.body.sections);

  if (req.body.lastPublishedAt !== undefined && req.body.lastPublishedAt !== null && !nextLastPublishedAt) {
    res.status(400).json({
      error: {
        code: "INVALID_INPUT",
        message: "lastPublishedAt must be an ISO timestamp or null.",
      },
    });
    return;
  }

  const entry: StoredEventPageBuilderEntry = {
    pageSlug: nextPageSlug,
    status: nextStatus,
    lastPublishedAt: nextLastPublishedAt,
    updatedAt: new Date().toISOString(),
    sections: nextSections,
  };

  const nextConfig: StoredEventPageBuilderConfig = {
    events: {
      ...config.events,
      [event.id]: entry,
    },
  };

  await prisma.pluginSetting.upsert({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: EVENTS_PAGE_BUILDER_PLUGIN_KEY,
      },
    },
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

  await logAudit({
    action: "EVENT_PAGE_BUILDER_CONFIG_UPDATED",
    entity: "Event",
    entityId: event.id,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      pageSlug: entry.pageSlug,
      pageUrl: buildEventPageUrl(baseOrigin, entry.pageSlug),
      status: entry.status,
      lastPublishedAt: entry.lastPublishedAt,
      sectionCount: entry.sections?.length ?? 0,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({
    eventId: event.id,
    pageSlug: entry.pageSlug,
    pageUrl: buildEventPageUrl(baseOrigin, entry.pageSlug),
    baseOrigin,
    status: entry.status,
    lastPublishedAt: entry.lastPublishedAt,
    sections: entry.sections ?? null,
  });
});

/** GET /api/events/dashboard-summary — high-level command-center metrics for Events CRM. */
router.get("/dashboard-summary", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({
      totalEvents: 0,
      activeEvents: 0,
      upcomingEvents: 0,
      registeredGuests: 0,
      checkedInGuests: 0,
      totalRevenue: 0,
      openSeats: 0,
      volunteerHours: 0,
    });
    return;
  }

  const now = new Date();
  const [
    events,
    guestAggregate,
    checkedInGuests,
    orderAggregate,
    volunteerHoursAgg,
  ] = await Promise.all([
    prisma.event.findMany({
      where: { organizationId },
      select: {
        id: true,
        active: true,
        startDate: true,
        registrationGoal: true,
        capacity: true,
        _count: { select: { guests: true } },
      },
    }),
    prisma.eventGuest.aggregate({
      where: { event: { organizationId } },
      _count: { id: true },
    }),
    prisma.eventGuest.count({
      where: { event: { organizationId }, checkedIn: true },
    }),
    prisma.eventOrder.aggregate({
      where: { event: { organizationId }, status: "CONFIRMED" },
      _sum: { totalAmount: true },
    }),
    prisma.volunteerHour.aggregate({
      where: { event: { organizationId } },
      _sum: { hours: true },
    }),
  ]);

  const activeEvents = events.filter((event) => event.active).length;
  const upcomingEvents = events.filter((event) => event.startDate >= now).length;
  const openSeats = events.reduce((sum, event) => {
    const capacity = event.capacity ?? event.registrationGoal ?? 0;
    const registered = event._count.guests;
    return sum + Math.max(0, capacity - registered);
  }, 0);

  res.json({
    totalEvents: events.length,
    activeEvents,
    upcomingEvents,
    registeredGuests: guestAggregate._count.id,
    checkedInGuests,
    totalRevenue: Number(orderAggregate._sum.totalAmount ?? 0),
    openSeats,
    volunteerHours: Number(volunteerHoursAgg._sum.hours ?? 0),
  });
});

/** GET /api/events — List all events with guest and order counts. */
router.get("/", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const events = await prisma.event.findMany({
    where: { organizationId },
    include: {
      _count: {
        select: {
          guests: true,
          orders: true,
          ticketTypes: true,
          attendances: true,
          volunteerHours: true,
        },
      },
    },
    orderBy: { startDate: "desc" },
  });
  res.json(events);
});

/** GET /api/events/:id — Get event detail with full relations. */
router.get("/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.id, organizationId },
    include: {
      ticketTypes: { orderBy: { sortOrder: "asc" } },
      _count: {
        select: {
          guests: true,
          orders: true,
          sponsors: true,
          tables: true,
          volunteerHours: true,
        },
      },
    },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  res.json(event);
});

/** POST /api/events — Create a new event record. */
router.post("/", async (req, res) => {
  const {
    name,
    description,
    type,
    status,
    visibility,
    location,
    address,
    city,
    state,
    zip,
    virtualUrl,
    startDate,
    endDate,
    registrationDeadline,
    capacity,
    registrationGoal,
    revenueGoal,
    ownerId,
    internalNotes,
    active,
  } = req.body;

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const event = await prisma.event.create({
    data: {
      organizationId,
      name,
      description: description ?? undefined,
      type: type ?? "OTHER",
      status: status ?? "DRAFT",
      visibility: visibility ?? "PUBLIC",
      location: location ?? undefined,
      address: address ?? undefined,
      city: city ?? undefined,
      state: state ?? undefined,
      zip: zip ?? undefined,
      virtualUrl: virtualUrl ?? undefined,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : undefined,
      capacity: capacity ?? undefined,
      registrationGoal: registrationGoal ?? undefined,
      revenueGoal: revenueGoal ?? undefined,
      ownerId: ownerId ?? undefined,
      internalNotes: internalNotes ?? undefined,
      active: active ?? true,
    },
    include: {
      _count: {
        select: {
          guests: true,
          orders: true,
          ticketTypes: true,
          attendances: true,
          volunteerHours: true,
        },
      },
    },
  });

  res.status(201).json(event);
});

/** PATCH /api/events/:id — Update event details. */
router.patch("/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const existing = await prisma.event.findFirst({
    where: { id: req.params.id, organizationId },
    select: { id: true },
  });

  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const {
    name,
    description,
    type,
    status,
    visibility,
    location,
    address,
    city,
    state,
    zip,
    virtualUrl,
    startDate,
    endDate,
    registrationDeadline,
    capacity,
    registrationGoal,
    revenueGoal,
    ownerId,
    internalNotes,
    active,
  } = req.body;

  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(type !== undefined && { type }),
      ...(status !== undefined && { status }),
      ...(visibility !== undefined && { visibility }),
      ...(location !== undefined && { location }),
      ...(address !== undefined && { address }),
      ...(city !== undefined && { city }),
      ...(state !== undefined && { state }),
      ...(zip !== undefined && { zip }),
      ...(virtualUrl !== undefined && { virtualUrl }),
      ...(startDate !== undefined && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(registrationDeadline !== undefined && { registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null }),
      ...(capacity !== undefined && { capacity }),
      ...(registrationGoal !== undefined && { registrationGoal }),
      ...(revenueGoal !== undefined && { revenueGoal }),
      ...(ownerId !== undefined && { ownerId }),
      ...(internalNotes !== undefined && { internalNotes }),
      ...(active !== undefined && { active }),
    },
    include: {
      _count: {
        select: {
          guests: true,
          orders: true,
          ticketTypes: true,
          attendances: true,
          volunteerHours: true,
        },
      },
    },
  });

  res.json(event);
});

/** DELETE /api/events/:id — Delete an event (soft delete via active flag or hard delete if no orders). */
router.delete("/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.id, organizationId },
    include: { _count: { select: { orders: true, guests: true } } },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  // If event has orders or guests, soft delete by marking inactive
  if (event._count.orders > 0 || event._count.guests > 0) {
    await prisma.event.update({
      where: { id: req.params.id },
      data: { active: false, status: "CANCELLED" },
    });
    res.json({ message: "Event marked inactive", soft: true });
  } else {
    // Hard delete if no related data
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ message: "Event deleted", soft: false });
  }
});

// ─── Ticket Types ────────────────────────────────────────────────────────────

/** GET /api/events/:eventId/ticket-types — List ticket types for an event. */
router.get("/:eventId/ticket-types", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const ticketTypes = await prisma.ticketType.findMany({
    where: { eventId: req.params.eventId },
    include: { _count: { select: { orderItems: true, guests: true } } },
    orderBy: { sortOrder: "asc" },
  });

  res.json(ticketTypes);
});

/** POST /api/events/:eventId/ticket-types — Create a new ticket type for an event. */
router.post("/:eventId/ticket-types", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const { name, description, price, capacity, available, sortOrder, active, isTable, seatsIncluded, minPerOrder, maxPerOrder } = req.body;

  const ticketType = await prisma.ticketType.create({
    data: {
      eventId: req.params.eventId,
      name,
      description: description ?? undefined,
      price,
      capacity: capacity ?? undefined,
      available: available ?? capacity ?? undefined,
      sortOrder: sortOrder ?? 0,
      active: active ?? true,
      isTable: isTable ?? false,
      seatsIncluded: seatsIncluded ?? 1,
      minPerOrder: minPerOrder ?? 1,
      maxPerOrder: maxPerOrder ?? undefined,
    },
    include: { _count: { select: { orderItems: true, guests: true } } },
  });

  res.status(201).json(ticketType);
});

/** PATCH /api/events/:eventId/ticket-types/:id — Update a ticket type. */
router.patch("/:eventId/ticket-types/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const { name, description, price, capacity, available, sortOrder, active, isTable, seatsIncluded, minPerOrder, maxPerOrder } = req.body;

  const ticketType = await prisma.ticketType.update({
    where: { id: req.params.id, eventId: req.params.eventId },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(price !== undefined && { price }),
      ...(capacity !== undefined && { capacity }),
      ...(available !== undefined && { available }),
      ...(sortOrder !== undefined && { sortOrder }),
      ...(active !== undefined && { active }),
      ...(isTable !== undefined && { isTable }),
      ...(seatsIncluded !== undefined && { seatsIncluded }),
      ...(minPerOrder !== undefined && { minPerOrder }),
      ...(maxPerOrder !== undefined && { maxPerOrder }),
    },
    include: { _count: { select: { orderItems: true, guests: true } } },
  });

  res.json(ticketType);
});

/** DELETE /api/events/:eventId/ticket-types/:id — Delete a ticket type. */
router.delete("/:eventId/ticket-types/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const ticketType = await prisma.ticketType.findFirst({
    where: { id: req.params.id, eventId: req.params.eventId },
    include: { _count: { select: { orderItems: true, guests: true } } },
  });

  if (!ticketType) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Ticket type not found" } });
    return;
  }

  // If ticket type has orders or guests, soft delete by marking inactive
  if (ticketType._count.orderItems > 0 || ticketType._count.guests > 0) {
    await prisma.ticketType.update({
      where: { id: req.params.id },
      data: { active: false },
    });
    res.json({ message: "Ticket type marked inactive", soft: true });
  } else {
    // Hard delete if no related data
    await prisma.ticketType.delete({ where: { id: req.params.id } });
    res.json({ message: "Ticket type deleted", soft: false });
  }
});

// ─── Event Orders ────────────────────────────────────────────────────────────

/** GET /api/events/orders — List all orders across all events with filters. */
router.get("/orders", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const { eventId, status, search } = req.query;

  // Build where clause dynamically for flexibility
  const whereConditions: Prisma.EventOrderWhereInput = { event: { organizationId } };
  if (eventId) {
    whereConditions.eventId = eventId as string;
  }
  if (status) {
    whereConditions.status = status as Prisma.EnumOrderStatusFilter<"EventOrder">;
  }
  if (search) {
    const searchStr = search as string;
    whereConditions.OR = [
      { orderNumber: { contains: searchStr } },
      { constituent: { firstName: { contains: searchStr } } },
      { constituent: { lastName: { contains: searchStr } } },
      { constituent: { email: { contains: searchStr } } },
    ];
  }

  const orders = await prisma.eventOrder.findMany({
    where: whereConditions,
    include: {
      event: { select: { id: true, name: true, startDate: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      items: { include: { ticketType: true } },
      _count: { select: { guests: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(orders);
});

/** GET /api/events/:eventId/orders — List orders for a specific event. */
router.get("/:eventId/orders", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const orders = await prisma.eventOrder.findMany({
    where: { eventId: req.params.eventId },
    include: {
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      items: { include: { ticketType: true } },
      _count: { select: { guests: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(orders);
});

/** POST /api/events/:eventId/orders — Create a new manual order for an event. */
router.post("/:eventId/orders", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const { constituentId, items, paymentMethod, status, notes, paidAt } = req.body;

  if (!constituentId || !items || items.length === 0) {
    res.status(400).json({ error: { code: "INVALID_INPUT", message: "constituentId and items are required" } });
    return;
  }

  // Generate unique order number
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  const orderNumber = `ORD-${timestamp}-${random}`;

  interface OrderItemInput {
    ticketTypeId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }

  // Calculate totals
  const totalAmount = items.reduce((sum: number, item: OrderItemInput) => sum + Number(item.totalPrice), 0);

  const order = await prisma.eventOrder.create({
    data: {
      eventId: req.params.eventId,
      constituentId,
      orderNumber,
      status: status ?? "PENDING",
      totalAmount,
      feeAmount: 0,
      paymentMethod: paymentMethod ?? undefined,
      paidAt: paidAt ? new Date(paidAt) : undefined,
      notes: notes ?? undefined,
      items: {
        create: items.map((item: OrderItemInput) => ({
          ticketTypeId: item.ticketTypeId,
          quantity: item.quantity ?? 1,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
      },
    },
    include: {
      event: { select: { id: true, name: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      items: { include: { ticketType: true } },
      _count: { select: { guests: true } },
    },
  });

  // Log activity for constituent timeline (donor sync)
  await prisma.activity.create({
    data: {
      constituentId,
      eventId: req.params.eventId,
      type: "EVENT_REGISTRATION",
      description: `Registered for event: ${order.event.name} (${items.length} ticket${items.length > 1 ? "s" : ""}, $${totalAmount.toFixed(2)})`,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount,
        itemCount: items.length,
        source: "api/events:orders:create",
      },
    },
  });

  res.status(201).json(order);
});

/** PATCH /api/events/orders/:orderId — Update an event order. */
router.patch("/orders/:orderId", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const order = await prisma.eventOrder.findFirst({
    where: { id: req.params.orderId },
    include: { event: true },
  });

  if (!order || order.event.organizationId !== organizationId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Order not found" } });
    return;
  }

  const { status, paymentMethod, paidAt, notes } = req.body;

  const updated = await prisma.eventOrder.update({
    where: { id: req.params.orderId },
    data: {
      ...(status !== undefined && { status }),
      ...(paymentMethod !== undefined && { paymentMethod }),
      ...(paidAt !== undefined && { paidAt: paidAt ? new Date(paidAt) : null }),
      ...(notes !== undefined && { notes }),
    },
    include: {
      event: { select: { id: true, name: true, startDate: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      items: { include: { ticketType: true } },
      _count: { select: { guests: true } },
    },
  });

  res.json(updated);
});

// ─── Event Guests ────────────────────────────────────────────────────────────

/** GET /api/events/guests — List all guests across all events with filters. */
router.get("/guests", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const { eventId, search, checkedIn, constituentLinked } = req.query;

  // Build where clause dynamically
  const whereConditions: Prisma.EventGuestWhereInput = { event: { organizationId } };
  if (eventId) {
    whereConditions.eventId = eventId as string;
  }
  if (checkedIn !== undefined) {
    whereConditions.checkedIn = checkedIn === "true";
  }
  if (constituentLinked === "true") {
    whereConditions.constituentId = { not: null };
  }
  if (constituentLinked === "false") {
    whereConditions.constituentId = null;
  }
  if (search) {
    const searchStr = search as string;
    whereConditions.OR = [
      { firstName: { contains: searchStr } },
      { lastName: { contains: searchStr } },
      { email: { contains: searchStr } },
      { checkinCode: { contains: searchStr } },
      { constituent: { firstName: { contains: searchStr } } },
      { constituent: { lastName: { contains: searchStr } } },
    ];
  }

  const guests = await prisma.eventGuest.findMany({
    where: whereConditions,
    include: {
      event: { select: { id: true, name: true, startDate: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      ticketType: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
      table: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(guests);
});

/** GET /api/events/guests/by-code/:code — Look up a guest by their unique checkin code. */
router.get("/guests/by-code/:code", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const { eventId } = req.query as { eventId?: string };

  if (eventId) {
    const event = await prisma.event.findFirst({
      where: { id: eventId, organizationId },
      select: { id: true },
    });
    if (!event) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
      return;
    }
  }

  const guest = await prisma.eventGuest.findFirst({
    where: {
      checkinCode: req.params.code.toUpperCase(),
      event: { organizationId },
      ...(eventId ? { eventId } : {}),
    },
    include: {
      event: { select: { id: true, name: true, startDate: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      ticketType: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
      table: { select: { id: true, name: true } },
    },
  });

  if (!guest) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "No guest found with that check-in code." } });
    return;
  }

  res.json(guest);
});

/** GET /api/events/:eventId/guests — List guests for a specific event. */
router.get("/:eventId/guests", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const guests = await prisma.eventGuest.findMany({
    where: { eventId: req.params.eventId },
    include: {
      event: { select: { id: true, name: true, startDate: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      ticketType: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
      table: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(guests);
});

/** POST /api/events/:eventId/guests — Create a new guest for an event. */
router.post("/:eventId/guests", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const {
    orderId,
    constituentId,
    ticketTypeId,
    tableId,
    firstName,
    lastName,
    email,
    phone,
    dietaryRestrictions,
    specialNeeds,
    notes,
    paymentStatus,
    rsvpStatus,
    mealPreference,
    seatNumber,
    partyName,
  } = req.body;

  // Generate a unique 6-character alphanumeric check-in code.
  async function generateCheckinCode(): Promise<string> {
    for (let attempts = 0; attempts < 10; attempts++) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const existing = await prisma.eventGuest.findUnique({ where: { checkinCode: code } });
      if (!existing) return code;
    }
    // Fallback: use timestamp if random codes keep colliding
    return Date.now().toString(36).toUpperCase().slice(-6);
  }

  const checkinCode = await generateCheckinCode();

  const guest = await prisma.eventGuest.create({
    data: {
      eventId: req.params.eventId,
      orderId: orderId ?? undefined,
      constituentId: constituentId ?? undefined,
      ticketTypeId: ticketTypeId ?? undefined,
      tableId: tableId ?? undefined,
      firstName: firstName ?? undefined,
      lastName: lastName ?? undefined,
      email: email ?? undefined,
      phone: phone ?? undefined,
      dietaryRestrictions: dietaryRestrictions ?? undefined,
      specialNeeds: specialNeeds ?? undefined,
      notes: notes ?? undefined,
      checkinCode,
      paymentStatus: paymentStatus ?? undefined,
      rsvpStatus: rsvpStatus ?? undefined,
      mealPreference: mealPreference ?? undefined,
      seatNumber: seatNumber ?? undefined,
      partyName: partyName ?? undefined,
    },
    include: {
      event: { select: { id: true, name: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      ticketType: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
      table: { select: { id: true, name: true } },
    },
  });

  // Log activity for linked constituents (donor sync)
  if (constituentId) {
    await prisma.activity.create({
      data: {
        constituentId,
        eventId: req.params.eventId,
        type: "EVENT_REGISTRATION",
        description: `Added as guest for event: ${guest.event.name}`,
        metadata: {
          guestId: guest.id,
          guestName: `${firstName || ""} ${lastName || ""}`.trim(),
          source: "api/events:guests:create",
        },
      },
    });
  }

  res.status(201).json(guest);
});

/** POST /api/events/:eventId/guests/import — Bulk import event guest CSV rows into one selected event. */
router.post("/:eventId/guests/import", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({ where: { id: req.params.eventId, organizationId }, select: { id: true } });
  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const { records, dryRun = true, duplicateResolution = "skip" } = req.body as {
    records?: Array<Record<string, string>>;
    dryRun?: boolean;
    duplicateResolution?: "skip" | "update";
  };
  if (!Array.isArray(records) || records.length === 0) {
    res.status(400).json({ error: { code: "NO_RECORDS", message: "No guest records to import." } });
    return;
  }

  const normalizePayment = (value?: string): EventGuestPaymentStatus => {
    const normalized = (value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (normalized === "PAID") return "PAID";
    if (normalized === "PENDING_CHECK") return "PENDING_CHECK";
    if (normalized === "COMP") return "COMP";
    if (normalized === "SPONSORED") return "SPONSORED";
    return "DUE";
  };
  const normalizeRsvp = (value?: string): EventGuestRsvpStatus => {
    const normalized = (value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
    if (normalized === "CONFIRMED") return "CONFIRMED";
    if (normalized === "DECLINED") return "DECLINED";
    if (normalized === "WAITLIST") return "WAITLIST";
    return "PENDING";
  };
  const parseSeatNumber = (value?: string): number | undefined => {
    const number = Number.parseInt(value ?? "", 10);
    return Number.isFinite(number) ? number : undefined;
  };
  const parseDate = (value?: string): Date | undefined => {
    if (!value?.trim()) return undefined;
    const date = new Date(value.trim());
    return Number.isNaN(date.getTime()) ? undefined : date;
  };
  const normalizeNullable = (value?: string): string | undefined => {
    const trimmed = (value ?? "").trim();
    return trimmed && trimmed.toUpperCase() !== "NULL" ? trimmed : undefined;
  };
  async function createCheckinCode(preferred?: string): Promise<string> {
    const candidate = normalizeNullable(preferred)?.toUpperCase();
    if (candidate) {
      const existing = await prisma.eventGuest.findUnique({ where: { checkinCode: candidate } });
      if (!existing) return candidate;
    }
    for (let attempts = 0; attempts < 10; attempts++) {
      const code = Math.random().toString(36).substring(2, 10).toUpperCase();
      const existing = await prisma.eventGuest.findUnique({ where: { checkinCode: code } });
      if (!existing) return code;
    }
    return Date.now().toString(36).toUpperCase().slice(-8);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const rec of records) {
    try {
      const firstName = normalizeNullable(rec.firstName);
      const lastName = normalizeNullable(rec.lastName);
      const email = normalizeNullable(rec.email)?.toLowerCase();
      const checkinCode = normalizeNullable(rec.checkinCode)?.toUpperCase();
      if (!firstName && !lastName && !email) {
        skipped++;
        continue;
      }

      const existing = checkinCode
        ? await prisma.eventGuest.findFirst({ where: { eventId: event.id, checkinCode }, select: { id: true } })
        : email
          ? await prisma.eventGuest.findFirst({ where: { eventId: event.id, email, firstName: firstName ?? undefined, lastName: lastName ?? undefined }, select: { id: true } })
          : null;

      if (dryRun) {
        if (existing) duplicateResolution === "update" ? updated++ : skipped++;
        else created++;
        continue;
      }

      const data = {
        firstName,
        lastName,
        email,
        phone: normalizeNullable(rec.phone),
        dietaryRestrictions: normalizeNullable(rec.dietaryRestrictions),
        specialNeeds: normalizeNullable(rec.specialRequests),
        notes: [normalizeNullable(rec.notes), normalizeNullable(rec.warnings), normalizeNullable(rec.ticketType) ? `Ticket type: ${normalizeNullable(rec.ticketType)}` : undefined, normalizeNullable(rec.seatType) ? `Seat type: ${normalizeNullable(rec.seatType)}` : undefined].filter(Boolean).join("\n") || undefined,
        paymentStatus: normalizePayment(rec.paymentStatus),
        rsvpStatus: normalizeRsvp(rec.rsvpStatus),
        mealPreference: normalizeNullable(rec.mealPreference),
        seatNumber: parseSeatNumber(rec.seatNumber),
        partyName: normalizeNullable(rec.partyName),
        checkedIn: (rec.checkInStatus ?? "").trim().toLowerCase() === "checked-in",
        checkedInAt: parseDate(rec.checkedInAt) ?? parseDate(rec.arrivalTime),
      };

      if (existing) {
        if (duplicateResolution !== "update") {
          skipped++;
          continue;
        }
        await prisma.eventGuest.update({ where: { id: existing.id }, data });
        updated++;
      } else {
        await prisma.eventGuest.create({
          data: {
            eventId: event.id,
            ...data,
            checkinCode: await createCheckinCode(checkinCode),
          },
        });
        created++;
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  res.json({ created, updated, skipped, errors: errors.length, errorMessages: errors.slice(0, 10), dryRun });
});

/** PATCH /api/events/guests/:guestId — Update a guest. */
router.patch("/guests/:guestId", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const guest = await prisma.eventGuest.findFirst({
    where: { id: req.params.guestId },
    include: { event: true },
  });

  if (!guest || guest.event.organizationId !== organizationId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Guest not found" } });
    return;
  }

  const {
    constituentId,
    ticketTypeId,
    tableId,
    firstName,
    lastName,
    email,
    phone,
    checkedIn,
    checkedInAt,
    dietaryRestrictions,
    specialNeeds,
    notes,
    paymentStatus,
    rsvpStatus,
    mealPreference,
    seatNumber,
    partyName,
  } = req.body;

  const updated = await prisma.eventGuest.update({
    where: { id: req.params.guestId },
    data: {
      ...(constituentId !== undefined && { constituentId }),
      ...(ticketTypeId !== undefined && { ticketTypeId }),
      ...(tableId !== undefined && { tableId }),
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(email !== undefined && { email }),
      ...(phone !== undefined && { phone }),
      ...(checkedIn !== undefined && { checkedIn }),
      ...(checkedInAt !== undefined && { checkedInAt: checkedInAt ? new Date(checkedInAt) : null }),
      ...(dietaryRestrictions !== undefined && { dietaryRestrictions }),
      ...(specialNeeds !== undefined && { specialNeeds }),
      ...(notes !== undefined && { notes }),
      ...(paymentStatus !== undefined && { paymentStatus }),
      ...(rsvpStatus !== undefined && { rsvpStatus }),
      ...(mealPreference !== undefined && { mealPreference }),
      ...(seatNumber !== undefined && { seatNumber }),
      ...(partyName !== undefined && { partyName }),
    },
    include: {
      event: { select: { id: true, name: true, startDate: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      ticketType: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
      table: { select: { id: true, name: true } },
    },
  });

  res.json(updated);
});

/** DELETE /api/events/guests/:guestId — Delete a guest. */
router.delete("/guests/:guestId", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const guest = await prisma.eventGuest.findFirst({
    where: { id: req.params.guestId },
    include: { event: true },
  });

  if (!guest || guest.event.organizationId !== organizationId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Guest not found" } });
    return;
  }

  await prisma.eventGuest.delete({ where: { id: req.params.guestId } });
  res.json({ message: "Guest deleted" });
});

// ─── Event Tables (Seating Management) ──────────────────────────────────────

/** GET /api/events/:eventId/tables — List tables for an event with guest counts. */
router.get("/:eventId/tables", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const tables = await prisma.eventTable.findMany({
    where: { eventId: req.params.eventId },
    include: {
      guests: {
        include: {
          constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
          ticketType: { select: { id: true, name: true } },
          order: { select: { id: true, orderNumber: true, status: true } },
        },
      },
      _count: { select: { guests: true } },
    },
    orderBy: { name: "asc" },
  });

  res.json(tables);
});

/** POST /api/events/:eventId/tables — Create a new table for an event. */
router.post("/:eventId/tables", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const { name, capacity, notes, tableNumber, isSponsored, hostName, xPosition, yPosition, shape } = req.body;

  const parsedTableNumber =
    tableNumber === undefined
      ? undefined
      : tableNumber === null || tableNumber === ""
        ? null
        : Number(tableNumber);

  if (
    parsedTableNumber !== undefined &&
    parsedTableNumber !== null &&
    !Number.isInteger(parsedTableNumber)
  ) {
    res.status(400).json({
      error: { code: "INVALID_INPUT", message: "tableNumber must be an integer when provided" },
    });
    return;
  }

  const table = await prisma.eventTable.create({
    data: {
      eventId: req.params.eventId,
      name,
      capacity: capacity ?? 10,
      notes: notes ?? undefined,
      tableNumber: parsedTableNumber,
      isSponsored: isSponsored ?? false,
      hostName: hostName ?? undefined,
      xPosition: xPosition ?? 0,
      yPosition: yPosition ?? 0,
      shape: shape ?? "round",
    },
    include: {
      guests: {
        include: {
          constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
          ticketType: { select: { id: true, name: true } },
          order: { select: { id: true, orderNumber: true, status: true } },
        },
      },
      _count: { select: { guests: true } },
    },
  });

  res.status(201).json(table);
});

/** PATCH /api/events/tables/:tableId — Update a table. */
router.patch("/tables/:tableId", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const table = await prisma.eventTable.findFirst({
    where: { id: req.params.tableId },
    include: { event: true },
  });

  if (!table || table.event.organizationId !== organizationId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Table not found" } });
    return;
  }

  const { name, capacity, notes, tableNumber, isSponsored, hostName, xPosition, yPosition, shape } = req.body;

  const parsedTableNumber =
    tableNumber === undefined
      ? undefined
      : tableNumber === null || tableNumber === ""
        ? null
        : Number(tableNumber);

  if (
    parsedTableNumber !== undefined &&
    parsedTableNumber !== null &&
    !Number.isInteger(parsedTableNumber)
  ) {
    res.status(400).json({
      error: { code: "INVALID_INPUT", message: "tableNumber must be an integer when provided" },
    });
    return;
  }

  const updated = await prisma.eventTable.update({
    where: { id: req.params.tableId },
    data: {
      ...(name !== undefined && { name }),
      ...(capacity !== undefined && { capacity }),
      ...(notes !== undefined && { notes }),
      ...(parsedTableNumber !== undefined && { tableNumber: parsedTableNumber }),
      ...(isSponsored !== undefined && { isSponsored }),
      ...(hostName !== undefined && { hostName }),
      ...(xPosition !== undefined && { xPosition }),
      ...(yPosition !== undefined && { yPosition }),
      ...(shape !== undefined && { shape }),
    },
    include: {
      guests: {
        include: {
          constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
          ticketType: { select: { id: true, name: true } },
          order: { select: { id: true, orderNumber: true, status: true } },
        },
      },
      _count: { select: { guests: true } },
    },
  });

  res.json(updated);
});

/** DELETE /api/events/tables/:tableId — Delete a table (unassigns guests first). */
router.delete("/tables/:tableId", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const table = await prisma.eventTable.findFirst({
    where: { id: req.params.tableId },
    include: { event: true },
  });

  if (!table || table.event.organizationId !== organizationId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Table not found" } });
    return;
  }

  // Unassign all guests from this table before deleting
  await prisma.eventGuest.updateMany({
    where: { tableId: req.params.tableId },
    data: { tableId: null },
  });

  await prisma.eventTable.delete({ where: { id: req.params.tableId } });
  res.json({ message: "Table deleted" });
});

/** PATCH /api/events/guests/:guestId/assign-table — Assign or unassign a guest to a table. */
router.patch("/guests/:guestId/assign-table", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const guest = await prisma.eventGuest.findFirst({
    where: { id: req.params.guestId },
    include: { event: true },
  });

  if (!guest || guest.event.organizationId !== organizationId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Guest not found" } });
    return;
  }

  const { tableId } = req.body;

  // Validate table exists and belongs to same event if tableId is provided
  if (tableId) {
    const table = await prisma.eventTable.findFirst({
      where: { id: tableId, eventId: guest.eventId },
    });
    if (!table) {
      res.status(400).json({ error: { code: "INVALID_TABLE", message: "Table not found for this event" } });
      return;
    }
  }

  const updated = await prisma.eventGuest.update({
    where: { id: req.params.guestId },
    data: { tableId: tableId ?? null },
    include: {
      event: { select: { id: true, name: true, startDate: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      ticketType: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
      table: { select: { id: true, name: true, capacity: true } },
    },
  });

  res.json(updated);
});

/** POST /api/events/guests/:guestId/check-in — Quick check-in toggle endpoint. */
router.post("/guests/:guestId/check-in", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const guest = await prisma.eventGuest.findFirst({
    where: { id: req.params.guestId },
    include: { event: true },
  });

  if (!guest || guest.event.organizationId !== organizationId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Guest not found" } });
    return;
  }

  const { checkedIn } = req.body;
  const newStatus = checkedIn !== undefined ? checkedIn : !guest.checkedIn;

  const updated = await prisma.eventGuest.update({
    where: { id: req.params.guestId },
    data: {
      checkedIn: newStatus,
      checkedInAt: newStatus ? new Date() : null,
    },
    include: {
      event: { select: { id: true, name: true, startDate: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      ticketType: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
      table: { select: { id: true, name: true } },
    },
  });

  // Log activity for linked constituents when they check in (donor sync)
  if (newStatus && updated.constituentId) {
    await prisma.activity.create({
      data: {
        constituentId: updated.constituentId,
        eventId: updated.event.id,
        type: "EVENT_ATTENDANCE",
        description: `Checked in at event: ${updated.event.name}`,
        metadata: {
          guestId: updated.id,
          checkedInAt: updated.checkedInAt,
          source: "api/events:guests:check-in",
        },
      },
    });
  }

  res.json(updated);
});

// ─── Event Reports ───────────────────────────────────────────────────────────

function computeFollowUpAction(input: {
  checkedIn: boolean;
  paymentStatus: EventGuestPaymentStatus;
  rsvpStatus: EventGuestRsvpStatus;
  hasLinkedConstituent: boolean;
}): string {
  if (!input.checkedIn && input.rsvpStatus === "CONFIRMED") {
    return "No-show outreach";
  }
  if (input.paymentStatus === "DUE" || input.paymentStatus === "PENDING_CHECK") {
    return "Payment follow-up";
  }
  if (input.checkedIn && !input.hasLinkedConstituent) {
    return "Link guest to constituent";
  }
  if (input.checkedIn) {
    return "Send post-event thank-you";
  }
  return "Review RSVP status";
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/\"/g, '""')}"`;
  }
  return value;
}

/**
 * GET /api/events/:eventId/donor-safe-export
 * Exports post-event donor follow-up rows without exposing sensitive client-only fields.
 */
router.get("/:eventId/donor-safe-export", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
    select: {
      id: true,
      name: true,
      startDate: true,
    },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const guests = await prisma.eventGuest.findMany({
    where: { eventId: event.id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      checkedIn: true,
      checkedInAt: true,
      paymentStatus: true,
      rsvpStatus: true,
      table: { select: { name: true } },
      ticketType: { select: { name: true } },
      constituent: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const rows = guests.map((guest) => {
    const guestFirstName = String(guest.firstName ?? guest.constituent?.firstName ?? "").trim();
    const guestLastName = String(guest.lastName ?? guest.constituent?.lastName ?? "").trim();
    const linkedConstituentName = guest.constituent
      ? `${guest.constituent.firstName} ${guest.constituent.lastName}`.trim()
      : "";

    const followUpAction = computeFollowUpAction({
      checkedIn: guest.checkedIn,
      paymentStatus: guest.paymentStatus,
      rsvpStatus: guest.rsvpStatus,
      hasLinkedConstituent: Boolean(guest.constituent?.id),
    });

    return {
      guestId: guest.id,
      firstName: guestFirstName,
      lastName: guestLastName,
      email: String(guest.email ?? "").trim(),
      checkedIn: guest.checkedIn,
      checkedInAt: guest.checkedInAt ? guest.checkedInAt.toISOString() : "",
      rsvpStatus: guest.rsvpStatus,
      paymentStatus: guest.paymentStatus,
      table: String(guest.table?.name ?? "Unassigned").trim(),
      ticketType: String(guest.ticketType?.name ?? "").trim(),
      linkedConstituentId: guest.constituent?.id ?? "",
      linkedConstituentName,
      followUpAction,
    };
  });

  const checkedInCount = rows.filter((row) => row.checkedIn).length;
  const noShowCount = rows.filter((row) => !row.checkedIn && row.rsvpStatus === "CONFIRMED").length;
  const paymentFollowUpCount = rows.filter((row) => row.followUpAction === "Payment follow-up").length;
  const linkFollowUpCount = rows.filter((row) => row.followUpAction === "Link guest to constituent").length;

  const format = String(req.query.format ?? "json").trim().toLowerCase();

  if (format === "csv") {
    const headers = [
      "event_name",
      "guest_id",
      "first_name",
      "last_name",
      "email",
      "checked_in",
      "checked_in_at",
      "rsvp_status",
      "payment_status",
      "table",
      "ticket_type",
      "linked_constituent_id",
      "linked_constituent_name",
      "follow_up_action",
    ];

    const lines = rows.map((row) => [
      event.name,
      row.guestId,
      row.firstName,
      row.lastName,
      row.email,
      row.checkedIn ? "YES" : "NO",
      row.checkedInAt,
      row.rsvpStatus,
      row.paymentStatus,
      row.table,
      row.ticketType,
      row.linkedConstituentId,
      row.linkedConstituentName,
      row.followUpAction,
    ].map((value) => escapeCsv(String(value ?? ""))).join(","));

    const csv = `${headers.join(",")}\n${lines.join("\n")}`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=event-${event.id}-donor-safe-export.csv`);
    res.status(200).send(csv);
    return;
  }

  res.json({
    event: {
      id: event.id,
      name: event.name,
      startDate: event.startDate,
    },
    summary: {
      totalGuests: rows.length,
      checkedIn: checkedInCount,
      noShows: noShowCount,
      paymentFollowUp: paymentFollowUpCount,
      linkFollowUp: linkFollowUpCount,
    },
    rows,
  });
});

/**
 * GET /api/events/:eventId/report — Comprehensive event summary for reporting.
 * Returns metrics, revenue breakdown, attendance, and donor-sync insights.
 */
router.get("/:eventId/report", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
    include: {
      _count: {
        select: {
          guests: true,
          orders: true,
          donations: true,
          activities: true,
          sponsors: true,
        },
      },
    },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  // Get detailed guest counts
  const [
    totalGuests,
    checkedInGuests,
    linkedGuests,
    unlinkedGuests,
  ] = await Promise.all([
    prisma.eventGuest.count({
      where: { eventId: req.params.eventId },
    }),
    prisma.eventGuest.count({
      where: { eventId: req.params.eventId, checkedIn: true },
    }),
    prisma.eventGuest.count({
      where: { eventId: req.params.eventId, constituentId: { not: null } },
    }),
    prisma.eventGuest.count({
      where: { eventId: req.params.eventId, constituentId: null },
    }),
  ]);

  // Calculate no-shows (registered but not checked in)
  const noShows = totalGuests - checkedInGuests;

  // Get order revenue breakdown
  const orderRevenue = await prisma.eventOrder.aggregate({
    where: { eventId: req.params.eventId, status: "CONFIRMED" },
    _sum: { totalAmount: true },
    _count: { id: true },
  });

  // Get event-linked donation revenue
  const donationRevenue = await prisma.donation.aggregate({
    where: { eventId: req.params.eventId, status: "COMPLETED" },
    _sum: { amount: true },
    _count: { id: true },
  });

  // Compute "new donor" count in a database-agnostic way.
  const eventCompletedDonations = await prisma.donation.findMany({
    where: {
      eventId: req.params.eventId,
      status: "COMPLETED",
    },
    select: {
      constituentId: true,
      date: true,
    },
  });

  const firstEventDonationDateByConstituent = new Map<string, Date>();
  for (const donation of eventCompletedDonations) {
    if (!donation.constituentId) continue;
    const existingDate = firstEventDonationDateByConstituent.get(donation.constituentId);
    if (!existingDate || donation.date < existingDate) {
      firstEventDonationDateByConstituent.set(donation.constituentId, donation.date);
    }
  }

  let newDonorCount = 0;
  const eventConstituentIds = Array.from(firstEventDonationDateByConstituent.keys());
  if (eventConstituentIds.length > 0) {
    const earliestDonations = await prisma.donation.groupBy({
      by: ["constituentId"],
      where: {
        constituentId: { in: eventConstituentIds },
      },
      _min: { date: true },
    });

    newDonorCount = earliestDonations.reduce((count, row) => {
      if (!row.constituentId || !row._min.date) return count;
      const firstEventDate = firstEventDonationDateByConstituent.get(row.constituentId);
      if (!firstEventDate) return count;
      return row._min.date.getTime() >= firstEventDate.getTime() ? count + 1 : count;
    }, 0);
  }

  // Total revenue = order revenue + donation revenue
  const totalRevenue = Number(orderRevenue._sum.totalAmount ?? 0) + Number(donationRevenue._sum.amount ?? 0);

  // Revenue goal progress
  const revenueGoal = event.revenueGoal ? Number(event.revenueGoal) : null;
  const revenueProgress = revenueGoal ? Math.round((totalRevenue / revenueGoal) * 100) : null;

  // Attendance goal progress
  const attendanceGoal = event.registrationGoal ?? event.capacity ?? null;
  const attendanceProgress = attendanceGoal ? Math.round((totalGuests / attendanceGoal) * 100) : null;

  res.json({
    event: {
      id: event.id,
      name: event.name,
      type: event.type,
      status: event.status,
      startDate: event.startDate,
      endDate: event.endDate,
      revenueGoal: event.revenueGoal,
      registrationGoal: event.registrationGoal,
      capacity: event.capacity,
    },
    attendance: {
      total: totalGuests,
      checkedIn: checkedInGuests,
      noShows,
      attendanceRate: totalGuests > 0 ? Math.round((checkedInGuests / totalGuests) * 100) : 0,
      goal: attendanceGoal,
      progress: attendanceProgress,
    },
    revenue: {
      total: totalRevenue,
      fromOrders: Number(orderRevenue._sum.totalAmount ?? 0),
      fromDonations: Number(donationRevenue._sum.amount ?? 0),
      orderCount: orderRevenue._count.id,
      donationCount: donationRevenue._count.id,
      goal: revenueGoal,
      progress: revenueProgress,
    },
    donorInsights: {
      linkedGuests,
      unlinkedGuests,
      newDonors: newDonorCount,
      needsFollowUp: unlinkedGuests + noShows, // Simple heuristic: unlinked + no-shows
    },
    counts: {
      sponsors: event._count.sponsors,
      activities: event._count.activities,
    },
  });
});

/**
 * GET /api/events/reports/summary — Aggregate report across all events.
 * Useful for event performance dashboards and YoY comparisons.
 */
router.get("/reports/summary", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({
      totalEvents: 0,
      totalRevenue: 0,
      totalAttendees: 0,
      totalNewDonors: 0,
      topEvents: [],
    });
    return;
  }

  const { startDate, endDate, eventType } = req.query;

  // Build filter dynamically
  const whereConditions: Prisma.EventWhereInput = { organizationId };
  
  if (startDate || endDate) {
    whereConditions.startDate = {};
    if (startDate) {
      whereConditions.startDate.gte = new Date(startDate as string);
    }
    if (endDate) {
      whereConditions.startDate.lte = new Date(endDate as string);
    }
  }
  
  if (eventType) {
    whereConditions.type = eventType as Prisma.EnumEventTypeFilter<"Event">;
  }

  const events = await prisma.event.findMany({
    where: whereConditions,
    select: {
      id: true,
      name: true,
      type: true,
      startDate: true,
      _count: {
        select: {
          guests: true,
          orders: true,
          donations: true,
        },
      },
    },
  });

  // Get revenue for all matching events
  const eventIds = events.map((e) => e.id);

  const [orderRevenue, donationRevenue, checkedInCounts] = await Promise.all([
    prisma.eventOrder.aggregate({
      where: { eventId: { in: eventIds }, status: "CONFIRMED" },
      _sum: { totalAmount: true },
    }),
    prisma.donation.aggregate({
      where: { eventId: { in: eventIds }, status: "COMPLETED" },
      _sum: { amount: true },
    }),
    prisma.eventGuest.groupBy({
      by: ["eventId"],
      where: { eventId: { in: eventIds }, checkedIn: true },
      _count: { id: true },
    }),
  ]);

  const totalRevenue = Number(orderRevenue._sum.totalAmount ?? 0) + Number(donationRevenue._sum.amount ?? 0);
  const totalAttendees = checkedInCounts.reduce((sum, e) => sum + e._count.id, 0);

  // Calculate top events by revenue (order + donation combined)
  const eventRevenueMap = new Map<string, number>();
  
  const ordersByEvent = await prisma.eventOrder.groupBy({
    by: ["eventId"],
    where: { eventId: { in: eventIds }, status: "CONFIRMED" },
    _sum: { totalAmount: true },
  });

  const donationsByEvent = await prisma.donation.groupBy({
    by: ["eventId"],
    where: { eventId: { in: eventIds }, status: "COMPLETED" },
    _sum: { amount: true },
  });

  ordersByEvent.forEach((o) => {
    eventRevenueMap.set(o.eventId, Number(o._sum.totalAmount ?? 0));
  });

  donationsByEvent.forEach((d) => {
    if (d.eventId) {
      const current = eventRevenueMap.get(d.eventId) ?? 0;
      eventRevenueMap.set(d.eventId, current + Number(d._sum.amount ?? 0));
    }
  });

  const topEvents = events
    .map((e) => ({
      id: e.id,
      name: e.name,
      type: e.type,
      startDate: e.startDate,
      revenue: eventRevenueMap.get(e.id) ?? 0,
      guests: e._count.guests,
      checkedIn: checkedInCounts.find((c) => c.eventId === e.id)?._count.id ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  res.json({
    totalEvents: events.length,
    totalRevenue,
    totalAttendees,
    topEvents,
  });
});

// ─── Event Sponsors ──────────────────────────────────────────────────────────

/** GET /api/events/:eventId/sponsors — List all sponsors for an event with constituent details. */
router.get("/:eventId/sponsors", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const sponsors = await prisma.eventSponsor.findMany({
    where: { eventId: req.params.eventId },
    include: {
      // Include constituent details needed for the sponsor table
      constituent: {
        select: { id: true, firstName: true, lastName: true, email: true, employer: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json(sponsors);
});

/** POST /api/events/:eventId/sponsors — Add a sponsor to an event. */
router.post("/:eventId/sponsors", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const event = await prisma.event.findFirst({
    where: { id: req.params.eventId, organizationId },
  });

  if (!event) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Event not found" } });
    return;
  }

  const { constituentId, level, amount, benefits, logoUrl, websiteUrl, notes } = req.body;

  if (!constituentId || !level || amount === undefined) {
    res.status(400).json({
      error: { code: "INVALID_INPUT", message: "constituentId, level, and amount are required" },
    });
    return;
  }

  // Ensure the constituent belongs to the same organization as the event
  const constituent = await prisma.constituent.findFirst({
    where: { id: constituentId, organizationId },
  });

  if (!constituent) {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Constituent not found in this organization" },
    });
    return;
  }

  const sponsor = await prisma.eventSponsor.create({
    data: {
      eventId: req.params.eventId,
      constituentId,
      level,
      amount,
      benefits: benefits ?? undefined,
      logoUrl: logoUrl ?? undefined,
      websiteUrl: websiteUrl ?? undefined,
      notes: notes ?? undefined,
    },
    include: {
      constituent: {
        select: { id: true, firstName: true, lastName: true, email: true, employer: true },
      },
    },
  });

  // Log sponsorship to constituent timeline for CRM visibility
  await prisma.activity.create({
    data: {
      constituentId,
      eventId: req.params.eventId,
      type: "NOTE",
      description: `Added as ${level} sponsor for event: ${event.name} ($${Number(amount).toFixed(2)})`,
      metadata: {
        sponsorId: sponsor.id,
        level,
        amount: Number(amount),
        source: "api/events:sponsors:create",
      },
    },
  });

  res.status(201).json(sponsor);
});

/** PATCH /api/events/sponsors/:sponsorId — Update a sponsor record (level, amount, benefits, etc.). */
router.patch("/sponsors/:sponsorId", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const sponsor = await prisma.eventSponsor.findFirst({
    where: { id: req.params.sponsorId },
    include: { event: true },
  });

  if (!sponsor || sponsor.event.organizationId !== organizationId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Sponsor not found" } });
    return;
  }

  const { level, amount, benefits, logoUrl, websiteUrl, notes } = req.body;

  const updated = await prisma.eventSponsor.update({
    where: { id: req.params.sponsorId },
    data: {
      ...(level !== undefined && { level }),
      ...(amount !== undefined && { amount }),
      ...(benefits !== undefined && { benefits }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(websiteUrl !== undefined && { websiteUrl }),
      ...(notes !== undefined && { notes }),
    },
    include: {
      constituent: {
        select: { id: true, firstName: true, lastName: true, email: true, employer: true },
      },
    },
  });

  res.json(updated);
});

/** DELETE /api/events/sponsors/:sponsorId — Remove a sponsor from an event. */
router.delete("/sponsors/:sponsorId", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const sponsor = await prisma.eventSponsor.findFirst({
    where: { id: req.params.sponsorId },
    include: { event: true },
  });

  if (!sponsor || sponsor.event.organizationId !== organizationId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Sponsor not found" } });
    return;
  }

  await prisma.eventSponsor.delete({ where: { id: req.params.sponsorId } });
  res.json({ message: "Sponsor removed" });
});

export default router;
