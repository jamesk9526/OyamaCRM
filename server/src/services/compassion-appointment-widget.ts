/** Shared parser and defaults for Compassion public appointment widget configuration. */

import { randomUUID } from "crypto";
import type { CompassionAppointmentType } from "@prisma/client";

export const APPOINTMENT_WIDGET_PLUGIN_KEY = "compassion_appointments_widget";

export const APPOINTMENT_TYPE_OPTIONS: CompassionAppointmentType[] = [
  "INTAKE",
  "PREGNANCY_TEST",
  "ULTRASOUND",
  "PARENTING_CLASS",
  "MATERIAL_ASSISTANCE",
  "RESOURCE_REFERRAL",
  "FOLLOW_UP",
  "MENTORING",
  "CASE_REVIEW",
  "HOME_VISIT",
  "OTHER",
];

const APPOINTMENT_TYPE_SET = new Set<CompassionAppointmentType>(APPOINTMENT_TYPE_OPTIONS);
const HEX_COLOR = /^#(?:[0-9a-fA-F]{6})$/;
const LOGO_DATA_URL_PREFIX = /^data:image\/(png|jpeg|jpg|webp|gif);base64,/i;
const MAX_LOGO_DATA_URL_LENGTH = 220000;
const TIME_24H = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export type AppointmentWidgetFieldKey = "email" | "phone" | "appointmentType" | "location" | "notes";
export type AppointmentWidgetQuestionType = "text" | "textarea" | "select" | "checkbox";

export interface AppointmentWidgetFieldConfig {
  key: AppointmentWidgetFieldKey;
  enabled: boolean;
  required: boolean;
  label: string;
  placeholder?: string;
  helperText?: string;
}

export interface AppointmentWidgetCustomQuestion {
  id: string;
  label: string;
  type: AppointmentWidgetQuestionType;
  required: boolean;
  placeholder?: string;
  helperText?: string;
  options: string[];
}

