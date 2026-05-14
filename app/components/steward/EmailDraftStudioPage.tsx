/** Steward Signals Email Draft Studio page for donor-specific form-mode drafting. */
"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import EmailDraftArtifactCard from "@/app/components/ai/artifacts/EmailDraftArtifactCard";
import type { StewardEmailDraftArtifact } from "@/app/components/ai/steward-artifact-types";

type DraftGoal =
  | "THANK_YOU"
  | "FIRST_TIME_WELCOME"
  | "SECOND_GIFT_INVITATION"
  | "MONTHLY_GIVING_INVITATION"
  | "LAPSED_RECONNECT"
  | "EVENT_FOLLOW_UP"
  | "CAMPAIGN_UPDATE"
  | "MAJOR_DONOR_CHECK_IN"
  | "GENERAL_STEWARDSHIP"
  | "CUSTOM";

type DraftTone = "WARM" | "BRIEF" | "FORMAL" | "PERSONAL" | "ENCOURAGING" | "PASTORAL" | "PROFESSIONAL";
type DraftLength = "SHORT" | "MEDIUM" | "DETAILED";

interface EmailDraftResponse {
  artifact: StewardEmailDraftArtifact;
  donor: {
    id: string | null;
    name: string;
    email: string | null;
  };
  aiUsed: boolean;
  aiError: string | null;
  draft: {
    id: string;
    name: string;
    status: string;
    updatedAt: string;
  } | null;
}

interface DraftFormState {
  donorId: string;
  donorName: string;
  donorFirstName: string;
  messageGoal: DraftGoal;
  messageIdea: string;
  tone: DraftTone;
  length: DraftLength;
  includeGivingContext: boolean;
  includeCampaignContext: boolean;
  includeMinistryImpact: boolean;
  callToAction: string;
  signature: string;
  useAi: boolean;
}

const GOALS: Array<{ value: DraftGoal; label: string }> = [
  { value: "THANK_YOU", label: "Thank You" },
  { value: "FIRST_TIME_WELCOME", label: "First-Time Welcome" },
  { value: "SECOND_GIFT_INVITATION", label: "Second Gift Invitation" },
  { value: "MONTHLY_GIVING_INVITATION", label: "Monthly Giving Invitation" },
  { value: "LAPSED_RECONNECT", label: "Lapsed Reconnect" },
  { value: "EVENT_FOLLOW_UP", label: "Event Follow-Up" },
  { value: "CAMPAIGN_UPDATE", label: "Campaign Update" },
  { value: "MAJOR_DONOR_CHECK_IN", label: "Major Donor Check-In" },
  { value: "GENERAL_STEWARDSHIP", label: "General Stewardship" },
  { value: "CUSTOM", label: "Custom" },
];

const TONES: Array<{ value: DraftTone; label: string }> = [
  { value: "WARM", label: "Warm" },
  { value: "BRIEF", label: "Brief" },
  { value: "FORMAL", label: "Formal" },
  { value: "PERSONAL", label: "Personal" },
  { value: "ENCOURAGING", label: "Encouraging" },
  { value: "PASTORAL", label: "Pastoral" },
  { value: "PROFESSIONAL", label: "Professional" },
];

const LENGTHS: Array<{ value: DraftLength; label: string }> = [
  { value: "SHORT", label: "Short" },
  { value: "MEDIUM", label: "Medium" },
  { value: "DETAILED", label: "Detailed" },
];

/**
 * EmailDraftStudioPage renders a donor-focused drafting workspace with
 * explicit review-first controls and no auto-send behavior.
 */
