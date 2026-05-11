// Compassion CRM Settings page — appointment widget builder for public and embeddable booking.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

type WidgetFieldKey = "email" | "phone" | "appointmentType" | "location" | "notes";
type CustomQuestionType = "text" | "textarea" | "select" | "checkbox";

interface AppointmentWidgetFieldConfig {
  key: WidgetFieldKey;
  enabled: boolean;
  required: boolean;
  label: string;
  placeholder?: string;
  helperText?: string;
}

interface AppointmentWidgetCustomQuestion {
  id: string;
  label: string;
  type: CustomQuestionType;
  required: boolean;
  placeholder?: string;
  helperText?: string;
  options: string[];
}

interface AppointmentWidgetAvailabilityBlock {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  location: string;
  appointmentType: string;
  capacity: number;
  isActive: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
}

interface AppointmentWidgetBlackoutDate {
  date: string;
  reason?: string;
}

interface AppointmentWidgetConfig {
  enabled: boolean;
  token: string;
  title: string;
  description: string;
  confirmationMessage: string;
  locationOptions: string[];
  defaultAppointmentType: string;
  appointmentTypeOptions: string[];
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

interface WidgetSettingsResponse {
  enabled: boolean;
  config: AppointmentWidgetConfig;
  publicUrl: string;
  iframeSnippet: string;
  scriptSnippet: string;
}

const APPOINTMENT_TYPES = [
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

const DAYS_OF_WEEK: Array<{ value: number; label: string }> = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

/** Converts enum values into user-facing labels. */
function humanize(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Creates a new blank custom question row for intake customization. */
function createEmptyCustomQuestion(index: number): AppointmentWidgetCustomQuestion {
  return {
    id: `custom_${index}_${Date.now()}`,
    label: "",
    type: "text",
    required: false,
    placeholder: "",
    helperText: "",
    options: [],
  };
}

/** Creates a new recurring office-hour block for slot generation. */
function createEmptyAvailabilityBlock(index: number): AppointmentWidgetAvailabilityBlock {
  return {
    id: `block_${index}_${Date.now()}`,
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "17:00",
    location: "Main Office",
    appointmentType: "ANY",
    capacity: 1,
    isActive: true,
    effectiveFrom: "",
    effectiveTo: "",
  };
}

/**
 * CompassionSettingsPage hosts the public appointment widget builder.
 * TODO: enforce Compassion workspace permission
 */
export default function CompassionSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [form, setForm] = useState<AppointmentWidgetConfig | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [publicUrl, setPublicUrl] = useState("");
  const [iframeSnippet, setIframeSnippet] = useState("");
  const [scriptSnippet, setScriptSnippet] = useState("");
  const [locationsInput, setLocationsInput] = useState("");

  const enabledFieldMap = useMemo(() => {
    const map = new Map<WidgetFieldKey, AppointmentWidgetFieldConfig>();
    for (const field of form?.enabledFields ?? []) {
      map.set(field.key, field);
    }
    return map;
  }, [form]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<WidgetSettingsResponse>("/api/compassion/appointment-widget");
      setEnabled(Boolean(data.enabled));
      setForm(data.config);
      setPublicUrl(data.publicUrl);
      setIframeSnippet(data.iframeSnippet);
      setScriptSnippet(data.scriptSnippet);
      setLocationsInput((data.config.locationOptions || []).join(", "));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load widget settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const previewTitle = useMemo(() => form?.title || "Request an Appointment", [form]);

  /** Replaces one field config while preserving order and key identity. */
  function updateFieldConfig(key: WidgetFieldKey, updater: (field: AppointmentWidgetFieldConfig) => AppointmentWidgetFieldConfig) {
    setForm((current) => {
      if (!current) return current;
      const updatedFields = current.enabledFields.map((field) => (field.key === key ? updater(field) : field));
      const emailField = updatedFields.find((field) => field.key === "email");
      const phoneField = updatedFields.find((field) => field.key === "phone");
      return {
        ...current,
        enabledFields: updatedFields,
        requireEmail: emailField?.required ?? current.requireEmail,
        requirePhone: phoneField?.required ?? current.requirePhone,
      };
    });
  }

  /** Reads an uploaded logo file and stores it in widget config as a data URL. */
  async function onLogoFileSelected(file: File | null) {
    if (!file || !form) return;
    if (!file.type.startsWith("image/")) {
      setError("Logo must be an image file.");
      return;
    }
    if (file.size > 160000) {
      setError("Logo file is too large. Please use an image under 160KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setForm((current) => (current ? { ...current, logoDataUrl: result } : current));
      setSaved("Logo updated.");
    };
    reader.onerror = () => {
      setError("Failed to read logo file.");
    };
    reader.readAsDataURL(file);
  }

  /** Adds one custom question row to the builder, capped server-side at six. */
  function addCustomQuestion() {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        customQuestions: [...current.customQuestions, createEmptyCustomQuestion(current.customQuestions.length + 1)],
      };
    });
  }

  /** Updates one custom question by id. */
  function updateCustomQuestion(id: string, patch: Partial<AppointmentWidgetCustomQuestion>) {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        customQuestions: current.customQuestions.map((question) => {
          if (question.id !== id) return question;
          return { ...question, ...patch };
        }),
      };
    });
  }

  /** Removes one custom question from the builder list. */
  function removeCustomQuestion(id: string) {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        customQuestions: current.customQuestions.filter((question) => question.id !== id),
      };
    });
  }

  /** Adds one recurring office-hours block for public slot generation. */
  function addAvailabilityBlock() {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        availabilityBlocks: [
          ...(current.availabilityBlocks ?? []),
          createEmptyAvailabilityBlock((current.availabilityBlocks?.length ?? 0) + 1),
        ],
      };
    });
  }

  /** Updates one availability block by id. */
  function updateAvailabilityBlock(id: string, patch: Partial<AppointmentWidgetAvailabilityBlock>) {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        availabilityBlocks: (current.availabilityBlocks ?? []).map((block) =>
          block.id === id ? { ...block, ...patch } : block
        ),
      };
    });
  }

  /** Removes one availability block from slot policy settings. */
  function removeAvailabilityBlock(id: string) {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        availabilityBlocks: (current.availabilityBlocks ?? []).filter((block) => block.id !== id),
      };
    });
  }

  /** Adds one blackout date row. */
  function addBlackoutDate() {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        blackoutDates: [...(current.blackoutDates ?? []), { date: "", reason: "" }],
      };
    });
  }

  /** Updates blackout date values by row index. */
  function updateBlackoutDate(index: number, patch: Partial<AppointmentWidgetBlackoutDate>) {
    setForm((current) => {
      if (!current) return current;
      const next = [...(current.blackoutDates ?? [])];
      next[index] = { ...(next[index] ?? { date: "", reason: "" }), ...patch };
      return {
        ...current,
        blackoutDates: next,
      };
    });
  }

  /** Removes one blackout date row by index. */
  function removeBlackoutDate(index: number) {
    setForm((current) => {
      if (!current) return current;
      return {
        ...current,
        blackoutDates: (current.blackoutDates ?? []).filter((_, rowIndex) => rowIndex !== index),
      };
    });
  }

  /** Toggles one appointment type option in the selectable list. */
  function toggleAppointmentType(type: string) {
    setForm((current) => {
      if (!current) return current;
      const hasType = current.appointmentTypeOptions.includes(type);
      const appointmentTypeOptions = hasType
        ? current.appointmentTypeOptions.filter((item) => item !== type)
        : [...current.appointmentTypeOptions, type];

      return {
        ...current,
        appointmentTypeOptions: appointmentTypeOptions.length > 0 ? appointmentTypeOptions : [current.defaultAppointmentType],
      };
    });
  }

  async function save(regenerateToken = false) {
    if (!form) return;
    setSaving(true);
    setSaved(null);
    setError(null);

    try {
      const locationOptions = locationsInput
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const customQuestions = form.customQuestions
        .map((question) => ({
          ...question,
          label: question.label.trim(),
          placeholder: (question.placeholder ?? "").trim(),
          helperText: (question.helperText ?? "").trim(),
          options: question.options.filter(Boolean),
        }))
        .filter((question) => question.label.length > 0);

      const appointmentTypeOptions = form.appointmentTypeOptions.length > 0
        ? form.appointmentTypeOptions
        : [form.defaultAppointmentType];

      const availabilityBlocks = (form.availabilityBlocks ?? [])
        .map((block) => ({
          ...block,
          dayOfWeek: Number.isFinite(block.dayOfWeek) ? Math.max(0, Math.min(6, Number(block.dayOfWeek))) : 1,
          startTime: String(block.startTime ?? "").trim(),
          endTime: String(block.endTime ?? "").trim(),
          location: String(block.location ?? "").trim(),
          appointmentType: String(block.appointmentType ?? "ANY").trim() || "ANY",
          capacity: Math.max(1, Math.min(20, Number.parseInt(String(block.capacity ?? 1), 10) || 1)),
          effectiveFrom: String(block.effectiveFrom ?? "").trim(),
          effectiveTo: String(block.effectiveTo ?? "").trim(),
        }))
        .filter((block) => block.startTime.length > 0 && block.endTime.length > 0);

      const blackoutDates = (form.blackoutDates ?? [])
        .map((item) => ({
          date: String(item.date ?? "").trim(),
          reason: String(item.reason ?? "").trim(),
        }))
        .filter((item) => item.date.length > 0);

      const normalizedEmailField = enabledFieldMap.get("email");
      const normalizedPhoneField = enabledFieldMap.get("phone");

      await apiFetch("/api/compassion/appointment-widget", {
        method: "PUT",
        body: JSON.stringify({
          enabled,
          regenerateToken,
          config: {
            ...form,
            enabled,
            requireEmail: normalizedEmailField?.required ?? form.requireEmail,
            requirePhone: normalizedPhoneField?.required ?? form.requirePhone,
            appointmentTypeOptions,
            locationOptions: locationOptions.length > 0 ? locationOptions : ["Main Office"],
            customQuestions,
            slotIntervalMinutes: Math.max(5, Math.min(180, Number(form.slotIntervalMinutes) || 30)),
            appointmentDurationMinutes: Math.max(5, Math.min(240, Number(form.appointmentDurationMinutes) || 60)),
            minLeadHours: Math.max(0, Math.min(336, Number(form.minLeadHours) || 0)),
            maxAdvanceDays: Math.max(1, Math.min(365, Number(form.maxAdvanceDays) || 90)),
            availabilityBlocks,
            blackoutDates,
          },
        }),
      });

      setSaved(regenerateToken ? "Saved and generated a new public link." : "Widget settings saved.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save widget settings");
    } finally {
      setSaving(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setSaved("Copied to clipboard.");
    } catch {
      setError("Could not copy to clipboard in this browser.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-xl">⚙️</div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Build, publish, and embed your public appointment request form.</p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Public booking is in active development. Use this builder to configure and deploy a beta appointment intake flow.
      </div>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
      {saved && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{saved}</div>}

      {loading || !form ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center text-sm text-gray-400 animate-pulse">
          Loading widget builder...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-sm font-semibold text-blue-800">Compassion communications settings (in development)</p>
            <p className="text-sm text-blue-700 mt-1">
              Email sender settings, SMS sender settings, consent defaults, communication templates, and client communication log preferences are planned for this module.
            </p>
            <p className="text-xs text-blue-700 mt-2">TODO: backend API needed for Compassion module communication configuration persistence.</p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-sm font-semibold text-gray-900">Appointment Widget Builder</h2>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="h-4 w-4"
                />
                Widget enabled
              </label>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
              Customize branding, field behavior, intake questions, and appointment type options for your public request form.
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Form title</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => (f ? { ...f, title: e.target.value } : f))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
              <textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm((f) => (f ? { ...f, description: e.target.value } : f))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Submit button text</label>
                <input
                  value={form.submitButtonText}
                  onChange={(e) => setForm((f) => (f ? { ...f, submitButtonText: e.target.value } : f))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Logo alt text</label>
                <input
                  value={form.logoAltText}
                  onChange={(e) => setForm((f) => (f ? { ...f, logoAltText: e.target.value } : f))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Privacy note</label>
              <textarea
                rows={2}
                value={form.privacyNote}
                onChange={(e) => setForm((f) => (f ? { ...f, privacyNote: e.target.value } : f))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>

            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-700">Branding</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-gray-700">Upload logo</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => void onLogoFileSelected(event.target.files?.[0] ?? null)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                  {form.logoDataUrl && (
                    <button
                      onClick={() => setForm((f) => (f ? { ...f, logoDataUrl: "" } : f))}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Remove logo
                    </button>
                  )}
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3 flex items-center justify-center min-h-[90px]">
                  {form.logoDataUrl ? (
                    <img src={form.logoDataUrl} alt={form.logoAltText || "Organization logo"} className="max-h-14 object-contain" />
                  ) : (
                    <p className="text-xs text-gray-500">No logo uploaded</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[{ key: "primaryColor", label: "Primary color" }, { key: "secondaryColor", label: "Secondary color" }, { key: "surfaceColor", label: "Surface color" }, { key: "textColor", label: "Text color" }].map((item) => (
                  <div key={item.key}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{item.label}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={(form as Record<string, string>)[item.key]}
                        onChange={(e) => setForm((f) => (f ? { ...f, [item.key]: e.target.value } : f))}
                        className="h-9 w-11 rounded border border-gray-200 bg-white p-1"
                      />
                      <input
                        value={(form as Record<string, string>)[item.key]}
                        onChange={(e) => setForm((f) => (f ? { ...f, [item.key]: e.target.value } : f))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Default appointment type</label>
                <select
                  value={form.defaultAppointmentType}
                  onChange={(e) => setForm((f) => (f ? { ...f, defaultAppointmentType: e.target.value } : f))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {APPOINTMENT_TYPES.map((type) => (
                    <option key={type} value={type}>{humanize(type)}</option>
                  ))}
                </select>
                <label className="mt-2 inline-flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.allowTypeSelection}
                    onChange={(e) => setForm((f) => (f ? { ...f, allowTypeSelection: e.target.checked } : f))}
                    className="h-4 w-4"
                  />
                  Let clients choose appointment type
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Locations (comma separated)</label>
                <input
                  value={locationsInput}
                  onChange={(e) => setLocationsInput(e.target.value)}
                  placeholder="Main Office, Mobile Clinic"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">Selectable appointment types</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {APPOINTMENT_TYPES.map((type) => (
                  <label key={type} className="inline-flex items-center gap-2 text-xs text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.appointmentTypeOptions.includes(type)}
                      onChange={() => toggleAppointmentType(type)}
                      className="h-4 w-4"
                    />
                    {humanize(type)}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs font-semibold text-blue-800">Scheduling Availability (Source Of Truth)</p>
                <span className="text-[11px] text-blue-700">Used by public page and embed widget slot picker</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-blue-800 mb-1">Slot Interval (minutes)</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    step={5}
                    value={form.slotIntervalMinutes}
                    onChange={(e) => setForm((f) => (f ? { ...f, slotIntervalMinutes: Number.parseInt(e.target.value, 10) || 30 } : f))}
                    className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-blue-800 mb-1">Appointment Duration (minutes)</label>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    step={5}
                    value={form.appointmentDurationMinutes}
                    onChange={(e) => setForm((f) => (f ? { ...f, appointmentDurationMinutes: Number.parseInt(e.target.value, 10) || 60 } : f))}
                    className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-blue-800 mb-1">Lead Time (hours)</label>
                  <input
                    type="number"
                    min={0}
                    max={336}
                    step={1}
                    value={form.minLeadHours}
                    onChange={(e) => setForm((f) => (f ? { ...f, minLeadHours: Number.parseInt(e.target.value, 10) || 0 } : f))}
                    className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-blue-800 mb-1">Max Advance (days)</label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    step={1}
                    value={form.maxAdvanceDays}
                    onChange={(e) => setForm((f) => (f ? { ...f, maxAdvanceDays: Number.parseInt(e.target.value, 10) || 90 } : f))}
                    className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-blue-200 bg-white p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-700">Recurring Availability Blocks</p>
                  <button
                    type="button"
                    onClick={addAvailabilityBlock}
                    className="text-xs font-medium text-blue-700 hover:underline"
                  >
                    + Add Block
                  </button>
                </div>

                {(form.availabilityBlocks ?? []).length === 0 ? (
                  <p className="text-xs text-gray-500">No office-hour blocks yet. Add a block to expose client-facing slots.</p>
                ) : (
                  <div className="space-y-2">
                    {(form.availabilityBlocks ?? []).map((block) => (
                      <div key={block.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                          <select
                            value={block.dayOfWeek}
                            onChange={(e) => updateAvailabilityBlock(block.id, { dayOfWeek: Number.parseInt(e.target.value, 10) || 0 })}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                          >
                            {DAYS_OF_WEEK.map((day) => (
                              <option key={day.value} value={day.value}>{day.label}</option>
                            ))}
                          </select>
                          <input
                            type="time"
                            value={block.startTime}
                            onChange={(e) => updateAvailabilityBlock(block.id, { startTime: e.target.value })}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                          />
                          <input
                            type="time"
                            value={block.endTime}
                            onChange={(e) => updateAvailabilityBlock(block.id, { endTime: e.target.value })}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                          />
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={block.capacity}
                            onChange={(e) => updateAvailabilityBlock(block.id, { capacity: Number.parseInt(e.target.value, 10) || 1 })}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                            placeholder="Capacity"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                          <input
                            value={block.location}
                            onChange={(e) => updateAvailabilityBlock(block.id, { location: e.target.value })}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                            placeholder="Location"
                          />
                          <select
                            value={block.appointmentType}
                            onChange={(e) => updateAvailabilityBlock(block.id, { appointmentType: e.target.value })}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                          >
                            <option value="ANY">Any appointment type</option>
                            {APPOINTMENT_TYPES.map((type) => (
                              <option key={type} value={type}>{humanize(type)}</option>
                            ))}
                          </select>
                          <input
                            type="date"
                            value={block.effectiveFrom ?? ""}
                            onChange={(e) => updateAvailabilityBlock(block.id, { effectiveFrom: e.target.value })}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                          />
                          <input
                            type="date"
                            value={block.effectiveTo ?? ""}
                            onChange={(e) => updateAvailabilityBlock(block.id, { effectiveTo: e.target.value })}
                            className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={block.isActive}
                              onChange={(e) => updateAvailabilityBlock(block.id, { isActive: e.target.checked })}
                              className="h-4 w-4"
                            />
                            Active block
                          </label>
                          <button
                            type="button"
                            onClick={() => removeAvailabilityBlock(block.id)}
                            className="text-xs text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-blue-200 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-700">Blackout Dates</p>
                  <button type="button" onClick={addBlackoutDate} className="text-xs font-medium text-blue-700 hover:underline">
                    + Add Blackout Date
                  </button>
                </div>

                {(form.blackoutDates ?? []).length === 0 ? (
                  <p className="text-xs text-gray-500">No blackout dates configured.</p>
                ) : (
                  <div className="space-y-2">
                    {(form.blackoutDates ?? []).map((blackout, index) => (
                      <div key={`${blackout.date}-${index}`} className="grid grid-cols-1 md:grid-cols-[200px_1fr_auto] gap-2 items-center">
                        <input
                          type="date"
                          value={blackout.date}
                          onChange={(e) => updateBlackoutDate(index, { date: e.target.value })}
                          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                        />
                        <input
                          value={blackout.reason ?? ""}
                          onChange={(e) => updateBlackoutDate(index, { reason: e.target.value })}
                          className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white"
                          placeholder="Reason (holiday, staff retreat, etc.)"
                        />
                        <button
                          type="button"
                          onClick={() => removeBlackoutDate(index)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Confirmation message</label>
              <textarea
                rows={2}
                value={form.confirmationMessage}
                onChange={(e) => setForm((f) => (f ? { ...f, confirmationMessage: e.target.value } : f))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
              />
            </div>

            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3">
              <p className="text-xs font-semibold text-gray-700">Field controls</p>
              <div className="space-y-2">
                {form.enabledFields.map((field) => (
                  <div key={field.key} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-gray-800">{humanize(field.key)}</p>
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-1 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={field.enabled}
                            onChange={(e) => updateFieldConfig(field.key, (current) => ({ ...current, enabled: e.target.checked }))}
                            className="h-4 w-4"
                          />
                          Show
                        </label>
                        <label className="inline-flex items-center gap-1 text-xs text-gray-600">
                          <input
                            type="checkbox"
                            checked={field.required}
                            onChange={(e) => updateFieldConfig(field.key, (current) => ({ ...current, required: e.target.checked }))}
                            className="h-4 w-4"
                          />
                          Required
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        value={field.label}
                        onChange={(e) => updateFieldConfig(field.key, (current) => ({ ...current, label: e.target.value }))}
                        placeholder="Field label"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs"
                      />
                      <input
                        value={field.placeholder ?? ""}
                        onChange={(e) => updateFieldConfig(field.key, (current) => ({ ...current, placeholder: e.target.value }))}
                        placeholder="Placeholder"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-gray-700">Custom intake questions</p>
                <button onClick={addCustomQuestion} className="text-xs text-blue-700 hover:underline">+ Add question</button>
              </div>

              {form.customQuestions.length === 0 ? (
                <p className="text-xs text-gray-500">No custom questions configured yet.</p>
              ) : (
                <div className="space-y-3">
                  {form.customQuestions.map((question) => (
                    <div key={question.id} className="rounded-lg border border-gray-200 bg-white p-3 space-y-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                          value={question.label}
                          onChange={(e) => updateCustomQuestion(question.id, { label: e.target.value })}
                          placeholder="Question label"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs"
                        />
                        <select
                          value={question.type}
                          onChange={(e) => updateCustomQuestion(question.id, { type: e.target.value as CustomQuestionType })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs"
                        >
                          <option value="text">Short text</option>
                          <option value="textarea">Long text</option>
                          <option value="select">Select list</option>
                          <option value="checkbox">Checkbox</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input
                          value={question.placeholder ?? ""}
                          onChange={(e) => updateCustomQuestion(question.id, { placeholder: e.target.value })}
                          placeholder="Placeholder"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs"
                        />
                        <input
                          value={question.helperText ?? ""}
                          onChange={(e) => updateCustomQuestion(question.id, { helperText: e.target.value })}
                          placeholder="Helper text"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs"
                        />
                      </div>

                      {question.type === "select" && (
                        <input
                          value={question.options.join(", ")}
                          onChange={(e) => updateCustomQuestion(question.id, {
                            options: e.target.value.split(",").map((item) => item.trim()).filter(Boolean),
                          })}
                          placeholder="Options (comma separated)"
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs"
                        />
                      )}

                      <div className="flex items-center justify-between">
                        <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                          <input
                            type="checkbox"
                            checked={question.required}
                            onChange={(e) => updateCustomQuestion(question.id, { required: e.target.checked })}
                            className="h-4 w-4"
                          />
                          Required
                        </label>
                        <button onClick={() => removeCustomQuestion(question.id)} className="text-xs text-red-600 hover:underline">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => save(false)}
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Widget"}
              </button>
              <button
                onClick={() => save(true)}
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-blue-200 text-blue-700 text-sm font-medium hover:bg-blue-50 disabled:opacity-60"
              >
                Regenerate Public Token
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Publish + Embed</h2>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs text-gray-500 mb-1">Public URL</p>
              <p className="text-xs text-gray-700 break-all">{publicUrl}</p>
              <button onClick={() => copy(publicUrl)} className="mt-2 text-xs text-blue-600 hover:underline">Copy URL</button>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs text-gray-500 mb-1">Embed snippet</p>
              <pre className="text-[11px] leading-relaxed text-gray-700 whitespace-pre-wrap">{iframeSnippet}</pre>
              <button onClick={() => copy(iframeSnippet)} className="mt-2 text-xs text-blue-600 hover:underline">Copy embed code</button>
            </div>
            <div className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-xs text-gray-500 mb-1">Script embed snippet</p>
              <pre className="text-[11px] leading-relaxed text-gray-700 whitespace-pre-wrap">{scriptSnippet}</pre>
              <button onClick={() => copy(scriptSnippet)} className="mt-2 text-xs text-blue-600 hover:underline">Copy script snippet</button>
            </div>
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs text-blue-700 font-medium mb-1">Preview label</p>
              <p className="text-sm text-blue-900">{previewTitle}</p>
              <p className="text-xs text-blue-700 mt-1">Status: {enabled ? "Live" : "Disabled"}</p>
            </div>

            <div
              className="rounded-xl border p-4"
              style={{
                backgroundColor: form.surfaceColor,
                borderColor: form.secondaryColor,
                color: form.textColor,
              }}
            >
              {form.logoDataUrl && (
                <img src={form.logoDataUrl} alt={form.logoAltText || "Organization logo"} className="h-10 object-contain mb-2" />
              )}
              <p className="text-sm font-semibold">{previewTitle}</p>
              <p className="text-xs mt-1">{form.description}</p>
              <button
                className="mt-3 px-3 py-2 rounded-lg text-xs font-medium text-white"
                style={{ backgroundColor: form.primaryColor }}
              >
                {form.submitButtonText}
              </button>
            </div>
          </div>

          </div>
        </div>
      )}
    </div>
  );
}
