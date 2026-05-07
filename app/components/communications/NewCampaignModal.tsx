"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const TEMPLATES = [
  { id: "appeal", name: "Donation Appeal", subject: "Your gift makes a difference", description: "Standard fundraising appeal" },
  { id: "newsletter", name: "Newsletter", subject: "OyamaCRM Newsletter — {Month}", description: "Monthly supporter update" },
  { id: "thanks", name: "Thank You", subject: "Thank you for your generous gift", description: "Post-donation acknowledgment" },
  { id: "event", name: "Event Invite", subject: "You're invited — {Event Name}", description: "Event invitation and RSVP" },
  { id: "blank", name: "Blank", subject: "", description: "Start from scratch" },
];

const AUDIENCE_OPTIONS = [
  { id: "all", label: "All Constituents (no opt-outs)" },
  { id: "active", label: "Active Donors" },
  { id: "lapsed", label: "Lapsed Donors (re-engagement)" },
  { id: "new", label: "New Donors (first 90 days)" },
  { id: "major", label: "Major Donors" },
  { id: "volunteers", label: "Volunteers" },
];

interface Props {
  onClose: () => void;
  /** Called with the new campaign's ID so the parent can open the email builder. */
  onCreated: (id: string) => void;
}

export default function NewCampaignModal({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedTemplate, setSelectedTemplate] = useState("blank");
  const [form, setForm] = useState({
    name: "",
    subject: "",
    previewText: "",
    fromName: "Hope Community Foundation",
    fromEmail: "giving@hopecommunity.org",
    replyToEmail: "",
    audienceId: "all",
    scheduledAt: "",
    bodyText: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function pickTemplate(id: string) {
    setSelectedTemplate(id);
    const t = TEMPLATES.find((t) => t.id === id);
    if (t && t.subject) set("subject", t.subject);
    if (!form.name && t) set("name", t.name);
  }

  async function submit() {
    if (!form.name.trim() || !form.subject.trim()) {
      setError("Campaign name and subject are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/email-campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          subject: form.subject,
          previewText: form.previewText,
          fromName: form.fromName,
          fromEmail: form.fromEmail,
          replyToEmail: form.replyToEmail || null,
          bodyText: form.bodyText || null,
          scheduledAt: form.scheduledAt || null,
          audienceFilter: { type: form.audienceId },
        }),
      });
      if (!res.ok) throw new Error("Failed to create campaign");
      const campaign = await res.json();
      onCreated(campaign.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">New Email Campaign</h2>
            <p className="text-xs text-gray-400 mt-0.5">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex px-6 pt-4 gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex-1 h-1 rounded-full transition-colors ${s <= step ? "bg-green-600" : "bg-gray-200"}`} />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Step 1: Template */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700">Choose a starting template</p>
              <div className="grid grid-cols-1 gap-2">
                {TEMPLATES.map((t) => (
                  <label
                    key={t.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      selectedTemplate === t.id ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="template"
                      checked={selectedTemplate === t.id}
                      onChange={() => pickTemplate(t.id)}
                      className="hidden"
                    />
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selectedTemplate === t.id ? "border-green-600" : "border-gray-300"
                    }`}>
                      {selectedTemplate === t.id && <div className="w-2 h-2 bg-green-600 rounded-full" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Setup */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700">Campaign details</p>
              <FormField label="Campaign Name" required>
                <input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Spring Appeal 2026"
                  className={INPUT}
                />
              </FormField>
              <FormField label="Email Subject" required>
                <input
                  value={form.subject}
                  onChange={(e) => set("subject", e.target.value)}
                  placeholder="Your compelling subject line"
                  className={INPUT}
                />
              </FormField>
              <FormField label="Preview Text" optional>
                <input
                  value={form.previewText}
                  onChange={(e) => set("previewText", e.target.value)}
                  placeholder="Short preview shown in inbox…"
                  className={INPUT}
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="From Name">
                  <input value={form.fromName} onChange={(e) => set("fromName", e.target.value)} className={INPUT} />
                </FormField>
                <FormField label="From Email">
                  <input type="email" value={form.fromEmail} onChange={(e) => set("fromEmail", e.target.value)} className={INPUT} />
                </FormField>
              </div>
              <FormField label="Reply-To Email" optional>
                <input type="email" value={form.replyToEmail} onChange={(e) => set("replyToEmail", e.target.value)} placeholder="Same as from email" className={INPUT} />
              </FormField>
            </div>
          )}

          {/* Step 3: Audience & Schedule */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">Audience</p>
                <div className="grid grid-cols-1 gap-2">
                  {AUDIENCE_OPTIONS.map((a) => (
                    <label
                      key={a.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        form.audienceId === a.id ? "border-green-500 bg-green-50" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input type="radio" name="audience" checked={form.audienceId === a.id} onChange={() => set("audienceId", a.id)} className="hidden" />
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${form.audienceId === a.id ? "border-green-600" : "border-gray-300"}`}>
                        {form.audienceId === a.id && <div className="w-2 h-2 bg-green-600 rounded-full" />}
                      </div>
                      <p className="text-sm text-gray-800">{a.label}</p>
                    </label>
                  ))}
                </div>
              </div>

              <FormField label="Schedule Send (optional)" optional>
                <input
                  type="datetime-local"
                  value={form.scheduledAt}
                  onChange={(e) => set("scheduledAt", e.target.value)}
                  className={INPUT}
                />
                <p className="text-xs text-gray-400 mt-1">Leave blank to save as draft and send manually later.</p>
              </FormField>

              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button
            onClick={step === 1 ? onClose : () => setStep((s) => (s - 1) as 1 | 2 | 3)}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            {step === 1 ? "Cancel" : "← Back"}
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3)}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Continue →
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={saving}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? "Creating…" : form.scheduledAt ? "Schedule Campaign" : "Save as Draft"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const INPUT = "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-gray-900 placeholder:text-gray-400";

function FormField({ label, required, optional, children }: { label: string; required?: boolean; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {optional && <span className="text-gray-400 ml-1 font-normal">(optional)</span>}
      </label>
      {children}
    </div>
  );
}
