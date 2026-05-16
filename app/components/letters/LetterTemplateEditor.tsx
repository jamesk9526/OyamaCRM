/** Document-studio editor for one printable project, including canvas editing, presets, merge preview, and publishing. */
"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import FormLetterRichEditor from "@/app/components/letters/FormLetterRichEditor";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import { bodyToPrintLayout, parsePrintLayout } from "@/app/components/letters/print-layout-utils";
import {
  DEFAULT_BRANDING_SETTINGS,
  fetchBrandingSettings,
  formatBrandingAddress,
  type BrandingSettings,
} from "@/app/lib/branding-settings";
import type { FooterPreset, HeaderPreset, MergeFieldSection, PrintLayoutDocument, SignatureBlock } from "@/app/components/letters/types";

type StudioPanel = "document" | "preview" | "publish";
type PresetModalKind = "header" | "footer" | null;

interface LetterTemplateForm {
  name: string;
  description: string;
  category: string;
  status: string;
  printSubject: string;
  printBody: string;
  emailSubject: string;
  emailBody: string;
  headerPresetId: string;
  footerPresetId: string;
  signatureBlockId: string;
  logoMode: string;
  customLogoUrl: string;
  crmScope: string;
}

interface TemplatePayload extends LetterTemplateForm {
  id: string;
  printLayoutJson?: unknown;
}

interface ConstituentLookup {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  donorStatus?: string | null;
  totalLifetimeGiving?: number | string | null;
}

interface DonationLookup {
  id: string;
  amount: number | string;
  date: string;
  status: string;
  constituentId?: string;
  constituent?: {
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
  } | null;
  campaign?: { name?: string | null } | null;
  designation?: { name?: string | null } | null;
}

const INITIAL_FORM: LetterTemplateForm = {
  name: "",
  description: "",
  category: "GENERAL",
  status: "DRAFT",
  printSubject: "",
  printBody: "",
  emailSubject: "",
  emailBody: "",
  headerPresetId: "",
  footerPresetId: "",
  signatureBlockId: "",
  logoMode: "ORGANIZATION_DEFAULT",
  customLogoUrl: "",
  crmScope: "DONOR",
};

const CATEGORY_OPTIONS = [
  "THANK_YOU",
  "TAX_RECEIPT",
  "END_OF_YEAR",
  "NEWSLETTER",
  "CAMPAIGN",
  "SPONSOR",
  "EVENT",
  "MONTHLY_DONOR",
  "MAJOR_DONOR",
  "GENERAL",
];

const DEFAULT_STARTER_BODY = `<p>{{donor.firstName}},</p><p>Thank you for supporting {{organization.name}}. Your generosity makes practical care possible for the people we serve.</p><p>Gift details:</p><table><tbody><tr><th>Gift Date</th><th>Amount</th><th>Designation</th></tr><tr><td>{{gift.date}}</td><td>{{gift.amount}}</td><td>{{gift.designation}}</td></tr></tbody></table><p>Sincerely,</p><p>{{organization.signerName}}<br />{{organization.signerTitle}}</p>`;

interface LetterTemplateEditorProps {
  templateId?: string;
  fullScreen?: boolean;
  initialPanel?: StudioPanel;
}

