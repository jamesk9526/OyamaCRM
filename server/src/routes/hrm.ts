/**
 * OyamaHRM API routes.
 * Provides persisted HRM data for dashboard, people directory, scheduling, locations, messages, and settings.
 */
import { Prisma } from "@prisma/client";
import { Router, type Request, type Response } from "express";
import { logAudit } from "../lib/audit.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = Router();

interface HrmScheduleItem {
  id: string;
  source: "meeting" | "appointment";
  personKey: string;
  personName: string;
  title: string;
  location: string | null;
  startTime: string;
  endTime: string | null;
  status: string;
}

interface HrmConflictItem {
  personKey: string;
  personName: string;
  first: HrmScheduleItem;
  second: HrmScheduleItem;
}

interface HrmPersonRecord {
  id: string;
  source: "user" | "staff";
  userId: string | null;
  compassionStaffId: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  personType: "staff" | "employee" | "volunteer" | "board_member";
  role: string | null;
  title: string | null;
  locationName: string | null;
  status: "active" | "on_leave" | "inactive";
  assignableToClients: boolean;
  schedulable: boolean;
  linkedUserEmail: string | null;
  hasLinkedUser: boolean;
}

// All HRM APIs require authentication.
router.use(requireAuth);

/** Normalizes one freeform input into a nullable trimmed string with max length guard. */
function readOptionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

/** Parses an optional YYYY-MM-DD query value and returns a valid day start in local time. */
function parseDayStart(dateValue: string | null): Date {
  const fallback = new Date();
  fallback.setHours(0, 0, 0, 0);

  if (!dateValue) return fallback;

  const parsed = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return fallback;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

/** Returns the day-end boundary for one provided day start value. */
function dayEnd(start: Date): Date {
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return end;
}

/** Converts one platform role into an HRM person type for directory rendering. */
function personTypeFromRole(role: string): "staff" | "employee" | "volunteer" | "board_member" {
  if (role === "report_viewer") return "board_member";
  if (role === "readonly") return "volunteer";
  if (role === "manager" || role === "admin") return "employee";
  return "staff";
}

/** Converts one staff title into an HRM person type when there is no linked user role. */
function personTypeFromStaffTitle(title: string | null): "staff" | "employee" | "volunteer" | "board_member" {
  const normalized = (title ?? "").toLowerCase();
  if (normalized.includes("board")) return "board_member";
  if (normalized.includes("volunteer")) return "volunteer";
  if (normalized.includes("director") || normalized.includes("manager") || normalized.includes("lead")) return "employee";
  return "staff";
}

/** Computes person status from one user/staff active-state combination. */
function resolvePersonStatus(params: { userActive?: boolean; staffActive?: boolean }): "active" | "on_leave" | "inactive" {
  if (params.userActive === false) return "inactive";
  if (params.staffActive === false) return params.userActive === undefined ? "inactive" : "on_leave";
  return "active";
}

/** Resolves the authenticated request organization and returns null after writing response when missing. */
async function requireOrganizationId(req: Request, res: Response): Promise<string | null> {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORGANIZATION_NOT_FOUND", message: "No organization is configured for this request." } });
    return null;
  }
  return organizationId;
}