export interface AppointmentWidgetAvailabilityBlock {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string;
  appointmentType: CompassionAppointmentType | "ANY";
  capacity: number;
  isActive: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface AppointmentWidgetBlackoutDate {
  date: string;
  reason?: string;
}

export interface AppointmentWidgetConfig {
  enabled: boolean;
  token: string;
  title: string;
  description: string;
  confirmationMessage: string;
  locationOptions: string[];
  defaultAppointmentType: CompassionAppointmentType;
  appointmentTypeOptions: CompassionAppointmentType[];
  allowTypeSelection: boolean;
  requireEmail: boolean;
  requirePhone: boolean;
  submitButtonText: string;
  privacyNote: string;
  logoDataUrl: string;
  logoAltText: string;
  primaryColor: string;
  secondaryColor: string;
  surfaceColor: string;
  textColor: string;
  enabledFields: AppointmentWidgetFieldConfig[];
  customQuestions: AppointmentWidgetCustomQuestion[];
  slotIntervalMinutes: number;
  appointmentDurationMinutes: number;
  minLeadHours: number;
  maxAdvanceDays: number;
  availabilityBlocks: AppointmentWidgetAvailabilityBlock[];
  blackoutDates: AppointmentWidgetBlackoutDate[];
}

export interface AppointmentSlotReservation {
  startTime: Date;
  location: string | null;
  appointmentType: CompassionAppointmentType;
  status?: string;
}

export interface AppointmentWidgetAvailableSlot {
  startTime: string;
  endTime: string;
  location: string;
  appointmentType: CompassionAppointmentType | "ANY";
  capacity: number;
  remainingCapacity: number;
}

/** Generates a fresh public token for a widget link. */
export function createWidgetToken(): string {
  return randomUUID();
}

/** Returns baseline configurable field settings for the public appointment form. */
export function buildDefaultWidgetFields(): AppointmentWidgetFieldConfig[] {
  return [
    { key: "email", enabled: true, required: false, label: "Email", placeholder: "you@example.org", helperText: "" },
    { key: "phone", enabled: true, required: true, label: "Phone", placeholder: "(555) 123-4567", helperText: "" },
    { key: "appointmentType", enabled: true, required: false, label: "Appointment Type", placeholder: "", helperText: "" },
    { key: "location", enabled: true, required: false, label: "Preferred Location", placeholder: "", helperText: "" },
    { key: "notes", enabled: true, required: false, label: "Notes", placeholder: "Share anything that helps us prepare for your visit.", helperText: "" },
  ];
}

/** Returns default config for first-time widget setup. */
export function buildDefaultWidgetConfig(): AppointmentWidgetConfig {
  return {
    enabled: false,
    token: createWidgetToken(),
    title: "Request an Appointment",
    description: "Submit your request and our care team will follow up to confirm details.",
    confirmationMessage: "Thank you. Your appointment request was submitted.",
    locationOptions: ["Main Office"],
    defaultAppointmentType: "INTAKE",
    appointmentTypeOptions: ["INTAKE", "PREGNANCY_TEST", "ULTRASOUND", "FOLLOW_UP", "OTHER"],
    allowTypeSelection: true,
    requireEmail: false,
    requirePhone: true,
    submitButtonText: "Submit Appointment Request",
    privacyNote: "We keep your information private and only use it to coordinate your requested care.",
    logoDataUrl: "",
    logoAltText: "Organization logo",
    primaryColor: "#2563eb",
    secondaryColor: "#dbeafe",
    surfaceColor: "#f8fafc",
    textColor: "#0f172a",
    enabledFields: buildDefaultWidgetFields(),
    customQuestions: [],
    slotIntervalMinutes: 30,
    appointmentDurationMinutes: 60,
    minLeadHours: 12,
    maxAdvanceDays: 90,
    availabilityBlocks: [
      { id: "mon-main", dayOfWeek: 1, startTime: "09:00", endTime: "17:00", location: "Main Office", appointmentType: "ANY", capacity: 2, isActive: true },
      { id: "tue-main", dayOfWeek: 2, startTime: "09:00", endTime: "17:00", location: "Main Office", appointmentType: "ANY", capacity: 2, isActive: true },
      { id: "wed-main", dayOfWeek: 3, startTime: "09:00", endTime: "17:00", location: "Main Office", appointmentType: "ANY", capacity: 2, isActive: true },
      { id: "thu-main", dayOfWeek: 4, startTime: "09:00", endTime: "17:00", location: "Main Office", appointmentType: "ANY", capacity: 2, isActive: true },
      { id: "fri-main", dayOfWeek: 5, startTime: "09:00", endTime: "17:00", location: "Main Office", appointmentType: "ANY", capacity: 2, isActive: true },
    ],
    blackoutDates: [],
  };
}

/** Parses bounded integer-like values with safe fallback. */
function parseBoundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/** Parses HH:mm values into minute offsets. */
function parseTimeToMinutes(value: string): number | null {
  const match = TIME_24H.exec(value.trim());
  if (!match) return null;
  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
}

/** Returns local date key YYYY-MM-DD from a Date. */
function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Builds local Date from a YYYY-MM-DD key. */
function fromDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map((value) => Number.parseInt(value, 10));
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

/** Parses availability blocks and keeps only valid operational windows. */
function parseAvailabilityBlocks(values: unknown, fallback: AppointmentWidgetAvailabilityBlock[]): AppointmentWidgetAvailabilityBlock[] {
  if (!Array.isArray(values)) return fallback;

  const parsed = values
    .map((item, index): AppointmentWidgetAvailabilityBlock | null => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;

      const id = String(obj.id ?? `block_${index + 1}`).trim() || `block_${index + 1}`;
      const dayOfWeek = parseBoundedInt(obj.dayOfWeek, 1, 0, 6);

      const startTime = String(obj.startTime ?? "").trim();
      const endTime = String(obj.endTime ?? "").trim();
      const startMinutes = parseTimeToMinutes(startTime);
      const endMinutes = parseTimeToMinutes(endTime);
      if (startMinutes === null || endMinutes === null || endMinutes <= startMinutes) return null;

      const typeCandidate = String(obj.appointmentType ?? "ANY").trim();
      const appointmentType: CompassionAppointmentType | "ANY" =
        typeCandidate === "ANY"
          ? "ANY"
          : APPOINTMENT_TYPE_SET.has(typeCandidate as CompassionAppointmentType)
            ? (typeCandidate as CompassionAppointmentType)
            : "ANY";

      const effectiveFrom = String(obj.effectiveFrom ?? "").trim();
      const effectiveTo = String(obj.effectiveTo ?? "").trim();

      return {
        id,
        dayOfWeek,
        startTime,
        endTime,
        location: String(obj.location ?? "").trim(),
        appointmentType,
        capacity: parseBoundedInt(obj.capacity, 1, 1, 20),
        isActive: typeof obj.isActive === "boolean" ? obj.isActive : true,
        effectiveFrom: DATE_KEY.test(effectiveFrom) ? effectiveFrom : undefined,
        effectiveTo: DATE_KEY.test(effectiveTo) ? effectiveTo : undefined,
      };
    })
    .filter((block): block is AppointmentWidgetAvailabilityBlock => Boolean(block));

