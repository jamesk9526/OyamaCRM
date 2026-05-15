/** Multi-step letters generation wizard that routes output into production workflows. */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import WorkspaceWizard from "@/app/components/workspace-ribbon/WorkspaceWizard";
import LettersWorkspaceNav from "@/app/components/letters/LettersWorkspaceNav";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import type {
  FooterPreset,
  GeneratedLetterSummary,
  HeaderPreset,
  LetterTemplateSummary,
  SignatureBlock,
} from "@/app/components/letters/types";
import type {
  LettersBatchPreviewResult,
  LettersConstituentLookup,
  LettersGenerateStep,
  LettersSinglePreview,
  LettersTemplateDetails,
  LettersWizardState,
} from "@/app/components/letters/generate/types";
import {
  DEFAULT_LETTERS_WIZARD_STATE,
  loadLettersWizardState,
  saveLettersWizardState,
} from "@/app/components/letters/generate/wizard-state";

const WIZARD_STEPS = ["Template", "Recipients", "Preview", "Complete"];

const STEP_PATHS: Record<LettersGenerateStep, string> = {
  template: "/letters-printables/generate/template",
  recipients: "/letters-printables/generate/recipients",
  preview: "/letters-printables/generate/preview",
  complete: "/letters-printables/generate/complete",
};

const BATCH_FILTERS = ["ALL", "ACTIVE", "LAPSED", "NEW", "MAJOR_DONOR", "MONTHLY_DONOR"] as const;

const ROUTE_TARGET_HELPER_TEXT: Record<LettersWizardState["routeTarget"], string> = {
  PRINT_QUEUE: "Queue generated letters for print operations.",
  MAIL_QUEUE: "Move generated letters directly into the mail queue.",
  EMAIL_DRAFT: "Create communications email draft records from generated letters.",
};

interface LettersGenerateWizardProps {
  step: LettersGenerateStep;
}

/** Normalizes unknown errors into user-facing strings. */
function normalizeError(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  return error.message || fallback;
}

/** Converts mixed API payload shapes into a constituent row array. */
function normalizeConstituentRows(payload: unknown): LettersConstituentLookup[] {
  if (Array.isArray(payload)) return payload as LettersConstituentLookup[];
  if (payload && typeof payload === "object") {
    const maybeItems = (payload as { items?: unknown }).items;
    if (Array.isArray(maybeItems)) return maybeItems as LettersConstituentLookup[];
  }
  return [];
}