/** Builds one flattened HRM schedule list for the given date range from meetings and Compassion appointments. */
async function buildScheduleItems(params: {
  organizationId: string;
  start: Date;
  end: Date;
}): Promise<HrmScheduleItem[]> {
  const [meetings, appointments] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        organizationId: params.organizationId,
        startTime: { gte: params.start, lt: params.end },
        assignedStaffId: { not: null },
      },
      include: {
        assignedStaff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { startTime: "asc" },
    }),
    prisma.compassionAppointment.findMany({
      where: {
        organizationId: params.organizationId,
        startTime: { gte: params.start, lt: params.end },
        OR: [{ assignedStaffId: { not: null } }, { assignedCompassionStaffId: { not: null } }],
      },
      include: {
        assignedStaff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        assignedCompassionStaff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
          },
        },
      },
      orderBy: { startTime: "asc" },
    }),
  ]);

  const meetingItems: HrmScheduleItem[] = meetings
    .filter((meeting) => Boolean(meeting.assignedStaff))
    .map((meeting) => ({
      id: meeting.id,
      source: "meeting",
      personKey: `user:${meeting.assignedStaff!.id}`,
      personName: `${meeting.assignedStaff!.firstName} ${meeting.assignedStaff!.lastName}`.trim(),
      title: meeting.title,
      location: meeting.location ?? null,
      startTime: meeting.startTime.toISOString(),
      endTime: meeting.endTime?.toISOString() ?? null,
      status: meeting.status.toLowerCase(),
    }));

  const appointmentItems: HrmScheduleItem[] = appointments.flatMap((appointment): HrmScheduleItem[] => {
    if (appointment.assignedStaff) {
      return [{
        id: appointment.id,
        source: "appointment",
        personKey: `user:${appointment.assignedStaff.id}`,
        personName: `${appointment.assignedStaff.firstName} ${appointment.assignedStaff.lastName}`.trim(),
        title: appointment.appointmentType.replaceAll("_", " "),
        location: appointment.location ?? null,
        startTime: appointment.startTime.toISOString(),
        endTime: appointment.endTime?.toISOString() ?? null,
        status: appointment.status.toLowerCase(),
      }];
    }

    if (appointment.assignedCompassionStaff) {
      const displayName = appointment.assignedCompassionStaff.displayName
        ?? `${appointment.assignedCompassionStaff.firstName} ${appointment.assignedCompassionStaff.lastName}`.trim();

      return [{
        id: appointment.id,
        source: "appointment",
        personKey: `staff:${appointment.assignedCompassionStaff.id}`,
        personName: displayName,
        title: appointment.appointmentType.replaceAll("_", " "),
        location: appointment.location ?? null,
        startTime: appointment.startTime.toISOString(),
        endTime: appointment.endTime?.toISOString() ?? null,
        status: appointment.status.toLowerCase(),
      }];
    }

    return [];
  });

  return [...meetingItems, ...appointmentItems].sort((left, right) =>
    new Date(left.startTime).getTime() - new Date(right.startTime).getTime());
}

/** Detects per-person overlapping schedule windows for conflict review. */
function detectScheduleConflicts(items: HrmScheduleItem[]): HrmConflictItem[] {
  const grouped = new Map<string, HrmScheduleItem[]>();

  for (const item of items) {
    const existing = grouped.get(item.personKey) ?? [];
    existing.push(item);
    grouped.set(item.personKey, existing);
  }

  const conflicts: HrmConflictItem[] = [];

  for (const [personKey, personItems] of grouped.entries()) {
    const sorted = [...personItems].sort((left, right) =>
      new Date(left.startTime).getTime() - new Date(right.startTime).getTime());

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1] as HrmScheduleItem;
      const current = sorted[index] as HrmScheduleItem;
      const previousEnd = previous.endTime ? new Date(previous.endTime).getTime() : new Date(previous.startTime).getTime() + 60 * 60 * 1000;
      const currentStart = new Date(current.startTime).getTime();

      if (currentStart < previousEnd) {
        conflicts.push({
          personKey,
          personName: current.personName,
          first: previous,
          second: current,
        });
      }
    }
  }

  return conflicts;
}