  return parsed.length > 0 ? parsed.slice(0, 120) : fallback;
}

/** Parses one-off blackout dates that should never expose slots publicly. */
function parseBlackoutDates(values: unknown): AppointmentWidgetBlackoutDate[] {
  if (!Array.isArray(values)) return [];

  const parsed = values
    .map((item): AppointmentWidgetBlackoutDate | null => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const date = String(obj.date ?? "").trim();
      if (!DATE_KEY.test(date)) return null;

      return {
        date,
        reason: String(obj.reason ?? "").trim().slice(0, 160),
      };
    })
    .filter((value): value is AppointmentWidgetBlackoutDate => Boolean(value));

  return parsed.slice(0, 90);
}

/** Parses a single brand color and falls back when invalid. */
function parseColor(value: unknown, fallback: string): string {
  const normalized = String(value ?? "").trim();
  return HEX_COLOR.test(normalized) ? normalized : fallback;
}

/** Parses and sanitizes an uploaded logo URL string. */
function parseLogoDataUrl(value: unknown, fallback: string): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) return "";
  if (!LOGO_DATA_URL_PREFIX.test(normalized)) return fallback;
  if (normalized.length > MAX_LOGO_DATA_URL_LENGTH) return fallback;
  return normalized;
}

/** Parses and normalizes appointment type arrays against enum-safe options. */
function parseAppointmentTypes(values: unknown, fallback: CompassionAppointmentType[]): CompassionAppointmentType[] {
  if (!Array.isArray(values)) return fallback;
  const normalized = values
    .map((value) => String(value ?? "").trim())
    .filter((value): value is CompassionAppointmentType => APPOINTMENT_TYPE_SET.has(value as CompassionAppointmentType));

  const unique = Array.from(new Set(normalized));
  return unique.length > 0 ? unique : fallback;
}

/** Parses enabled field customizations while preserving default keys. */
function parseFieldConfig(values: unknown, fallback: AppointmentWidgetFieldConfig[]): AppointmentWidgetFieldConfig[] {
  const fallbackMap = new Map(fallback.map((field) => [field.key, field]));
  if (!Array.isArray(values)) return fallback;

  const inputMap = new Map<string, Record<string, unknown>>();
  for (const item of values) {
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const key = String(obj.key ?? "").trim();
      if (fallbackMap.has(key as AppointmentWidgetFieldKey)) {
        inputMap.set(key, obj);
      }
    }
  }

  return fallback.map((defaults) => {
    const input = inputMap.get(defaults.key);
    if (!input) return defaults;

    return {
      key: defaults.key,
      enabled: typeof input.enabled === "boolean" ? input.enabled : defaults.enabled,
      required: typeof input.required === "boolean" ? input.required : defaults.required,
      label: typeof input.label === "string" && input.label.trim().length > 0 ? input.label.trim() : defaults.label,
      placeholder:
        typeof input.placeholder === "string" ? input.placeholder.trim() : (defaults.placeholder ?? ""),
      helperText:
        typeof input.helperText === "string" ? input.helperText.trim() : (defaults.helperText ?? ""),
    };
  });
}

/** Parses custom intake questions with limits to keep payloads bounded. */
function parseCustomQuestions(values: unknown): AppointmentWidgetCustomQuestion[] {
  if (!Array.isArray(values)) return [];

  const parsed = values
    .map((item, index): AppointmentWidgetCustomQuestion | null => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const id = String(obj.id ?? `q_${index + 1}`).trim() || `q_${index + 1}`;
      const label = String(obj.label ?? "").trim();
      if (!label) return null;

      const type = String(obj.type ?? "text").trim();
      const normalizedType: AppointmentWidgetQuestionType =
        type === "textarea" || type === "select" || type === "checkbox" ? type : "text";

      const options = Array.isArray(obj.options)
        ? obj.options.map((value) => String(value ?? "").trim()).filter(Boolean).slice(0, 20)
        : [];

      return {
        id,
        label: label.slice(0, 80),
        type: normalizedType,
        required: Boolean(obj.required),
        placeholder: String(obj.placeholder ?? "").trim().slice(0, 120),
        helperText: String(obj.helperText ?? "").trim().slice(0, 200),
        options,
      };
    })
    .filter((question): question is AppointmentWidgetCustomQuestion => Boolean(question));

  return parsed.slice(0, 6);
}

