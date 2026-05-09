// Public appointment request page for Compassion CRM widget embedding and hosted scheduling.
"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type WidgetFieldKey = "email" | "phone" | "appointmentType" | "location" | "notes";
type CustomQuestionType = "text" | "textarea" | "select" | "checkbox";

interface PublicWidgetFieldConfig {
  key: WidgetFieldKey;
  enabled: boolean;
  required: boolean;
  label: string;
  placeholder?: string;
  helperText?: string;
}

interface PublicWidgetCustomQuestion {
  id: string;
  label: string;
  type: CustomQuestionType;
  required: boolean;
  placeholder?: string;
  helperText?: string;
  options: string[];
}

interface PublicWidgetConfig {
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
  enabledFields: PublicWidgetFieldConfig[];
  customQuestions: PublicWidgetCustomQuestion[];
}

interface PublicPageProps {
  params: Promise<{
    token: string;
  }>;
}

/** Converts enum-style values to display text. */
function humanize(value: string): string {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

/** Returns one field configuration by key with a safe fallback value. */
function fieldByKey(fields: PublicWidgetFieldConfig[], key: WidgetFieldKey): PublicWidgetFieldConfig {
  return fields.find((field) => field.key === key) ?? {
    key,
    enabled: false,
    required: false,
    label: humanize(key),
    placeholder: "",
    helperText: "",
  };
}

/**
 * PublicAppointmentWidgetPage renders an unauthenticated booking form
 * for a configured Compassion CRM appointment widget token.
 */
export default function PublicAppointmentWidgetPage({ params }: PublicPageProps) {
  const { token } = use(params);
  const [config, setConfig] = useState<PublicWidgetConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [customResponses, setCustomResponses] = useState<Record<string, string | boolean>>({});
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    startTime: "",
    notes: "",
    appointmentType: "INTAKE",
  });

  const emailField = useMemo(() => fieldByKey(config?.enabledFields ?? [], "email"), [config]);
  const phoneField = useMemo(() => fieldByKey(config?.enabledFields ?? [], "phone"), [config]);
  const typeField = useMemo(() => fieldByKey(config?.enabledFields ?? [], "appointmentType"), [config]);
  const locationField = useMemo(() => fieldByKey(config?.enabledFields ?? [], "location"), [config]);
  const notesField = useMemo(() => fieldByKey(config?.enabledFields ?? [], "notes"), [config]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/api/compassion-public/widget/${token}/config`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error?.message ?? "Widget not available");
      }
      setConfig(body as PublicWidgetConfig);
      setForm((prev) => ({
        ...prev,
        location: (body.locationOptions || [""])[0] || "",
        appointmentType: body.defaultAppointmentType || "INTAKE",
      }));
      const nextResponses: Record<string, string | boolean> = {};
      const customQuestions = Array.isArray(body.customQuestions) ? body.customQuestions : [];
      for (const question of customQuestions) {
        nextResponses[String(question.id)] = question.type === "checkbox" ? false : "";
      }
      setCustomResponses(nextResponses);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load booking form");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const canSubmit = useMemo(() => {
    if (!config) return false;
    if (!form.firstName.trim() || !form.lastName.trim() || !form.startTime) return false;
    if (emailField.enabled && config.requireEmail && !form.email.trim()) return false;
    if (phoneField.enabled && config.requirePhone && !form.phone.trim()) return false;
    if (locationField.enabled && locationField.required && !form.location.trim()) return false;
    if (notesField.enabled && notesField.required && !form.notes.trim()) return false;

    for (const question of config.customQuestions ?? []) {
      const answer = customResponses[question.id];
      if (!question.required) continue;
      if (question.type === "checkbox") {
        if (!Boolean(answer)) return false;
      } else if (!String(answer ?? "").trim()) {
        return false;
      }
    }

    return true;
  }, [config, customResponses, emailField, form, locationField, notesField, phoneField]);

  /** Updates one custom question response from text/select/checkbox controls. */
  function updateCustomResponse(questionId: string, value: string | boolean) {
    setCustomResponses((current) => ({ ...current, [questionId]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!config || !canSubmit) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const startIso = new Date(form.startTime).toISOString();
      const res = await fetch(`${API_BASE}/api/compassion-public/widget/${token}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          startTime: startIso,
          customResponses,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error?.message ?? "Failed to submit request");
      }

      setSuccess(String(body.confirmationMessage || "Your request has been submitted."));
      setForm((prev) => ({
        ...prev,
        notes: "",
      }));

      const resetResponses: Record<string, string | boolean> = {};
      for (const question of config.customQuestions ?? []) {
        resetResponses[question.id] = question.type === "checkbox" ? false : "";
      }
      setCustomResponses(resetResponses);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="min-h-screen px-4 py-8"
      style={{
        background: `linear-gradient(180deg, ${config?.secondaryColor ?? "#dbeafe"} 0%, ${config?.surfaceColor ?? "#f8fafc"} 100%)`,
      }}
    >
      <div className="mx-auto w-full max-w-2xl">
        <div className="rounded-2xl border shadow-sm p-6 sm:p-8 space-y-5" style={{ backgroundColor: config?.surfaceColor ?? "#ffffff", borderColor: config?.secondaryColor ?? "#dbeafe", color: config?.textColor ?? "#0f172a" }}>
          {loading ? (
            <p className="text-sm text-gray-400 animate-pulse">Loading appointment form...</p>
          ) : error && !config ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : config ? (
            <>
              <div>
                {config.logoDataUrl ? (
                  <img src={config.logoDataUrl} alt={config.logoAltText || "Organization logo"} className="h-12 object-contain mb-3" />
                ) : null}
                <h1 className="text-2xl font-semibold" style={{ color: config.textColor }}>{config.title}</h1>
                <p className="text-sm mt-1" style={{ color: config.textColor }}>{config.description}</p>
              </div>

              {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
              {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>}

              <form onSubmit={submit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">First Name *</label>
                    <input
                      required
                      value={form.firstName}
                      onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Last Name *</label>
                    <input
                      required
                      value={form.lastName}
                      onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {emailField.enabled && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {emailField.label}{config.requireEmail ? " *" : ""}
                      </label>
                      <input
                        type="email"
                        required={config.requireEmail}
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder={emailField.placeholder || undefined}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                  {phoneField.enabled && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        {phoneField.label}{config.requirePhone ? " *" : ""}
                      </label>
                      <input
                        required={config.requirePhone}
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder={phoneField.placeholder || undefined}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {typeField.enabled && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">{typeField.label}</label>
                      {config.allowTypeSelection ? (
                        <select
                          value={form.appointmentType}
                          onChange={(e) => setForm((f) => ({ ...f, appointmentType: e.target.value }))}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                        >
                          {(config.appointmentTypeOptions?.length ? config.appointmentTypeOptions : [config.defaultAppointmentType]).map((type) => (
                            <option key={type} value={type}>{humanize(type)}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={humanize(config.defaultAppointmentType)}
                          disabled
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-600"
                        />
                      )}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Preferred Date & Time *</label>
                    <input
                      type="datetime-local"
                      required
                      value={form.startTime}
                      onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {locationField.enabled && config.locationOptions.length > 0 && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {locationField.label}{locationField.required ? " *" : ""}
                    </label>
                    <select
                      value={form.location}
                      required={locationField.required}
                      onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    >
                      {config.locationOptions.map((location) => (
                        <option key={location} value={location}>{location}</option>
                      ))}
                    </select>
                    {locationField.helperText ? <p className="mt-1 text-xs text-gray-500">{locationField.helperText}</p> : null}
                  </div>
                )}

                {notesField.enabled && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {notesField.label}{notesField.required ? " *" : ""}
                    </label>
                    <textarea
                      rows={3}
                      required={notesField.required}
                      value={form.notes}
                      onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                      placeholder={notesField.placeholder || "Share anything that helps us prepare for your visit."}
                    />
                    {notesField.helperText ? <p className="mt-1 text-xs text-gray-500">{notesField.helperText}</p> : null}
                  </div>
                )}

                {(config.customQuestions ?? []).map((question) => (
                  <div key={question.id}>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      {question.label}{question.required ? " *" : ""}
                    </label>
                    {question.type === "textarea" ? (
                      <textarea
                        rows={3}
                        required={question.required}
                        value={String(customResponses[question.id] ?? "")}
                        onChange={(e) => updateCustomResponse(question.id, e.target.value)}
                        placeholder={question.placeholder || undefined}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
                      />
                    ) : question.type === "select" ? (
                      <select
                        required={question.required}
                        value={String(customResponses[question.id] ?? "")}
                        onChange={(e) => updateCustomResponse(question.id, e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="">Select an option</option>
                        {(question.options ?? []).map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : question.type === "checkbox" ? (
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={Boolean(customResponses[question.id])}
                          onChange={(e) => updateCustomResponse(question.id, e.target.checked)}
                          className="h-4 w-4"
                        />
                        {question.helperText || "I confirm"}
                      </label>
                    ) : (
                      <input
                        required={question.required}
                        value={String(customResponses[question.id] ?? "")}
                        onChange={(e) => updateCustomResponse(question.id, e.target.value)}
                        placeholder={question.placeholder || undefined}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      />
                    )}
                    {question.type !== "checkbox" && question.helperText ? (
                      <p className="mt-1 text-xs text-gray-500">{question.helperText}</p>
                    ) : null}
                  </div>
                ))}

                <button
                  type="submit"
                  disabled={!canSubmit || submitting}
                  className="w-full rounded-lg text-white text-sm font-medium py-2.5 disabled:opacity-60"
                  style={{ backgroundColor: config.primaryColor }}
                >
                  {submitting ? "Submitting..." : (config.submitButtonText || "Submit Appointment Request")}
                </button>

                {config.privacyNote ? (
                  <p className="text-xs text-gray-500">{config.privacyNote}</p>
                ) : null}
              </form>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
