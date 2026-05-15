/** Branding preset manager for letter headers and footers. */
"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { FooterPreset, HeaderPreset } from "@/app/components/letters/types";

/** Manages letter branding presets that can be reused by templates. */
export default function LetterBrandingManager() {
  const [headers, setHeaders] = useState<HeaderPreset[]>([]);
  const [footers, setFooters] = useState<FooterPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headerName, setHeaderName] = useState("");
  const [footerName, setFooterName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [headerRows, footerRows] = await Promise.all([
        apiFetch<HeaderPreset[]>("/api/letters/header-presets"),
        apiFetch<FooterPreset[]>("/api/letters/footer-presets"),
      ]);
      setHeaders(headerRows);
      setFooters(footerRows);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load branding presets.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Creates a minimal header preset with organization defaults enabled. */
  async function createHeader() {
    await apiFetch("/api/letters/header-presets", {
      method: "POST",
      body: JSON.stringify({
        name: headerName,
        logoAlignment: "LEFT",
        showOrganizationName: true,
        showAddress: true,
        showPhone: true,
        showWebsite: true,
      }),
    });
    setHeaderName("");
    await load();
  }

  /** Creates a minimal footer preset with default donor communication fields. */
  async function createFooter() {
    await apiFetch("/api/letters/footer-presets", {
      method: "POST",
      body: JSON.stringify({
        name: footerName,
        showOrganizationName: true,
        showAddress: true,
        showPhone: true,
        showEmail: false,
        showWebsite: true,
      }),
    });
    setFooterName("");
    await load();
  }

  /** Toggles default header preset while preserving one-default semantics server-side. */
  async function makeHeaderDefault(item: HeaderPreset) {
    await apiFetch(`/api/letters/header-presets/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isDefault: true }),
    });
    await load();
  }

  /** Toggles default footer preset while preserving one-default semantics server-side. */
  async function makeFooterDefault(item: FooterPreset) {
    await apiFetch(`/api/letters/footer-presets/${item.id}`, {
      method: "PATCH",
      body: JSON.stringify({ isDefault: true }),
    });
    await load();
  }

  return (
    <div className="space-y-5 pt-2">
      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>}

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Header Presets</h2>
        <div className="flex gap-2">
          <input value={headerName} onChange={(event) => setHeaderName(event.target.value)} placeholder="Header preset name" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <button onClick={() => void createHeader()} className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700">Add</button>
        </div>
        <div className="space-y-2">
          {loading ? <p className="text-sm text-gray-500">Loading...</p> : headers.map((item) => (
            <div key={item.id} className="rounded-lg border border-gray-200 p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                <p className="text-xs text-gray-500">Alignment: {item.logoAlignment}</p>
              </div>
              <button onClick={() => void makeHeaderDefault(item)} className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50">
                {item.isDefault ? "Default" : "Make Default"}
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Footer Presets</h2>
        <div className="flex gap-2">
          <input value={footerName} onChange={(event) => setFooterName(event.target.value)} placeholder="Footer preset name" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <button onClick={() => void createFooter()} className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700">Add</button>
        </div>
        <div className="space-y-2">
          {loading ? <p className="text-sm text-gray-500">Loading...</p> : footers.map((item) => (
            <div key={item.id} className="rounded-lg border border-gray-200 p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{item.name}</p>
              </div>
              <button onClick={() => void makeFooterDefault(item)} className="px-3 py-1.5 text-xs rounded border border-gray-300 text-gray-700 hover:bg-gray-50">
                {item.isDefault ? "Default" : "Make Default"}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
