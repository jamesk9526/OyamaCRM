/** Generation center to create individual letters from templates and donor context. */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import LettersWorkspaceNav from "@/app/components/letters/LettersWorkspaceNav";
import type { LetterTemplateSummary } from "@/app/components/letters/types";

interface DraftPreview {
  mergedPrintBody: string;
  mergedEmailBody: string | null;
  unsupportedFields: string[];
}

/** Converts raw API errors into user-facing guidance for letter workflows. */
function normalizeLettersError(error: unknown): string {
  const fallback = "Failed to load letter templates.";
  if (!(error instanceof Error)) return fallback;

  if (error.message.includes("database migrations are pending")) {
    return "Letter templates are temporarily unavailable because the database migration is pending. Run pnpm db:migrate, pnpm db:generate, then restart the API.";
  }

  return error.message || fallback;
}

/** Supports one-off generation flow with preview before save. */
export default function LetterGenerateCenter() {
  const searchParams = useSearchParams();
  const [templates, setTemplates] = useState<LetterTemplateSummary[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [constituentId, setConstituentId] = useState("");
  const [donationId, setDonationId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [eventId, setEventId] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [preview, setPreview] = useState<DraftPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    try {
      const result = await apiFetch<LetterTemplateSummary[]>("/api/letters/templates?status=ACTIVE");
      setTemplates(result);
      if (!templateId && result[0]) setTemplateId(result[0].id);
    } catch (requestError) {
      setTemplates([]);
      setError(normalizeLettersError(requestError));
    }
  }, [templateId]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  // Applies constituent context when generation starts from donor profile actions.
  useEffect(() => {
    const seededConstituentId = searchParams.get("constituentId");
    if (!seededConstituentId) return;
    setConstituentId((prev) => prev || seededConstituentId);
  }, [searchParams]);

  const requestBody = useMemo(
    () => ({
      templateId,
      constituentId: constituentId || undefined,
      donationId: donationId || undefined,
      campaignId: campaignId || undefined,
      eventId: eventId || undefined,
      year: Number.parseInt(year, 10),
    }),
    [campaignId, constituentId, donationId, eventId, templateId, year],
  );

  /** Runs merge preview without storing a generated letter. */
  async function runPreview() {
    if (!templateId) {
      setError("Choose a template first.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await apiFetch<DraftPreview>("/api/letters/generated/preview", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });
      setPreview(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to preview merge.");
    } finally {
      setLoading(false);
    }
  }

  /** Persists one generated letter and logs communication history server-side. */
  async function generateLetter() {
    if (!templateId) {
      setError("Choose a template first.");
      return;
    }

    setGenerating(true);
    setError(null);
    try {
      const result = await apiFetch<{ id: string }>("/api/letters/generated", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });
      setCreatedId(result.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to generate letter.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Generate Letter</h1>
          <p className="mt-0.5 text-sm text-gray-500">Generate one donor letter now and track it in communication history.</p>
        </div>
        <Link href="/letters-printables/generated" className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
          View Generated Letters
        </Link>
      </div>

      <LettersWorkspaceNav />

      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>}

      {createdId && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Letter generated successfully.
          <Link href="/letters-printables/generated" className="ml-2 font-semibold underline">Open generated list</Link>
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block text-sm text-gray-700">
            Template
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
              <option value="">Choose template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm text-gray-700">
            Constituent ID
            <input value={constituentId} onChange={(event) => setConstituentId(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label className="block text-sm text-gray-700">
            Donation ID (optional)
            <input value={donationId} onChange={(event) => setDonationId(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label className="block text-sm text-gray-700">
            Campaign ID (optional)
            <input value={campaignId} onChange={(event) => setCampaignId(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label className="block text-sm text-gray-700">
            Event ID (optional)
            <input value={eventId} onChange={(event) => setEventId(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label className="block text-sm text-gray-700">
            Year for rollups
            <input value={year} onChange={(event) => setYear(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => void runPreview()} disabled={loading} className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            {loading ? "Previewing..." : "Preview Merge"}
          </button>
          <button onClick={() => void generateLetter()} disabled={generating} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60">
            {generating ? "Generating..." : "Generate & Save"}
          </button>
        </div>
      </section>

      {preview && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Preview</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Print</p>
              <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-700">{preview.mergedPrintBody}</pre>
            </div>
            <div className="rounded-lg border border-gray-200 p-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Email</p>
              <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-700">{preview.mergedEmailBody || "No email content"}</pre>
            </div>
          </div>
          {preview.unsupportedFields.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Unsupported merge fields: {preview.unsupportedFields.join(", ")}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
