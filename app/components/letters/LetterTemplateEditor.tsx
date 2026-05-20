/** Document-studio editor for one printable project, including canvas editing, presets, merge preview, and publishing. */
"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import FormLetterRichEditor, { type LetterEditorCommands, type LetterInsertBlockKind } from "@/app/components/letters/FormLetterRichEditor";
import LetterBuilderIcon, { type LetterBuilderIconName } from "@/app/components/letters/LetterBuilderIcon";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
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
type RightPanelTab = "insert" | "format" | "page" | "settings";
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

const FONT_FAMILY_OPTIONS = [
  { label: "Inter", value: "Inter, Arial, sans-serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: '"Times New Roman", Times, serif' },
  { label: "Garamond", value: "Garamond, Georgia, serif" },
  { label: "Merriweather", value: "Merriweather, Georgia, serif" },
  { label: "Source Serif", value: '"Source Serif", Georgia, serif' },
  { label: "System Sans", value: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif" },
  { label: "System Serif", value: "ui-serif, Georgia, Cambria, serif" },
];

const FONT_SIZE_OPTIONS = ["9", "10", "11", "12", "14", "16", "18", "20", "24", "32"];

const DEFAULT_STARTER_BODY = `<p>{{donor.firstName}},</p><p>Thank you for supporting {{organization.name}}. Your generosity makes practical care possible for the people we serve.</p><p>Gift details:</p><table><tbody><tr><th>Gift Date</th><th>Amount</th><th>Fund</th></tr><tr><td>{{gift.date}}</td><td>{{gift.amount}}</td><td>{{gift.fund}}</td></tr></tbody></table><p>Sincerely,</p><p>{{staff.fullName}}<br />{{staff.title}}</p>`;

const LETTER_BODY_CONTENT_CLASS = "min-h-[560px] text-sm leading-6 text-gray-900 [&_a]:text-blue-700 [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-green-200 [&_blockquote]:bg-green-50 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_h1]:my-3 [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:leading-tight [&_h2]:my-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:leading-tight [&_h3]:my-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:leading-tight [&_hr[data-page-break='true']]:my-8 [&_hr[data-page-break='true']]:border-t-2 [&_hr[data-page-break='true']]:border-dashed [&_hr[data-page-break='true']]:border-gray-400 [&_img]:h-auto [&_img]:max-w-full [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:p-2 [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6";

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
  const [rightTab, setRightTab] = useState<RightPanelTab>("format");
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
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [isPublishConfirmOpen, setIsPublishConfirmOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [convertingToEmailDraft, setConvertingToEmailDraft] = useState(false);
  const [editorCommands, setEditorCommands] = useState<LetterEditorCommands | null>(null);
  const [selectedFontFamily, setSelectedFontFamily] = useState(FONT_FAMILY_OPTIONS[0].value);
  const [selectedFontSize, setSelectedFontSize] = useState("11");
  const [selectedLineHeight, setSelectedLineHeight] = useState("1.6");

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
  async function runPreview(): Promise<boolean> {
    const currentId = await saveTemplate({ silent: true });
    if (!currentId) return false;

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
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to run preview.");
      return false;
    }
  }

  /** Opens a print-focused modal preview after refreshing merged data for the current context. */
  async function openPrintPreviewModal() {
    const ready = await runPreview();
    if (!ready) return;
    setIsPrintPreviewOpen(true);
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

  /** Converts the current letter template into a Communications email draft and opens the draft campaign. */
  async function convertTemplateToEmailDraft() {
    const currentId = await saveTemplate({ silent: true });
    if (!currentId) return;

    setConvertingToEmailDraft(true);
    setError(null);
    try {
      const result = await apiFetch<{ redirectTo?: string; emailCampaign?: { id: string } }>(`/api/letters/templates/${currentId}/create-email-draft`, {
        method: "POST",
      });

      const redirectTo = result.redirectTo || (result.emailCampaign?.id ? `/communications/${result.emailCampaign.id}` : null);
      if (!redirectTo) {
        throw new Error("Email draft created without a redirect path.");
      }

      setNotice("Email draft created from this letter template.");
      router.push(redirectTo);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to convert letter template to email draft.");
    } finally {
      setConvertingToEmailDraft(false);
    }
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

  /** Routes insert-panel clicks through the focused editor command API when available. */
  function insertBlock(kind: LetterInsertBlockKind) {
    if (kind === "variable") {
      insertField("{{donor.firstName}}");
      return;
    }
    editorCommands?.insertBlock(kind);
  }

  function applyFontFamily(value: string) {
    setSelectedFontFamily(value);
    editorCommands?.setFontFamily(value);
  }

  function applyFontSize(value: string) {
    setSelectedFontSize(value);
    editorCommands?.setFontSize(`${value}pt`);
  }

  function applyLineHeight(value: string) {
    setSelectedLineHeight(value);
    editorCommands?.setLineHeight(value);
  }

  if (loading) {
    return <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">Loading printable studio...</div>;
  }

  return (
    <div data-testid="letter-builder-page" className={fullScreen ? "fixed inset-0 z-[90] flex min-w-0 flex-col overflow-hidden bg-gray-50" : "relative flex h-[calc(100dvh-5.75rem)] min-w-0 flex-col overflow-hidden bg-gray-50"}>
      <header className="z-40 shrink-0 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="flex min-h-10 min-w-0 items-center justify-between gap-3 px-3 py-1.5">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="hidden min-w-0 shrink text-xs text-gray-500 md:flex md:items-center md:gap-1.5">
              <Link href="/communications" className="hover:text-green-700">Communications</Link>
              <span className="text-gray-300">/</span>
              <Link href="/letters-printables" className="hover:text-green-700">Letters & Printables</Link>
              <span className="text-gray-300">/</span>
            </div>
            <input
              data-testid="letter-title"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
              placeholder="Steward Letter: Thank You"
              className="min-w-[180px] flex-1 truncate border-0 bg-transparent p-0 text-[15px] font-semibold text-gray-950 outline-none placeholder:text-gray-400"
            />
            <span className="hidden rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500 sm:inline">Edit</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${isDirty ? "bg-amber-50 text-amber-700" : "bg-green-50 text-green-700"}`}>{isDirty ? "Unsaved" : "Saved"}</span>
          </div>
        </div>
        <div className="flex min-h-9 min-w-0 items-center justify-between gap-3 border-t border-gray-100 px-3 py-1">
          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto">
            <BuilderTab active={activePanel === "document"} label="Compose" onClick={() => setActivePanel("document")} />
            <BuilderTab active={activePanel === "preview"} label="Test Recipients" onClick={() => setActivePanel("preview")} />
            <BuilderTab active={activePanel === "publish"} label="History" onClick={() => setActivePanel("publish")} />
          </nav>
          <div className="flex shrink-0 items-center gap-1.5 border-l border-gray-200 pl-3">
            <button data-testid="letter-preview" type="button" onClick={() => void openPrintPreviewModal()} className="h-8 rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50">
              Preview
            </button>
            <button data-testid="letter-save-draft" type="button" onClick={() => void saveTemplate()} disabled={saving} className="h-8 rounded-md border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-60">
              {saving ? "Saving..." : "Save Draft"}
            </button>
            <button data-testid="letter-publish" type="button" onClick={() => setIsPublishConfirmOpen(true)} className="h-8 rounded-md bg-green-600 px-3 text-xs font-semibold text-white shadow-sm hover:bg-green-700">
              Publish
            </button>
            <div className="relative">
              <button type="button" onClick={() => setIsMoreMenuOpen((prev) => !prev)} className="flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-semibold text-gray-600 shadow-sm hover:bg-gray-50" aria-label="More Options">
                ...
              </button>
              {isMoreMenuOpen && (
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-2 text-sm shadow-xl">
                  <MoreMenuButton label={convertingToEmailDraft ? "Converting..." : "Convert to Email Draft"} onClick={() => void convertTemplateToEmailDraft()} />
                  <MoreMenuButton label="Duplicate Template" onClick={() => setNotice("Duplicate template is planned for a future production pass.")} />
                  <MoreMenuButton label="Export PDF" onClick={() => void openPrintPreviewModal()} />
                  <MoreMenuButton label="Print Test" onClick={() => void openPrintPreviewModal()} />
                  <MoreMenuButton label="Archive Template" onClick={() => update("status", "ARCHIVED")} />
                  <MoreMenuButton label="View Version History" onClick={() => setActivePanel("publish")} />
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {error && <div className="mx-5 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>}
      {notice && <div className="mx-5 mt-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{notice}</div>}

      <div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_320px]">
        <aside data-testid="letter-left-insert-panel" className="min-h-0 border-r border-gray-200 bg-white p-4 pb-12 lg:h-full lg:overflow-auto">
          <PanelSection title="Content">
            <InsertBlockButton icon="heading" label="Heading" onClick={() => insertBlock("heading")} />
            <InsertBlockButton icon="text" label="Text" onClick={() => insertBlock("text")} />
            <InsertBlockButton icon="list" label="List" onClick={() => insertBlock("list")} />
            <InsertBlockButton icon="quote" label="Quote" onClick={() => insertBlock("quote")} />
            <InsertBlockButton icon="image" label="Image" onClick={() => insertBlock("image")} />
            <InsertBlockButton icon="table" label="Table" onClick={() => insertBlock("table")} />
            <InsertBlockButton icon="divider" label="Divider" onClick={() => insertBlock("divider")} />
            <InsertBlockButton icon="variable" label="Variable" onClick={() => insertBlock("variable")} testId="letter-variable-insert" />
          </PanelSection>
          <PanelSection title="Blocks">
            <InsertBlockButton icon="header" label="Header" onClick={() => insertBlock("header")} />
            <InsertBlockButton icon="footer" label="Footer" onClick={() => insertBlock("footer")} />
            <InsertBlockButton icon="signature" label="Signature" onClick={() => insertBlock("signature")} />
            <InsertBlockButton icon="social" label="Social Links" onClick={() => insertBlock("social")} />
            <InsertBlockButton icon="callout" label="Callout" onClick={() => insertBlock("callout")} />
          </PanelSection>
          <PanelSection title="Advanced">
            <InsertBlockButton icon="donation" label="Donation Summary" onClick={() => insertBlock("donationSummary")} />
            <InsertBlockButton icon="receipt" label="Receipt Block" onClick={() => insertBlock("receipt")} />
            <InsertBlockButton icon="organization" label="Organization Info" onClick={() => insertBlock("organization")} />
            <InsertBlockButton icon="campaign" label="Campaign Info" onClick={() => insertBlock("campaign")} />
            <InsertBlockButton icon="event" label="Event Info" onClick={() => insertBlock("event")} />
          </PanelSection>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
            Type / for commands or {"{{"} for variables.
          </div>
        </aside>

        <main className="min-h-0 min-w-0 overflow-auto bg-gray-100 px-4 pb-20 pt-6">
          {activePanel === "document" && (
            <div className="mx-auto w-full max-w-[940px]">
              <PrintablePageShell branding={branding} header={selectedHeader} footer={selectedFooter} signature={selectedSignature}>
                <FormLetterRichEditor
                  value={form.printBody}
                  placeholder="Start writing, or type / for commands..."
                  minHeight={560}
                  htmlLabel="Raw HTML"
                  mergeFields={mergeFields}
                  onChange={updatePrintBody}
                  onRegisterInsert={handleRegisterPrintInsert}
                  onRegisterCommands={setEditorCommands}
                  onUploadImage={uploadEditorImage}
                  floatingToolbarTopClassName="top-0"
                />
              </PrintablePageShell>
            </div>
          )}

          {activePanel === "preview" && (
            <div className="mx-auto w-full max-w-[940px]">
              <PrintablePageShell branding={branding} header={selectedHeader} footer={selectedFooter} signature={selectedSignature}>
                <div
                  className={LETTER_BODY_CONTENT_CLASS}
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
                <h2 className="text-sm font-semibold text-gray-900">History and Publishing Workflows</h2>
                <p className="mt-1 text-xs text-gray-600">Version history is planned. Production handoff remains confirmation-gated through Publish.</p>
              </section>
              <div className="grid gap-3 md:grid-cols-2">
                <PublishCard title="Generate Single Letter" description="Search one constituent, preview the merge, generate the letter, and export a PDF from the same workspace." action="Open Single Generator" onClick={() => void openGenerateWorkspace("single")} />
                <PublishCard title="Batch Generate Letters" description="Use segments, contact search, or saved audience lists, run a dry-run, then generate batch PDFs or queue output." action="Open Batch Generator" onClick={() => void openGenerateWorkspace("batch")} />
                <PublishCard title="Generate For Print Queue" description="Open batch generation with print queue handoff selected for this template." action="Open Print Workflow" onClick={() => void openGenerateWorkspace("batch", "print")} />
                <PublishCard title="Generate For Mail Queue" description="Open batch generation with mail queue handoff selected for this template." action="Open Mail Workflow" onClick={() => void openGenerateWorkspace("batch", "mail")} />
              </div>
            </div>
          )}
        </main>

        <aside data-testid="letter-right-sidebar" className="min-h-0 border-l border-gray-200 bg-white pb-12 xl:h-full xl:overflow-auto">
          <div className="flex border-b border-gray-200 px-3 pt-3">
            <RightPanelTabButton active={rightTab === "insert"} label="Insert" onClick={() => setRightTab("insert")} />
            <RightPanelTabButton active={rightTab === "format"} label="Format" onClick={() => setRightTab("format")} testId="letter-format-tab" />
            <RightPanelTabButton active={rightTab === "page"} label="Page" onClick={() => setRightTab("page")} />
            <RightPanelTabButton active={rightTab === "settings"} label="Settings" onClick={() => setRightTab("settings")} />
          </div>
          <div className="space-y-4 p-4">
            {rightTab === "insert" && (
              <>
                <PanelSection title="Variables">
                  <div className="max-h-72 space-y-2 overflow-auto pr-1">
                    {mergeSections.map((section) => (
                      <details key={section.key} className="rounded-lg border border-gray-200 p-2" open={section.key === "donor"}>
                        <summary className="cursor-pointer text-[11px] font-semibold uppercase text-gray-600">{section.label}</summary>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {section.fields.map((field) => (
                            <button key={field} type="button" onClick={() => insertField(field)} className="rounded border border-gray-200 px-2 py-1 font-mono text-[10px] text-gray-700 hover:bg-gray-50">
                              {field}
                            </button>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </PanelSection>
                <PanelSection title="Quick Blocks">
                  {["donor.firstName", "gift.amount", "gift.date", "organization.name"].map((token) => (
                    <button key={token} type="button" onClick={() => insertField(`{{${token}}}`)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-left font-mono text-xs text-gray-700 hover:bg-gray-50">
                      {`{{${token}}}`}
                    </button>
                  ))}
                </PanelSection>
              </>
            )}

            {rightTab === "format" && (
              <>
                <PanelSection title="Text">
                  <div className="grid grid-cols-[1fr_80px] gap-2">
                    <select data-testid="letter-font-family-select" value={selectedFontFamily} onChange={(event) => applyFontFamily(event.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                      {FONT_FAMILY_OPTIONS.map((option) => <option key={option.label} value={option.value}>{option.label}</option>)}
                    </select>
                    <select data-testid="letter-font-size-select" value={selectedFontSize} onChange={(event) => applyFontSize(event.target.value)} className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
                      {FONT_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-5 gap-1">
                    <MiniFormatButton icon="bold" label="B" onClick={() => editorCommands?.toggleBold()} strong />
                    <MiniFormatButton icon="italic" label="I" onClick={() => editorCommands?.toggleItalic()} italic />
                    <MiniFormatButton icon="underline" label="U" onClick={() => editorCommands?.toggleUnderline()} underline />
                    <MiniFormatButton icon="strike" label="S" onClick={() => editorCommands?.toggleStrike()} />
                    <MiniFormatButton icon="code" label="Code" onClick={() => editorCommands?.toggleCode()} />
                  </div>
                  <label className="block text-xs font-semibold text-gray-600">
                    <span className="mb-1 flex items-center gap-1.5"><LetterBuilderIcon name="color" className="h-3.5 w-3.5" />Text color</span>
                    <input type="color" defaultValue="#111827" onChange={(event) => editorCommands?.setColor(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-gray-200 bg-white px-2" />
                  </label>
                </PanelSection>
                <PanelSection title="Alignment">
                  <div className="grid grid-cols-4 gap-1">
                    {([
                      ["left", "alignLeft"],
                      ["center", "alignCenter"],
                      ["right", "alignRight"],
                      ["justify", "alignJustify"],
                    ] as const).map(([alignment, icon]) => (
                      <button key={alignment} type="button" onClick={() => editorCommands?.setAlignment(alignment)} className="flex items-center justify-center rounded-lg border border-gray-200 px-2 py-2 text-xs capitalize hover:bg-gray-50" title={alignment}>
                        <LetterBuilderIcon name={icon} className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                </PanelSection>
                <PanelSection title="Spacing">
                  <label className="block text-xs font-semibold text-gray-600">
                    <span className="mb-1 flex items-center gap-1.5"><LetterBuilderIcon name="lineHeight" className="h-3.5 w-3.5" />Line height</span>
                    <select value={selectedLineHeight} onChange={(event) => applyLineHeight(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                      {["1.2", "1.4", "1.5", "1.6", "1.8", "2"].map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input aria-label="Space before" value="0 pt" readOnly className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500" />
                    <input aria-label="Space after" value="12 pt" readOnly className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-500" />
                  </div>
                </PanelSection>
              </>
            )}

            {rightTab === "page" && (
              <>
                <PanelSection title="Page">
                  <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"><option>Letter (8.5 x 11 in)</option></select>
                  <select className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"><option>Margins: Normal</option><option>Narrow</option><option>Wide</option></select>
                  <select value={form.headerPresetId} onChange={(event) => update("headerPresetId", event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    <option value="">Header: organization default</option>
                    {headerPresets.map((item) => <option key={item.id} value={item.id}>Header: {item.name}</option>)}
                  </select>
                  <select value={form.footerPresetId} onChange={(event) => update("footerPresetId", event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    <option value="">Footer: organization default</option>
                    {footerPresets.map((item) => <option key={item.id} value={item.id}>Footer: {item.name}</option>)}
                  </select>
                  <select value={form.signatureBlockId} onChange={(event) => update("signatureBlockId", event.target.value)} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    <option value="">Signature: none</option>
                    {signatures.map((item) => <option key={item.id} value={item.id}>Signature: {item.name}</option>)}
                  </select>
                </PanelSection>
                <PanelSection title="Branding Source">
                  <div className="flex items-start gap-3">
                    <BrandSourceLogo branding={branding} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900">{branding.organizationDisplayName || branding.legalOrganizationName || "Organization"}</p>
                      <p className="text-xs text-gray-500">{formatBrandingAddress(branding) || "No organization address configured."}</p>
                    </div>
                  </div>
                </PanelSection>
              </>
            )}

            {rightTab === "settings" && (
              <>
                <PanelSection title="Template">
                  <label className="block text-xs font-semibold text-gray-600">Subject<input value={form.printSubject} onChange={(event) => update("printSubject", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
                  <label className="block text-xs font-semibold text-gray-600">Category<select value={form.category} onChange={(event) => update("category", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">{CATEGORY_OPTIONS.map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}</select></label>
                  <label className="block text-xs font-semibold text-gray-600">Status<select value={form.status} onChange={(event) => update("status", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">{["DRAFT", "ACTIVE", "ARCHIVED"].map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                  <label className="block text-xs font-semibold text-gray-600">Internal notes<textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" /></label>
                </PanelSection>
                <PanelSection title="Test Preview">
                  <SearchBox label="Constituent" value={constituentQuery} onChange={setConstituentQuery} placeholder="Search name, email, or phone" />
                  {constituentResults.length > 0 && <ResultList>{constituentResults.map((row) => <button key={row.id} type="button" onClick={() => chooseConstituent(row)} className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-gray-50"><span className="font-semibold text-gray-900">{formatConstituentName(row)}</span><span className="block truncate text-gray-500">{row.email || row.phone || row.donorStatus || row.id}</span></button>)}</ResultList>}
                  <SearchBox label="Donation/Gift" value={donationQuery} onChange={setDonationQuery} placeholder="Search gift, donor, campaign" />
                  {donationResults.length > 0 && <ResultList>{donationResults.map((row) => <button key={row.id} type="button" onClick={() => chooseDonation(row)} className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-gray-50"><span className="font-semibold text-gray-900">{formatDonationLabel(row)}</span><span className="block truncate text-gray-500">{row.campaign?.name || row.designation?.name || row.status}</span></button>)}</ResultList>}
                  <SearchBox label="Year" value={previewYear} onChange={setPreviewYear} placeholder="Year" />
                  <button type="button" onClick={() => void runPreview()} className="w-full rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700">Run Preview</button>
                  {previewResult && <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700">Preview ready. Missing fields: 0. Unsupported fields: {previewResult.unsupportedFields.length}.</p>}
                </PanelSection>
              </>
            )}

            <PanelSection title="Merge Health">
              <div data-testid="letter-merge-health" className="grid grid-cols-2 gap-2 text-xs">
                <MetricBox label="Words" value={String(mergeHealth.words)} />
                <MetricBox label="Fields" value={String(mergeHealth.usedTokens.length)} />
              </div>
              {mergeHealth.unsupportedTokens.length > 0 ? (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-2">
                  <p className="text-[11px] font-semibold text-amber-800">Unsupported merge fields detected</p>
                  {mergeHealth.unsupportedTokens.map((token) => <p key={token} className="truncate rounded bg-white px-2 py-1 font-mono text-[10px] text-amber-800">{token}</p>)}
                  <button type="button" onClick={normalizeTokens} className="w-full rounded-md border border-amber-300 bg-white px-2 py-1.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100">Normalize Legacy Tokens</button>
                </div>
              ) : (
                <div className="rounded-lg border border-green-200 bg-green-50 px-2 py-1.5 text-[11px] text-green-700">All good</div>
              )}
            </PanelSection>
          </div>
        </aside>
      </div>

      <div data-testid="letter-bottom-status" className="absolute bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 px-5 py-2 text-xs text-gray-500 backdrop-blur">
        Words: {mergeHealth.words} | Characters: {mergeHealth.characters} | Read time: {Math.max(1, Math.ceil(mergeHealth.words / 180))} min | {isDirty ? "Unsaved changes" : "Saved a few seconds ago"} | {mergeHealth.unsupportedTokens.length === 0 ? "All good" : `${mergeHealth.unsupportedTokens.length} unsupported fields`}
      </div>

      {isPublishConfirmOpen && (
        <WorkspaceSetupModal
          title="Confirm Publish"
          subtitle="Publishing opens the production handoff choices. Nothing is sent or queued until you choose a generation workflow."
          onClose={() => setIsPublishConfirmOpen(false)}
          maxWidthClassName="max-w-lg"
        >
          <div className="space-y-4 px-6 pb-6 pt-14">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Review preview output and merge health before publishing. Unsupported fields: {mergeHealth.unsupportedTokens.length}.
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setIsPublishConfirmOpen(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Cancel</button>
              <button
                type="button"
                onClick={() => {
                  setIsPublishConfirmOpen(false);
                  void openPublishWorkspace();
                }}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
              >
                Continue to Publish
              </button>
            </div>
          </div>
        </WorkspaceSetupModal>
      )}

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

      {isPrintPreviewOpen && (
        <WorkspaceSetupModal
          title="Print Preview"
          subtitle="Rendered print layout preview using current merge context, branding presets, and signature settings."
          onClose={() => setIsPrintPreviewOpen(false)}
          maxWidthClassName="max-w-6xl"
        >
          <div className="space-y-4 px-6 pb-6 pt-14">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <span>Preview target: {selectedConstituent ? formatConstituentName(selectedConstituent) : "No constituent selected"}</span>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                Print This View
              </button>
            </div>
            <div className="max-h-[70vh] overflow-auto rounded-xl border border-gray-200 bg-gray-100 p-3">
              <PrintablePageShell branding={branding} header={selectedHeader} footer={selectedFooter} signature={selectedSignature}>
                <div
                  className={LETTER_BODY_CONTENT_CLASS}
                  dangerouslySetInnerHTML={{ __html: previewResult?.mergedPrintBody || form.printBody || "<p class='text-gray-400'>Run preview to see merged output.</p>" }}
                />
                {previewResult?.unsupportedFields && previewResult.unsupportedFields.length > 0 && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Unsupported fields: {previewResult.unsupportedFields.join(", ")}
                  </div>
                )}
              </PrintablePageShell>
            </div>
          </div>
        </WorkspaceSetupModal>
      )}
    </div>
  );
}

function BuilderTab({ active = false, label, onClick }: { active?: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 whitespace-nowrap border-b-2 px-2.5 text-xs font-semibold ${active ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}
    >
      {label}
    </button>
  );
}

function PanelSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-semibold uppercase text-gray-500">{title}</h2>
      {children}
    </section>
  );
}

function MoreMenuButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="block w-full rounded-lg px-3 py-2 text-left text-gray-700 hover:bg-gray-50">
      {label}
    </button>
  );
}

function InsertBlockButton({ icon, label, onClick, testId }: { icon: LetterBuilderIconName; label: string; onClick: () => void; testId?: string }) {
  return (
    <button data-testid={testId} type="button" onClick={onClick} className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-sm text-gray-700 shadow-sm hover:border-green-200 hover:bg-green-50">
      <span className="flex min-w-0 items-center gap-2">
        <LetterBuilderIcon name={icon} className="h-4 w-4 shrink-0 text-gray-500" />
        <span className="truncate">{label}</span>
      </span>
      <span className="text-gray-300">+</span>
    </button>
  );
}

function RightPanelTabButton({ active = false, label, onClick, testId }: { active?: boolean; label: string; onClick: () => void; testId?: string }) {
  const icon: LetterBuilderIconName = label === "Insert" ? "variable" : label === "Format" ? "text" : label === "Page" ? "header" : "organization";
  return (
    <button data-testid={testId} type="button" onClick={onClick} className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-semibold ${active ? "border-green-600 text-green-700" : "border-transparent text-gray-500 hover:text-gray-800"}`}>
      <LetterBuilderIcon name={icon} className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function MiniFormatButton({ icon, label, onClick, strong = false, italic = false, underline = false }: { icon: LetterBuilderIconName; label: string; onClick: () => void; strong?: boolean; italic?: boolean; underline?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center justify-center rounded-lg border border-gray-200 px-2 py-2 text-xs hover:bg-gray-50 ${strong ? "font-bold" : ""} ${italic ? "italic" : ""} ${underline ? "underline" : ""}`} title={label} aria-label={label}>
      <LetterBuilderIcon name={icon} className="h-4 w-4" />
    </button>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5">
      <p className="text-[10px] uppercase text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
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
