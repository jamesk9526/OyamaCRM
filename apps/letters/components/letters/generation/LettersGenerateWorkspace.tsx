/** Interactive all-in-one OyamaLetters generation workspace. */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch, apiFetchResponse } from "@/lib/auth-client";
import type { GeneratedLetterSummary } from "@/components/letters/types";
import DocumentPreviewPanel from "./DocumentPreviewPanel";
import GenerateActionBar from "./GenerateActionBar";
import MergeSettingsPanel from "./MergeSettingsPanel";
import TemplateAudiencePanel from "./TemplateAudiencePanel";
import type {
  BatchResult,
  CampaignLookup,
  ConstituentLookup,
  DonationLookup,
  GenerateAudienceSource,
  GenerationStatus,
  LetterTemplateCard,
  MergeFieldSection,
  PdfPreviewState,
  PreviewMode,
  PrintableDocumentType,
  RightPanelTab,
  SavedAudienceDetail,
  SavedAudienceList,
  SinglePreview,
} from "./letters-generation-types";
import { downloadBlob, filenameFromDisposition, formatConstituentName, getGeneratedIds, parseIds, resolveYear } from "./generation-utils";

const DOCUMENT_TYPES: PrintableDocumentType[] = [
  { id: "thank-you", label: "Thank-You Letter", category: "THANK_YOU", description: "Personal donor thanks and acknowledgments." },
  { id: "receipt", label: "Donation Receipt", category: "TAX_RECEIPT", description: "Single or batch tax receipt printables." },
  { id: "labels", label: "Mailing Labels", category: "GENERAL", description: "Address labels and envelope labels." },
  { id: "custom", label: "Custom Letter", category: "GENERAL", description: "Flexible letter or printable PDF." },
  { id: "event-packet", label: "Event Packet", category: "EVENT", description: "Event letters and packet documents." },
  { id: "board-packet", label: "Board Packet", category: "GENERAL", description: "Board-facing printable packets." },
];

const EMPTY_PREVIEW: SinglePreview | null = null;
const QUERY_TYPE_ALIASES: Record<string, string> = {
  "thank-you": "thank-you",
  thankyou: "thank-you",
  receipt: "receipt",
  receipts: "receipt",
  labels: "labels",
  "mailing-labels": "labels",
  custom: "custom",
  "custom-letter": "custom",
  "event-packet": "event-packet",
  "board-packet": "board-packet",
};

