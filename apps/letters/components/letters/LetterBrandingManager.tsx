/** Editable header and footer preset manager for printable letter branding. */
"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/auth-client";
import {
  DEFAULT_BRANDING_SETTINGS,
  fetchBrandingSettings,
  formatBrandingAddress,
  type BrandingSettings,
} from "@/lib/branding-settings";
import type { FooterPreset, HeaderPreset } from "@/components/letters/types";

type PresetTab = "headers" | "footers";

interface HeaderForm {
  name: string;
  logoAlignment: string;
  showOrganizationName: boolean;
  showTagline: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showWebsite: boolean;
  customHtml: string;
  isDefault: boolean;
  isActive: boolean;
}

interface FooterForm {
  name: string;
  showOrganizationName: boolean;
  showAddress: boolean;
  showPhone: boolean;
  showEmail: boolean;
  showWebsite: boolean;
  showTaxId: boolean;
  showPageNumber: boolean;
  customText: string;
  customHtml: string;
  isDefault: boolean;
  isActive: boolean;
}

const EMPTY_HEADER: HeaderForm = {
  name: "",
  logoAlignment: "LEFT",
  showOrganizationName: true,
  showTagline: false,
  showAddress: true,
  showPhone: true,
  showWebsite: true,
  customHtml: "",
  isDefault: false,
  isActive: true,
};

const EMPTY_FOOTER: FooterForm = {
  name: "",
  showOrganizationName: true,
  showAddress: true,
  showPhone: true,
  showEmail: true,
  showWebsite: true,
  showTaxId: false,
  showPageNumber: false,
  customText: "",
  customHtml: "",
  isDefault: false,
  isActive: true,
};