/** Builds one location-frequency map per person key from upcoming assignments. */
async function buildPrimaryLocationMap(organizationId: string): Promise<Map<string, string>> {
  const rangeStart = new Date();
  const rangeEnd = new Date();
  rangeEnd.setDate(rangeEnd.getDate() + 60);

  const [meetings, appointments] = await Promise.all([
    prisma.meeting.findMany({
      where: {
        organizationId,
        startTime: { gte: rangeStart, lt: rangeEnd },
        assignedStaffId: { not: null },
        location: { not: null },
      },
      select: {
        assignedStaffId: true,
        location: true,
      },
    }),
    prisma.compassionAppointment.findMany({
      where: {
        organizationId,
        startTime: { gte: rangeStart, lt: rangeEnd },
        location: { not: null },
        OR: [{ assignedStaffId: { not: null } }, { assignedCompassionStaffId: { not: null } }],
      },
      select: {
        assignedStaffId: true,
        assignedCompassionStaffId: true,
        location: true,
      },
    }),
  ]);

  const frequency = new Map<string, Map<string, number>>();

  for (const meeting of meetings) {
    if (!meeting.assignedStaffId || !meeting.location) continue;
    const personKey = `user:${meeting.assignedStaffId}`;
    const location = meeting.location.trim();
    if (!location) continue;

    const locationMap = frequency.get(personKey) ?? new Map<string, number>();
    locationMap.set(location, (locationMap.get(location) ?? 0) + 1);
    frequency.set(personKey, locationMap);
  }

  for (const appointment of appointments) {
    const location = appointment.location?.trim();
    if (!location) continue;

    if (appointment.assignedStaffId) {
      const personKey = `user:${appointment.assignedStaffId}`;
      const locationMap = frequency.get(personKey) ?? new Map<string, number>();
      locationMap.set(location, (locationMap.get(location) ?? 0) + 1);
      frequency.set(personKey, locationMap);
    }

    if (appointment.assignedCompassionStaffId) {
      const personKey = `staff:${appointment.assignedCompassionStaffId}`;
      const locationMap = frequency.get(personKey) ?? new Map<string, number>();
      locationMap.set(location, (locationMap.get(location) ?? 0) + 1);
      frequency.set(personKey, locationMap);
    }
  }

  const primaryLocations = new Map<string, string>();

  for (const [personKey, locationMap] of frequency.entries()) {
    const sorted = [...locationMap.entries()].sort((left, right) => right[1] - left[1]);
    const top = sorted[0];
    if (top) {
      primaryLocations.set(personKey, top[0]);
    }
  }

  return primaryLocations;
}

/** Builds one HRM people directory combining platform users and optional Compassion staff profiles. */
async function buildPeopleDirectory(organizationId: string): Promise<HrmPersonRecord[]> {
  const [users, compassionStaff, primaryLocations] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        active: true,
        linkedCompassionStaff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            title: true,
            email: true,
            phone: true,
            isActive: true,
            supportsScheduling: true,
          },
        },
      },
    }),
    prisma.compassionStaff.findMany({
      where: { organizationId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        linkedUserId: true,
        firstName: true,
        lastName: true,
        displayName: true,
        title: true,
        email: true,
        phone: true,
        isActive: true,
        supportsScheduling: true,
      },
    }),
    buildPrimaryLocationMap(organizationId),
  ]);

  const userRows: HrmPersonRecord[] = users.map((user) => {
    const linkedStaff = user.linkedCompassionStaff;
    const fullName = `${user.firstName} ${user.lastName}`.trim();
    const status = resolvePersonStatus({ userActive: user.active, staffActive: linkedStaff?.isActive });
    const userLocation = primaryLocations.get(`user:${user.id}`)
      ?? (linkedStaff ? primaryLocations.get(`staff:${linkedStaff.id}`) : null)
      ?? null;

    return {
      id: user.id,
      source: "user",
      userId: user.id,
      compassionStaffId: linkedStaff?.id ?? null,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName,
      email: user.email,
      phone: linkedStaff?.phone ?? null,
      personType: personTypeFromRole(user.role),
      role: user.role,
      title: linkedStaff?.title ?? null,
      locationName: userLocation,
      status,
      assignableToClients: Boolean(linkedStaff?.isActive),
      schedulable: Boolean(linkedStaff?.isActive && linkedStaff.supportsScheduling),
      linkedUserEmail: user.email,
      hasLinkedUser: true,
    };
  });

  const unlinkedStaffRows: HrmPersonRecord[] = compassionStaff
    .filter((staff) => !staff.linkedUserId)
    .map((staff) => {
      const displayName = staff.displayName?.trim() || `${staff.firstName} ${staff.lastName}`.trim();
      const locationName = primaryLocations.get(`staff:${staff.id}`) ?? null;

      return {
        id: `staff:${staff.id}`,
        source: "staff",
        userId: null,
        compassionStaffId: staff.id,
        firstName: staff.firstName,
        lastName: staff.lastName,
        fullName: displayName,
        email: staff.email,
        phone: staff.phone,
        personType: personTypeFromStaffTitle(staff.title),
        role: null,
        title: staff.title,
        locationName,
        status: staff.isActive ? "active" : "inactive",
        assignableToClients: staff.isActive,
        schedulable: staff.isActive && staff.supportsScheduling,
        linkedUserEmail: null,
        hasLinkedUser: false,
      };
    });

  return [...userRows, ...unlinkedStaffRows].sort((left, right) => left.fullName.localeCompare(right.fullName));
}

