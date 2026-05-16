/** Unified single and batch generation workspace for one printable template. */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import type { GeneratedLetterSummary, LetterTemplateSummary } from "@/app/components/letters/types";

type GenerateMode = "single" | "batch";
type BatchSource = "segment" | "contacts" | "list";
type QueueTarget = "none" | "print" | "mail";
type BatchFilter = "ALL" | "ACTIVE" | "LAPSED" | "NEW" | "MAJOR_DONOR" | "MONTHLY_DONOR";

interface ConstituentLookup {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  donorStatus?: string | null;
}

interface DonationLookup {
  id: string;
  amount: number | string;
  date: string;
  status: string;
  constituent?: { firstName?: string | null; lastName?: string | null } | null;
  campaign?: { name?: string | null } | null;
  designation?: { name?: string | null } | null;
}

interface SavedAudienceList {
  id: string;
  name: string;
  description?: string | null;
  recipientsCount: number;
}

interface SavedAudienceDetail {
  id: string;
  name: string;
  recipients: Array<{ email: string }>;
}

interface SinglePreview {
  mergedPrintBody: string;
  unsupportedFields: string[];
}

interface BatchResult {
  dryRun: boolean;
  templateId: string;
  totalSelected: number;
  eligible: number;
  generatedCount: number;
  generatedIds?: string[];
  skippedCount: number;
  skippedByReason: Record<string, number>;
  skipped: Array<{ constituentId: string; reason: string }>;
  generated: Array<{ id: string; constituentId: string; constituentName: string }>;
  addToPrintQueue: boolean;
}

const BATCH_FILTERS: BatchFilter[] = ["ALL", "ACTIVE", "LAPSED", "NEW", "MAJOR_DONOR", "MONTHLY_DONOR"];

/** Downloads a binary response body as a file in the browser. */
async function downloadBlobFromResponse(response: Response, fallbackName: string): Promise<void> {
  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition") || "";
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i);
  const filename = filenameMatch?.[1] || fallbackName;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

