/** Document-studio editor for one printable project, including canvas editing, presets, merge preview, and publishing. */
"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import FormLetterRichEditor from "@/app/components/letters/FormLetterRichEditor";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import { bodyToPrintLayout, parsePrintLayout } from "@/app/components/letters/print-layout-utils";
import {
  buildLetterFooterContactLine,
  normalizeHeaderLogoAlignment,
  resolveLetterLogoUrl,
  shouldShowLetterLogo,
  type HeaderLogoAlignment,
} from "@/app/components/letters/letter-branding-rendering";
import {
  DEFAULT_BRANDING_SETTINGS,
  fetchBrandingSettings,
  formatBrandingAddress,
  type BrandingSettings,
} from "@/app/lib/branding-settings";
import type { FooterPreset, HeaderPreset, MergeFieldSection, PrintLayoutDocument, SignatureBlock } from "@/app/components/letters/types";

type StudioPanel = "document" | "preview" | "publish";
type RibbonTab = "home" | "insert" | "mailings" | "review";
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

const DEFAULT_STARTER_BODY = `<p>{{donor.firstName}},</p><p>Thank you for supporting {{organization.name}}. Your generosity makes practical care possible for the people we serve.</p><p>Gift details:</p><table><tbody><tr><th>Gift Date</th><th>Amount</th><th>Fund</th></tr><tr><td>{{gift.date}}</td><td>{{gift.amount}}</td><td>{{gift.fund}}</td></tr></tbody></table><p>Sincerely,</p><p>{{staff.fullName}}<br />{{staff.title}}</p>`;

const LEGACY_TOKEN_NORMALIZERS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\{\{\s*constituent\.firstName\s*\}\}/g, replacement: "{{donor.firstName}}" },
  { pattern: /\{\{\s*constituent\.lastName\s*\}\}/g, replacement: "{{donor.lastName}}" },
  { pattern: /\{\{\s*constituent\.fullName\s*\}\}/g, replacement: "{{donor.fullName}}" },
  { pattern: /\{\{\s*constituent\.preferredName\s*\}\}/g, replacement: "{{donor.preferredName}}" },
  { pattern: /\{\{\s*constituent\.email\s*\}\}/g, replacement: "{{donor.email}}" },
  { pattern: /\{\{\s*constituent\.phone\s*\}\}/g, replacement: "{{donor.phone}}" },
  { pattern: /\{\{\s*constituent\.addressLine1\s*\}\}/g, replacement: "{{donor.addressLine1}}" },
  { pattern: /\{\{\s*constituent\.addressLine2\s*\}\}/g, replacement: "{{donor.addressLine2}}" },
  { pattern: /\{\{\s*constituent\.city\s*\}\}/g, replacement: "{{donor.city}}" },
  { pattern: /\{\{\s*constituent\.state\s*\}\}/g, replacement: "{{donor.state}}" },
  { pattern: /\{\{\s*constituent\.zip\s*\}\}/g, replacement: "{{donor.zip}}" },
  { pattern: /\{\{\s*constituent\.salutation\s*\}\}/g, replacement: "{{donor.salutation}}" },
  { pattern: /\{\{\s*donation\.amount\s*\}\}/g, replacement: "{{gift.amount}}" },
  { pattern: /\{\{\s*donation\.date\s*\}\}/g, replacement: "{{gift.date}}" },
  { pattern: /\{\{\s*donation\.designation\s*\}\}/g, replacement: "{{gift.fund}}" },
  { pattern: /\{\{\s*donation\.campaign\s*\}\}/g, replacement: "{{gift.campaign}}" },
  { pattern: /\{\{\s*donation\.paymentMethod\s*\}\}/g, replacement: "{{gift.paymentMethod}}" },
  { pattern: /\{\{\s*donation\.receiptNumber\s*\}\}/g, replacement: "{{gift.receiptNumber}}" },
  { pattern: /\{\{\s*donation\.taxDeductibleAmount\s*\}\}/g, replacement: "{{gift.taxDeductibleAmount}}" },
  { pattern: /\{\{\s*gift\.designation\s*\}\}/g, replacement: "{{gift.fund}}" },
  { pattern: /\{\{\s*organization\.signerName\s*\}\}/g, replacement: "{{staff.fullName}}" },
  { pattern: /\{\{\s*organization\.signerTitle\s*\}\}/g, replacement: "{{staff.title}}" },
];

