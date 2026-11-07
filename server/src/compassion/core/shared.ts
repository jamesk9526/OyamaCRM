import type {
CompassionAppointmentStatus
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "../database.js";
export const CLIENT_ACTIVITY_ENTRY_TYPES = [
  "CLIENT_NOTE",
  "CLIENT_ASSESSMENT",
  "CLIENT_DOCUMENT",
  "CLIENT_COMMUNICATION",
  "CLIENT_PORTAL_EVENT",
] as const;

export const CLIENT_ACTIVITY_ENTRY_TYPE_SET = new Set<string>(CLIENT_ACTIVITY_ENTRY_TYPES);

export function isAllowedClientActivityEntryType(activityType: string): boolean {
  return CLIENT_ACTIVITY_ENTRY_TYPE_SET.has(activityType);
}

export function normalizeActivityMetadata(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function normalizeOptionalId(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

export function resolveStaffReference(params: {
  assignedCompassionStaff?: {
    id: string;
    firstName: string;
    lastName: string;
    displayName?: string | null;
  } | null;
  assignedStaff?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}) {
  if (params.assignedCompassionStaff) {
    return {
      id: params.assignedCompassionStaff.id,
      firstName: params.assignedCompassionStaff.firstName,
      lastName: params.assignedCompassionStaff.lastName,
      displayName: params.assignedCompassionStaff.displayName ?? null,
    };
  }
  if (params.assignedStaff) {
    return {
      id: params.assignedStaff.id,
      firstName: params.assignedStaff.firstName,
      lastName: params.assignedStaff.lastName,
      displayName: null,
    };
  }
  return null;
}

export function mapCompassionStaffRow(staff: {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  supportsScheduling: boolean;
  linkedUserId: string | null;
  notes: string | null;
  linkedUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
    active: boolean;
  } | null;
}) {
  const fullName = (staff.displayName ?? "").trim() || `${staff.firstName} ${staff.lastName}`.trim();
  return {
    id: staff.id,
    firstName: staff.firstName,
    lastName: staff.lastName,
    displayName: staff.displayName,
    fullName,
    title: staff.title,
    email: staff.email,
    phone: staff.phone,
    isActive: staff.isActive,
    supportsScheduling: staff.supportsScheduling,
    linkedUserId: staff.linkedUserId,
    hasLinkedAccount: Boolean(staff.linkedUserId),
    notes: staff.notes,
    linkedUser: staff.linkedUser ?? null,
  };
}

export async function getValidCompassionStaff(params: {
  organizationId: string;
  compassionStaffId: string | null;
  requireActive?: boolean;
}) {
  if (!params.compassionStaffId) return null;
  return prisma.compassionStaff.findFirst({
    where: {
      id: params.compassionStaffId,
      organizationId: params.organizationId,
      ...(params.requireActive ? { isActive: true } : {}),
    },
    select: {
      id: true,
      linkedUserId: true,
      firstName: true,
      lastName: true,
      displayName: true,
      supportsScheduling: true,
    },
  });
}

export async function hasValidLegacyStaffUser(params: {
  organizationId: string;
  assignedStaffId: string | null;
}) {
  if (!params.assignedStaffId) return true;
  const match = await prisma.user.findFirst({
    where: {
      id: params.assignedStaffId,
      organizationId: params.organizationId,
    },
    select: { id: true },
  });
  return Boolean(match);
}

export function computeFamilyKey(client: {
  id: string;
  lastName: string;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
}): string {
  const address = (client.addressLine1 ?? "").trim().toLowerCase();
  const city = (client.city ?? "").trim().toLowerCase();
  const state = (client.state ?? "").trim().toLowerCase();
  const zip = (client.zip ?? "").trim().toLowerCase();
  const digits = (client.phone ?? "").replace(/\D/g, "");
  const lastName = (client.lastName ?? "").trim().toLowerCase();

  if (address) {
    return `address:${address}|${zip || `${city}|${state}`}`;
  }
  if (digits.length >= 10) {
    return `phone:${digits.slice(-10)}`;
  }
  if (lastName && zip) {
    return `namezip:${lastName}|${zip}`;
  }
  return `client:${client.id}`;
}

export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 60;

export const APPOINTMENT_BLOCKING_STATUSES: CompassionAppointmentStatus[] = ["SCHEDULED", "CHECKED_IN", "RESCHEDULED"];

export function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

export function sanitizeDurationMinutes(rawValue: unknown): number {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return DEFAULT_APPOINTMENT_DURATION_MINUTES;
  return Math.min(12 * 60, Math.max(5, Math.round(parsed)));
}

export function normalizeLocation(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function resolveAppointmentWindow(params: {
  startTime: unknown;
  endTime?: unknown;
  durationMinutes?: unknown;
}): { start: Date; end: Date; durationMinutes: number } | null {
  const start = new Date(String(params.startTime ?? ""));
  if (Number.isNaN(start.getTime())) return null;

  if (params.endTime !== undefined && params.endTime !== null && params.endTime !== "") {
    const explicitEnd = new Date(String(params.endTime));
    if (Number.isNaN(explicitEnd.getTime()) || explicitEnd <= start) return null;
    const explicitDuration = Math.max(5, Math.round((explicitEnd.getTime() - start.getTime()) / 60_000));
    return { start, end: explicitEnd, durationMinutes: explicitDuration };
  }

  const durationMinutes = sanitizeDurationMinutes(params.durationMinutes);
  return { start, end: addMinutes(start, durationMinutes), durationMinutes };
}

export interface AppointmentConflict {
  id: string;
  startTime: string;
  endTime: string;
  reasons: Array<"CLIENT" | "STAFF" | "LOCATION">;
  clientName: string;
  assignedStaffName: string | null;
  location: string | null;
}

export async function findAppointmentConflicts(params: {
  organizationId: string;
  start: Date;
  end: Date;
  clientId: string;
  assignedCompassionStaffId?: string | null;
  assignedStaffId?: string | null;
  location?: string | null;
  excludeAppointmentId?: string;
}): Promise<AppointmentConflict[]> {
  const where: Prisma.CompassionAppointmentWhereInput = {
    organizationId: params.organizationId,
    status: { in: APPOINTMENT_BLOCKING_STATUSES },
    startTime: { lt: params.end },
    OR: [{ endTime: null }, { endTime: { gt: params.start } }],
    ...(params.excludeAppointmentId ? { id: { not: params.excludeAppointmentId } } : {}),
  };

  const candidates = await prisma.compassionAppointment.findMany({
    where,
    include: {
      client: { select: { firstName: true, lastName: true } },
      assignedStaff: { select: { firstName: true, lastName: true } },
      assignedCompassionStaff: { select: { firstName: true, lastName: true, displayName: true } },
    },
  });

  const targetLocation = normalizeLocation(params.location);
  const conflicts: AppointmentConflict[] = [];

  for (const candidate of candidates) {
    const candidateEnd = candidate.endTime ?? addMinutes(candidate.startTime, DEFAULT_APPOINTMENT_DURATION_MINUTES);
    const overlaps = candidate.startTime < params.end && candidateEnd > params.start;
    if (!overlaps) continue;

    const reasons: Array<"CLIENT" | "STAFF" | "LOCATION"> = [];
    if (candidate.clientId === params.clientId) reasons.push("CLIENT");
    const sameCompassionStaff = Boolean(
      params.assignedCompassionStaffId
      && candidate.assignedCompassionStaffId
      && candidate.assignedCompassionStaffId === params.assignedCompassionStaffId,
    );
    const sameLegacyStaff = Boolean(
      params.assignedStaffId
      && candidate.assignedStaffId
      && candidate.assignedStaffId === params.assignedStaffId,
    );
    if (sameCompassionStaff || sameLegacyStaff) reasons.push("STAFF");

    const candidateLocation = normalizeLocation(candidate.location);
    if (targetLocation && candidateLocation && candidateLocation === targetLocation) reasons.push("LOCATION");

    if (reasons.length === 0) continue;

    conflicts.push({
      id: candidate.id,
      startTime: candidate.startTime.toISOString(),
      endTime: candidateEnd.toISOString(),
      reasons,
      clientName: `${candidate.client.firstName} ${candidate.client.lastName}`,
      assignedStaffName: candidate.assignedCompassionStaff
        ? (candidate.assignedCompassionStaff.displayName ?? `${candidate.assignedCompassionStaff.firstName} ${candidate.assignedCompassionStaff.lastName}`)
        : (candidate.assignedStaff ? `${candidate.assignedStaff.firstName} ${candidate.assignedStaff.lastName}` : null),
      location: candidate.location ?? null,
    });
  }

  return conflicts;
}

export function mapAppointmentForWorkspace<T extends {
  startTime: Date;
  endTime: Date | null;
  followUpNeeded: boolean;
  assignedCompassionStaff?: { id: string; firstName: string; lastName: string; displayName?: string | null } | null;
  assignedStaff?: { id: string; firstName: string; lastName: string } | null;
  client: { id: string; firstName: string; lastName: string; email?: string | null; phone?: string | null; intakeDate?: Date | null };
}>(
  appointment: T,
  firstAppointmentByClient: Map<string, number>,
  noShowCountByClient: Map<string, number>,
) {
  const resolvedEnd = appointment.endTime ?? addMinutes(appointment.startTime, DEFAULT_APPOINTMENT_DURATION_MINUTES);
  const durationMinutes = Math.max(5, Math.round((resolvedEnd.getTime() - appointment.startTime.getTime()) / 60_000));
  const firstStart = firstAppointmentByClient.get(appointment.client.id);
  const noShowCount = noShowCountByClient.get(appointment.client.id) ?? 0;
  const hasContact = Boolean((appointment.client.email ?? "").trim() || (appointment.client.phone ?? "").trim());

  return {
    ...appointment,
    endTime: resolvedEnd,
    durationMinutes,
    assignedStaff: resolveStaffReference({
      assignedCompassionStaff: appointment.assignedCompassionStaff,
      assignedStaff: appointment.assignedStaff,
    }),
    staff: resolveStaffReference({
      assignedCompassionStaff: appointment.assignedCompassionStaff,
      assignedStaff: appointment.assignedStaff,
    }),
    flags: {
      firstVisit: typeof firstStart === "number" && firstStart === appointment.startTime.getTime(),
      followUpNeeded: Boolean(appointment.followUpNeeded),
      noShowRisk: noShowCount > 0,
      incompleteIntake: !hasContact,
      noShowCount,
    },
  };
}