/** Renders the modern template-specific generation workspace. */
export default function LetterGenerateCenter() {
  const searchParams = useSearchParams();
  const seededTemplateId = searchParams.get("templateId")?.trim() || "";
  const seededMode = searchParams.get("mode") === "batch" ? "batch" : "single";
  const seededTarget = searchParams.get("target") === "mail" ? "mail" : searchParams.get("target") === "print" ? "print" : "none";

  const [mode, setMode] = useState<GenerateMode>(seededMode);
  const [batchSource, setBatchSource] = useState<BatchSource>("segment");
  const [templates, setTemplates] = useState<LetterTemplateSummary[]>([]);
  const [templateId, setTemplateId] = useState(seededTemplateId);
  const [constituentSearch, setConstituentSearch] = useState("");
  const [constituentOptions, setConstituentOptions] = useState<ConstituentLookup[]>([]);
  const [selectedConstituent, setSelectedConstituent] = useState<ConstituentLookup | null>(null);
  const [donationSearch, setDonationSearch] = useState("");
  const [donationOptions, setDonationOptions] = useState<DonationLookup[]>([]);
  const [selectedDonation, setSelectedDonation] = useState<DonationLookup | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [contactOptions, setContactOptions] = useState<ConstituentLookup[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [audienceLists, setAudienceLists] = useState<SavedAudienceList[]>([]);
  const [audienceListId, setAudienceListId] = useState("");
  const [matchedListIds, setMatchedListIds] = useState<string[]>([]);
  const [batchFilter, setBatchFilter] = useState<BatchFilter>("ALL");
  const [manualIds, setManualIds] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [queueTarget, setQueueTarget] = useState<QueueTarget>(seededTarget);
  const [dedupeHousehold, setDedupeHousehold] = useState(true);
  const [singlePreview, setSinglePreview] = useState<SinglePreview | null>(null);
  const [batchPreview, setBatchPreview] = useState<BatchResult | null>(null);
  const [singleGenerated, setSingleGenerated] = useState<GeneratedLetterSummary | null>(null);
  const [batchResult, setBatchResult] = useState<BatchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [pdfWorking, setPdfWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = useMemo(() => templates.find((template) => template.id === templateId) ?? null, [templateId, templates]);

  const batchConstituentIds = useMemo(() => {
    if (batchSource === "contacts") return Array.from(selectedContactIds);
    if (batchSource === "list") return matchedListIds;
    return parseIds(manualIds);
  }, [batchSource, manualIds, matchedListIds, selectedContactIds]);

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [templateRows, listRows] = await Promise.all([
        apiFetch<LetterTemplateSummary[]>("/api/letters/templates"),
        apiFetch<SavedAudienceList[]>("/api/email-campaigns/lists"),
      ]);
      setTemplates(templateRows);
      setAudienceLists(listRows);
      if (!templateId && templateRows[0]) setTemplateId(templateRows[0].id);
      if (!audienceListId && listRows[0]) setAudienceListId(listRows[0].id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load generation workspace.");
    } finally {
      setLoading(false);
    }
  }, [audienceListId, templateId]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const query = constituentSearch.trim();
    if (query.length < 2) {
      setConstituentOptions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      apiFetch<ConstituentLookup[]>(`/api/constituents?search=${encodeURIComponent(query)}&limit=12`)
        .then(setConstituentOptions)
        .catch(() => setConstituentOptions([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [constituentSearch]);

  useEffect(() => {
    const query = donationSearch.trim();
    if (query.length < 2 && !selectedConstituent?.id) {
      setDonationOptions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ limit: "12" });
      if (query.length >= 2) params.set("search", query);
      if (selectedConstituent?.id) params.set("constituentId", selectedConstituent.id);
      apiFetch<{ items: DonationLookup[] }>(`/api/donations?${params.toString()}`)
        .then((payload) => setDonationOptions(payload.items ?? []))
        .catch(() => setDonationOptions([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [donationSearch, selectedConstituent?.id]);

  useEffect(() => {
    const query = contactSearch.trim();
    if (query.length < 2) {
      setContactOptions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      apiFetch<ConstituentLookup[]>(`/api/constituents?search=${encodeURIComponent(query)}&limit=20`)
        .then(setContactOptions)
        .catch(() => setContactOptions([]));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [contactSearch]);

  useEffect(() => {
    if (!audienceListId || batchSource !== "list") return;

    let cancelled = false;
    async function matchListToConstituents() {
      try {
        const detail = await apiFetch<SavedAudienceDetail>(`/api/email-campaigns/lists/${audienceListId}`);
        const emails = detail.recipients.map((row) => row.email.trim()).filter(Boolean);
        const matched = new Set<string>();
        for (const email of emails.slice(0, 250)) {
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
  }, [audienceListId, batchSource]);

  async function runSinglePreview() {
    if (!templateId || !selectedConstituent?.id) {
      setError("Choose this template and one constituent before preview.");
      return;
    }
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const preview = await apiFetch<SinglePreview>("/api/letters/generated/preview", {
        method: "POST",
        body: JSON.stringify(singlePayload(templateId, selectedConstituent.id, selectedDonation?.id, year)),
      });
      setSinglePreview(preview);
      setNotice("Single letter preview is ready.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to preview single letter.");
    } finally {
      setWorking(false);
    }
  }

  async function generateSingle(downloadPdf: boolean) {
    if (!templateId || !selectedConstituent?.id) {
      setError("Choose this template and one constituent before generating.");
      return;
    }
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const generated = await apiFetch<GeneratedLetterSummary>("/api/letters/generated", {
        method: "POST",
        body: JSON.stringify(singlePayload(templateId, selectedConstituent.id, selectedDonation?.id, year)),
      });
      setSingleGenerated(generated);
      await routeGenerated([generated.id]);
      if (downloadPdf) await exportSinglePdf(generated.id);
      setNotice(downloadPdf ? "Single PDF generated." : "Single letter generated.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to generate single letter.");
    } finally {
      setWorking(false);
    }
  }

  async function runBatch(dryRun: boolean) {
    if (!templateId) {
      setError("Choose a template before running batch generation.");
      return;
    }

    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiFetch<BatchResult>("/api/letters/generated/batch", {
        method: "POST",
        body: JSON.stringify({
          templateId,
          filterType: batchSource === "segment" ? batchFilter : "ALL",
          constituentIds: batchConstituentIds,
          year: resolveYear(year),
          dryRun,
          addToPrintQueue: queueTarget === "print",
          dedupeHousehold,
        }),
      });
      if (dryRun) {
        setBatchPreview(result);
        setNotice("Batch dry-run complete.");
      } else {
        setBatchResult(result);
        if (queueTarget === "mail") await routeGenerated(getGeneratedIds(result));
        setNotice(`Generated ${result.generatedCount} letters.`);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Batch generation failed.");
    } finally {
      setWorking(false);
    }
  }

  async function routeGenerated(letterIds: string[]) {
    if (queueTarget === "none" || letterIds.length === 0) return;
    if (queueTarget === "mail") {
      await apiFetch("/api/letters/generated/queue/mail/actions", {
        method: "POST",
        body: JSON.stringify({ action: "QUEUE_FOR_MAIL", letterIds, note: "Queued from generation workspace" }),
      });
    }
  }

  async function exportSinglePdf(letterId: string) {
    const response = await apiFetchResponse(`/api/letters/generated/${letterId}/export-pdf`, { method: "POST" });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error?.message ?? "Failed to export PDF.");
    }
    await downloadBlobFromResponse(response, `generated-letter-${letterId}.pdf`);
  }

  async function exportLatestSinglePdf() {
    if (!singleGenerated?.id) {
      setError("Generate one letter before exporting a PDF.");
      return;
    }
    setPdfWorking(true);
    setError(null);
    try {
      await exportSinglePdf(singleGenerated.id);
      setNotice("Single PDF downloaded.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to export single PDF.");
    } finally {
      setPdfWorking(false);
    }
  }

  async function exportBatchPdf() {
    if (!batchResult) {
      setError("Generate a batch before exporting a batch PDF.");
      return;
    }
    const letterIds = getGeneratedIds(batchResult);
    if (letterIds.length === 0) {
      setError("No generated letter IDs are available for batch PDF export.");
      return;
    }
    setPdfWorking(true);
    setError(null);
    try {
      const response = await apiFetchResponse("/api/letters/generated/export-pdf-batch", {
        method: "POST",
        body: JSON.stringify({ letterIds }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? "Failed to export batch PDF.");
      }
      await downloadBlobFromResponse(response, `letters-batch-${Date.now()}.pdf`);
      setNotice(`Batch PDF downloaded (${letterIds.length} letters).`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to export batch PDF.");
    } finally {
      setPdfWorking(false);
    }
  }

  function chooseConstituent(row: ConstituentLookup) {
    setSelectedConstituent(row);
    setConstituentSearch(formatConstituentName(row));
    setConstituentOptions([]);
    setSelectedDonation(null);
    setDonationSearch("");
  }

  function chooseDonation(row: DonationLookup) {
    setSelectedDonation(row);
    setDonationSearch(formatDonationLabel(row));
    setDonationOptions([]);
  }

  function toggleContact(row: ConstituentLookup) {
    setSelectedContactIds((previous) => {
      const next = new Set(previous);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      return next;
    });
  }

  return (
    <div className="min-w-0 space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <Link href="/letters-printables" className="font-medium text-green-700 hover:underline">Project Manager</Link>
              <span>/</span>
              <span>Generate Letters</span>
            </div>
            <h1 className="mt-1 text-xl font-semibold text-gray-900">Generate Letters</h1>
            <p className="mt-1 text-sm text-gray-500">Generate one donor letter or run this template across a searched audience with dry-run checks and queue handoff.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedTemplate && <Link href={`/letters-printables/templates/${selectedTemplate.id}?panel=publish`} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Back to Template</Link>}
            <Link href="/contacts-manager" className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Contacts Manager</Link>
          </div>
        </div>
      </div>

      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>}
      {notice && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Template</h2>
            <select value={templateId} onChange={(event) => setTemplateId(event.target.value)} disabled={loading} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Choose template</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
            {selectedTemplate && <p className="text-xs text-gray-500">{selectedTemplate.category.replaceAll("_", " ")} · {selectedTemplate.status}</p>}
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Mode</h2>
            <div className="grid grid-cols-2 gap-2">
              <ModeButton active={mode === "single"} label="Single" onClick={() => setMode("single")} />
              <ModeButton active={mode === "batch"} label="Batch" onClick={() => setMode("batch")} />
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Route</h2>
            <select value={queueTarget} onChange={(event) => setQueueTarget(event.target.value as QueueTarget)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="none">Generate only</option>
              <option value="print">Add to print queue</option>
              <option value="mail">Add to mail queue</option>
            </select>
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Year</h2>
            <input value={year} onChange={(event) => setYear(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </section>
        </aside>

        <main className="min-w-0 space-y-4">
          {mode === "single" ? (
            <SingleLetterPanel
              constituentSearch={constituentSearch}
              donationSearch={donationSearch}
              constituentOptions={constituentOptions}
              donationOptions={donationOptions}
              selectedConstituent={selectedConstituent}
              selectedDonation={selectedDonation}
              preview={singlePreview}
              generated={singleGenerated}
              working={working}
              pdfWorking={pdfWorking}
              setConstituentSearch={setConstituentSearch}
              setDonationSearch={setDonationSearch}
              chooseConstituent={chooseConstituent}
              chooseDonation={chooseDonation}
              runPreview={() => void runSinglePreview()}
              generate={() => void generateSingle(false)}
              generatePdf={() => void generateSingle(true)}
              exportPdf={() => void exportLatestSinglePdf()}
            />
          ) : (
            <BatchLetterPanel
              batchSource={batchSource}
              batchFilter={batchFilter}
              manualIds={manualIds}
              contactSearch={contactSearch}
              contactOptions={contactOptions}
              selectedContactIds={selectedContactIds}
              audienceLists={audienceLists}
              audienceListId={audienceListId}
              matchedListIds={matchedListIds}
              dedupeHousehold={dedupeHousehold}
              preview={batchPreview}
              result={batchResult}
              working={working}
              pdfWorking={pdfWorking}
              setBatchSource={setBatchSource}
              setBatchFilter={setBatchFilter}
              setManualIds={setManualIds}
              setContactSearch={setContactSearch}
              toggleContact={toggleContact}
              setAudienceListId={setAudienceListId}
              setDedupeHousehold={setDedupeHousehold}
              runDryRun={() => void runBatch(true)}
              generateBatch={() => void runBatch(false)}
              exportBatchPdf={() => void exportBatchPdf()}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function SingleLetterPanel(props: {
  constituentSearch: string;
  donationSearch: string;
  constituentOptions: ConstituentLookup[];
  donationOptions: DonationLookup[];
  selectedConstituent: ConstituentLookup | null;
  selectedDonation: DonationLookup | null;
  preview: SinglePreview | null;
  generated: GeneratedLetterSummary | null;
  working: boolean;
  pdfWorking: boolean;
  setConstituentSearch: (value: string) => void;
  setDonationSearch: (value: string) => void;
  chooseConstituent: (row: ConstituentLookup) => void;
  chooseDonation: (row: DonationLookup) => void;
  runPreview: () => void;
  generate: () => void;
  generatePdf: () => void;
  exportPdf: () => void;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-900">Single Letter</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <LookupBox label="Constituent" value={props.constituentSearch} onChange={props.setConstituentSearch} placeholder="Search constituents by name, email, or phone">
            {props.constituentOptions.map((row) => <LookupButton key={row.id} label={formatConstituentName(row)} sublabel={row.email || row.phone || row.donorStatus || row.id} onClick={() => props.chooseConstituent(row)} />)}
          </LookupBox>
          <LookupBox label="Donation (optional)" value={props.donationSearch} onChange={props.setDonationSearch} placeholder="Search gifts after selecting constituent">
            {props.donationOptions.map((row) => <LookupButton key={row.id} label={formatDonationLabel(row)} sublabel={row.campaign?.name || row.designation?.name || row.status} onClick={() => props.chooseDonation(row)} />)}
          </LookupBox>
        </div>
        <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
          Selected: {props.selectedConstituent ? formatConstituentName(props.selectedConstituent) : "No constituent"}{props.selectedDonation ? ` · ${formatDonationLabel(props.selectedDonation)}` : ""}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <ActionButton label={props.working ? "Working..." : "Preview"} onClick={props.runPreview} disabled={props.working} />
          <ActionButton label="Generate" onClick={props.generate} disabled={props.working} primary />
          <ActionButton label="Generate PDF" onClick={props.generatePdf} disabled={props.working} />
          <ActionButton label={props.pdfWorking ? "Exporting..." : "Export Latest PDF"} onClick={props.exportPdf} disabled={props.pdfWorking || !props.generated} />
        </div>
      </section>

      {props.preview && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900">Print Preview</h3>
          <div className="mt-3 rounded border border-gray-200 bg-white p-4 text-sm text-gray-800 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:p-2" dangerouslySetInnerHTML={{ __html: props.preview.mergedPrintBody }} />
          {props.preview.unsupportedFields.length > 0 && <p className="mt-3 text-xs text-amber-700">Unsupported fields: {props.preview.unsupportedFields.join(", ")}</p>}
        </section>
      )}
    </div>
  );
}

function BatchLetterPanel(props: {
  batchSource: BatchSource;
  batchFilter: BatchFilter;
  manualIds: string;
  contactSearch: string;
  contactOptions: ConstituentLookup[];
  selectedContactIds: Set<string>;
  audienceLists: SavedAudienceList[];
  audienceListId: string;
  matchedListIds: string[];
  dedupeHousehold: boolean;
  preview: BatchResult | null;
  result: BatchResult | null;
  working: boolean;
  pdfWorking: boolean;
  setBatchSource: (value: BatchSource) => void;
  setBatchFilter: (value: BatchFilter) => void;
  setManualIds: (value: string) => void;
  setContactSearch: (value: string) => void;
  toggleContact: (row: ConstituentLookup) => void;
  setAudienceListId: (value: string) => void;
  setDedupeHousehold: (value: boolean) => void;
  runDryRun: () => void;
  generateBatch: () => void;
  exportBatchPdf: () => void;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Batch Generate Letters</h2>
            <p className="mt-1 text-xs text-gray-500">Choose a segment, searched contacts, or a Contacts Manager audience list.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" checked={props.dedupeHousehold} onChange={(event) => props.setDedupeHousehold(event.target.checked)} />
            Dedupe households
          </label>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <ModeButton active={props.batchSource === "segment"} label="Segment Search" onClick={() => props.setBatchSource("segment")} />
          <ModeButton active={props.batchSource === "contacts"} label="Contact Search" onClick={() => props.setBatchSource("contacts")} />
          <ModeButton active={props.batchSource === "list"} label="Saved Audience" onClick={() => props.setBatchSource("list")} />
        </div>

        <div className="mt-4">
          {props.batchSource === "segment" && (
            <div className="grid gap-3 lg:grid-cols-2">
              <label className="block text-xs font-semibold text-gray-600">
                Segment
                <select value={props.batchFilter} onChange={(event) => props.setBatchFilter(event.target.value as BatchFilter)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  {BATCH_FILTERS.map((filter) => <option key={filter} value={filter}>{filter.replaceAll("_", " ")}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-gray-600">
                Optional specific constituent IDs
                <textarea value={props.manualIds} onChange={(event) => props.setManualIds(event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs" />
              </label>
            </div>
          )}

          {props.batchSource === "contacts" && (
            <div className="space-y-3">
              <input value={props.contactSearch} onChange={(event) => props.setContactSearch(event.target.value)} placeholder="Search contacts to add to this batch" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              <div className="max-h-56 overflow-auto rounded-lg border border-gray-200">
                {props.contactOptions.length === 0 ? <p className="p-3 text-sm text-gray-500">Search contacts to select recipients.</p> : props.contactOptions.map((row) => (
                  <button key={row.id} type="button" onClick={() => props.toggleContact(row)} className={`block w-full border-b border-gray-100 px-3 py-2 text-left text-sm hover:bg-gray-50 ${props.selectedContactIds.has(row.id) ? "bg-green-50" : "bg-white"}`}>
                    <span className="font-semibold text-gray-900">{formatConstituentName(row)}</span>
                    <span className="ml-2 text-xs text-gray-500">{row.email || row.phone || row.donorStatus || row.id}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500">{props.selectedContactIds.size} contacts selected.</p>
            </div>
          )}

          {props.batchSource === "list" && (
            <div className="space-y-3">
              <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-gray-700">
                Build and tag reusable letter audiences in Contacts Manager, then choose the saved audience here.
                <Link href="/contacts-manager" className="ml-2 font-semibold text-green-700 hover:text-green-800">Open Contacts Manager</Link>
              </div>
              <select value={props.audienceListId} onChange={(event) => props.setAudienceListId(event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">Choose saved audience</option>
                {props.audienceLists.map((list) => <option key={list.id} value={list.id}>{list.name} ({list.recipientsCount})</option>)}
              </select>
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                Matched saved-list emails to {props.matchedListIds.length} constituent records. Non-constituent emails remain available for email sends in Communications, but printed letters require constituent records.
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <ActionButton label={props.working ? "Working..." : "Dry Run"} onClick={props.runDryRun} disabled={props.working} />
          <ActionButton label="Generate Batch" onClick={props.generateBatch} disabled={props.working} primary />
          <ActionButton label={props.pdfWorking ? "Exporting..." : "Export Batch PDF"} onClick={props.exportBatchPdf} disabled={props.pdfWorking || !props.result} />
        </div>
      </section>

      {(props.preview || props.result) && <BatchResultPanel title={props.result ? "Generated Batch Result" : "Batch Dry-Run"} result={props.result ?? props.preview} />}
    </div>
  );
}

function BatchResultPanel({ title, result }: { title: string; result: BatchResult | null }) {
  if (!result) return null;
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Selected" value={result.totalSelected} />
        <Metric label="Eligible" value={result.eligible} />
        <Metric label="Generated" value={result.generatedCount} />
        <Metric label="Skipped" value={result.skippedCount} />
        <Metric label="Mode" value={result.dryRun ? "Dry Run" : "Saved"} />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 p-3 text-xs text-gray-700">
          <p className="font-semibold uppercase tracking-wide text-gray-500">Skipped Reasons</p>
          <div className="mt-2 space-y-1">
            {Object.keys(result.skippedByReason).length === 0 ? <p>No skipped records.</p> : Object.entries(result.skippedByReason).map(([reason, count]) => <p key={reason}>{reason.replaceAll("_", " ")}: {count}</p>)}
          </div>
        </div>
        <div className="max-h-48 overflow-auto rounded-lg border border-gray-200 p-3 text-xs text-gray-700">
          <p className="font-semibold uppercase tracking-wide text-gray-500">Generated Sample</p>
          {result.generated.length === 0 ? <p className="mt-2">No generated rows in this run.</p> : result.generated.slice(0, 30).map((entry) => <p key={`${entry.id}-${entry.constituentId}`} className="mt-1">{entry.constituentName || entry.constituentId}</p>)}
        </div>
      </div>
    </section>
  );
}

function LookupBox({ label, value, onChange, placeholder, children }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; children: ReactNode }) {
  return (
    <label className="relative block text-xs font-semibold text-gray-600">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-sm">{children}</div>
    </label>
  );
}

function LookupButton({ label, sublabel, onClick }: { label: string; sublabel?: string | null; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="block w-full border-b border-gray-100 px-3 py-2 text-left text-xs hover:bg-gray-50"><span className="font-semibold text-gray-900">{label}</span><span className="block truncate text-gray-500">{sublabel}</span></button>;
}

function ActionButton({ label, onClick, disabled = false, primary = false }: { label: string; onClick: () => void; disabled?: boolean; primary?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60 ${primary ? "bg-green-600 text-white hover:bg-green-700" : "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}>{label}</button>;
}

function ModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${active ? "border-green-600 bg-green-50 text-green-700" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}>{label}</button>;
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-lg border border-gray-200 p-3"><p className="text-xs text-gray-500">{label}</p><p className="text-lg font-semibold text-gray-900">{value}</p></div>;
}

function singlePayload(templateId: string, constituentId: string, donationId: string | undefined, year: string) {
  return {
    templateId,
    constituentId,
    donationId: donationId || undefined,
    year: resolveYear(year),
  };
}

function parseIds(raw: string): string[] {
  return raw.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean);
}

function resolveYear(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
}

function getGeneratedIds(result: BatchResult): string[] {
  return (result.generatedIds ?? result.generated.map((entry) => entry.id)).filter((id) => Boolean(id && id !== "dry-run"));
}

function formatConstituentName(row: ConstituentLookup): string {
  return [row.firstName, row.lastName].filter(Boolean).join(" ").trim() || row.email || row.id;
}

function formatDonationLabel(row: DonationLookup): string {
  const amount = Number(row.amount);
  const formatted = Number.isFinite(amount) ? amount.toLocaleString(undefined, { style: "currency", currency: "USD" }) : String(row.amount);
  const date = row.date ? new Date(row.date).toLocaleDateString() : "Undated";
  const donorName = row.constituent ? [row.constituent.firstName, row.constituent.lastName].filter(Boolean).join(" ") : "";
  return `${formatted} - ${date}${donorName ? ` - ${donorName}` : ""}`;
}