const LEGACY_MERGE_TOKEN_ALIASES: Readonly<Record<string, string>> = {
  "{{constituent.firstName}}": "{{donor.firstName}}",
  "{{constituent.lastName}}": "{{donor.lastName}}",
  "{{constituent.fullName}}": "{{donor.fullName}}",
  "{{constituent.preferredName}}": "{{donor.preferredName}}",
  "{{constituent.email}}": "{{donor.email}}",
  "{{constituent.phone}}": "{{donor.phone}}",
  "{{constituent.addressLine1}}": "{{donor.addressLine1}}",
  "{{constituent.addressLine2}}": "{{donor.addressLine2}}",
  "{{constituent.city}}": "{{donor.city}}",
  "{{constituent.state}}": "{{donor.state}}",
  "{{constituent.zip}}": "{{donor.zip}}",
  "{{constituent.salutation}}": "{{donor.salutation}}",
  "{{donation.amount}}": "{{gift.amount}}",
  "{{donation.date}}": "{{gift.date}}",
  "{{donation.designation}}": "{{gift.fund}}",
  "{{donation.campaign}}": "{{gift.campaign}}",
  "{{donation.paymentMethod}}": "{{gift.paymentMethod}}",
  "{{donation.receiptNumber}}": "{{gift.receiptNumber}}",
  "{{donation.taxDeductibleAmount}}": "{{gift.taxDeductibleAmount}}",
  "{{gift.designation}}": "{{gift.fund}}",
  "{{organization.signerName}}": "{{staff.fullName}}",
  "{{organization.signerTitle}}": "{{staff.title}}",
};