/** Parses persisted widget JSON into a safe runtime configuration. */
export function parseWidgetConfig(raw: unknown): AppointmentWidgetConfig {
  const defaults = buildDefaultWidgetConfig();
  if (!raw || typeof raw !== "object") return defaults;

  const obj = raw as Record<string, unknown>;
  const locationOptions = Array.isArray(obj.locationOptions)
    ? obj.locationOptions.map((value) => String(value).trim()).filter(Boolean).slice(0, 20)
    : defaults.locationOptions;

  const appointmentTypeOptions = parseAppointmentTypes(obj.appointmentTypeOptions, defaults.appointmentTypeOptions);
  const defaultAppointmentTypeCandidate = String(obj.defaultAppointmentType ?? defaults.defaultAppointmentType).trim();
  const defaultAppointmentType = APPOINTMENT_TYPE_SET.has(defaultAppointmentTypeCandidate as CompassionAppointmentType)
    ? (defaultAppointmentTypeCandidate as CompassionAppointmentType)
    : defaults.defaultAppointmentType;
  const slotIntervalMinutes = parseBoundedInt(obj.slotIntervalMinutes, defaults.slotIntervalMinutes, 5, 180);
  const appointmentDurationMinutes = parseBoundedInt(obj.appointmentDurationMinutes, defaults.appointmentDurationMinutes, 5, 240);

  return {
    enabled: typeof obj.enabled === "boolean" ? obj.enabled : defaults.enabled,
    token: typeof obj.token === "string" && obj.token.trim().length > 0 ? obj.token.trim() : defaults.token,
    title: typeof obj.title === "string" && obj.title.trim().length > 0 ? obj.title.trim() : defaults.title,
    description: typeof obj.description === "string" ? obj.description.trim() : defaults.description,
    confirmationMessage:
      typeof obj.confirmationMessage === "string" && obj.confirmationMessage.trim().length > 0
        ? obj.confirmationMessage.trim()
        : defaults.confirmationMessage,
    locationOptions: locationOptions.length > 0 ? locationOptions : defaults.locationOptions,
    defaultAppointmentType,
    appointmentTypeOptions,
    allowTypeSelection: typeof obj.allowTypeSelection === "boolean" ? obj.allowTypeSelection : defaults.allowTypeSelection,
    requireEmail: typeof obj.requireEmail === "boolean" ? obj.requireEmail : defaults.requireEmail,
    requirePhone: typeof obj.requirePhone === "boolean" ? obj.requirePhone : defaults.requirePhone,
    submitButtonText:
      typeof obj.submitButtonText === "string" && obj.submitButtonText.trim().length > 0
        ? obj.submitButtonText.trim()
        : defaults.submitButtonText,
    privacyNote:
      typeof obj.privacyNote === "string" && obj.privacyNote.trim().length > 0
        ? obj.privacyNote.trim()
        : defaults.privacyNote,
    logoDataUrl: parseLogoDataUrl(obj.logoDataUrl, defaults.logoDataUrl),
    logoAltText:
      typeof obj.logoAltText === "string" && obj.logoAltText.trim().length > 0
        ? obj.logoAltText.trim()
        : defaults.logoAltText,
    primaryColor: parseColor(obj.primaryColor, defaults.primaryColor),
    secondaryColor: parseColor(obj.secondaryColor, defaults.secondaryColor),
    surfaceColor: parseColor(obj.surfaceColor, defaults.surfaceColor),
    textColor: parseColor(obj.textColor, defaults.textColor),
    enabledFields: parseFieldConfig(obj.enabledFields, defaults.enabledFields),
    customQuestions: parseCustomQuestions(obj.customQuestions),
    slotIntervalMinutes,
    appointmentDurationMinutes,
    minLeadHours: parseBoundedInt(obj.minLeadHours, defaults.minLeadHours, 0, 336),
    maxAdvanceDays: parseBoundedInt(obj.maxAdvanceDays, defaults.maxAdvanceDays, 1, 365),
    availabilityBlocks: parseAvailabilityBlocks(obj.availabilityBlocks, defaults.availabilityBlocks),
    blackoutDates: parseBlackoutDates(obj.blackoutDates),
  };
}