/** Parses comma/newline separated IDs into one cleaned list. */
function parseConstituentIds(raw: string): string[] {
  return raw
    .split(/[\n,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

/** Downloads a binary response body as a file in the browser. */
async function downloadBlobFromResponse(response: Response, fallbackName: string): Promise<void> {
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const fileNameMatch = disposition.match(/filename="?([^";]+)"?/i);
  const filename = fileNameMatch?.[1] || fallbackName;

  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

/** Formats a human-readable constituent label for recipient search rows. */
function formatConstituentLabel(row: LettersConstituentLookup): string {
  const fullName = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
  const status = row.donorStatus ? ` - ${row.donorStatus}` : "";
  const email = row.email ? ` (${row.email})` : "";
  return `${fullName || row.id}${email}${status}`;
}

/** Returns one parsed year value with current-year fallback. */
function resolveYear(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
}

/** Guided letters generation workflow for template, recipients, preview, and routing. */
export default function LettersGenerateWizard({ step }: LettersGenerateWizardProps) {
  const router = useRouter();

  const [wizardState, setWizardState] = useState<LettersWizardState>(() => loadLettersWizardState());

  const [templates, setTemplates] = useState<LetterTemplateSummary[]>([]);
  const [headerPresets, setHeaderPresets] = useState<HeaderPreset[]>([]);
  const [footerPresets, setFooterPresets] = useState<FooterPreset[]>([]);
  const [signatureBlocks, setSignatureBlocks] = useState<SignatureBlock[]>([]);
  const [selectedTemplateDetails, setSelectedTemplateDetails] = useState<LettersTemplateDetails | null>(null);

  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [recipientSearch, setRecipientSearch] = useState("");
  const [recipientOptions, setRecipientOptions] = useState<LettersConstituentLookup[]>([]);
  const [recipientSearchLoading, setRecipientSearchLoading] = useState(false);

  const [previewLoading, setPreviewLoading] = useState(false);
  const [singlePreview, setSinglePreview] = useState<LettersSinglePreview | null>(null);
  const [batchPreview, setBatchPreview] = useState<LettersBatchPreviewResult | null>(null);

  const [generationLoading, setGenerationLoading] = useState(false);
  const [generatedLetter, setGeneratedLetter] = useState<GeneratedLetterSummary | null>(null);
  const [generatedBatchResult, setGeneratedBatchResult] = useState<LettersBatchPreviewResult | null>(null);

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === wizardState.templateId) ?? null,
    [templates, wizardState.templateId],
  );

  const wizardStepIndex = useMemo(() => {
    if (step === "template") return 0;
    if (step === "recipients") return 1;
    if (step === "preview") return 2;
    return 3;
  }, [step]);

  const recipientsReady = useMemo(() => {
    if (!wizardState.templateId.trim()) return false;
    if (wizardState.projectType === "INDIVIDUAL") return Boolean(wizardState.constituentId.trim());
    return true;
  }, [wizardState.constituentId, wizardState.projectType, wizardState.templateId]);

  const previewReady = Boolean(wizardState.previewConfirmedAt);

  useEffect(() => {
    saveLettersWizardState(wizardState);
  }, [wizardState]);

  /** Updates wizard state and clears stale preview confirmation by default. */
  const updateWizardState = useCallback((patch: Partial<LettersWizardState>, resetPreview = true) => {
    setWizardState((previous) => ({
      ...previous,
      ...patch,
      previewConfirmedAt: resetPreview ? null : patch.previewConfirmedAt ?? previous.previewConfirmedAt,
    }));
  }, []);

  /** Navigates to one wizard step route. */
  const goToStep = useCallback((target: LettersGenerateStep) => {
    router.push(STEP_PATHS[target]);
  }, [router]);

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const [templateRows, headers, footers, signatures] = await Promise.all([
        apiFetch<LetterTemplateSummary[]>("/api/letters/templates?status=ACTIVE"),
        apiFetch<HeaderPreset[]>("/api/letters/header-presets"),
        apiFetch<FooterPreset[]>("/api/letters/footer-presets"),
        apiFetch<SignatureBlock[]>("/api/letters/signatures"),
      ]);

      setTemplates(templateRows);
      setHeaderPresets(headers);
      setFooterPresets(footers);
      setSignatureBlocks(signatures);

      if (!wizardState.templateId && templateRows[0]) {
        setWizardState((previous) => ({
          ...previous,
          templateId: templateRows[0]?.id || "",
          previewConfirmedAt: null,
        }));
      }
    } catch (requestError) {
      setCatalogError(normalizeError(requestError, "Failed to load template and preset catalog."));
    } finally {
      setCatalogLoading(false);
    }
  }, [wizardState.templateId]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    async function loadTemplateDetails(templateId: string) {
      try {
        const details = await apiFetch<LettersTemplateDetails>(`/api/letters/templates/${templateId}`);
        setSelectedTemplateDetails(details);
      } catch {
        setSelectedTemplateDetails(null);
      }
    }

    if (!wizardState.templateId) {
      setSelectedTemplateDetails(null);
      return;
    }

    void loadTemplateDetails(wizardState.templateId);
  }, [wizardState.templateId]);

  useEffect(() => {
    if (step !== "recipients" || wizardState.projectType !== "INDIVIDUAL") return;
    const trimmed = recipientSearch.trim();
    if (trimmed.length < 2) {
      setRecipientOptions([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setRecipientSearchLoading(true);
      try {
        const result = await apiFetch<unknown>(`/api/constituents?search=${encodeURIComponent(trimmed)}&limit=20`);
        if (cancelled) return;
        setRecipientOptions(normalizeConstituentRows(result));
      } catch {
        if (cancelled) return;
        setRecipientOptions([]);
      } finally {
        if (!cancelled) setRecipientSearchLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [recipientSearch, step, wizardState.projectType]);

  /** Runs merge preview for either individual or batch generation path. */
  async function runPreview(): Promise<void> {
    if (!recipientsReady) {
      setError("Select a template and recipient context before preview.");
      return;
    }

    setPreviewLoading(true);
    setError(null);
    setNotice(null);
    try {
      if (wizardState.projectType === "INDIVIDUAL") {
        const preview = await apiFetch<LettersSinglePreview>("/api/letters/generated/preview", {
          method: "POST",
          body: JSON.stringify({
            templateId: wizardState.templateId,
            constituentId: wizardState.constituentId || undefined,
            donationId: wizardState.donationId || undefined,
            campaignId: wizardState.campaignId || undefined,
            eventId: wizardState.eventId || undefined,
            year: resolveYear(wizardState.year),
          }),
        });

        setSinglePreview(preview);
        setBatchPreview(null);
      } else {
        const batch = await apiFetch<LettersBatchPreviewResult>("/api/letters/generated/batch", {
          method: "POST",
          body: JSON.stringify({
            templateId: wizardState.templateId,
            filterType: wizardState.batchFilterType,
            constituentIds: parseConstituentIds(wizardState.batchConstituentIdsText),
            year: resolveYear(wizardState.year),
            dryRun: true,
            addToPrintQueue: wizardState.routeTarget === "PRINT_QUEUE",
            dedupeHousehold: wizardState.dedupeHousehold,
          }),
        });

        setBatchPreview(batch);
        setSinglePreview(null);
      }

      updateWizardState({ previewConfirmedAt: new Date().toISOString() }, false);
      setNotice("Preview generated. Continue when output looks correct.");
    } catch (requestError) {
      setError(normalizeError(requestError, "Failed to preview merge output."));
    } finally {
      setPreviewLoading(false);
    }
  }

  /** Routes one generated letter to print queue, mail queue, or email draft workflow. */
  async function routeSingleLetter(generatedId: string): Promise<string> {
    if (wizardState.routeTarget === "PRINT_QUEUE") {
      await apiFetch("/api/letters/generated/queue/print/actions", {
        method: "POST",
        body: JSON.stringify({
          action: "QUEUE_FOR_PRINT",
          letterIds: [generatedId],
          note: "Queued by generation wizard",
        }),
      });
      return "Routed to print queue.";
    }

    if (wizardState.routeTarget === "MAIL_QUEUE") {
      await apiFetch("/api/letters/generated/queue/mail/actions", {
        method: "POST",
        body: JSON.stringify({
          action: "QUEUE_FOR_MAIL",
          letterIds: [generatedId],
          note: "Queued by generation wizard",
        }),
      });
      return "Routed to mail queue.";
    }

    await apiFetch(`/api/letters/generated/${generatedId}/create-email-draft`, {
      method: "POST",
    });
    return "Created linked email draft.";
  }

  /** Routes generated batch items after creation when route target is not print queue. */
  async function routeBatch(result: LettersBatchPreviewResult): Promise<string> {
    const generatedIds = result.generated
      .map((entry) => entry.id)
      .filter((entry) => entry && entry !== "dry-run");

    if (wizardState.routeTarget === "PRINT_QUEUE") {
      return "Batch generation completed and queued for print.";
    }

    if (generatedIds.length === 0) {
      return "No generated IDs were returned for post-generation routing.";
    }

    if (wizardState.routeTarget === "MAIL_QUEUE") {
      await apiFetch("/api/letters/generated/queue/mail/actions", {
        method: "POST",
        body: JSON.stringify({
          action: "QUEUE_FOR_MAIL",
          letterIds: generatedIds,
          note: "Queued by generation wizard",
        }),
      });

      const truncated = result.generatedCount > generatedIds.length
        ? ` Routed ${generatedIds.length} IDs (response was capped).`
        : "";
      return `Routed batch to mail queue.${truncated}`;
    }

    const maxDraftAttempts = 80;
    const draftIds = generatedIds.slice(0, maxDraftAttempts);
    let successCount = 0;

    for (const id of draftIds) {
      try {
        await apiFetch(`/api/letters/generated/${id}/create-email-draft`, { method: "POST" });
        successCount += 1;
      } catch {
        // Continue routing for remaining records.
      }
    }

    const truncated = generatedIds.length > maxDraftAttempts
      ? ` Processed first ${maxDraftAttempts} generated IDs.`
      : "";
    return `Created ${successCount} email drafts from batch output.${truncated}`;
  }

  /** Generates letters and routes results to the selected downstream workflow target. */
  async function generateAndRoute(): Promise<void> {
    if (!recipientsReady) {
      setError("Template and recipient context are required before generation.");
      return;
    }
    if (!previewReady) {
      setError("Run preview before generation so merge output is validated.");
      return;
    }

    setGenerationLoading(true);
    setError(null);
    setNotice(null);
    setGeneratedLetter(null);
    setGeneratedBatchResult(null);

    try {
      if (wizardState.projectType === "INDIVIDUAL") {
        const generated = await apiFetch<GeneratedLetterSummary>("/api/letters/generated", {
          method: "POST",
          body: JSON.stringify({
            templateId: wizardState.templateId,
            constituentId: wizardState.constituentId || undefined,
            donationId: wizardState.donationId || undefined,
            campaignId: wizardState.campaignId || undefined,
            eventId: wizardState.eventId || undefined,
            year: resolveYear(wizardState.year),
          }),
        });

        setGeneratedLetter(generated);
        const routeMessage = await routeSingleLetter(generated.id);
        setNotice(`Generated 1 letter. ${routeMessage}`);
        return;
      }

      const batch = await apiFetch<LettersBatchPreviewResult>("/api/letters/generated/batch", {
        method: "POST",
        body: JSON.stringify({
          templateId: wizardState.templateId,
          filterType: wizardState.batchFilterType,
          constituentIds: parseConstituentIds(wizardState.batchConstituentIdsText),
          year: resolveYear(wizardState.year),
          dryRun: false,
          addToPrintQueue: wizardState.routeTarget === "PRINT_QUEUE",
          dedupeHousehold: wizardState.dedupeHousehold,
        }),
      });

      setGeneratedBatchResult(batch);
      const routeMessage = await routeBatch(batch);
      setNotice(`Generated ${batch.generatedCount} letters. ${routeMessage}`);
    } catch (requestError) {
      setError(normalizeError(requestError, "Failed to generate and route letters."));
    } finally {
      setGenerationLoading(false);
    }
  }

  /** Downloads one server-rendered PDF for the latest generated letter. */
  async function downloadGeneratedPdf(): Promise<void> {
    if (!generatedLetter?.id) {
      setError("Generate one letter first before exporting PDF.");
      return;
    }

    setError(null);
    try {
      const response = await apiFetchResponse(`/api/letters/generated/${generatedLetter.id}/export-pdf`, {
        method: "POST",
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Failed to export generated letter PDF.");
      }

      await downloadBlobFromResponse(response, `generated-letter-${generatedLetter.id}.pdf`);
      setNotice("Server PDF export completed.");
    } catch (requestError) {
      setError(normalizeError(requestError, "Failed to export generated letter PDF."));
    }
  }

  /** Opens browser print fallback using merged print HTML from preview or generated record. */
  function openBrowserPrintFallback(): void {
    const bodyHtml = generatedLetter?.mergedPrintBody || singlePreview?.mergedPrintBody;
    if (!bodyHtml) {
      setError("No merged print output is available for browser print fallback.");
      return;
    }

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      setError("Popup blocked. Allow popups to use browser print fallback.");
      return;
    }

    const subject = generatedLetter?.mergedPrintSubject || selectedTemplate?.name || "Generated Letter";

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${subject}</title>
    <style>
      body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 24px; color: #111827; }
      hr[data-page-break="true"] { border: 0; border-top: 2px dashed #9ca3af; margin: 24px 0; }
    </style>
  </head>
  <body>
    ${bodyHtml}
    <script>
      window.onload = function () {
        window.print();
      };
    </script>
  </body>
</html>`);
    printWindow.document.close();
  }

  const wizardMetadata = useMemo(() => {
    if (catalogLoading) return "Loading template and preset catalog";
    return `${templates.length} active templates · ${headerPresets.length} headers · ${footerPresets.length} footers · ${signatureBlocks.length} signatures`;
  }, [catalogLoading, footerPresets.length, headerPresets.length, signatureBlocks.length, templates.length]);

  return (
    <WorkspaceWizard
      title="Letter Generation Wizard"
      description="Choose project type, select template/preset context, pick recipients, preview merge output, then route generated letters."
      steps={WIZARD_STEPS}
      activeStep={wizardStepIndex}
      breadcrumbItems={[
        { label: "Donor CRM", href: "/" },
        { label: "Letters & Printables", href: "/letters-printables" },
        { label: "Generate Wizard" },
      ]}
      metadata={wizardMetadata}
    >
      <div className="space-y-4">
        <LettersWorkspaceNav />

        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
          <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">Project: {wizardState.projectType}</span>
          <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">Route: {wizardState.routeTarget.replaceAll("_", " ")}</span>
          <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
            Preview: {previewReady ? "Ready" : "Pending"}
          </span>
        </div>

        {catalogError && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{catalogError}</div>
        )}

        {error && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>
        )}

        {notice && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</div>
        )}

        {step === "template" && (
          <div className="space-y-4">
            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">1. Choose Project Type</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => updateWizardState({ projectType: "INDIVIDUAL" })}
                  className={`rounded-lg border p-3 text-left ${wizardState.projectType === "INDIVIDUAL" ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <p className="text-sm font-semibold text-gray-900">Individual Letter</p>
                  <p className="mt-1 text-xs text-gray-600">Generate one letter with optional donation/campaign/event merge context.</p>
                </button>
                <button
                  type="button"
                  onClick={() => updateWizardState({ projectType: "BATCH" })}
                  className={`rounded-lg border p-3 text-left ${wizardState.projectType === "BATCH" ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <p className="text-sm font-semibold text-gray-900">Batch Letter Run</p>
                  <p className="mt-1 text-xs text-gray-600">Generate many letters with donor filter rules and skip reporting.</p>
                </button>
              </div>
            </section>

            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">2. Pick Template / Preset Context</h2>
              <label className="mt-3 block text-sm text-gray-700">
                Active Template
                <select
                  value={wizardState.templateId}
                  onChange={(event) => updateWizardState({ templateId: event.target.value })}
                  disabled={catalogLoading}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                >
                  <option value="">Choose template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
              </label>

              {selectedTemplate && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                  <p><span className="font-semibold text-gray-900">Category:</span> {selectedTemplate.category.replaceAll("_", " ")}</p>
                  {selectedTemplate.description && (
                    <p className="mt-1"><span className="font-semibold text-gray-900">Description:</span> {selectedTemplate.description}</p>
                  )}
                  <p className="mt-2"><span className="font-semibold text-gray-900">Header preset:</span> {selectedTemplateDetails?.headerPreset?.name || "Template default"}</p>
                  <p><span className="font-semibold text-gray-900">Footer preset:</span> {selectedTemplateDetails?.footerPreset?.name || "Template default"}</p>
                  <p><span className="font-semibold text-gray-900">Signature preset:</span> {selectedTemplateDetails?.signatureBlock?.name || "Template default"}</p>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <Link href="/letters-printables/templates" className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50">Open Template Library</Link>
                <Link href="/letters-printables/presets" className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50">Open Preset Library</Link>
                <Link href="/letters-printables/generate" className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50">Open Existing Generate Center</Link>
              </div>
            </section>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => goToStep("recipients")}
                disabled={!wizardState.templateId}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                Continue to Recipients
              </button>
            </div>
          </div>
        )}

        {step === "recipients" && (
          <div className="space-y-4">
            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">Recipient Selection</h2>

              {wizardState.projectType === "INDIVIDUAL" ? (
                <div className="mt-3 space-y-3">
                  <label className="block text-sm text-gray-700">
                    Search Constituents
                    <input
                      value={recipientSearch}
                      onChange={(event) => setRecipientSearch(event.target.value)}
                      placeholder="Type at least 2 characters"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                    />
                  </label>

                  {recipientSearchLoading && <p className="text-xs text-gray-500">Searching recipients...</p>}

                  {!recipientSearchLoading && recipientOptions.length > 0 && (
                    <div className="max-h-48 overflow-auto rounded-lg border border-gray-200">
                      {recipientOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => updateWizardState({ constituentId: option.id })}
                          className={`block w-full border-b border-gray-100 px-3 py-2 text-left text-xs hover:bg-gray-50 ${wizardState.constituentId === option.id ? "bg-green-50" : "bg-white"}`}
                        >
                          {formatConstituentLabel(option)}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block text-sm text-gray-700">
                      Constituent ID
                      <input
                        value={wizardState.constituentId}
                        onChange={(event) => updateWizardState({ constituentId: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm text-gray-700">
                      Year
                      <input
                        value={wizardState.year}
                        onChange={(event) => updateWizardState({ year: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm text-gray-700">
                      Donation ID (optional)
                      <input
                        value={wizardState.donationId}
                        onChange={(event) => updateWizardState({ donationId: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm text-gray-700">
                      Campaign ID (optional)
                      <input
                        value={wizardState.campaignId}
                        onChange={(event) => updateWizardState({ campaignId: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </label>
                    <label className="block text-sm text-gray-700 md:col-span-2">
                      Event ID (optional)
                      <input
                        value={wizardState.eventId}
                        onChange={(event) => updateWizardState({ eventId: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block text-sm text-gray-700">
                      Donor Filter
                      <select
                        value={wizardState.batchFilterType}
                        onChange={(event) => updateWizardState({ batchFilterType: event.target.value as LettersWizardState["batchFilterType"] })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      >
                        {BATCH_FILTERS.map((entry) => (
                          <option key={entry} value={entry}>{entry.replaceAll("_", " ")}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm text-gray-700">
                      Year
                      <input
                        value={wizardState.year}
                        onChange={(event) => updateWizardState({ year: event.target.value })}
                        className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                    </label>
                  </div>

                  <label className="block text-sm text-gray-700">
                    Optional Specific Constituent IDs
                    <textarea
                      value={wizardState.batchConstituentIdsText}
                      onChange={(event) => updateWizardState({ batchConstituentIdsText: event.target.value })}
                      rows={4}
                      placeholder="Separate IDs with commas or new lines"
                      className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
                    />
                  </label>

                  <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={wizardState.dedupeHousehold}
                      onChange={(event) => updateWizardState({ dedupeHousehold: event.target.checked })}
                    />
                    Dedupe by household during batch generation
                  </label>
                </div>
              )}
            </section>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => goToStep("template")}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Back to Template
              </button>
              <button
                type="button"
                onClick={() => goToStep("preview")}
                disabled={!recipientsReady}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                Continue to Preview
              </button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">Preview Merge Output</h2>
              <p className="mt-1 text-xs text-gray-600">
                Validate merge output before generation. This must pass before completion routing.
              </p>

              <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                <p><span className="font-semibold text-gray-900">Project:</span> {wizardState.projectType}</p>
                <p><span className="font-semibold text-gray-900">Template:</span> {selectedTemplate?.name || "Not selected"}</p>
                <p><span className="font-semibold text-gray-900">Route target:</span> {wizardState.routeTarget.replaceAll("_", " ")}</p>
                {wizardState.projectType === "INDIVIDUAL" ? (
                  <p><span className="font-semibold text-gray-900">Constituent:</span> {wizardState.constituentId || "Not selected"}</p>
                ) : (
                  <p><span className="font-semibold text-gray-900">Batch filter:</span> {wizardState.batchFilterType.replaceAll("_", " ")}</p>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void runPreview()}
                  disabled={previewLoading || !recipientsReady}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                >
                  {previewLoading ? "Previewing..." : "Run Preview"}
                </button>
                <Link href="/letters-printables/generate" className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Open Existing Generate Center
                </Link>
              </div>
            </section>

            {singlePreview && (
              <section className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-gray-900">Single Letter Preview</h3>
                <div
                  className="mt-3 rounded border border-gray-200 bg-white p-4 text-sm text-gray-800 [&_hr[data-page-break='true']]:my-6 [&_hr[data-page-break='true']]:border-t-2 [&_hr[data-page-break='true']]:border-dashed [&_hr[data-page-break='true']]:border-gray-400"
                  dangerouslySetInnerHTML={{ __html: singlePreview.mergedPrintBody }}
                />
                {singlePreview.unsupportedFields.length > 0 && (
                  <p className="mt-3 text-xs text-amber-700">Unsupported merge fields: {singlePreview.unsupportedFields.join(", ")}</p>
                )}
              </section>
            )}

            {batchPreview && (
              <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Batch Dry-Run Preview</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">Selected</p><p className="text-lg font-semibold text-gray-900">{batchPreview.totalSelected}</p></div>
                  <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">Eligible</p><p className="text-lg font-semibold text-gray-900">{batchPreview.eligible}</p></div>
                  <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">Generated (Dry)</p><p className="text-lg font-semibold text-gray-900">{batchPreview.generatedCount}</p></div>
                  <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">Skipped</p><p className="text-lg font-semibold text-gray-900">{batchPreview.skippedCount}</p></div>
                </div>

                <div className="rounded-lg border border-gray-200 p-3 text-xs text-gray-700">
                  {Object.keys(batchPreview.skippedByReason).length === 0
                    ? "No skipped rows in this dry-run."
                    : Object.entries(batchPreview.skippedByReason).map(([reason, count]) => `${reason}: ${count}`).join(" | ")}
                </div>
              </section>
            )}

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => goToStep("recipients")}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Back to Recipients
              </button>
              <button
                type="button"
                onClick={() => goToStep("complete")}
                disabled={!previewReady}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
              >
                Continue to Complete
              </button>
            </div>
          </div>
        )}

        {step === "complete" && (
          <div className="space-y-4">
            <section className="rounded-lg border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">Generate and Route</h2>
              <p className="mt-1 text-xs text-gray-600">
                Route outputs to print queue, mail queue, or email draft after generation.
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {(["PRINT_QUEUE", "MAIL_QUEUE", "EMAIL_DRAFT"] as const).map((target) => (
                  <button
                    key={target}
                    type="button"
                    onClick={() => updateWizardState({ routeTarget: target }, false)}
                    className={`rounded-lg border p-3 text-left ${wizardState.routeTarget === target ? "border-green-600 bg-green-50" : "border-gray-200 hover:border-gray-300"}`}
                  >
                    <p className="text-sm font-semibold text-gray-900">{target.replaceAll("_", " ")}</p>
                    <p className="mt-1 text-xs text-gray-600">{ROUTE_TARGET_HELPER_TEXT[target]}</p>
                  </button>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void generateAndRoute()}
                  disabled={generationLoading || !previewReady}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                >
                  {generationLoading ? "Generating..." : "Generate and Route"}
                </button>
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700">
                  Server PDF export is enabled for generated letters, with browser print still available as a fallback.
                </span>
              </div>
            </section>

            {generatedLetter && (
              <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Single Letter Result</h3>
                <p className="text-xs text-gray-600">Generated letter ID: {generatedLetter.id}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void downloadGeneratedPdf()}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    Export PDF (Server)
                  </button>
                  <button
                    type="button"
                    onClick={openBrowserPrintFallback}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    Browser Print Fallback
                  </button>
                  <Link href="/letters-printables/generated" className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50">
                    Open Generated Letters
                  </Link>
                </div>
              </section>
            )}

            {generatedBatchResult && (
              <section className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900">Batch Result</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">Selected</p><p className="text-lg font-semibold text-gray-900">{generatedBatchResult.totalSelected}</p></div>
                  <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">Generated</p><p className="text-lg font-semibold text-gray-900">{generatedBatchResult.generatedCount}</p></div>
                  <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">Skipped</p><p className="text-lg font-semibold text-gray-900">{generatedBatchResult.skippedCount}</p></div>
                  <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">Route</p><p className="text-lg font-semibold text-gray-900">{wizardState.routeTarget.replaceAll("_", " ")}</p></div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Link href="/letters-printables/print-queue" className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50">Open Print Queue</Link>
                  <Link href="/letters-printables/mail-queue" className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50">Open Mail Queue</Link>
                  <Link href="/letters-printables/generated" className="rounded-lg border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50">Open Generated Letters</Link>
                </div>
              </section>
            )}

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => goToStep("preview")}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Back to Preview
              </button>
              <Link href="/letters-printables/generate" className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Open Existing Generate Center
              </Link>
            </div>
          </div>
        )}
      </div>
    </WorkspaceWizard>
  );
}
