/** Branding settings workspace for identity defaults consumed by Email Builder and other modules. */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import {
  DEFAULT_BRANDING_SETTINGS,
  formatBrandingAddress,
  normalizeBrandingSettings,
  type BrandingSettings,
} from "@/app/lib/branding-settings";

/** BrandingSettingsPage persists organization-level identity, color, and contact defaults. */
export default function BrandingSettingsPage() {
  const [form, setForm] = useState<BrandingSettings>(DEFAULT_BRANDING_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState<"primary" | "square" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const primaryLogoInputRef = useRef<HTMLInputElement | null>(null);
  const squareLogoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;

    async function loadBranding() {
      try {
        const payload = await apiFetch<BrandingSettings>("/api/settings/branding");
        if (!active) return;
        setForm(normalizeBrandingSettings(payload));
      } catch (requestError) {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "Failed to load branding settings.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadBranding();
    return () => {
      active = false;
    };
  }, []);

  /** Updates one branding field while clearing stale save messages. */
  function setField<K extends keyof BrandingSettings>(key: K, value: BrandingSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setError(null);
  }

  /** Uploads one branding logo file and writes the returned public URL into the selected logo field. */
  async function uploadLogo(file: File, field: "logoUrl" | "logoSquareUrl") {
    if (!file) return;
    setUploadingLogo(field === "logoUrl" ? "primary" : "square");
    setError(null);
    setUploadMessage(null);

    try {
      const dataBase64 = await readFileAsDataUrl(file);
      const uploaded = await apiFetch<{ url: string }>("/api/settings/branding/logo-upload", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "image/png",
          dataBase64,
          slot: field === "logoUrl" ? "primary" : "square",
        }),
      });
      setField(field, uploaded.url);
      setUploadMessage(`${field === "logoUrl" ? "Primary" : "Square"} logo uploaded. Save Branding Defaults to publish changes.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to upload logo file.");
    } finally {
      setUploadingLogo(null);
      if (field === "logoUrl" && primaryLogoInputRef.current) primaryLogoInputRef.current.value = "";
      if (field === "logoSquareUrl" && squareLogoInputRef.current) squareLogoInputRef.current.value = "";
    }
  }

  /** Saves branding defaults for all downstream module consumers. */
  async function saveBranding(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const payload = await apiFetch<BrandingSettings>("/api/settings/branding", {
        method: "PUT",
        body: JSON.stringify(form),
      });
      setForm(normalizeBrandingSettings(payload));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save branding settings.");
    } finally {
      setSaving(false);
    }
  }

  const computedAddress = useMemo(() => formatBrandingAddress(form), [form]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-7 w-60 animate-pulse rounded bg-gray-200" />
        <div className="h-40 animate-pulse rounded-lg bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pt-2">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {saved && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Branding settings saved.
        </div>
      )}

      {uploadMessage && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {uploadMessage}
        </div>
      )}

      <form onSubmit={saveBranding} className="space-y-5">
        <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Identity</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Organization Display Name">
              <input value={form.organizationDisplayName} onChange={(e) => setField("organizationDisplayName", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Hope Community Foundation" />
            </Field>
            <Field label="Legal Organization Name">
              <input value={form.legalOrganizationName} onChange={(e) => setField("legalOrganizationName", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Hope Community Foundation, Inc." />
            </Field>
            <Field label="Tagline">
              <input value={form.tagline} onChange={(e) => setField("tagline", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Compassion in Action" />
            </Field>
            <Field label="Mission Statement">
              <input value={form.missionStatement} onChange={(e) => setField("missionStatement", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Serving families with practical care and hope." />
            </Field>
            <Field label="Primary Logo (Upload or URL)">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => primaryLogoInputRef.current?.click()}
                    disabled={uploadingLogo === "primary"}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {uploadingLogo === "primary" ? "Uploading..." : "Upload Primary Logo"}
                  </button>
                  <input
                    ref={primaryLogoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadLogo(file, "logoUrl");
                    }}
                  />
                </div>
                {form.logoUrl && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                    <img src={form.logoUrl} alt="Primary logo preview" className="max-h-20 w-auto max-w-full object-contain" />
                  </div>
                )}
                <input value={form.logoUrl} onChange={(e) => setField("logoUrl", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://.../logo.png" />
              </div>
            </Field>
            <Field label="Square Logo (Upload or URL)">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => squareLogoInputRef.current?.click()}
                    disabled={uploadingLogo === "square"}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {uploadingLogo === "square" ? "Uploading..." : "Upload Square Logo"}
                  </button>
                  <input
                    ref={squareLogoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void uploadLogo(file, "logoSquareUrl");
                    }}
                  />
                </div>
                {form.logoSquareUrl && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
                    <img src={form.logoSquareUrl} alt="Square logo preview" className="max-h-20 w-auto max-w-full object-contain" />
                  </div>
                )}
                <input value={form.logoSquareUrl} onChange={(e) => setField("logoSquareUrl", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://.../logo-square.png" />
              </div>
            </Field>
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Theme + Email Defaults</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Primary Color">
              <div className="flex items-center gap-2">
                <input type="color" value={form.primaryColor} onChange={(e) => setField("primaryColor", e.target.value)} className="h-10 w-12 rounded border border-gray-300" />
                <input value={form.primaryColor} onChange={(e) => setField("primaryColor", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </Field>
            <Field label="Accent Color">
              <div className="flex items-center gap-2">
                <input type="color" value={form.accentColor} onChange={(e) => setField("accentColor", e.target.value)} className="h-10 w-12 rounded border border-gray-300" />
                <input value={form.accentColor} onChange={(e) => setField("accentColor", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </Field>
            <Field label="Email Background Color">
              <div className="flex items-center gap-2">
                <input type="color" value={form.emailBackgroundColor} onChange={(e) => setField("emailBackgroundColor", e.target.value)} className="h-10 w-12 rounded border border-gray-300" />
                <input value={form.emailBackgroundColor} onChange={(e) => setField("emailBackgroundColor", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
              </div>
            </Field>
            <Field label="Email Font Family">
              <input value={form.emailFontFamily} onChange={(e) => setField("emailFontFamily", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Arial, Helvetica, sans-serif" />
            </Field>
            <Field label="Email Content Width (px)">
              <input type="number" min={420} max={760} value={form.emailContentWidth} onChange={(e) => setField("emailContentWidth", Number(e.target.value))} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="Footer Legal Text">
              <input value={form.footerLegalText} onChange={(e) => setField("footerLegalText", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="© 2026 Hope Community Foundation. All rights reserved." />
            </Field>
          </div>
        </section>

        <section id="communication-header-footer" className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Communication Header + Footer</h2>
            <p className="mt-1 text-xs text-gray-500">
              These are the only organization-level header and footer blocks. They apply to every OyamaEmail render and every OyamaLetters preview/output.
            </p>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Field label="Global Header HTML">
              <textarea
                value={form.globalHeaderHtml}
                onChange={(e) => setField("globalHeaderHtml", e.target.value)}
                className="min-h-40 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
                placeholder="<div><strong>Your Organization</strong></div>"
              />
            </Field>
            <Field label="Global Footer HTML">
              <textarea
                value={form.globalFooterHtml}
                onChange={(e) => setField("globalFooterHtml", e.target.value)}
                className="min-h-40 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
                placeholder="<div>Address, contact details, and legal text</div>"
              />
            </Field>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Rendered Preview</p>
            <iframe
              title="Communication header and footer preview"
              sandbox=""
              className="h-64 w-full rounded border border-gray-200 bg-white"
              srcDoc={`<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:${escapeAttribute(form.emailFontFamily)};"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${escapeAttribute(form.emailBackgroundColor)};"><tr><td align="center" style="padding:18px;"><table role="presentation" width="${form.emailContentWidth}" cellspacing="0" cellpadding="0" style="max-width:100%;background:#ffffff;border:1px solid #dbe5df;border-radius:10px;overflow:hidden;"><tr><td style="padding:18px 22px;border-bottom:1px solid #e5e7eb;">${form.globalHeaderHtml || `<strong>${escapeHtml(form.organizationDisplayName || "Organization Header")}</strong>`}</td></tr><tr><td style="padding:22px;color:#475569;">Recipient content renders between the global header and footer.</td></tr><tr><td style="padding:18px 22px;border-top:1px solid #e5e7eb;background:#f8fafc;color:#475569;">${form.globalFooterHtml || escapeHtml(form.footerLegalText || computedAddress || "Organization footer")}</td></tr></table></td></tr></table></body></html>`}
            />
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Contact + Location</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Contact Email">
              <input type="email" value={form.contactEmail} onChange={(e) => setField("contactEmail", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="hello@organization.org" />
            </Field>
            <Field label="Contact Phone">
              <input value={form.contactPhone} onChange={(e) => setField("contactPhone", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="(555) 123-4567" />
            </Field>
            <Field label="Website URL">
              <input value={form.websiteUrl} onChange={(e) => setField("websiteUrl", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://organization.org" />
            </Field>
            <Field label="Tax ID / EIN">
              <input value={form.taxId} onChange={(e) => setField("taxId", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="12-3456789" />
            </Field>
            <Field label="Location Name">
              <input value={form.locationName} onChange={(e) => setField("locationName", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Main Office" />
            </Field>
            <Field label="Address Line 1">
              <input value={form.streetAddress1} onChange={(e) => setField("streetAddress1", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="123 Main St" />
            </Field>
            <Field label="Address Line 2">
              <input value={form.streetAddress2} onChange={(e) => setField("streetAddress2", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Suite 200" />
            </Field>
            <Field label="City">
              <input value={form.city} onChange={(e) => setField("city", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="State / Province">
              <input value={form.stateProvince} onChange={(e) => setField("stateProvince", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="Postal Code">
              <input value={form.postalCode} onChange={(e) => setField("postalCode", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </Field>
            <Field label="Country">
              <input value={form.country} onChange={(e) => setField("country", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </Field>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Combined address preview: {computedAddress || "No address configured yet."}
          </div>
        </section>

        <section className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900">Social Profiles</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Facebook URL">
              <input value={form.socialFacebook} onChange={(e) => setField("socialFacebook", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://facebook.com/..." />
            </Field>
            <Field label="Instagram URL">
              <input value={form.socialInstagram} onChange={(e) => setField("socialInstagram", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://instagram.com/..." />
            </Field>
            <Field label="LinkedIn URL">
              <input value={form.socialLinkedIn} onChange={(e) => setField("socialLinkedIn", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://linkedin.com/..." />
            </Field>
            <Field label="YouTube URL">
              <input value={form.socialYoutube} onChange={(e) => setField("socialYoutube", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://youtube.com/..." />
            </Field>
            <Field label="X / Twitter URL">
              <input value={form.socialX} onChange={(e) => setField("socialX", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://x.com/..." />
            </Field>
          </div>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Branding Defaults"}
          </button>
        </div>
      </form>
    </div>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
}

/** Field wrapper keeps settings form labels and controls visually consistent. */
function Field({ label, children }: FieldProps) {
  return (
    <label className="space-y-1.5">
      <span className="block text-xs font-semibold text-gray-600">{label}</span>
      {children}
    </label>
  );
}

/** Reads a browser File as a base64 data URL for API upload payloads. */
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
