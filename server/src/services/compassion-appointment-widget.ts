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
  };
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
  };
}