/** Returns true when an appointment status should consume booking capacity. */
function blocksCapacity(status: string | undefined): boolean {
  return status !== "CANCELLED" && status !== "NO_SHOW";
}

/** Evaluates date-range filters for recurring availability blocks. */
function blockAppliesToDate(block: AppointmentWidgetAvailabilityBlock, dateKey: string): boolean {
  if (!block.isActive) return false;
  if (block.effectiveFrom && dateKey < block.effectiveFrom) return false;
  if (block.effectiveTo && dateKey > block.effectiveTo) return false;
  return true;
}

/** Computes available slots from configured office availability and existing appointment load. */
export function buildWidgetAvailableSlots(params: {
  config: AppointmentWidgetConfig;
  date: Date;
  appointments: AppointmentSlotReservation[];
  now?: Date;
  requestedLocation?: string;
  requestedAppointmentType?: CompassionAppointmentType;
}): AppointmentWidgetAvailableSlot[] {
  const now = params.now ?? new Date();
  const dateKey = toDateKey(params.date);
  const daysAhead = Math.floor((fromDateKey(dateKey).getTime() - fromDateKey(toDateKey(now)).getTime()) / (24 * 60 * 60 * 1000));
  if (daysAhead < 0 || daysAhead > params.config.maxAdvanceDays) return [];
  if (params.config.blackoutDates.some((item) => item.date === dateKey)) return [];

  const requestedLocation = (params.requestedLocation ?? "").trim();
  const requestedAppointmentType = params.requestedAppointmentType;
  const leadCutoff = new Date(now.getTime() + params.config.minLeadHours * 60 * 60 * 1000);

  const slotsByKey = new Map<string, AppointmentWidgetAvailableSlot>();
  const weekday = fromDateKey(dateKey).getDay();

  for (const block of params.config.availabilityBlocks) {
    if (block.dayOfWeek !== weekday) continue;
    if (!blockAppliesToDate(block, dateKey)) continue;

    if (requestedLocation && block.location && block.location !== requestedLocation) continue;
    if (
      requestedAppointmentType
      && block.appointmentType !== "ANY"
      && block.appointmentType !== requestedAppointmentType
    ) {
      continue;
    }

    const startMinutes = parseTimeToMinutes(block.startTime);
    const endMinutes = parseTimeToMinutes(block.endTime);
    if (startMinutes === null || endMinutes === null) continue;

    const slotLocation = block.location || requestedLocation || params.config.locationOptions[0] || "";
    const blockType = block.appointmentType;

    for (let minute = startMinutes; minute + params.config.appointmentDurationMinutes <= endMinutes; minute += params.config.slotIntervalMinutes) {
      const slotStart = fromDateKey(dateKey);
      slotStart.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
      if (slotStart.getTime() < leadCutoff.getTime()) continue;

      const slotEnd = new Date(slotStart.getTime() + params.config.appointmentDurationMinutes * 60 * 1000);
      const reservationCount = params.appointments.filter((appointment) => {
        if (!blocksCapacity(appointment.status)) return false;
        if (appointment.startTime.getTime() !== slotStart.getTime()) return false;

        const appointmentLocation = (appointment.location ?? "").trim();
        if (slotLocation && appointmentLocation && appointmentLocation !== slotLocation) return false;

        if (blockType !== "ANY" && appointment.appointmentType !== blockType) return false;
        if (requestedAppointmentType && appointment.appointmentType !== requestedAppointmentType && blockType === "ANY") return false;
        return true;
      }).length;

      const remainingCapacity = Math.max(0, block.capacity - reservationCount);
      if (remainingCapacity < 1) continue;

      const slotKey = `${slotStart.toISOString()}|${slotLocation}|${blockType}`;
      const existing = slotsByKey.get(slotKey);
      const candidate: AppointmentWidgetAvailableSlot = {
        startTime: slotStart.toISOString(),
        endTime: slotEnd.toISOString(),
        location: slotLocation,
        appointmentType: blockType,
        capacity: block.capacity,
        remainingCapacity,
      };

      if (!existing || candidate.remainingCapacity > existing.remainingCapacity) {
        slotsByKey.set(slotKey, candidate);
      }
    }
  }

  return [...slotsByKey.values()].sort((left, right) => left.startTime.localeCompare(right.startTime));
}