interface LetterTemplateEditorProps {
  templateId?: string;
  fullScreen?: boolean;
  initialPanel?: StudioPanel;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMergeTokens(html: string): string[] {
  const matches = html.match(/\{\{\s*[^{}]+\s*\}\}/g) ?? [];
  return Array.from(new Set(matches.map((token) => token.replace(/\s+/g, ""))));
}

function canonicalizeMergeToken(token: string): string {
  const normalized = token.replace(/\s+/g, "");
  return LEGACY_MERGE_TOKEN_ALIASES[normalized] ?? normalized;
}

function normalizeLegacyMergeTokens(html: string): { html: string; replacements: number } {
  let next = html;
  let replacements = 0;

  for (const rule of LEGACY_TOKEN_NORMALIZERS) {
    next = next.replace(rule.pattern, () => {
      replacements += 1;
      return rule.replacement;
    });
  }

  return { html: next, replacements };
}

/** Renders the printable document studio used by both new and existing printable projects. */
export default function LetterTemplateEditor({ templateId, fullScreen = false, initialPanel = "document" }: LetterTemplateEditorProps) {
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<StudioPanel>(initialPanel);
  const [ribbonTab, setRibbonTab] = useState<RibbonTab>("home");
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
  const quickInsertTokens = useMemo(() => {
    const preferred = [
      "{{donor.firstName}}",
      "{{donor.fullName}}",
      "{{gift.amount}}",
      "{{gift.date}}",
      "{{gift.fund}}",
      "{{organization.name}}",
      "{{organization.website}}",
      "{{staff.fullName}}",
    ];
    const availablePreferred = preferred.filter((field) => mergeFields.includes(field));
    return availablePreferred.length > 0 ? availablePreferred : mergeFields.slice(0, 8);
  }, [mergeFields]);
  const mergeHealth = useMemo(() => {
    const plainText = stripHtmlToText(form.printBody || "");
    const words = plainText ? plainText.split(/\s+/).length : 0;
    const characters = plainText.length;
    const usedTokens = extractMergeTokens(form.printBody || "");
    const known = new Set(mergeFields);
    const unsupportedTokens = usedTokens.filter((token) => !known.has(canonicalizeMergeToken(token)));
    return {
      words,
      characters,
      usedTokens,
      unsupportedTokens,
    };
  }, [form.printBody, mergeFields]);

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

  /** Converts common legacy merge-field aliases to current token names used by merge preview and generation. */
  function normalizeTokens() {
    const result = normalizeLegacyMergeTokens(form.printBody || "");
    if (result.replacements === 0) {
      setNotice("No legacy tokens detected. Merge fields already use current naming.");
      return;
    }
    updatePrintBody(result.html);
    setNotice(`Normalized ${result.replacements} merge field token${result.replacements === 1 ? "" : "s"}.`);
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
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gradient-to-r from-white via-gray-50 to-white px-4 py-3">
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
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-600">Session: {activePanel === "document" ? "Editing" : activePanel === "preview" ? "Previewing" : "Publishing"}</span>
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

        <div className="border-b border-gray-200 bg-white px-3 py-1.5">
          <div className="flex flex-wrap items-center gap-1">
            <RibbonButton active={ribbonTab === "home"} label="Home" onClick={() => setRibbonTab("home")} />
            <RibbonButton active={ribbonTab === "insert"} label="Insert" onClick={() => setRibbonTab("insert")} />
            <RibbonButton active={ribbonTab === "mailings"} label="Mailings" onClick={() => setRibbonTab("mailings")} />
            <RibbonButton active={ribbonTab === "review"} label="Review" onClick={() => setRibbonTab("review")} />
          </div>
        </div>

        <div className="px-2 py-2">
          <WorkspaceRibbon>
            {ribbonTab === "home" && (
              <>
                <WorkspaceRibbonGroup label="Workspace">
                  <WorkspaceRibbonButton label="Document" active={activePanel === "document"} onClick={() => setActivePanel("document")} />
                  <WorkspaceRibbonButton label="Preview" active={activePanel === "preview"} onClick={() => setActivePanel("preview")} />
                  <WorkspaceRibbonButton label="Publish" active={activePanel === "publish"} onClick={() => setActivePanel("publish")} />
                </WorkspaceRibbonGroup>
                <WorkspaceRibbonGroup label="Session">
                  <WorkspaceRibbonButton label="Save" onClick={() => void saveTemplate()} />
                  <WorkspaceRibbonButton label="Print Preview" onClick={() => void runPreview()} />
                  <WorkspaceRibbonButton label="Publish Workspace" onClick={() => void openPublishWorkspace()} />
                </WorkspaceRibbonGroup>
                <WorkspaceRibbonGroup label="Layout">
                  <WorkspaceRibbonButton label="Header Tool" href="/settings/branding/letter-presets?tab=headers" />
                  <WorkspaceRibbonButton label="Footer Tool" href="/settings/branding/letter-presets?tab=footers" />
                  <WorkspaceRibbonButton label="Branding Settings" onClick={() => router.push("/settings/branding")} />
                </WorkspaceRibbonGroup>
              </>
            )}

            {ribbonTab === "insert" && (
              <>
                <WorkspaceRibbonGroup label="Merge Tokens">
                  {quickInsertTokens.slice(0, 5).map((token) => (
                    <WorkspaceRibbonButton key={token} label={token.replaceAll("{{", "").replaceAll("}}", "")} onClick={() => insertField(token)} />
                  ))}
                </WorkspaceRibbonGroup>
                <WorkspaceRibbonGroup label="Structure">
                  <WorkspaceRibbonButton label="Header Tool" href="/settings/branding/letter-presets?tab=headers" />
                  <WorkspaceRibbonButton label="Footer Tool" href="/settings/branding/letter-presets?tab=footers" />
                </WorkspaceRibbonGroup>
                <WorkspaceRibbonGroup label="Preview">
                  <WorkspaceRibbonButton label="Run Merged Preview" onClick={() => void runPreview()} />
                </WorkspaceRibbonGroup>
              </>
            )}

            {ribbonTab === "mailings" && (
              <>
                <WorkspaceRibbonGroup label="Merge Run">
                  <WorkspaceRibbonButton label="Run Merged Preview" onClick={() => void runPreview()} />
                  <WorkspaceRibbonButton label="Single Generator" onClick={() => void openGenerateWorkspace("single")} />
                  <WorkspaceRibbonButton label="Batch Generator" onClick={() => void openGenerateWorkspace("batch")} />
                </WorkspaceRibbonGroup>
                <WorkspaceRibbonGroup label="Queue Handoff">
                  <WorkspaceRibbonButton label="Print Queue" onClick={() => void openGenerateWorkspace("batch", "print")} />
                  <WorkspaceRibbonButton label="Mail Queue" onClick={() => void openGenerateWorkspace("batch", "mail")} />
                </WorkspaceRibbonGroup>
              </>
            )}

            {ribbonTab === "review" && (
              <>
                <WorkspaceRibbonGroup label="Quality">
                  <WorkspaceRibbonButton
                    label={`Unsupported Tokens (${mergeHealth.unsupportedTokens.length})`}
                    disabled={mergeHealth.unsupportedTokens.length === 0}
                    onClick={() => setActivePanel("preview")}
                  />
                  <WorkspaceRibbonButton label="Normalize Legacy Tokens" onClick={normalizeTokens} />
                </WorkspaceRibbonGroup>
                <WorkspaceRibbonGroup label="Status">
                  <WorkspaceRibbonButton label={`${mergeHealth.words} Words`} disabled />
                  <WorkspaceRibbonButton label={`${mergeHealth.characters} Chars`} disabled />
                  <WorkspaceRibbonButton label={`${mergeHealth.usedTokens.length} Merge Fields`} disabled />
                </WorkspaceRibbonGroup>
              </>
            )}
          </WorkspaceRibbon>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-200 bg-gray-50 px-4 py-2 text-[11px] text-gray-600">
          <span>Words: <span className="font-semibold text-gray-800">{mergeHealth.words}</span></span>
          <span>Characters: <span className="font-semibold text-gray-800">{mergeHealth.characters}</span></span>
          <span>Merge Fields Used: <span className="font-semibold text-gray-800">{mergeHealth.usedTokens.length}</span></span>
          <span>
            Unsupported: <span className={`font-semibold ${mergeHealth.unsupportedTokens.length > 0 ? "text-amber-700" : "text-green-700"}`}>{mergeHealth.unsupportedTokens.length}</span>
          </span>
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

          <PanelSection title="Merge Health">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Words</p>
                <p className="text-sm font-semibold text-gray-900">{mergeHealth.words}</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-gray-500">Merge Fields</p>
                <p className="text-sm font-semibold text-gray-900">{mergeHealth.usedTokens.length}</p>
              </div>
            </div>
            {mergeHealth.unsupportedTokens.length > 0 ? (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                <p className="text-[11px] font-semibold text-amber-800">Unsupported merge fields detected</p>
                <div className="max-h-28 space-y-1 overflow-auto">
                  {mergeHealth.unsupportedTokens.map((token) => (
                    <p key={token} className="truncate rounded bg-white px-2 py-1 font-mono text-[10px] text-amber-800">
                      {token}
                    </p>
                  ))}
                </div>
                <button type="button" onClick={normalizeTokens} className="w-full rounded-md border border-amber-300 bg-white px-2 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100">
                  Normalize Legacy Tokens
                </button>
              </div>
            ) : (
              <div className="rounded-lg border border-green-200 bg-green-50 px-2 py-1.5 text-[11px] text-green-700">
                All merge fields are using current token naming.
              </div>
            )}
          </PanelSection>

          <PanelSection title="Brand Source">
            <div className="flex items-start gap-3">
              <BrandSourceLogo branding={branding} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">{branding.organizationDisplayName || branding.legalOrganizationName || "Organization"}</p>
                <p className="text-xs text-gray-500">{formatBrandingAddress(branding) || "No organization address configured."}</p>
              </div>
            </div>
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
  const alignment = normalizeHeaderLogoAlignment(header?.logoAlignment);
  const logoUrl = resolveLetterLogoUrl(branding.logoUrl, branding.logoSquareUrl);
  const footerContactLine = buildLetterFooterContactLine(branding, footer);
  const borderColor = branding.primaryColor || DEFAULT_BRANDING_SETTINGS.primaryColor;
  const headerCustomHtml = header?.customHtml?.trim();
  const footerCustomHtml = footer?.customHtml?.trim();

  return (
    <div className="mx-auto flex min-h-[1056px] w-full max-w-[816px] flex-col rounded-sm border border-gray-300 bg-white px-12 py-10 shadow-sm">
      <header className={`${getPrintableHeaderClassName(alignment)} mb-8 border-b pb-5`} style={{ borderColor }}>
        {headerCustomHtml ? (
          <div
            className="w-full text-sm text-gray-700 [&_img]:h-auto [&_img]:max-w-full [&_p]:my-1 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:p-1.5 [&_th]:border [&_th]:border-gray-200 [&_th]:p-1.5"
            dangerouslySetInnerHTML={{ __html: headerCustomHtml }}
          />
        ) : (
          <>
            {shouldShowLetterLogo(header) && (logoUrl ? <LetterheadLogo logoUrl={logoUrl} orgName={orgName} alignment={alignment} /> : <LetterheadLogoPlaceholder alignment={alignment} />)}
            <div className={alignment === "CENTER" ? "min-w-0" : "min-w-0 flex-1"}>
              {(header?.showOrganizationName ?? true) && <p className="text-lg font-semibold text-gray-900">{orgName}</p>}
              {(header?.showTagline ?? true) && branding.tagline && <p className="text-xs text-gray-500">{branding.tagline}</p>}
              {(header?.showAddress ?? true) && address && <p className="mt-1 text-xs text-gray-500">{address}</p>}
              {(header?.showPhone ?? true) && branding.contactPhone && <p className="text-xs text-gray-500">{branding.contactPhone}</p>}
              {(header?.showWebsite ?? true) && branding.websiteUrl && <p className="text-xs text-gray-500">{branding.websiteUrl}</p>}
            </div>
          </>
        )}
      </header>
      <main className="flex-1">{children}</main>
      {signature && (
        <section className="mt-10 text-sm text-gray-800">
          {signature.closingPhrase && <p>{signature.closingPhrase}</p>}
          {signature.signatureImageUrl && <img src={signature.signatureImageUrl} alt="" className="mt-4 h-auto max-h-20 w-auto max-w-56 object-contain" />}
          {signature.typedSignature && !signature.signatureImageUrl && <p className="mt-4 font-serif text-2xl text-gray-900">{signature.typedSignature}</p>}
          <p className="mt-4 font-semibold">{signature.signerName}</p>
          {signature.signerTitle && <p className="text-gray-500">{signature.signerTitle}</p>}
          {[signature.email, signature.phone].filter(Boolean).length > 0 && <p className="text-xs text-gray-500">{[signature.email, signature.phone].filter(Boolean).join(" | ")}</p>}
        </section>
      )}
      <footer className="mt-auto border-t pt-4 text-center text-[11px] leading-5 text-gray-500" style={{ borderColor }}>
        {footerCustomHtml ? (
          <div
            className="text-gray-600 [&_img]:mx-auto [&_img]:h-auto [&_img]:max-w-full [&_p]:my-1 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:p-1.5 [&_th]:border [&_th]:border-gray-200 [&_th]:p-1.5"
            dangerouslySetInnerHTML={{ __html: footerCustomHtml }}
          />
        ) : (
          <>
            {(footer?.showOrganizationName ?? true) && <p className="font-semibold text-gray-700">{orgName}</p>}
            {(footer?.showAddress ?? true) && address && <p>{address}</p>}
            {footerContactLine && <p>{footerContactLine}</p>}
            {(footer?.showTaxId ?? false) && branding.taxId && <p>Tax ID: {branding.taxId}</p>}
            {footer?.customText && <p className="whitespace-pre-line">{footer.customText}</p>}
            {(footer?.showPageNumber ?? true) && <p>Page 1</p>}
            {branding.footerLegalText && <p>{branding.footerLegalText}</p>}
          </>
        )}
      </footer>
    </div>
  );
}

function BrandSourceLogo({ branding }: { branding: BrandingSettings }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const logoUrl = resolveLetterLogoUrl(branding.logoUrl, branding.logoSquareUrl);

  if (!logoUrl || logoFailed) {
    return (
      <div className="flex h-10 w-24 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 px-2 text-center text-[10px] font-semibold text-gray-400">
        No logo
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt=""
      className="h-auto max-h-10 w-auto max-w-24 rounded border border-gray-200 bg-white object-contain p-1"
      onError={() => setLogoFailed(true)}
    />
  );
}

function LetterheadLogo({ logoUrl, orgName, alignment }: { logoUrl: string; orgName: string; alignment: HeaderLogoAlignment }) {
  const [logoFailed, setLogoFailed] = useState(false);

  if (logoFailed) return <LetterheadLogoPlaceholder alignment={alignment} />;

  return (
    <img
      src={logoUrl}
      alt={`${orgName} logo`}
      className={`h-auto max-h-16 w-auto max-w-40 object-contain ${alignment === "CENTER" ? "mx-auto" : ""}`}
      onError={() => setLogoFailed(true)}
    />
  );
}

function LetterheadLogoPlaceholder({ alignment }: { alignment: HeaderLogoAlignment }) {
  return (
    <div className={`flex h-14 w-28 items-center justify-center rounded border border-dashed border-gray-300 bg-gray-50 px-2 text-center text-[10px] font-semibold uppercase tracking-wide text-gray-400 ${alignment === "CENTER" ? "mx-auto" : ""}`}>
      No logo configured
    </div>
  );
}

function getPrintableHeaderClassName(alignment: HeaderLogoAlignment): string {
  if (alignment === "CENTER") return "flex flex-col items-center gap-3 text-center";
  if (alignment === "RIGHT") return "flex flex-row-reverse items-start gap-4 text-right";
  return "flex items-start gap-4 text-left";
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