/** Manages letter branding presets that can be reused by templates. */
export default function LetterBrandingManager() {
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<PresetTab>("headers");
  const [headers, setHeaders] = useState<HeaderPreset[]>([]);
  const [footers, setFooters] = useState<FooterPreset[]>([]);
  const [selectedHeaderId, setSelectedHeaderId] = useState<string | null>(null);
  const [selectedFooterId, setSelectedFooterId] = useState<string | null>(null);
  const [headerForm, setHeaderForm] = useState<HeaderForm>(EMPTY_HEADER);
  const [footerForm, setFooterForm] = useState<FooterForm>(EMPTY_FOOTER);
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedHeader = useMemo(() => headers.find((item) => item.id === selectedHeaderId) ?? null, [headers, selectedHeaderId]);
  const selectedFooter = useMemo(() => footers.find((item) => item.id === selectedFooterId) ?? null, [footers, selectedFooterId]);

  useEffect(() => {
    const tabQuery = searchParams.get("tab");
    if (tabQuery === "headers" || tabQuery === "footers") {
      setTab(tabQuery);
    }
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [headerRows, footerRows, brandingRows] = await Promise.all([
        apiFetch<HeaderPreset[]>("/api/letters/header-presets"),
        apiFetch<FooterPreset[]>("/api/letters/footer-presets"),
        fetchBrandingSettings(),
      ]);
      setHeaders(headerRows);
      setFooters(footerRows);
      setBranding(brandingRows);
      if (!selectedHeaderId && headerRows.length > 0) setSelectedHeaderId(headerRows[0].id);
      if (!selectedFooterId && footerRows.length > 0) setSelectedFooterId(footerRows[0].id);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load branding presets.");
    } finally {
      setLoading(false);
    }
  }, [selectedFooterId, selectedHeaderId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedHeader) {
      setHeaderForm(EMPTY_HEADER);
      return;
    }
    setHeaderForm({
      name: selectedHeader.name,
      logoAlignment: selectedHeader.logoAlignment ?? "LEFT",
      showOrganizationName: selectedHeader.showOrganizationName ?? true,
      showTagline: selectedHeader.showTagline ?? false,
      showAddress: selectedHeader.showAddress ?? true,
      showPhone: selectedHeader.showPhone ?? true,
      showWebsite: selectedHeader.showWebsite ?? true,
      customHtml: selectedHeader.customHtml ?? "",
      isDefault: selectedHeader.isDefault,
      isActive: selectedHeader.isActive,
    });
  }, [selectedHeader]);

  useEffect(() => {
    if (!selectedFooter) {
      setFooterForm(EMPTY_FOOTER);
      return;
    }
    setFooterForm({
      name: selectedFooter.name,
      showOrganizationName: selectedFooter.showOrganizationName ?? true,
      showAddress: selectedFooter.showAddress ?? true,
      showPhone: selectedFooter.showPhone ?? true,
      showEmail: selectedFooter.showEmail ?? true,
      showWebsite: selectedFooter.showWebsite ?? true,
      showTaxId: selectedFooter.showTaxId ?? false,
      showPageNumber: selectedFooter.showPageNumber ?? false,
      customText: selectedFooter.customText ?? "",
      customHtml: selectedFooter.customHtml ?? "",
      isDefault: selectedFooter.isDefault,
      isActive: selectedFooter.isActive,
    });
  }, [selectedFooter]);

  async function saveHeader() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = { ...headerForm, customHtml: headerForm.customHtml || null };
      const result = selectedHeaderId
        ? await apiFetch<HeaderPreset>(`/api/letters/header-presets/${selectedHeaderId}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await apiFetch<HeaderPreset>("/api/letters/header-presets", { method: "POST", body: JSON.stringify(payload) });
      setSelectedHeaderId(result.id);
      await load();
      setMessage("Header preset saved.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save header preset.");
    } finally {
      setSaving(false);
    }
  }

  async function saveFooter() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        ...footerForm,
        customText: footerForm.customText || null,
        customHtml: footerForm.customHtml || null,
      };
      const result = selectedFooterId
        ? await apiFetch<FooterPreset>(`/api/letters/footer-presets/${selectedFooterId}`, { method: "PATCH", body: JSON.stringify(payload) })
        : await apiFetch<FooterPreset>("/api/letters/footer-presets", { method: "POST", body: JSON.stringify(payload) });
      setSelectedFooterId(result.id);
      await load();
      setMessage("Footer preset saved.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save footer preset.");
    } finally {
      setSaving(false);
    }
  }

  function startNewHeader() {
    setSelectedHeaderId(null);
    setHeaderForm({ ...EMPTY_HEADER, name: "New Header Preset" });
    setTab("headers");
  }

  function startNewFooter() {
    setSelectedFooterId(null);
    setFooterForm({ ...EMPTY_FOOTER, name: "New Footer Preset" });
    setTab("footers");
  }

  return (
    <div className="space-y-4 pt-2">
      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>}
      {message && <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <TabButton active={tab === "headers"} label={`Headers (${headers.length})`} onClick={() => setTab("headers")} />
          <TabButton active={tab === "footers"} label={`Footers (${footers.length})`} onClick={() => setTab("footers")} />
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={startNewHeader} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">New Header</button>
          <button type="button" onClick={startNewFooter} className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">New Footer</button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-900">{tab === "headers" ? "Header Presets" : "Footer Presets"}</h2>
          <div className="mt-3 space-y-2">
            {loading ? <p className="text-sm text-gray-500">Loading...</p> : (tab === "headers" ? headers : footers).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => tab === "headers" ? setSelectedHeaderId(item.id) : setSelectedFooterId(item.id)}
                className={`w-full rounded-lg border px-3 py-2 text-left ${item.id === (tab === "headers" ? selectedHeaderId : selectedFooterId) ? "border-green-300 bg-green-50" : "border-gray-200 hover:bg-gray-50"}`}
              >
                <p className="truncate text-sm font-semibold text-gray-900">{item.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">{item.isDefault ? "Default" : "Custom"} · {item.isActive ? "Active" : "Inactive"}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          {tab === "headers" ? (
            <HeaderEditor form={headerForm} setForm={setHeaderForm} saving={saving} onSave={() => void saveHeader()} />
          ) : (
            <FooterEditor form={footerForm} setForm={setFooterForm} saving={saving} onSave={() => void saveFooter()} />
          )}

          <PresetPreview branding={branding} header={headerForm} footer={footerForm} tab={tab} />
        </section>
      </div>
    </div>
  );
}

function HeaderEditor({ form, setForm, saving, onSave }: { form: HeaderForm; setForm: (next: HeaderForm) => void; saving: boolean; onSave: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-900">Header Editor</h2>
      <Field label="Preset Name"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></Field>
      <Field label="Logo Alignment">
        <select value={form.logoAlignment} onChange={(event) => setForm({ ...form, logoAlignment: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
          {["LEFT", "CENTER", "RIGHT", "NONE"].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </Field>
      <ToggleGrid>
        <Toggle label="Organization Name" checked={form.showOrganizationName} onChange={(value) => setForm({ ...form, showOrganizationName: value })} />
        <Toggle label="Tagline" checked={form.showTagline} onChange={(value) => setForm({ ...form, showTagline: value })} />
        <Toggle label="Address" checked={form.showAddress} onChange={(value) => setForm({ ...form, showAddress: value })} />
        <Toggle label="Phone" checked={form.showPhone} onChange={(value) => setForm({ ...form, showPhone: value })} />
        <Toggle label="Website" checked={form.showWebsite} onChange={(value) => setForm({ ...form, showWebsite: value })} />
        <Toggle label="Default" checked={form.isDefault} onChange={(value) => setForm({ ...form, isDefault: value })} />
        <Toggle label="Active" checked={form.isActive} onChange={(value) => setForm({ ...form, isActive: value })} />
      </ToggleGrid>
      <Field label="Custom Header HTML">
        <textarea value={form.customHtml} onChange={(event) => setForm({ ...form, customHtml: event.target.value })} rows={4} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs" />
      </Field>
      <button type="button" onClick={onSave} disabled={saving || !form.name.trim()} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">{saving ? "Saving..." : "Save Header Preset"}</button>
    </div>
  );
}

function FooterEditor({ form, setForm, saving, onSave }: { form: FooterForm; setForm: (next: FooterForm) => void; saving: boolean; onSave: () => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-gray-900">Footer Editor</h2>
      <Field label="Preset Name"><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" /></Field>
      <ToggleGrid>
        <Toggle label="Organization Name" checked={form.showOrganizationName} onChange={(value) => setForm({ ...form, showOrganizationName: value })} />
        <Toggle label="Address" checked={form.showAddress} onChange={(value) => setForm({ ...form, showAddress: value })} />
        <Toggle label="Phone" checked={form.showPhone} onChange={(value) => setForm({ ...form, showPhone: value })} />
        <Toggle label="Email" checked={form.showEmail} onChange={(value) => setForm({ ...form, showEmail: value })} />
        <Toggle label="Website" checked={form.showWebsite} onChange={(value) => setForm({ ...form, showWebsite: value })} />
        <Toggle label="Tax ID" checked={form.showTaxId} onChange={(value) => setForm({ ...form, showTaxId: value })} />
        <Toggle label="Page Number" checked={form.showPageNumber} onChange={(value) => setForm({ ...form, showPageNumber: value })} />
        <Toggle label="Default" checked={form.isDefault} onChange={(value) => setForm({ ...form, isDefault: value })} />
        <Toggle label="Active" checked={form.isActive} onChange={(value) => setForm({ ...form, isActive: value })} />
      </ToggleGrid>
      <Field label="Custom Footer Text">
        <textarea value={form.customText} onChange={(event) => setForm({ ...form, customText: event.target.value })} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
      </Field>
      <Field label="Custom Footer HTML">
        <textarea value={form.customHtml} onChange={(event) => setForm({ ...form, customHtml: event.target.value })} rows={4} className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs" />
      </Field>
      <button type="button" onClick={onSave} disabled={saving || !form.name.trim()} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60">{saving ? "Saving..." : "Save Footer Preset"}</button>
    </div>
  );
}

function PresetPreview({ branding, header, footer, tab }: { branding: BrandingSettings; header: HeaderForm; footer: FooterForm; tab: PresetTab }) {
  const orgName = branding.organizationDisplayName || branding.legalOrganizationName || "Organization Name";
  const address = formatBrandingAddress(branding);
  const customHtml = tab === "headers" ? header.customHtml.trim() : footer.customHtml.trim();
  const headerCustomHtml = header.customHtml.trim();
  const footerCustomHtml = footer.customHtml.trim();
  const htmlPreviewDoc = buildHtmlPreviewDocument(customHtml);
  const footerContactLine = [
    footer.showPhone ? branding.contactPhone : "",
    footer.showEmail ? branding.contactEmail : "",
    footer.showWebsite ? branding.websiteUrl : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Rendered Letter Preview</p>
      <div className="mx-auto max-w-[620px] rounded border border-gray-300 bg-white p-8 shadow-sm">
        <header className={`border-b pb-4 ${header.logoAlignment === "CENTER" ? "text-center" : header.logoAlignment === "RIGHT" ? "text-right" : "text-left"}`} style={{ borderColor: branding.primaryColor }}>
          {headerCustomHtml ? (
            <div
              className="text-sm text-gray-700 [&_img]:max-w-full [&_img]:h-auto [&_p]:my-1"
              dangerouslySetInnerHTML={{ __html: headerCustomHtml }}
            />
          ) : (
            <>
              {tab === "headers" && header.logoAlignment !== "NONE" && <div className="mb-2 inline-flex h-10 w-16 items-center justify-center rounded border text-[10px] text-gray-400">Logo</div>}
              {header.showOrganizationName && <p className="font-semibold text-gray-900">{orgName}</p>}
              {header.showTagline && branding.tagline && <p className="text-xs text-gray-500">{branding.tagline}</p>}
              {header.showAddress && address && <p className="text-xs text-gray-500">{address}</p>}
              {header.showPhone && branding.contactPhone && <p className="text-xs text-gray-500">{branding.contactPhone}</p>}
              {header.showWebsite && branding.websiteUrl && <p className="text-xs text-gray-500">{branding.websiteUrl}</p>}
            </>
          )}
        </header>
        <main className="min-h-40 py-8 text-sm text-gray-500">Letter content appears here.</main>
        <footer className="border-t pt-3 text-center text-[11px] text-gray-500">
          {footerCustomHtml ? (
            <div
              className="text-sm text-gray-700 [&_img]:max-w-full [&_img]:h-auto [&_p]:my-1"
              dangerouslySetInnerHTML={{ __html: footerCustomHtml }}
            />
          ) : (
            <>
              {footer.showOrganizationName && <p className="font-semibold text-gray-700">{orgName}</p>}
              {footer.showAddress && address && <p>{address}</p>}
              {footerContactLine && <p>{footerContactLine}</p>}
              {footer.showTaxId && branding.taxId && <p>Tax ID: {branding.taxId}</p>}
              {footer.customText && <p className="whitespace-pre-line">{footer.customText}</p>}
              {footer.showPageNumber && <p>Page 1</p>}
            </>
          )}
        </footer>
      </div>

      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Custom HTML Preview</p>
        <p className="mt-1 text-xs text-gray-600">
          {tab === "headers" ? "Header HTML renders here using a sandboxed preview surface." : "Footer HTML renders here using a sandboxed preview surface."}
        </p>
        {customHtml ? (
          <div className="mt-3 space-y-3">
            <iframe
              title={tab === "headers" ? "Header HTML preview" : "Footer HTML preview"}
              sandbox=""
              srcDoc={htmlPreviewDoc}
              className="h-44 w-full rounded-md border border-gray-200 bg-white"
            />
            <details className="rounded-md border border-gray-200 bg-gray-50 p-2">
              <summary className="cursor-pointer text-xs font-semibold text-gray-700">View raw HTML</summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-white p-2 font-mono text-[11px] text-gray-700">{customHtml}</pre>
            </details>
          </div>
        ) : (
          <div className="mt-3 rounded-md border border-dashed border-gray-300 bg-gray-50 px-3 py-4 text-xs text-gray-500">
            Add custom HTML in the editor above to render a live preview.
          </div>
        )}
      </div>
    </div>
  );
}

function buildHtmlPreviewDocument(customHtml: string): string {
  return [
    "<!DOCTYPE html>",
    "<html>",
    "<head>",
    "<meta charset=\"utf-8\" />",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />",
    "<style>",
    "body { margin: 0; padding: 12px; font-family: Segoe UI, Arial, sans-serif; color: #1f2937; background: #ffffff; }",
    "img { max-width: 100%; height: auto; }",
    "table { width: 100%; border-collapse: collapse; }",
    "th, td { border: 1px solid #d1d5db; padding: 6px; }",
    "</style>",
    "</head>",
    "<body>",
    customHtml,
    "</body>",
    "</html>",
  ].join("");
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`rounded-lg border px-3 py-2 text-xs font-semibold ${active ? "border-green-600 bg-green-50 text-green-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>{label}</button>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block text-xs font-semibold text-gray-600">{label}<div className="mt-1">{children}</div></label>;
}

function ToggleGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{children}</div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-green-600" />
      {label}
    </label>
  );
}