/**
 * GET /api/hrm/dashboard
 * Returns real dashboard metrics and widget lists for the HRM module.
 */
router.get("/dashboard", requirePermission("hrm.view"), async (req: Request, res: Response) => {
  const organizationId = await requireOrganizationId(req, res);
  if (!organizationId) return;

  const start = parseDayStart(null);
  const end = dayEnd(start);

  const [people, todaySchedule, locations, openInternalMessages, announcements] = await Promise.all([
    buildPeopleDirectory(organizationId),
    buildScheduleItems({ organizationId, start, end }),
    prisma.hrmLocation.findMany({
      where: { organizationId },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        status: true,
      },
    }),
    prisma.hrmMessage.count({
      where: {
        organizationId,
        archivedAt: null,
        readAt: null,
      },
    }),
    prisma.hrmMessage.findMany({
      where: {
        organizationId,
        kind: "ANNOUNCEMENT",
        archivedAt: null,
      },
      take: 6,
      orderBy: { createdAt: "desc" },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
  ]);

  const locationCoverageMap = new Map<string, number>();
  for (const item of todaySchedule) {
    const key = item.location?.trim().toLowerCase();
    if (!key) continue;
    locationCoverageMap.set(key, (locationCoverageMap.get(key) ?? 0) + 1);
  }

  const locationStatus = locations.map((location) => {
    const coverage = locationCoverageMap.get(location.name.trim().toLowerCase()) ?? 0;
    return {
      id: location.id,
      location: location.name,
      status: location.status === "ACTIVE" ? "Open" : "Inactive",
      coverage: `${coverage} assignment(s) today`,
    };
  });

  const uniqueScheduledPeople = new Set(todaySchedule.map((item) => item.personKey));
  const activePeople = people.filter((person) => person.status !== "inactive");

  const metrics = {
    activeStaff: activePeople.length,
    boardMembers: people.filter((person) => person.personType === "board_member" && person.status !== "inactive").length,
    locations: locations.length,
    peopleScheduledToday: uniqueScheduledPeople.size,
    openInternalMessages,
    profileCompletionNeeded: people.filter((person) => !person.email || !person.title).length,
  };

  res.json({
    metrics,
    todaySchedule: todaySchedule.slice(0, 12),
    locationStatus,
    announcements: announcements.map((message) => ({
      id: message.id,
      title: message.title,
      body: message.body,
      priority: message.priority.toLowerCase(),
      createdAt: message.createdAt,
      senderName: `${message.sender.firstName} ${message.sender.lastName}`.trim(),
    })),
  });
});

/**
 * GET /api/hrm/people
 * Returns one real people directory built from platform users and Compassion staff records.
 */
router.get("/people", requirePermission("hrm.view"), async (req: Request, res: Response) => {
  const organizationId = await requireOrganizationId(req, res);
  if (!organizationId) return;

  const allPeople = await buildPeopleDirectory(organizationId);

  const search = readOptionalString(req.query.search, 120)?.toLowerCase() ?? null;
  const statusFilter = readOptionalString(req.query.status, 20);
  const typeFilter = readOptionalString(req.query.type, 20);

  const filtered = allPeople.filter((person) => {
    if (statusFilter && person.status !== statusFilter) return false;
    if (typeFilter && person.personType !== typeFilter) return false;

    if (!search) return true;

    const haystack = [
      person.fullName,
      person.email ?? "",
      person.title ?? "",
      person.locationName ?? "",
      person.role ?? "",
    ].join(" ").toLowerCase();

    return haystack.includes(search);
  });

  res.json({
    items: filtered,
    totals: {
      total: filtered.length,
      active: filtered.filter((person) => person.status === "active").length,
      assignable: filtered.filter((person) => person.assignableToClients).length,
      schedulable: filtered.filter((person) => person.schedulable).length,
    },
  });
});

/**
 * GET /api/hrm/scheduling
 * Returns one date-scoped schedule with upcoming assignments and conflict detection.
 */
router.get("/scheduling", requirePermission("hrm.view"), async (req: Request, res: Response) => {
  const organizationId = await requireOrganizationId(req, res);
  if (!organizationId) return;

  const selectedDay = parseDayStart(readOptionalString(req.query.date, 20));
  const selectedDayEnd = dayEnd(selectedDay);

  const upcomingStart = new Date(selectedDay);
  const upcomingEnd = new Date(selectedDay);
  upcomingEnd.setDate(upcomingEnd.getDate() + 7);

  const [todayItems, upcomingItems, staffAvailability] = await Promise.all([
    buildScheduleItems({ organizationId, start: selectedDay, end: selectedDayEnd }),
    buildScheduleItems({ organizationId, start: upcomingStart, end: upcomingEnd }),
    prisma.compassionStaff.findMany({
      where: {
        organizationId,
        isActive: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        title: true,
        supportsScheduling: true,
      },
    }),
  ]);

  const conflicts = detectScheduleConflicts(upcomingItems);

  res.json({
    selectedDate: selectedDay.toISOString().slice(0, 10),
    todayItems,
    upcomingItems,
    conflicts,
    staffAvailability: staffAvailability.map((staff) => ({
      id: staff.id,
      fullName: staff.displayName?.trim() || `${staff.firstName} ${staff.lastName}`.trim(),
      title: staff.title,
      supportsScheduling: staff.supportsScheduling,
    })),
  });
});

/**
 * GET /api/hrm/locations
 * Returns persisted HRM locations with live assignment coverage for the selected day.
 */
router.get("/locations", requirePermission("hrm.view"), async (req: Request, res: Response) => {
  const organizationId = await requireOrganizationId(req, res);
  if (!organizationId) return;

  const selectedDay = parseDayStart(readOptionalString(req.query.date, 20));
  const selectedDayEnd = dayEnd(selectedDay);
  const search = readOptionalString(req.query.search, 120)?.toLowerCase() ?? null;
  const status = readOptionalString(req.query.status, 20);

  const locations = await prisma.hrmLocation.findMany({
    where: {
      organizationId,
      ...(status === "ACTIVE" || status === "INACTIVE" ? { status: status as "ACTIVE" | "INACTIVE" } : {}),
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  const scheduleItems = await buildScheduleItems({ organizationId, start: selectedDay, end: selectedDayEnd });
  const coverageMap = new Map<string, number>();

  for (const item of scheduleItems) {
    const key = item.location?.trim().toLowerCase();
    if (!key) continue;
    coverageMap.set(key, (coverageMap.get(key) ?? 0) + 1);
  }

  const items = locations
    .map((location) => {
      const coverageToday = coverageMap.get(location.name.trim().toLowerCase()) ?? 0;
      return {
        id: location.id,
        name: location.name,
        code: location.code,
        timezone: location.timezone,
        status: location.status,
        addressLine1: location.addressLine1,
        addressLine2: location.addressLine2,
        city: location.city,
        state: location.state,
        zip: location.zip,
        notes: location.notes,
        createdAt: location.createdAt,
        updatedAt: location.updatedAt,
        coverageToday,
      };
    })
    .filter((location) => {
      if (!search) return true;
      const haystack = [location.name, location.code ?? "", location.city ?? "", location.state ?? ""].join(" ").toLowerCase();
      return haystack.includes(search);
    });

  res.json({ items });
});

/**
 * POST /api/hrm/locations
 * Creates one persisted HRM location row.
 */
router.post("/locations", requirePermission("hrm.locations.manage"), async (req: Request, res: Response) => {
  const organizationId = await requireOrganizationId(req, res);
  if (!organizationId) return;

  const name = readOptionalString(req.body?.name, 120);
  const timezone = readOptionalString(req.body?.timezone, 120) ?? "America/Chicago";
  const code = readOptionalString(req.body?.code, 40);
  const status = readOptionalString(req.body?.status, 20);

  if (!name) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Location name is required." } });
    return;
  }

  try {
    const created = await prisma.hrmLocation.create({
      data: {
        organizationId,
        name,
        code,
        timezone,
        status: status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
        addressLine1: readOptionalString(req.body?.addressLine1, 180),
        addressLine2: readOptionalString(req.body?.addressLine2, 180),
        city: readOptionalString(req.body?.city, 120),
        state: readOptionalString(req.body?.state, 60),
        zip: readOptionalString(req.body?.zip, 30),
        notes: readOptionalString(req.body?.notes, 4000),
      },
    });

    await logAudit({
      action: "HRM_LOCATION_CREATED",
      entity: "HrmLocation",
      entityId: created.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        name: created.name,
        code: created.code,
        status: created.status,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json({ item: created });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ error: { code: "CONFLICT", message: "Location name or code already exists." } });
      return;
    }
    throw error;
  }
});

/**
 * PATCH /api/hrm/locations/:id
 * Updates one persisted HRM location row.
 */
router.patch("/locations/:id", requirePermission("hrm.locations.manage"), async (req: Request, res: Response) => {
  const organizationId = await requireOrganizationId(req, res);
  if (!organizationId) return;

  const id = readOptionalString(req.params.id, 120);
  if (!id) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid location id." } });
    return;
  }

  const existing = await prisma.hrmLocation.findFirst({
    where: { id, organizationId },
    select: { id: true, name: true, status: true },
  });

  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Location not found." } });
    return;
  }

  try {
    const updated = await prisma.hrmLocation.update({
      where: { id: existing.id },
      data: {
        ...(req.body?.name !== undefined ? { name: readOptionalString(req.body.name, 120) ?? existing.name } : {}),
        ...(req.body?.code !== undefined ? { code: readOptionalString(req.body.code, 40) } : {}),
        ...(req.body?.timezone !== undefined ? { timezone: readOptionalString(req.body.timezone, 120) ?? "America/Chicago" } : {}),
        ...(req.body?.status !== undefined ? { status: readOptionalString(req.body.status, 20) === "INACTIVE" ? "INACTIVE" : "ACTIVE" } : {}),
        ...(req.body?.addressLine1 !== undefined ? { addressLine1: readOptionalString(req.body.addressLine1, 180) } : {}),
        ...(req.body?.addressLine2 !== undefined ? { addressLine2: readOptionalString(req.body.addressLine2, 180) } : {}),
        ...(req.body?.city !== undefined ? { city: readOptionalString(req.body.city, 120) } : {}),
        ...(req.body?.state !== undefined ? { state: readOptionalString(req.body.state, 60) } : {}),
        ...(req.body?.zip !== undefined ? { zip: readOptionalString(req.body.zip, 30) } : {}),
        ...(req.body?.notes !== undefined ? { notes: readOptionalString(req.body.notes, 4000) } : {}),
      },
    });

    await logAudit({
      action: "HRM_LOCATION_UPDATED",
      entity: "HrmLocation",
      entityId: updated.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        previousStatus: existing.status,
        status: updated.status,
        name: updated.name,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ item: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({ error: { code: "CONFLICT", message: "Location name or code already exists." } });
      return;
    }
    throw error;
  }
});

/**
 * GET /api/hrm/messages
 * Returns inbox/sent/announcement message lists for the authenticated user.
 */
router.get("/messages", requirePermission("hrm.view"), async (req: Request, res: Response) => {
  const organizationId = await requireOrganizationId(req, res);
  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!organizationId || !userId || !role) return;

  const folder = readOptionalString(req.query.folder, 30) ?? "inbox";
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 200);

  const inboxWhere: Prisma.HrmMessageWhereInput = {
    organizationId,
    archivedAt: null,
    OR: [
      { recipientUserId: userId },
      { recipientRole: role },
      { broadcastAll: true },
    ],
  };

  const where: Prisma.HrmMessageWhereInput =
    folder === "sent"
      ? {
          organizationId,
          archivedAt: null,
          senderUserId: userId,
        }
      : folder === "announcements"
        ? {
            organizationId,
            archivedAt: null,
            kind: "ANNOUNCEMENT",
          }
        : inboxWhere;

  const [items, unreadCount] = await Promise.all([
    prisma.hrmMessage.findMany({
      where,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        recipient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }),
    prisma.hrmMessage.count({
      where: {
        ...inboxWhere,
        readAt: null,
      },
    }),
  ]);

  res.json({
    items,
    unreadCount,
  });
});