export default function EmailDraftStudioPage() {
  const [form, setForm] = useState<DraftFormState>({
    donorId: "",
    donorName: "",
    donorFirstName: "",
    messageGoal: "THANK_YOU",
    messageIdea: "",
    tone: "WARM",
    length: "MEDIUM",
    includeGivingContext: true,
    includeCampaignContext: false,
    includeMinistryImpact: true,
    callToAction: "",
    signature: "With gratitude,\n[Your Name]",
    useAi: true,
  });

  const [result, setResult] = useState<EmailDraftResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [creatingTask, setCreatingTask] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof DraftFormState>(key: K, value: DraftFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGenerateDraft(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await apiFetch<EmailDraftResponse>("/api/steward-signals/email-draft", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          saveAsDraft: false,
        }),
      });

      setResult(response);
      setNotice(response.aiUsed
        ? "AI-assisted email draft generated. Review before saving or sending."
        : "Deterministic email draft generated. Review before saving.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate draft.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDraft() {
    if (!result?.artifact) return;
    if (!window.confirm("Save this reviewed draft to Communications as DRAFT status?")) return;

    setSavingDraft(true);
    setError(null);
    setNotice(null);

    try {
      const response = await apiFetch<{ draft?: { id: string }; message?: string }>("/api/steward-signals/email-draft/save", {
        method: "POST",
        body: JSON.stringify({
          confirm: true,
          donorId: form.donorId || result.donor.id || undefined,
          donorName: form.donorName || result.donor.name,
          subject: result.artifact.subject,
          previewText: result.artifact.previewText,
          bodyMarkdown: result.artifact.bodyMarkdown,
          bodyPlainText: result.artifact.bodyPlainText,
          bodyHtml: result.artifact.bodyHtml,
        }),
      });

      setNotice(response.message ?? "Draft saved successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft.");
    } finally {
      setSavingDraft(false);
    }
  }

  async function handleCreateFollowUpTask() {
    const donorId = form.donorId || result?.donor.id || "";
    if (!donorId) {
      setError("Donor ID is required to create a follow-up task.");
      return;
    }

    if (!window.confirm("Create follow-up task for this donor?")) return;

    setCreatingTask(true);
    setError(null);
    setNotice(null);

    try {
      const response = await apiFetch<{ message?: string }>("/api/steward-signals/email-draft/create-follow-up-task", {
        method: "POST",
        body: JSON.stringify({
          confirm: true,
          donorId,
          title: `${result?.donor.name || form.donorName || "Donor"}: Steward email follow-up`,
          note: "Review draft and complete outreach according to communication preferences.",
        }),
      });

      setNotice(response.message ?? "Follow-up task created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create follow-up task.");
    } finally {
      setCreatingTask(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Email Draft Studio</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Build review-first donor drafts with deterministic stewardship context and optional AI refinement.
          </p>
        </div>
        <Link
          href="/steward-signals"
          className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50"
        >
          Back to Steward Signals
        </Link>
      </header>

      {error && <p className="text-sm text-red-700 rounded-lg border border-red-200 bg-red-50 px-3 py-2">{error}</p>}
      {notice && <p className="text-sm text-green-700 rounded-lg border border-green-200 bg-green-50 px-3 py-2">{notice}</p>}

      <form onSubmit={handleGenerateDraft} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Donor ID (optional but required for task creation)">
            <input
              value={form.donorId}
              onChange={(event) => setField("donorId", event.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="constituent-id"
            />
          </Field>

          <Field label="Donor Name">
            <input
              value={form.donorName}
              onChange={(event) => setField("donorName", event.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Jane Smith"
            />
          </Field>

          <Field label="Donor First Name">
            <input
              value={form.donorFirstName}
              onChange={(event) => setField("donorFirstName", event.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Jane"
            />
          </Field>

          <Field label="Message Goal">
            <select
              value={form.messageGoal}
              onChange={(event) => setField("messageGoal", event.target.value as DraftGoal)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {GOALS.map((goal) => (
                <option key={goal.value} value={goal.value}>{goal.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Tone">
            <select
              value={form.tone}
              onChange={(event) => setField("tone", event.target.value as DraftTone)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {TONES.map((tone) => (
                <option key={tone.value} value={tone.value}>{tone.label}</option>
              ))}
            </select>
          </Field>

          <Field label="Length">
            <select
              value={form.length}
              onChange={(event) => setField("length", event.target.value as DraftLength)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {LENGTHS.map((length) => (
                <option key={length.value} value={length.value}>{length.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Message Idea">
          <textarea
            value={form.messageIdea}
            onChange={(event) => setField("messageIdea", event.target.value)}
            rows={4}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="What should this message accomplish for this donor relationship?"
          />
        </Field>

        <Field label="Call To Action">
          <input
            value={form.callToAction}
            onChange={(event) => setField("callToAction", event.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Would you consider renewing your support this month?"
          />
        </Field>

        <Field label="Signature">
          <textarea
            value={form.signature}
            onChange={(event) => setField("signature", event.target.value)}
            rows={3}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
          <label className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <input
              type="checkbox"
              checked={form.includeGivingContext}
              onChange={(event) => setField("includeGivingContext", event.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Include giving context
          </label>

          <label className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <input
              type="checkbox"
              checked={form.includeCampaignContext}
              onChange={(event) => setField("includeCampaignContext", event.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Include campaign context
          </label>

          <label className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <input
              type="checkbox"
              checked={form.includeMinistryImpact}
              onChange={(event) => setField("includeMinistryImpact", event.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Include ministry impact
          </label>

          <label className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <input
              type="checkbox"
              checked={form.useAi}
              onChange={(event) => setField("useAi", event.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Use AI refinement
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
          >
            {loading ? "Generating..." : "Generate Draft"}
          </button>

          <button
            type="button"
            onClick={() => void handleSaveDraft()}
            disabled={!result?.artifact || savingDraft}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-green-200 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-60"
          >
            {savingDraft ? "Saving..." : "Save As Draft"}
          </button>

          <button
            type="button"
            onClick={() => void handleCreateFollowUpTask()}
            disabled={!result?.artifact || creatingTask}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-60"
          >
            {creatingTask ? "Creating Task..." : "Create Follow-Up Task"}
          </button>
        </div>
      </form>

      {result?.artifact && (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-gray-900">Generated Draft</h2>
            <p className="text-xs text-gray-500">
              Donor: {result.donor.name}
              {result.donor.email ? ` (${result.donor.email})` : ""}
            </p>
          </div>
          <EmailDraftArtifactCard artifact={result.artifact} />
          {result.aiError && (
            <p className="text-xs text-amber-700">AI note: {result.aiError}</p>
          )}
        </section>
      )}
    </div>
  );
}

interface FieldProps {
  label: string;
  children: ReactNode;
}

function Field({ label, children }: FieldProps) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-gray-600">{label}</span>
      {children}
    </label>
  );
}