/** Coordinates real record selection, merge preview, PDF generation, and browser PDF preview. */
export default function LettersGenerateWorkspace() {
  const searchParams = useSearchParams();
  const seededTemplateId = searchParams.get("templateId")?.trim() || "";
  const seededConstituentId = searchParams.get("constituentId")?.trim() || "";
  const seededTab = searchParams.get("tab") === "activity" ? "activity" : "merge-fields";
  const seededDocumentType = QUERY_TYPE_ALIASES[(searchParams.get("type") ?? searchParams.get("documentType") ?? "").trim().toLowerCase()] ?? "thank-you";
  const reportIds = useMemo(() => parseIds(searchParams.get("constituentIds") ?? searchParams.get("reportConstituentIds") ?? ""), [searchParams]);

  const [documentTypeId, setDocumentTypeId] = useState(seededDocumentType);
  const [templates, setTemplates] = useState<LetterTemplateCard[]>([]);
  const [templateId, setTemplateId] = useState(seededTemplateId);
  const [audienceSource, setAudienceSource] = useState<GenerateAudienceSource>(seededConstituentId ? "single" : reportIds.length > 0 ? "report-result" : "single");
  const [mergeSections, setMergeSections] = useState<MergeFieldSection[]>([]);
  const [generatedLetters, setGeneratedLetters] = useState<GeneratedLetterSummary[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignLookup[]>([]);
  const [audienceLists, setAudienceLists] = useState<SavedAudienceList[]>([]);
  const [audienceListId, setAudienceListId] = useState("");
  const [matchedListIds, setMatchedListIds] = useState<string[]>([]);

  const [constituentSearch, setConstituentSearch] = useState("");
  const [constituentOptions, setConstituentOptions] = useState<ConstituentLookup[]>([]);
  const [selectedConstituent, setSelectedConstituent] = useState<ConstituentLookup | null>(null);
  const [selectedDonation, setSelectedDonation] = useState<DonationLookup | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [contactOptions, setContactOptions] = useState<ConstituentLookup[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());

  const [campaignId, setCampaignId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("ALL");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [pageSize, setPageSize] = useState("Letter");
  const [orientation, setOrientation] = useState("Portrait");
  const [marginPreset, setMarginPreset] = useState("Normal");
  const [dateFormat, setDateFormat] = useState("MMMM d, yyyy");
  const [currencyFormat, setCurrencyFormat] = useState("$1,234.00");
  const [addressFormat, setAddressFormat] = useState("US multiline");
  const [showOrganizationFooter, setShowOrganizationFooter] = useState(true);
  const [includeCoverPage, setIncludeCoverPage] = useState(false);
  const [includeToc, setIncludeToc] = useState(false);
  const [pageNumbering, setPageNumbering] = useState(true);
  const [dedupeHousehold, setDedupeHousehold] = useState(true);

  const [previewMode, setPreviewMode] = useState<PreviewMode>("html");
  const [rightTab, setRightTab] = useState<RightPanelTab>(seededTab);
  const [singlePreview, setSinglePreview] = useState<SinglePreview | null>(EMPTY_PREVIEW);
  const [batchPreview, setBatchPreview] = useState<BatchResult | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [singleGenerated, setSingleGenerated] = useState<GeneratedLetterSummary | null>(null);
  const [pdfPreview, setPdfPreview] = useState<PdfPreviewState | null>(null);
  const [recipientIndex, setRecipientIndex] = useState(0);
  const [status, setStatus] = useState<GenerationStatus>("Draft");
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = useMemo(() => templates.find((template) => template.id === templateId) ?? null, [templateId, templates]);
  const selectedDocumentType = useMemo(() => DOCUMENT_TYPES.find((type) => type.id === documentTypeId) ?? DOCUMENT_TYPES[0], [documentTypeId]);
  const isBatch = audienceSource !== "single";
  const batchRecipientIds = useMemo(() => resolveBatchRecipientIds(audienceSource, selectedContactIds, matchedListIds, reportIds), [audienceSource, matchedListIds, reportIds, selectedContactIds]);
  const batchRecipients = batchPreview?.generated ?? batchResult?.generated ?? [];
  const activeBatchRecipient = batchRecipients[recipientIndex] ?? batchRecipients[0] ?? null;
  const selectedRecipientName = isBatch ? activeBatchRecipient?.constituentName ?? "" : formatConstituentName(selectedConstituent);
  const canGeneratePdf = Boolean(templateId && (selectedConstituent?.id || isBatch));
  const canDownloadPdf = Boolean(pdfPreview);
  const primaryLabel = pdfPreview ? "Download PDF" : isBatch ? "Generate Batch PDF" : "Generate PDF";
  const workspaceTitle = titleForDocumentType(selectedDocumentType.id, selectedDocumentType.label);

  const loadCatalog = useCallback(async () => {
    setError(null);
    try {
      const [templateRows, mergeCatalog, listRows, campaignRows, generatedRows] = await Promise.all([
        apiFetch<LetterTemplateCard[]>("/api/letters/templates"),
        apiFetch<{ sections: MergeFieldSection[] }>("/api/letters/merge-fields"),
        apiFetch<SavedAudienceList[]>("/api/email-campaigns/lists"),
        apiFetch<CampaignLookup[]>("/api/campaigns?limit=100&scope=ALL_YEARS"),
        apiFetch<GeneratedLetterSummary[]>(`/api/letters/generated?limit=25${seededTemplateId ? `&templateId=${encodeURIComponent(seededTemplateId)}` : ""}`),
      ]);
      setTemplates(templateRows);
      setMergeSections(mergeCatalog.sections ?? []);
      setAudienceLists(listRows);
      setCampaigns(campaignRows);
      setGeneratedLetters(generatedRows);
      if (!templateId && templateRows[0]) setTemplateId(templateRows[0].id);
      if (!audienceListId && listRows[0]) setAudienceListId(listRows[0].id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load Letters & Printables.");
      setStatus("Failed");
    }
  }, [audienceListId, templateId]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!seededConstituentId || selectedConstituent?.id === seededConstituentId) return;
    let cancelled = false;
    apiFetch<ConstituentLookup>(`/api/constituents/${encodeURIComponent(seededConstituentId)}`)
      .then((row) => {
        if (cancelled || !row?.id) return;
        setSelectedConstituent(row);
        setConstituentSearch(formatConstituentName(row));
        setStatus("Ready to Preview");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [seededConstituentId, selectedConstituent?.id]);

  useSearchLookup(constituentSearch, setConstituentOptions);
  useSearchLookup(contactSearch, setContactOptions);

  useEffect(() => {
    if (!audienceListId || audienceSource !== "saved-list") return;
    let cancelled = false;
    async function matchListToConstituents() {
      try {
        const detail = await apiFetch<SavedAudienceDetail>(`/api/email-campaigns/lists/${audienceListId}`);
        const matched = new Set<string>();
        for (const email of detail.recipients.map((row) => row.email.trim()).filter(Boolean).slice(0, 250)) {
          const rows = await apiFetch<ConstituentLookup[]>(`/api/constituents?search=${encodeURIComponent(email)}&limit=3`);
          const exact = rows.find((row) => row.email?.toLowerCase() === email.toLowerCase());
          if (exact) matched.add(exact.id);
        }
        if (!cancelled) setMatchedListIds(Array.from(matched));
      } catch {
        if (!cancelled) setMatchedListIds([]);
      }
    }
    void matchListToConstituents();
    return () => {
      cancelled = true;
    };
  }, [audienceListId, audienceSource]);

  useEffect(() => {
    return () => {
      if (pdfPreview?.url) URL.revokeObjectURL(pdfPreview.url);
    };
  }, [pdfPreview?.url]);

  async function runPreview() {
    if (!templateId) return setErrorState("Choose a real template before preview.");
    if (audienceSource === "single") {
      if (!selectedConstituent?.id) return setErrorState("Choose a constituent before preview.");
      await previewForConstituent(selectedConstituent.id);
      return;
    }
    const dryRun = await runBatch(true);
    const first = dryRun?.generated[0];
    if (first?.constituentId) await previewForConstituent(first.constituentId);
  }

  async function previewForConstituent(constituentId: string) {
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const preview = await apiFetch<SinglePreview>("/api/letters/generated/preview", {
        method: "POST",
        body: JSON.stringify({ templateId, constituentId, donationId: selectedDonation?.id, year: resolveYear(year) }),
      });
      setSinglePreview(preview);
      setPreviewMode("html");
      setStatus(preview.missingFields.length > 0 || preview.unsupportedFields.length > 0 ? "Missing Merge Fields" : "Ready to Preview");
      setNotice("Merged preview is ready.");
    } catch (requestError) {
      setErrorState(requestError instanceof Error ? requestError.message : "Failed to preview document.");
    } finally {
      setWorking(false);
    }
  }

  async function generatePdf() {
    if (pdfPreview) {
      downloadBlob(pdfPreview.blob, pdfPreview.filename);
      setStatus("Downloaded");
      return;
    }
    if (!templateId) return setErrorState("Choose a template before generating PDF.");
    setWorking(true);
    setError(null);
    setNotice(null);
    setStatus("Generating PDF");
    try {
      if (isBatch) {
        const result = batchResult ?? await runBatch(false, true);
        const letterIds = getGeneratedIds(result);
        if (letterIds.length === 0) throw new Error("No generated document IDs are available for PDF preview.");
        await previewBatchPdf(letterIds);
      } else {
        if (!selectedConstituent?.id) throw new Error("Choose a constituent before generating PDF.");
        const generated = singleGenerated ?? await apiFetch<GeneratedLetterSummary>("/api/letters/generated", {
          method: "POST",
          body: JSON.stringify({ templateId, constituentId: selectedConstituent.id, donationId: selectedDonation?.id, year: resolveYear(year) }),
        });
        setSingleGenerated(generated);
        await previewSinglePdf(generated.id);
      }
      setStatus("Generated");
      setPreviewMode("pdf");
      setNotice("PDF generated and loaded into browser preview.");
      await loadGeneratedHistory();
    } catch (requestError) {
      setErrorState(requestError instanceof Error ? requestError.message : "PDF generation failed. The template may contain an unsupported block or missing image.");
    } finally {
      setWorking(false);
    }
  }

  async function runBatch(dryRun: boolean, keepWorking = false): Promise<BatchResult | null> {
    if (!templateId) {
      setErrorState("Choose a template before batch generation.");
      return null;
    }
    if (!keepWorking) setWorking(true);
    setError(null);
    try {
      const result = await apiFetch<BatchResult>("/api/letters/generated/batch", {
        method: "POST",
        body: JSON.stringify({
          templateId,
          filterType: audienceSource === "segment" ? segmentFilter : "ALL",
          constituentIds: batchRecipientIds,
          campaignId: audienceSource === "campaign" ? campaignId : undefined,
          dateFrom: audienceSource === "date-range" ? dateFrom : undefined,
          dateTo: audienceSource === "date-range" ? dateTo : undefined,
          year: resolveYear(year),
          dryRun,
          addToPrintQueue: false,
          dedupeHousehold,
        }),
      });
      if (dryRun) {
        setBatchPreview(result);
        setRecipientIndex(0);
        setNotice(`Batch dry-run found ${result.eligible} eligible recipients.`);
      } else {
        setBatchResult(result);
        setRecipientIndex(0);
      }
      return result;
    } catch (requestError) {
      setErrorState(requestError instanceof Error ? requestError.message : "Batch generation failed.");
      return null;
    } finally {
      if (!keepWorking) setWorking(false);
    }
  }

  async function previewSinglePdf(letterId: string) {
    const response = await apiFetchResponse(`/api/letters/generated/${letterId}/export-pdf?preview=1`, { method: "POST" });
    await loadPdfResponse(response, `generated-letter-${letterId}.pdf`, [letterId]);
  }

  async function previewBatchPdf(letterIds: string[]) {
    const response = await apiFetchResponse("/api/letters/generated/export-pdf-batch?preview=1", {
      method: "POST",
      body: JSON.stringify({ letterIds }),
    });
    await loadPdfResponse(response, `letters-batch-${Date.now()}.pdf`, letterIds);
  }

  async function loadPdfResponse(response: Response, fallbackName: string, letterIds: string[]) {
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error?.message ?? "PDF generation failed.");
    }
    const blob = await response.blob();
    const filename = filenameFromDisposition(response.headers.get("content-disposition"), fallbackName);
    const url = URL.createObjectURL(blob);
    setPdfPreview((previous) => {
      if (previous?.url) URL.revokeObjectURL(previous.url);
      return { url, blob, filename, letterIds, generatedAt: new Date().toISOString() };
    });
  }

  async function loadGeneratedHistory() {
    const result = await apiFetch<GeneratedLetterSummary[]>("/api/letters/generated?limit=25");
    setGeneratedLetters(result);
  }

  function chooseConstituent(row: ConstituentLookup) {
    setSelectedConstituent(row);
    setConstituentSearch(formatConstituentName(row));
    setConstituentOptions([]);
    setStatus("Ready to Preview");
  }

  function toggleContact(row: ConstituentLookup) {
    setSelectedContactIds((previous) => {
      const next = new Set(previous);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
  }

  function downloadPdf() {
    if (!pdfPreview) return;
    downloadBlob(pdfPreview.blob, pdfPreview.filename);
    setStatus("Downloaded");
  }

  function printPdf() {
    if (!pdfPreview) return;
    window.open(pdfPreview.url, "_blank", "noopener,noreferrer");
  }

  async function markPrinted() {
    if (!pdfPreview?.letterIds.length) return;
    setWorking(true);
    try {
      await Promise.all(pdfPreview.letterIds.map((id) => apiFetch(`/api/letters/generated/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "PRINTED" }),
      })));
      setStatus("Printed");
      await loadGeneratedHistory();
    } catch (requestError) {
      setErrorState(requestError instanceof Error ? requestError.message : "Failed to mark generated documents printed.");
    } finally {
      setWorking(false);
    }
  }

  function setErrorState(message: string) {
    setError(message);
    setNotice(null);
    setStatus("Failed");
  }

  return (
    <div className="min-w-0 bg-[#f6f8fb]">
      <GenerateActionBar
        title={workspaceTitle}
        subtitle="Create and personalize print-ready documents from real CRM records."
        status={status}
        primaryLabel={primaryLabel}
        canGeneratePdf={Boolean(pdfPreview) || canGeneratePdf}
        canDownloadPdf={canDownloadPdf}
        canPrintPdf={Boolean(pdfPreview)}
        working={working}
        isBatch={isBatch}
        onPreview={() => void runPreview()}
        onGeneratePdf={() => void generatePdf()}
        onDownloadPdf={downloadPdf}
        onPrintPdf={printPdf}
        onSaveDraft={() => setNotice("Draft metadata is kept in the selected template; generated-document draft persistence is not yet separate.")}
        onSaveToRecord={() => setNotice(singleGenerated?.constituentId ? "Generated document is already linked to the constituent activity timeline." : "Generate a single-recipient document before saving to a record.")}
        onCreateTask={() => setNotice("Create Task handoff is not wired yet for generated printables.")}
        onMarkPrinted={() => void markPrinted()}
      />

      {error ? <div className="mx-3 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">PDF generation failed. {error} <button type="button" onClick={() => void generatePdf()} className="ml-2 font-semibold underline">Retry</button></div> : null}
      {notice ? <div className="mx-3 mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div> : null}

      <div className="grid min-h-[calc(100dvh-9.25rem)] min-w-0 gap-3 p-3 xl:grid-cols-[292px_minmax(0,1fr)_348px]">
        <TemplateAudiencePanel
          documentTypes={DOCUMENT_TYPES}
          documentTypeId={selectedDocumentType.id}
          templates={filterTemplates(templates, selectedDocumentType.category)}
          templateId={templateId}
          audienceSource={audienceSource}
          constituentSearch={constituentSearch}
          constituentOptions={constituentOptions}
          selectedConstituent={selectedConstituent}
          selectedContactIds={selectedContactIds}
          contactSearch={contactSearch}
          contactOptions={contactOptions}
          audienceLists={audienceLists}
          audienceListId={audienceListId}
          matchedListIds={matchedListIds}
          reportIds={reportIds}
          campaigns={campaigns}
          campaignId={campaignId}
          dateFrom={dateFrom}
          dateTo={dateTo}
          segmentFilter={segmentFilter}
          year={year}
          pageSize={pageSize}
          orientation={orientation}
          dedupeHousehold={dedupeHousehold}
          preview={singlePreview}
          onDocumentTypeChange={(value) => {
            setDocumentTypeId(value);
            const nextType = DOCUMENT_TYPES.find((type) => type.id === value);
            const nextTemplate = filterTemplates(templates, nextType?.category).find((template) => template.status !== "ARCHIVED");
            if (nextTemplate) setTemplateId(nextTemplate.id);
          }}
          onTemplateChange={setTemplateId}
          onAudienceSourceChange={setAudienceSource}
          onConstituentSearchChange={setConstituentSearch}
          onChooseConstituent={chooseConstituent}
          onContactSearchChange={setContactSearch}
          onToggleContact={toggleContact}
          onAudienceListChange={setAudienceListId}
          onCampaignChange={setCampaignId}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onSegmentFilterChange={setSegmentFilter}
          onYearChange={setYear}
          onPageSizeChange={setPageSize}
          onOrientationChange={setOrientation}
          onDedupeHouseholdChange={setDedupeHousehold}
        />

        <DocumentPreviewPanel
          mode={previewMode}
          preview={singlePreview}
          pdfPreview={pdfPreview}
          batchPreview={batchPreview}
          recipientIndex={recipientIndex}
          recipientCount={batchRecipients.length}
          selectedRecipientName={selectedRecipientName}
          onModeChange={setPreviewMode}
          onPreviousRecipient={() => {
            const next = Math.max(0, recipientIndex - 1);
            setRecipientIndex(next);
            const recipient = batchRecipients[next];
            if (recipient?.constituentId) void previewForConstituent(recipient.constituentId);
          }}
          onNextRecipient={() => {
            const next = Math.min(Math.max(batchRecipients.length - 1, 0), recipientIndex + 1);
            setRecipientIndex(next);
            const recipient = batchRecipients[next];
            if (recipient?.constituentId) void previewForConstituent(recipient.constituentId);
          }}
        />

        <MergeSettingsPanel
          tab={rightTab}
          mergeSections={mergeSections}
          preview={singlePreview}
          generatedLetters={generatedLetters}
          pageSize={pageSize}
          orientation={orientation}
          marginPreset={marginPreset}
          dateFormat={dateFormat}
          currencyFormat={currencyFormat}
          addressFormat={addressFormat}
          showOrganizationFooter={showOrganizationFooter}
          includeCoverPage={includeCoverPage}
          includeToc={includeToc}
          pageNumbering={pageNumbering}
          onTabChange={setRightTab}
          onInsertMergeField={(field) => void navigator.clipboard?.writeText(field)}
          onMarginPresetChange={setMarginPreset}
          onDateFormatChange={setDateFormat}
          onCurrencyFormatChange={setCurrencyFormat}
          onAddressFormatChange={setAddressFormat}
          onShowOrganizationFooterChange={setShowOrganizationFooter}
          onIncludeCoverPageChange={setIncludeCoverPage}
          onIncludeTocChange={setIncludeToc}
          onPageNumberingChange={setPageNumbering}
        />
      </div>
    </div>
  );
}

function useSearchLookup(query: string, setRows: (rows: ConstituentLookup[]) => void) {
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setRows([]);
      return;
    }
    const timer = window.setTimeout(() => {
      apiFetch<ConstituentLookup[]>(`/api/constituents?search=${encodeURIComponent(trimmed)}&limit=20`)
        .then(setRows)
        .catch(() => setRows([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, setRows]);
}

function resolveBatchRecipientIds(source: GenerateAudienceSource, selectedContactIds: Set<string>, matchedListIds: string[], reportIds: string[]): string[] {
  if (source === "multiple") return Array.from(selectedContactIds);
  if (source === "saved-list") return matchedListIds;
  if (source === "report-result") return reportIds;
  return [];
}

function filterTemplates(templates: LetterTemplateCard[], category?: string): LetterTemplateCard[] {
  if (!category) return templates;
  const filtered = templates.filter((template) => template.category === category || category === "GENERAL");
  return filtered.length > 0 ? filtered : templates;
}

function titleForDocumentType(id: string, label: string): string {
  if (id === "thank-you") return "Generate Thank-You Letters";
  if (id === "receipt") return "Generate Donation Receipts";
  if (id === "labels") return "Generate Mailing Labels";
  if (id === "event-packet") return "Build Event Packet";
  if (id === "board-packet") return "Build Board Packet";
  return `Generate ${label}`;
}