/**
 * POST /api/hrm/messages
 * Creates one persisted internal HRM message.
 */
router.post("/messages", requirePermission("hrm.messages.manage"), async (req: Request, res: Response) => {
  const organizationId = await requireOrganizationId(req, res);
  const userId = req.user?.sub;
  if (!organizationId || !userId) return;

  const title = readOptionalString(req.body?.title, 180);
  const body = readOptionalString(req.body?.body, 12000);
  const recipientUserId = readOptionalString(req.body?.recipientUserId, 120);
  const recipientRole = readOptionalString(req.body?.recipientRole, 40);
  const broadcastAll = Boolean(req.body?.broadcastAll);
  const priorityRaw = readOptionalString(req.body?.priority, 20);
  const kindRaw = readOptionalString(req.body?.kind, 30);

  if (!title || !body) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "title and body are required." } });
    return;
  }

  if (!broadcastAll && !recipientUserId && !recipientRole) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Provide recipientUserId, recipientRole, or broadcastAll.",
      },
    });
    return;
  }

  if (recipientUserId) {
    const recipient = await prisma.user.findFirst({
      where: {
        id: recipientUserId,
        organizationId,
      },
      select: { id: true },
    });

    if (!recipient) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "recipientUserId is not valid in this organization." } });
      return;
    }
  }

  const priority: "LOW" | "NORMAL" | "HIGH" | "URGENT" =
    priorityRaw === "LOW" || priorityRaw === "NORMAL" || priorityRaw === "HIGH" || priorityRaw === "URGENT"
      ? priorityRaw
      : "NORMAL";

  const kind: "DIRECT" | "ANNOUNCEMENT" = kindRaw === "ANNOUNCEMENT" ? "ANNOUNCEMENT" : "DIRECT";

  const created = await prisma.hrmMessage.create({
    data: {
      organizationId,
      senderUserId: userId,
      recipientUserId,
      recipientRole,
      broadcastAll,
      title,
      body,
      priority,
      kind,
    },
    include: {
      sender: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
      recipient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  await logAudit({
    action: "HRM_MESSAGE_SENT",
    entity: "HrmMessage",
    entityId: created.id,
    userId,
    organizationId,
    metadata: {
      kind: created.kind,
      priority: created.priority,
      recipientUserId: created.recipientUserId,
      recipientRole: created.recipientRole,
      broadcastAll: created.broadcastAll,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.status(201).json({ item: created });
});

/**
 * PATCH /api/hrm/messages/:id/read
 * Marks one message as read for recipient tracking.
 */
router.patch("/messages/:id/read", requirePermission("hrm.view"), async (req: Request, res: Response) => {
  const organizationId = await requireOrganizationId(req, res);
  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!organizationId || !userId || !role) return;

  const id = readOptionalString(req.params.id, 120);
  if (!id) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid message id." } });
    return;
  }

  const message = await prisma.hrmMessage.findFirst({
    where: {
      id,
      organizationId,
      archivedAt: null,
      OR: [
        { recipientUserId: userId },
        { recipientRole: role },
        { broadcastAll: true },
      ],
    },
    select: { id: true, readAt: true },
  });

  if (!message) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Message not found." } });
    return;
  }

  const updated = await prisma.hrmMessage.update({
    where: { id: message.id },
    data: {
      ...(message.readAt ? {} : { readAt: new Date() }),
    },
  });

  res.json({ item: updated });
});

/**
 * PATCH /api/hrm/messages/:id/archive
 * Archives one sent message so it no longer appears in normal message folders.
 */
router.patch("/messages/:id/archive", requirePermission("hrm.messages.manage"), async (req: Request, res: Response) => {
  const organizationId = await requireOrganizationId(req, res);
  const userId = req.user?.sub;
  if (!organizationId || !userId) return;

  const id = readOptionalString(req.params.id, 120);
  if (!id) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid message id." } });
    return;
  }

  const message = await prisma.hrmMessage.findFirst({
    where: {
      id,
      organizationId,
      senderUserId: userId,
      archivedAt: null,
    },
    select: { id: true },
  });

  if (!message) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Message not found." } });
    return;
  }

  const updated = await prisma.hrmMessage.update({
    where: { id: message.id },
    data: {
      archivedAt: new Date(),
    },
  });

  res.json({ item: updated });
});

