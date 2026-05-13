/** Create/edit form for one letters template with merge-field awareness. */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import LettersWorkspaceNav from "@/app/components/letters/LettersWorkspaceNav";
import FormLetterRichEditor from "@/app/components/letters/FormLetterRichEditor";
import PrintLayoutBuilder from "@/app/components/letters/PrintLayoutBuilder";
import { bodyToPrintLayout, parsePrintLayout, printLayoutToBody } from "@/app/components/letters/print-layout-utils";
import type { FooterPreset, HeaderPreset, MergeFieldSection, PrintLayoutDocument, SignatureBlock } from "@/app/components/letters/types";

const EDITOR_TABS = ["setup", "print", "email", "branding", "merge", "preview"] as const;

type EditorTab = (typeof EDITOR_TABS)[number];
type PrintEditorMode = "TEXT" | "VISUAL";

const VISUAL_PRINT_BUILDER_ENABLED = process.env.NEXT_PUBLIC_FEATURE_LETTERS_VISUAL_BUILDER === "true";

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

interface LetterTemplateEditorProps {
  templateId?: string;
}

/** Renders form sections for creating and editing donor letter templates. */
export default function LetterTemplateEditor({ templateId }: LetterTemplateEditorProps) {
  const router = useRouter();
  const [tab, setTab] = useState<EditorTab>("setup");
  const [form, setForm] = useState<LetterTemplateForm>(INITIAL_FORM);
  const [loading, setLoading] = useState(Boolean(templateId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(templateId ?? null);
  const [mergeSections, setMergeSections] = useState<MergeFieldSection[]>([]);
  const [headerPresets, setHeaderPresets] = useState<HeaderPreset[]>([]);
  const [footerPresets, setFooterPresets] = useState<FooterPreset[]>([]);
  const [signatures, setSignatures] = useState<SignatureBlock[]>([]);
  const [fieldTarget, setFieldTarget] = useState<"print" | "email">("print");
  const [previewConstituentId, setPreviewConstituentId] = useState("");
  const [previewDonationId, setPreviewDonationId] = useState("");
  const [previewYear, setPreviewYear] = useState(String(new Date().getFullYear()));
  const [previewResult, setPreviewResult] = useState<{
    mergedPrintBody: string;
    mergedEmailBody: string | null;
    unsupportedFields: string[];
  } | null>(null);
  const [printInsertHandler, setPrintInsertHandler] = useState<((token: string) => void) | null>(null);
  const [emailInsertHandler, setEmailInsertHandler] = useState<((token: string) => void) | null>(null);
  const [printEditorMode, setPrintEditorMode] = useState<PrintEditorMode>(VISUAL_PRINT_BUILDER_ENABLED ? "VISUAL" : "TEXT");
  const [printLayout, setPrintLayout] = useState<PrintLayoutDocument>([]);

  const isEdit = Boolean(templateId);

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
    if (!templateId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<TemplatePayload>(`/api/letters/templates/${templateId}`);
      setForm({
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
      });
      const parsedLayout = parsePrintLayout(data.printLayoutJson);
      setPrintLayout(parsedLayout.length > 0 ? parsedLayout : bodyToPrintLayout(data.printBody ?? ""));
      setSavedId(data.id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load template.");
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    void loadSupports();
  }, [loadSupports]);

  useEffect(() => {
    void loadTemplate();
  }, [loadTemplate]);

  /** Applies one form field change while preserving other values. */
  function update<K extends keyof LetterTemplateForm>(key: K, value: LetterTemplateForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  /** Inserts one merge token into the active body editor. */
  function insertField(token: string) {
    const handler = fieldTarget === "print" ? printInsertHandler : emailInsertHandler;
    if (handler) {
      handler(token);
      return;
    }

    if (fieldTarget === "print") {
      update("printBody", `${form.printBody}${form.printBody ? "\n" : ""}${token}`);
    } else {
      update("emailBody", `${form.emailBody}${form.emailBody ? "\n" : ""}${token}`);
    }
  }

  /** Saves template changes by POST (create) or PATCH (update). */
  async function saveTemplate() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        printLayoutJson: printLayout.length > 0 ? printLayout : null,
        description: form.description || null,
        printSubject: form.printSubject || null,
        emailSubject: form.emailSubject || null,
        emailBody: form.emailBody || null,
        headerPresetId: form.headerPresetId || null,
        footerPresetId: form.footerPresetId || null,
        signatureBlockId: form.signatureBlockId || null,
        customLogoUrl: form.customLogoUrl || null,
      };

      if (templateId) {
        const updated = await apiFetch<TemplatePayload>(`/api/letters/templates/${templateId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        setSavedId(updated.id);
      } else {
        const created = await apiFetch<TemplatePayload>("/api/letters/templates", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSavedId(created.id);
        router.replace(`/letters-printables/templates/${created.id}`);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save template.");
    } finally {
      setSaving(false);
    }
  }

  /** Runs one merge preview for the currently saved template. */
  async function runPreview() {
    if (!savedId) {
      setError("Save template first, then run merge preview.");
      return;
    }

    setError(null);
    try {
      const result = await apiFetch<{
        mergedPrintBody: string;
        mergedEmailBody: string | null;
        unsupportedFields: string[];
      }>("/api/letters/generated/preview", {
        method: "POST",
        body: JSON.stringify({
          templateId: savedId,
          constituentId: previewConstituentId || undefined,
          donationId: previewDonationId || undefined,
          year: Number.parseInt(previewYear, 10),
        }),
      });
      setPreviewResult(result);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to run preview.");
    }
  }

  const title = useMemo(() => (isEdit ? "Edit Template" : "New Template"), [isEdit]);

  /** Updates visual blocks and keeps legacy printBody synchronized for compatibility. */
  function updatePrintLayout(nextLayout: PrintLayoutDocument) {
    setPrintLayout(nextLayout);
    update("printBody", printLayoutToBody(nextLayout));
  }

  /** Rebuilds visual blocks from current legacy text content. */
  function convertTextToVisual() {
    updatePrintLayout(bodyToPrintLayout(form.printBody));
    setPrintEditorMode("VISUAL");
  }

  /** Flattens visual blocks into plain text and switches to legacy editor mode. */
  function convertVisualToText() {
    update("printBody", printLayoutToBody(printLayout));
    setPrintEditorMode("TEXT");
  }

  if (loading) {
    return <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">Loading template...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          <p className="mt-0.5 text-sm text-gray-500">Build reusable donor communication templates for print and email delivery.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/letters-printables/templates" className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Back</Link>
          <button
            onClick={() => void saveTemplate()}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Template"}
          </button>
        </div>
      </div>

      <LettersWorkspaceNav />

      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-3">
        {EDITOR_TABS.map((entry) => (
          <button
            key={entry}
            onClick={() => setTab(entry)}
            className={`px-3 py-1.5 rounded-full text-sm border ${tab === entry ? "border-green-600 bg-green-50 text-green-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
          >
            {entry[0].toUpperCase() + entry.slice(1)}
          </button>
        ))}
      </div>

      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>}

      {tab === "setup" && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <label className="block text-sm text-gray-700">
            Name
            <input value={form.name} onChange={(event) => update("name", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <label className="block text-sm text-gray-700">
            Description
            <textarea value={form.description} onChange={(event) => update("description", event.target.value)} rows={3} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm text-gray-700">
              Category
              <select value={form.category} onChange={(event) => update("category", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
                {[
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
                ].map((option) => <option key={option} value={option}>{option.replaceAll("_", " ")}</option>)}
              </select>
            </label>
            <label className="block text-sm text-gray-700">
              Status
              <select value={form.status} onChange={(event) => update("status", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
                {["DRAFT", "ACTIVE", "ARCHIVED"].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="block text-sm text-gray-700">
              CRM Scope
              <select value={form.crmScope} onChange={(event) => update("crmScope", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
                {["DONOR", "EVENTS", "COMPASSION", "GLOBAL"].map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
          </div>
        </section>
      )}

      {tab === "print" && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Print Content</h2>
            <button onClick={() => setFieldTarget("print")} className="text-xs text-green-700">Insert merge fields into print body</button>
          </div>

          {VISUAL_PRINT_BUILDER_ENABLED && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">Editor Mode</span>
              <button
                type="button"
                onClick={() => setPrintEditorMode("VISUAL")}
                className={`rounded-md border px-2.5 py-1 text-xs ${printEditorMode === "VISUAL" ? "border-green-600 bg-green-50 text-green-700" : "border-gray-300 bg-white text-gray-600"}`}
              >
                Visual Builder
              </button>
              <button
                type="button"
                onClick={() => setPrintEditorMode("TEXT")}
                className={`rounded-md border px-2.5 py-1 text-xs ${printEditorMode === "TEXT" ? "border-green-600 bg-green-50 text-green-700" : "border-gray-300 bg-white text-gray-600"}`}
              >
                Text Mode
              </button>
              <button type="button" onClick={convertTextToVisual} className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100">Convert Text to Visual</button>
              <button type="button" onClick={convertVisualToText} className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-100">Flatten Visual to Text</button>
            </div>
          )}

          <label className="block text-sm text-gray-700">
            Print Subject
            <input value={form.printSubject} onChange={(event) => update("printSubject", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>

          {VISUAL_PRINT_BUILDER_ENABLED && printEditorMode === "VISUAL" ? (
            <PrintLayoutBuilder value={printLayout} onChange={updatePrintLayout} />
          ) : (
            <div className="space-y-3">
              <FormLetterRichEditor
                value={form.printBody}
                placeholder="Write the printable letter body with merge fields and page-break markers..."
                onChange={(nextBody) => {
                  update("printBody", nextBody);
                  if (VISUAL_PRINT_BUILDER_ENABLED) {
                    setPrintLayout(bodyToPrintLayout(nextBody));
                  }
                }}
                onRegisterInsert={(handler) => setPrintInsertHandler(() => handler)}
              />

              <div className="rounded-xl border border-gray-300 bg-gray-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Print-Ready Page Preview (8.5 x 11)</p>
                <div className="mx-auto mt-3 w-full max-w-[816px] rounded border border-gray-300 bg-white p-10 shadow-sm">
                  <div className="min-h-[720px] text-[14px] leading-6 text-gray-900 [&_hr[data-page-break='true']]:my-8 [&_hr[data-page-break='true']]:border-t-2 [&_hr[data-page-break='true']]:border-dashed [&_hr[data-page-break='true']]:border-gray-400" dangerouslySetInnerHTML={{ __html: form.printBody || "<p class='text-gray-400'>Letter preview will appear here.</p>" }} />
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {tab === "email" && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Email Content</h2>
            <button onClick={() => setFieldTarget("email")} className="text-xs text-green-700">Insert merge fields into email body</button>
          </div>
          <label className="block text-sm text-gray-700">
            Email Subject
            <input value={form.emailSubject} onChange={(event) => update("emailSubject", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
          </label>
          <FormLetterRichEditor
            value={form.emailBody}
            placeholder="Write the email adaptation of this letter template..."
            minHeight={220}
            onChange={(nextBody) => update("emailBody", nextBody)}
            onRegisterInsert={(handler) => setEmailInsertHandler(() => handler)}
          />
        </section>
      )}

      {tab === "branding" && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Branding & Signature</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm text-gray-700">
              Header Preset
              <select value={form.headerPresetId} onChange={(event) => update("headerPresetId", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
                <option value="">None</option>
                {headerPresets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="block text-sm text-gray-700">
              Footer Preset
              <select value={form.footerPresetId} onChange={(event) => update("footerPresetId", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
                <option value="">None</option>
                {footerPresets.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="block text-sm text-gray-700">
              Signature Block
              <select value={form.signatureBlockId} onChange={(event) => update("signatureBlockId", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
                <option value="">None</option>
                {signatures.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label className="block text-sm text-gray-700">
              Logo Mode
              <select value={form.logoMode} onChange={(event) => update("logoMode", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2">
                {["ORGANIZATION_DEFAULT", "CUSTOM", "NONE"].map((entry) => <option key={entry} value={entry}>{entry.replaceAll("_", " ")}</option>)}
              </select>
            </label>
          </div>
          {form.logoMode === "CUSTOM" && (
            <label className="block text-sm text-gray-700">
              Custom Logo URL
              <input value={form.customLogoUrl} onChange={(event) => update("customLogoUrl", event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2" />
            </label>
          )}
        </section>
      )}

      {tab === "merge" && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Merge Fields</h2>
            <p className="text-xs text-gray-500">Click a token to insert it into the selected editor.</p>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {mergeSections.map((section) => (
              <div key={section.key} className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">{section.label}</p>
                {section.sensitive && <p className="text-[11px] text-amber-700 mt-1">Sensitive giving data</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {section.fields.map((field) => (
                    <button
                      key={field}
                      onClick={() => insertField(field)}
                      className="px-2 py-1 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                    >
                      {field}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "preview" && (
        <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Merge Preview</h2>
          <p className="text-xs text-gray-500">Run a preview against one constituent and optional gift to validate merge output.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <input placeholder="Constituent ID" value={previewConstituentId} onChange={(event) => setPreviewConstituentId(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Donation ID (optional)" value={previewDonationId} onChange={(event) => setPreviewDonationId(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <input placeholder="Year" value={previewYear} onChange={(event) => setPreviewYear(event.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <button onClick={() => void runPreview()} className="px-4 py-2 text-sm rounded-lg bg-green-600 text-white hover:bg-green-700">Run Preview</button>

          {previewResult && (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Print Preview</p>
                <div className="mt-2 rounded border border-gray-200 bg-white p-4 text-sm text-gray-800 [&_hr[data-page-break='true']]:my-6 [&_hr[data-page-break='true']]:border-t-2 [&_hr[data-page-break='true']]:border-dashed [&_hr[data-page-break='true']]:border-gray-400" dangerouslySetInnerHTML={{ __html: previewResult.mergedPrintBody }} />
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Email Preview</p>
                <div className="mt-2 rounded border border-gray-200 bg-white p-4 text-sm text-gray-800" dangerouslySetInnerHTML={{ __html: previewResult.mergedEmailBody || "<p>No email body configured.</p>" }} />
              </div>
              {previewResult.unsupportedFields.length > 0 && (
                <div className="lg:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  Unsupported fields: {previewResult.unsupportedFields.join(", ")}
                </div>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