/** Renders the printable document studio used by both new and existing printable projects. */
export default function LetterTemplateEditor({ templateId, fullScreen = false, initialPanel = "document" }: LetterTemplateEditorProps) {
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<StudioPanel>(initialPanel);
  const [form, setForm] = useState<LetterTemplateForm>(INITIAL_FORM);
  const [loading, setLoading] = useState(Boolean(templateId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(templateId ?? null);
  const [isDirty, setIsDirty] = useState(false);
  const [mergeSections, setMergeSections] = useState<MergeFieldSection[]>([]);
  const [headerPresets, setHeaderPresets] = useState<HeaderPreset[]>([]);
  const [footerPresets, setFooterPresets] = useState<FooterPreset[]>([]);
  const [signatures, setSignatures] = useState<SignatureBlock[]>([]);
  const [previewConstituentId, setPreviewConstituentId] = useState("");
  const [previewDonationId, setPreviewDonationId] = useState("");
  const [previewYear, setPreviewYear] = useState(String(new Date().getFullYear()));
  const [constituentQuery, setConstituentQuery] = useState("");
  const [donationQuery, setDonationQuery] = useState("");
  const [constituentResults, setConstituentResults] = useState<ConstituentLookup[]>([]);
  const [donationResults, setDonationResults] = useState<DonationLookup[]>([]);
  const [selectedConstituent, setSelectedConstituent] = useState<ConstituentLookup | null>(null);
  const [selectedDonation, setSelectedDonation] = useState<DonationLookup | null>(null);
  const [previewResult, setPreviewResult] = useState<{
    mergedPrintBody: string;
    mergedEmailBody: string | null;
    unsupportedFields: string[];
  } | null>(null);
  const [printInsertHandler, setPrintInsertHandler] = useState<((token: string) => void) | null>(null);
  const [printLayout, setPrintLayout] = useState<PrintLayoutDocument>([]);
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING_SETTINGS);
  const [presetModal, setPresetModal] = useState<PresetModalKind>(null);
  const [presetName, setPresetName] = useState("");
  const [presetSaving, setPresetSaving] = useState(false);

  const isEdit = Boolean(templateId);
  const selectedHeader = useMemo(() => headerPresets.find((item) => item.id === form.headerPresetId), [form.headerPresetId, headerPresets]);
  const selectedFooter = useMemo(() => footerPresets.find((item) => item.id === form.footerPresetId), [form.footerPresetId, footerPresets]);
  const selectedSignature = useMemo(() => signatures.find((item) => item.id === form.signatureBlockId), [form.signatureBlockId, signatures]);
  const mergeFields = useMemo(() => mergeSections.flatMap((section) => section.fields), [mergeSections]);

  const loadSupports = useCallback(async () => {
    const [fields, headers, footers, signatureRows] = await Promise.all([
      apiFetch<{ sections: MergeFieldSection[] }>("/api/letters/merge-fields"),
      apiFetch<HeaderPreset[]>("/api/letters/header-presets"),
      apiFetch<FooterPreset[]>("/api/letters/footer-presets"),
      apiFetch<SignatureBlock[]>("/api/letters/signatures"),
    ]);

    setMergeSections(fields.sections ?? []);
    setHeaderPresets(headers ?? []);
    setFooterPresets(footers ?? []);
    setSignatures(signatureRows ?? []);
  }, []);

  const loadTemplate = useCallback(async () => {
    if (!templateId) {
      setPrintLayout(bodyToPrintLayout(DEFAULT_STARTER_BODY));
      setForm((prev) => ({ ...prev, printBody: DEFAULT_STARTER_BODY, printSubject: "Printable Letter" }));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<TemplatePayload>(`/api/letters/templates/${templateId}`);
      const nextForm = {
        name: data.name ?? "",
        description: data.description ?? "",
        category: data.category ?? "GENERAL",
        status: data.status ?? "DRAFT",
        printSubject: data.printSubject ?? "",
        printBody: data.printBody ?? "",
        emailSubject: data.emailSubject ?? "",
        emailBody: data.emailBody ?? "",
        headerPresetId: data.headerPresetId ?? "",
        footerPresetId: data.footerPresetId ?? "",
        signatureBlockId: data.signatureBlockId ?? "",
        logoMode: data.logoMode ?? "ORGANIZATION_DEFAULT",
        customLogoUrl: data.customLogoUrl ?? "",
        crmScope: data.crmScope ?? "DONOR",
      };
      setForm(nextForm);
      const parsedLayout = parsePrintLayout(data.printLayoutJson);
      setPrintLayout(parsedLayout.length > 0 ? parsedLayout : bodyToPrintLayout(nextForm.printBody));
      setSavedId(data.id);
      setIsDirty(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load printable project.");
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    void loadSupports();
  }, [loadSupports]);

  useEffect(() => {
    fetchBrandingSettings()
      .then((settings) => setBranding(settings))
      .catch(() => setBranding(DEFAULT_BRANDING_SETTINGS));
  }, []);

  useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

  useEffect(() => {
    const query = constituentQuery.trim();
    if (query.length < 2) {
      setConstituentResults([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({ search: query, limit: "8" });
      apiFetch<ConstituentLookup[]>(`/api/constituents?${params.toString()}`)
        .then(setConstituentResults)
        .catch(() => setConstituentResults([]));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [constituentQuery]);

  useEffect(() => {
    const query = donationQuery.trim();
    if (query.length < 2 && !previewConstituentId) {
      setDonationResults([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams({ limit: "8" });
      if (query.length >= 2) params.set("search", query);
      if (previewConstituentId) params.set("constituentId", previewConstituentId);
      apiFetch<{ items: DonationLookup[] }>(`/api/donations?${params.toString()}`)
        .then((payload) => setDonationResults(payload.items ?? []))
        .catch(() => setDonationResults([]));
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [donationQuery, previewConstituentId]);

  /** Applies one form field change and marks the printable project as needing a save. */
  function update<K extends keyof LetterTemplateForm>(key: K, value: LetterTemplateForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
    setNotice(null);
  }

  /** Keeps legacy print body and visual layout metadata synchronized from the rich editor canvas. */
  function updatePrintBody(nextBody: string) {
    update("printBody", nextBody);
    setPrintLayout(bodyToPrintLayout(nextBody));
  }

  /** Registers the print merge-token insertion callback without creating a new function each render. */
  const handleRegisterPrintInsert = useCallback((handler: (token: string) => void) => {
    setPrintInsertHandler(() => handler);
  }, []);

  /** Inserts one merge field into the active document canvas. */
  function insertField(token: string) {
    if (printInsertHandler) {
      printInsertHandler(token);
      return;
    }
    updatePrintBody(`${form.printBody}${form.printBody ? " " : ""}${token}`);
  }

  /** Saves template changes by POST (create) or PATCH (update), returning the current project ID. */
  async function saveTemplate(options?: { silent?: boolean }): Promise<string | null> {
    setSaving(true);
    setError(null);
    if (!options?.silent) setNotice(null);

    try {
      const payload = {
        ...form,
        printLayoutJson: printLayout.length > 0 ? printLayout : bodyToPrintLayout(form.printBody),
        description: form.description || null,
        printSubject: form.printSubject || null,
        emailSubject: null,
        emailBody: null,
        headerPresetId: form.headerPresetId || null,
        footerPresetId: form.footerPresetId || null,
        signatureBlockId: form.signatureBlockId || null,
        logoMode: "ORGANIZATION_DEFAULT",
        customLogoUrl: null,
      };

      if (savedId || templateId) {
        const updated = await apiFetch<TemplatePayload>(`/api/letters/templates/${savedId ?? templateId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setSavedId(updated.id);
        setIsDirty(false);
        if (!options?.silent) setNotice("Printable saved.");
        return updated.id;
      }

      const created = await apiFetch<TemplatePayload>("/api/letters/templates", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSavedId(created.id);
      setIsDirty(false);
      if (!options?.silent) setNotice("Printable created.");
      router.replace(`/letters-printables/templates/${created.id}`);
      return created.id;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save printable.");
      return null;
    } finally {
      setSaving(false);
    }
  }

  /** Runs one saved merge preview for the selected constituent and optional donation context. */
  async function runPreview() {
    const currentId = await saveTemplate({ silent: true });
    if (!currentId) return;

    setError(null);
    setActivePanel("preview");
    try {
      const result = await apiFetch<{
        mergedPrintBody: string;
        mergedEmailBody: string | null;
        unsupportedFields: string[];
      }>("/api/letters/generated/preview", {
        method: "POST",
        body: JSON.stringify({
          templateId: currentId,
          constituentId: previewConstituentId || undefined,
          donationId: previewDonationId || undefined,
          year: Number.parseInt(previewYear, 10),
        }),
      });
      setPreviewResult(result);
      setNotice("Merged preview updated.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to run preview.");
    }
  }

  /** Saves first, then keeps the user in the modern publish workspace tab. */
  async function openPublishWorkspace() {
    const currentId = await saveTemplate({ silent: true });
    if (!currentId) return;
    setActivePanel("publish");
    setNotice("Publish workspace is ready. Choose Generate PDF, Print Queue, or Mail Queue.");
  }

  /** Saves first, then opens the unified generation workspace with this template and target selected. */
  async function openGenerateWorkspace(nextMode: "single" | "batch", target: "none" | "print" | "mail" = "none") {
    const currentId = await saveTemplate({ silent: true });
    if (!currentId) return;
    const params = new URLSearchParams({ templateId: currentId, mode: nextMode });
    if (target !== "none") params.set("target", target);
    router.push(`/letters-printables/generate?${params.toString()}`);
  }

  /** Creates a reusable header or footer preset from the studio without duplicating organization branding settings. */
  async function createPreset() {
    const name = presetName.trim();
    if (!presetModal || !name) return;

    setPresetSaving(true);
    setError(null);
    try {
      if (presetModal === "header") {
        const created = await apiFetch<HeaderPreset>("/api/letters/header-presets", {
          method: "POST",
          body: JSON.stringify({
            name,
            logoAlignment: "LEFT",
            showOrganizationName: true,
            showTagline: true,
            showAddress: true,
            showPhone: true,
            showWebsite: true,
          }),
        });
        await loadSupports();
        update("headerPresetId", created.id);
      } else {
        const created = await apiFetch<FooterPreset>("/api/letters/footer-presets", {
          method: "POST",
          body: JSON.stringify({
            name,
            showOrganizationName: true,
            showAddress: true,
            showPhone: true,
            showEmail: true,
            showWebsite: true,
            showTaxId: true,
            showPageNumber: true,
          }),
        });
        await loadSupports();
        update("footerPresetId", created.id);
      }
      setPresetName("");
      setPresetModal(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to create preset.");
    } finally {
      setPresetSaving(false);
    }
  }

  function chooseConstituent(row: ConstituentLookup) {
    setSelectedConstituent(row);
    setPreviewConstituentId(row.id);
    setConstituentQuery(formatConstituentName(row));
    setConstituentResults([]);
    setSelectedDonation(null);
    setPreviewDonationId("");
    setDonationQuery("");
  }

  function chooseDonation(row: DonationLookup) {
    setSelectedDonation(row);
    setPreviewDonationId(row.id);
    setDonationQuery(formatDonationLabel(row));
    setDonationResults([]);
  }

  /** Sends one local image to the letters media endpoint and returns its public URL for editor insertion. */
  async function uploadEditorImage(file: File): Promise<string> {
    const dataBase64 = await readFileAsDataUrl(file);
    const uploaded = await apiFetch<{ url: string }>("/api/letters/media", {
      method: "POST",
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || "image/png",
        dataBase64,
        purpose: "editor",
      }),
    });
    return uploaded.url;
  }

  if (loading) {
    return <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">Loading printable studio...</div>;
  }

  return (
    <div className={fullScreen ? "fixed inset-0 z-[90] min-w-0 overflow-auto bg-gray-50 p-3" : "min-w-0 space-y-3"}>
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <Link href="/letters-printables" className="font-medium text-green-700 hover:underline">Project Manager</Link>
              <span>/</span>
              <span>{isEdit ? "Edit Printable" : "New Printable"}</span>
              {isDirty && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">Unsaved changes</span>}
            </div>
            <input
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Untitled printable"
              className="mt-1 w-full min-w-0 border-0 p-0 text-xl font-semibold text-gray-900 outline-none placeholder:text-gray-400"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!fullScreen && (
              <Link
                href={`${savedId || templateId ? `/letters-printables/templates/${savedId ?? templateId}` : "/letters-printables/templates/new"}?fullscreen=1`}
                target="_blank"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Open Full Screen
              </Link>
            )}
            {fullScreen && (
              <Link href={savedId || templateId ? `/letters-printables/templates/${savedId ?? templateId}` : "/letters-printables/templates/new"} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Exit Full Screen
              </Link>
            )}
            <button type="button" onClick={() => void runPreview()} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Print Preview
            </button>
            <button type="button" onClick={() => void saveTemplate()} disabled={saving} className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:opacity-60">
              {saving ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => void openPublishWorkspace()} className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">
              Publish
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 px-4 py-2">
          <RibbonButton active={activePanel === "document"} label="Document" onClick={() => setActivePanel("document")} />
          <RibbonButton active={activePanel === "preview"} label="Preview" onClick={() => setActivePanel("preview")} />
          <RibbonButton active={activePanel === "publish"} label="Publish" onClick={() => setActivePanel("publish")} />
          <span className="mx-1 h-8 border-l border-gray-200" />
          <RibbonButton label="Header Tool" onClick={() => setPresetModal("header")} />
          <RibbonButton label="Footer Tool" onClick={() => setPresetModal("footer")} />
          <Link href="/settings/branding" className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">
            Branding Settings
          </Link>
        </div>
      </div>

      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>}
      {notice && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}

      <div className="grid min-w-0 gap-3 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
        <aside className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 xl:sticky xl:top-3 xl:max-h-[calc(100vh-120px)] xl:overflow-auto">
          <PanelSection title="Project">
            <label className="block text-xs font-semibold text-gray-600">
              Subject
              <input value={form.printSubject} onChange={(event) => update("printSubject", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-semibold text-gray-600">
                Category
                <select value={form.category} onChange={(event) => update("category", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs">
                  {CATEGORY_OPTIONS.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold text-gray-600">
                Status
                <select value={form.status} onChange={(event) => update("status", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2 text-xs">
                  {["DRAFT", "ACTIVE", "ARCHIVED"].map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-xs font-semibold text-gray-600">
              Notes
              <textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </label>
          </PanelSection>

          <PanelSection title="Letterhead">
            <select value={form.headerPresetId} onChange={(event) => update("headerPresetId", event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs">
              <option value="">Header: organization default</option>
              {headerPresets.map((item) => <option key={item.id} value={item.id}>Header: {item.name}</option>)}
            </select>
            <select value={form.footerPresetId} onChange={(event) => update("footerPresetId", event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs">
              <option value="">Footer: organization default</option>
              {footerPresets.map((item) => <option key={item.id} value={item.id}>Footer: {item.name}</option>)}
            </select>
            <select value={form.signatureBlockId} onChange={(event) => update("signatureBlockId", event.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs">
              <option value="">Signature: none</option>
              {signatures.map((item) => <option key={item.id} value={item.id}>Signature: {item.name}</option>)}
            </select>
          </PanelSection>

          <PanelSection title="Merge Fields">
            <p className="text-[11px] text-gray-500">Type <span className="font-mono text-green-700">{"{{"}</span> in the canvas for inline suggestions, or click a token below.</p>
            <div className="max-h-72 space-y-2 overflow-auto pr-1">
              {mergeSections.map((section) => (
                <details key={section.key} className="rounded-lg border border-gray-200 p-2" open={section.key === "donor"}>
                  <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-gray-600">{section.label}</summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {section.fields.map((field) => (
                      <button key={field} type="button" onClick={() => insertField(field)} className="rounded border border-gray-300 px-2 py-1 font-mono text-[10px] text-gray-700 hover:bg-gray-50">
                        {field}
                      </button>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </PanelSection>
        </aside>

        <main className="min-w-0 rounded-xl border border-gray-200 bg-gray-100 p-3">
          {activePanel === "document" && (
            <div className="mx-auto w-full max-w-[940px]">
              <div className="mb-3 rounded-lg border border-green-100 bg-white px-3 py-2 text-xs text-gray-600">
                Branding is locked to Organization Settings and Branding Settings. This project can choose header/footer presets, but logos, organization name, address, and colors come from the CRM branding source of truth.
              </div>
              <PrintablePageShell branding={branding} header={selectedHeader} footer={selectedFooter} signature={selectedSignature}>
                <FormLetterRichEditor
                  value={form.printBody}
                  placeholder="Start writing, or type {{ to insert merge fields..."
                  minHeight={560}
                  htmlLabel="Raw HTML"
                  mergeFields={mergeFields}
                  studioMode
                  onChange={updatePrintBody}
                  onRegisterInsert={handleRegisterPrintInsert}
                  onUploadImage={uploadEditorImage}
                />
              </PrintablePageShell>
            </div>
          )}

          {activePanel === "preview" && (
            <div className="mx-auto w-full max-w-[940px] space-y-3">
              <PreviewContextPanel
                constituentQuery={constituentQuery}
                donationQuery={donationQuery}
                previewYear={previewYear}
                constituentResults={constituentResults}
                donationResults={donationResults}
                selectedConstituent={selectedConstituent}
                selectedDonation={selectedDonation}
                setConstituentQuery={setConstituentQuery}
                setDonationQuery={setDonationQuery}
                setPreviewYear={setPreviewYear}
                chooseConstituent={chooseConstituent}
                chooseDonation={chooseDonation}
                runPreview={() => void runPreview()}
              />
              <PrintablePageShell branding={branding} header={selectedHeader} footer={selectedFooter} signature={selectedSignature}>
                <div
                  className="min-h-[560px] text-sm leading-6 text-gray-900 [&_hr[data-page-break='true']]:my-8 [&_hr[data-page-break='true']]:border-t-2 [&_hr[data-page-break='true']]:border-dashed [&_hr[data-page-break='true']]:border-gray-400 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:p-2"
                  dangerouslySetInnerHTML={{ __html: previewResult?.mergedPrintBody || form.printBody || "<p class='text-gray-400'>Run preview to see merged output.</p>" }}
                />
                {previewResult?.unsupportedFields && previewResult.unsupportedFields.length > 0 && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Unsupported fields: {previewResult.unsupportedFields.join(", ")}
                  </div>
                )}
              </PrintablePageShell>
            </div>
          )}

          {activePanel === "publish" && (
            <div className="mx-auto w-full max-w-[940px] space-y-3">
              <section className="rounded-xl border border-gray-200 bg-white p-4">
                <h2 className="text-sm font-semibold text-gray-900">Publish This Printable</h2>
                <p className="mt-1 text-xs text-gray-600">
                  Choose single-letter generation for one constituent, or batch generation for a segment, contact search, or Contacts Manager audience list.
                </p>
              </section>
              <div className="grid gap-3 md:grid-cols-2">
                <PublishCard
                  title="Generate Single Letter"
                  description="Search one constituent, preview the merge, generate the letter, and export a PDF from the same workspace."
                  action="Open Single Generator"
                  onClick={() => void openGenerateWorkspace("single")}
                />
                <PublishCard
                  title="Batch Generate Letters"
                  description="Use segments, contact search, or saved audience lists, run a dry-run, then generate batch PDFs or queue output."
                  action="Open Batch Generator"
                  onClick={() => void openGenerateWorkspace("batch")}
                />
                <PublishCard
                  title="Generate For Print Queue"
                  description="Open batch generation with print queue handoff selected for this template."
                  action="Open Print Workflow"
                  onClick={() => void openGenerateWorkspace("batch", "print")}
                />
                <PublishCard
                  title="Generate For Mail Queue"
                  description="Open batch generation with mail queue handoff selected for this template."
                  action="Open Mail Workflow"
                  onClick={() => void openGenerateWorkspace("batch", "mail")}
                />
              </div>
            </div>
          )}
        </main>

        <aside className="space-y-3 rounded-xl border border-gray-200 bg-white p-3 xl:sticky xl:top-3 xl:max-h-[calc(100vh-120px)] xl:overflow-auto">
          <PanelSection title="Preview Context">
            <SearchBox label="Constituent" value={constituentQuery} onChange={setConstituentQuery} placeholder="Search name, email, or phone" />
            {constituentResults.length > 0 && (
              <ResultList>
                {constituentResults.map((row) => (
                  <button key={row.id} type="button" onClick={() => chooseConstituent(row)} className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-gray-50">
                    <span className="font-semibold text-gray-900">{formatConstituentName(row)}</span>
                    <span className="block truncate text-gray-500">{row.email || row.phone || row.donorStatus || row.id}</span>
                  </button>
                ))}
              </ResultList>
            )}
            <SearchBox label="Donation" value={donationQuery} onChange={setDonationQuery} placeholder="Search gift, donor, campaign" />
            {donationResults.length > 0 && (
              <ResultList>
                {donationResults.map((row) => (
                  <button key={row.id} type="button" onClick={() => chooseDonation(row)} className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-gray-50">
                    <span className="font-semibold text-gray-900">{formatDonationLabel(row)}</span>
                    <span className="block truncate text-gray-500">{row.campaign?.name || row.designation?.name || row.status}</span>
                  </button>
                ))}
              </ResultList>
            )}
            <label className="block text-xs font-semibold text-gray-600">
              Year
              <input value={previewYear} onChange={(event) => setPreviewYear(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </label>
            <button type="button" onClick={() => void runPreview()} className="w-full rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700">
              Run Merged Preview
            </button>
          </PanelSection>

          <PanelSection title="Brand Source">
            <p className="text-sm font-semibold text-gray-900">{branding.organizationDisplayName || branding.legalOrganizationName || "Organization"}</p>
            <p className="text-xs text-gray-500">{formatBrandingAddress(branding) || "No organization address configured."}</p>
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <span className="h-4 w-4 rounded-full border border-gray-200" style={{ backgroundColor: branding.primaryColor }} />
              {branding.primaryColor}
            </div>
          </PanelSection>

          <PanelSection title="Selected Presets">
            <PresetSummary label="Header" value={selectedHeader?.name || "Organization default"} />
            <PresetSummary label="Footer" value={selectedFooter?.name || "Organization default"} />
            <PresetSummary label="Signature" value={selectedSignature?.name || "None"} />
          </PanelSection>
        </aside>
      </div>

      {presetModal && (
        <WorkspaceSetupModal
          title={presetModal === "header" ? "Create Header Preset" : "Create Footer Preset"}
          subtitle="Presets control document structure. Organization identity, logo, address, and colors still come from Branding Settings."
          onClose={() => {
            setPresetModal(null);
            setPresetName("");
          }}
          maxWidthClassName="max-w-lg"
        >
          <div className="space-y-4 px-6 pb-6 pt-14">
            <label className="block text-sm font-medium text-gray-700">
              Preset Name
              <input value={presetName} onChange={(event) => setPresetName(event.target.value)} autoFocus className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder={presetModal === "header" ? "Standard Letterhead" : "Tax Receipt Footer"} />
            </label>
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
              New presets include organization name, address, phone, website, and other safe defaults. More detailed preset editing remains in Branding Settings.
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPresetModal(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={() => void createPreset()} disabled={presetSaving || !presetName.trim()} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                {presetSaving ? "Creating..." : "Create Preset"}
              </button>
            </div>
          </div>
        </WorkspaceSetupModal>
      )}
    </div>
  );
}

function RibbonButton({ active = false, label, onClick }: { active?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${active ? "border-green-600 bg-green-50 text-green-700" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"}`}
    >
      {label}
    </button>
  );
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 rounded-lg border border-gray-200 p-3">
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</h2>
      {children}
    </section>
  );
}

function SearchBox({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="block text-xs font-semibold text-gray-600">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
    </label>
  );
}

function ResultList({ children }: { children: ReactNode }) {
  return <div className="max-h-44 overflow-auto rounded-lg border border-gray-200 bg-white p-1">{children}</div>;
}

function PresetSummary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="truncate font-semibold text-gray-800">{value}</span>
    </div>
  );
}

function PublishCard({ title, description, action, onClick, disabled = false }: { title: string; description: string; action: string; onClick: () => void; disabled?: boolean }) {
  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      <p className="mt-2 min-h-16 text-xs leading-5 text-gray-600">{description}</p>
      <button type="button" onClick={onClick} disabled={disabled} className="mt-4 w-full rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60">
        {action}
      </button>
    </article>
  );
}

function PreviewContextPanel(props: {
  constituentQuery: string;
  donationQuery: string;
  previewYear: string;
  constituentResults: ConstituentLookup[];
  donationResults: DonationLookup[];
  selectedConstituent: ConstituentLookup | null;
  selectedDonation: DonationLookup | null;
  setConstituentQuery: (value: string) => void;
  setDonationQuery: (value: string) => void;
  setPreviewYear: (value: string) => void;
  chooseConstituent: (row: ConstituentLookup) => void;
  chooseDonation: (row: DonationLookup) => void;
  runPreview: () => void;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-3">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_120px_auto]">
        <div className="relative">
          <SearchBox label="Constituent" value={props.constituentQuery} onChange={props.setConstituentQuery} placeholder="Search constituents" />
          {props.constituentResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full">
              <ResultList>
                {props.constituentResults.map((row) => (
                  <button key={row.id} type="button" onClick={() => props.chooseConstituent(row)} className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-gray-50">
                    <span className="font-semibold text-gray-900">{formatConstituentName(row)}</span>
                    <span className="block truncate text-gray-500">{row.email || row.phone || row.id}</span>
                  </button>
                ))}
              </ResultList>
            </div>
          )}
        </div>
        <div className="relative">
          <SearchBox label="Donation" value={props.donationQuery} onChange={props.setDonationQuery} placeholder="Search donations" />
          {props.donationResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full">
              <ResultList>
                {props.donationResults.map((row) => (
                  <button key={row.id} type="button" onClick={() => props.chooseDonation(row)} className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-gray-50">
                    <span className="font-semibold text-gray-900">{formatDonationLabel(row)}</span>
                    <span className="block truncate text-gray-500">{row.campaign?.name || row.designation?.name || row.status}</span>
                  </button>
                ))}
              </ResultList>
            </div>
          )}
        </div>
        <SearchBox label="Year" value={props.previewYear} onChange={props.setPreviewYear} placeholder="Year" />
        <div className="flex items-end">
          <button type="button" onClick={props.runPreview} className="h-10 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700">
            Run Preview
          </button>
        </div>
      </div>
      {(props.selectedConstituent || props.selectedDonation) && (
        <p className="mt-2 text-xs text-gray-500">
          Context: {props.selectedConstituent ? formatConstituentName(props.selectedConstituent) : "No constituent"}{props.selectedDonation ? `, ${formatDonationLabel(props.selectedDonation)}` : ""}
        </p>
      )}
    </section>
  );
}

function PrintablePageShell({
  branding,
  header,
  footer,
  signature,
  children,
}: {
  branding: BrandingSettings;
  header?: HeaderPreset;
  footer?: FooterPreset;
  signature?: SignatureBlock;
  children: ReactNode;
}) {
  const orgName = branding.organizationDisplayName || branding.legalOrganizationName || "Organization Name";
  const address = formatBrandingAddress(branding);

  return (
    <div className="mx-auto min-h-[1056px] w-full max-w-[816px] rounded-sm border border-gray-300 bg-white px-12 py-10 shadow-sm">
      <header className={`mb-8 flex gap-4 border-b pb-5 ${header?.logoAlignment === "CENTER" ? "flex-col items-center text-center" : "items-start"}`} style={{ borderColor: branding.primaryColor }}>
        {branding.logoUrl ? <img src={branding.logoUrl} alt="" className="max-h-16 max-w-40 object-contain" /> : <div className="flex h-14 w-14 items-center justify-center rounded border text-xs font-semibold text-gray-400">Logo</div>}
        <div className="min-w-0">
          {(header?.showOrganizationName ?? true) && <p className="text-lg font-semibold text-gray-900">{orgName}</p>}
          {(header?.showTagline ?? true) && branding.tagline && <p className="text-xs text-gray-500">{branding.tagline}</p>}
          {(header?.showAddress ?? true) && address && <p className="mt-1 text-xs text-gray-500">{address}</p>}
          {(header?.showPhone ?? true) && branding.contactPhone && <p className="text-xs text-gray-500">{branding.contactPhone}</p>}
          {(header?.showWebsite ?? true) && branding.websiteUrl && <p className="text-xs text-gray-500">{branding.websiteUrl}</p>}
        </div>
      </header>
      {children}
      {signature && (
        <section className="mt-10 text-sm text-gray-800">
          {signature.closingPhrase && <p>{signature.closingPhrase}</p>}
          {signature.signatureImageUrl && <img src={signature.signatureImageUrl} alt="" className="mt-4 max-h-20 max-w-56 object-contain" />}
          {signature.typedSignature && !signature.signatureImageUrl && <p className="mt-4 font-serif text-2xl text-gray-900">{signature.typedSignature}</p>}
          <p className="mt-4 font-semibold">{signature.signerName}</p>
          {signature.signerTitle && <p className="text-gray-500">{signature.signerTitle}</p>}
          {[signature.email, signature.phone].filter(Boolean).length > 0 && <p className="text-xs text-gray-500">{[signature.email, signature.phone].filter(Boolean).join(" | ")}</p>}
        </section>
      )}
      <footer className="mt-10 border-t pt-4 text-center text-[11px] leading-5 text-gray-500">
        {(footer?.showOrganizationName ?? true) && <p className="font-semibold text-gray-700">{orgName}</p>}
        {(footer?.showAddress ?? true) && address && <p>{address}</p>}
        {(footer?.showPhone ?? true) && [branding.contactPhone, branding.contactEmail, branding.websiteUrl].filter(Boolean).join(" | ")}
        {(footer?.showTaxId ?? false) && branding.taxId && <p>Tax ID: {branding.taxId}</p>}
        {footer?.customText && <p>{footer.customText}</p>}
        {branding.footerLegalText && <p>{branding.footerLegalText}</p>}
      </footer>
    </div>
  );
}

function formatConstituentName(row: ConstituentLookup): string {
  const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
  return name || row.email || row.id;
}

function formatDonationLabel(row: DonationLookup): string {
  const amount = Number(row.amount);
  const formattedAmount = Number.isFinite(amount) ? amount.toLocaleString(undefined, { style: "currency", currency: "USD" }) : String(row.amount);
  const date = row.date ? new Date(row.date).toLocaleDateString() : "Undated";
  const donorName = row.constituent ? [row.constituent.firstName, row.constituent.lastName].filter(Boolean).join(" ") : "";
  return `${formattedAmount} - ${date}${donorName ? ` - ${donorName}` : ""}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}