/**
 * GET /api/hrm/settings
 * Returns persisted HRM settings and available active location options.
 */
router.get("/settings", requirePermission("hrm.view"), async (req: Request, res: Response) => {
  const organizationId = await requireOrganizationId(req, res);
  if (!organizationId) return;

  const organizationSettings = await prisma.organizationSettings.findUnique({
    where: { organizationId },
    select: { timezone: true },
  });

  const settings = await prisma.hrmSetting.upsert({
    where: { organizationId },
    update: {},
    create: {
      organizationId,
      defaultTimezone: organizationSettings?.timezone ?? "America/Chicago",
    },
  });

  const locationOptions = await prisma.hrmLocation.findMany({
    where: {
      organizationId,
      status: "ACTIVE",
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });

  res.json({
    item: settings,
    locationOptions,
  });
});

/**
 * PATCH /api/hrm/settings
 * Updates persisted HRM module settings.
 */
router.patch("/settings", requirePermission("hrm.settings.manage"), async (req: Request, res: Response) => {
  const organizationId = await requireOrganizationId(req, res);
  if (!organizationId) return;

  const defaultLocationId = readOptionalString(req.body?.defaultLocationId, 120);

  if (defaultLocationId) {
    const location = await prisma.hrmLocation.findFirst({
      where: {
        id: defaultLocationId,
        organizationId,
      },
      select: { id: true },
    });

    if (!location) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "defaultLocationId is not valid for this organization." } });
      return;
    }
  }

  const updated = await prisma.hrmSetting.upsert({
    where: { organizationId },
    update: {
      ...(req.body?.defaultTimezone !== undefined ? { defaultTimezone: readOptionalString(req.body.defaultTimezone, 120) ?? "America/Chicago" } : {}),
      ...(req.body?.defaultLocationId !== undefined ? { defaultLocationId } : {}),
      ...(req.body?.allowCompassionAssignmentSync !== undefined ? { allowCompassionAssignmentSync: Boolean(req.body.allowCompassionAssignmentSync) } : {}),
      ...(req.body?.requireSchedulableFlag !== undefined ? { requireSchedulableFlag: Boolean(req.body.requireSchedulableFlag) } : {}),
      ...(req.body?.messageDigestEnabled !== undefined ? { messageDigestEnabled: Boolean(req.body.messageDigestEnabled) } : {}),
    },
    create: {
      organizationId,
      defaultTimezone: readOptionalString(req.body?.defaultTimezone, 120) ?? "America/Chicago",
      defaultLocationId,
      allowCompassionAssignmentSync: req.body?.allowCompassionAssignmentSync !== undefined
        ? Boolean(req.body.allowCompassionAssignmentSync)
        : true,
      requireSchedulableFlag: req.body?.requireSchedulableFlag !== undefined
        ? Boolean(req.body.requireSchedulableFlag)
        : true,
      messageDigestEnabled: req.body?.messageDigestEnabled !== undefined
        ? Boolean(req.body.messageDigestEnabled)
        : false,
    },
  });

  await logAudit({
    action: "HRM_SETTINGS_UPDATED",
    entity: "HrmSetting",
    entityId: updated.id,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      defaultTimezone: updated.defaultTimezone,
      defaultLocationId: updated.defaultLocationId,
      allowCompassionAssignmentSync: updated.allowCompassionAssignmentSync,
      requireSchedulableFlag: updated.requireSchedulableFlag,
      messageDigestEnabled: updated.messageDigestEnabled,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({ item: updated });
});

/** Exposes persisted HRM API routes for the OyamaHRM module. */
export default router;
