/** Branding settings workspace for identity defaults consumed by Email Builder and other modules. */
"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
            <Field label="Primary Logo URL">
              <input value={form.logoUrl} onChange={(e) => setField("logoUrl", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://.../logo.png" />
            </Field>
            <Field label="Square Logo URL">
              <input value={form.logoSquareUrl} onChange={(e) => setField("logoSquareUrl", e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="https://.../logo-square.png" />
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
