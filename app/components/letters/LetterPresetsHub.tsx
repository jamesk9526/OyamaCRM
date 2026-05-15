/** Presets hub for header/footer/signature libraries used by letter templates. */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import LettersWorkspaceNav from "@/app/components/letters/LettersWorkspaceNav";
import type { FooterPreset, HeaderPreset, SignatureBlock } from "@/app/components/letters/types";

/** Displays preset inventory and quick links into preset management workflows. */
export default function LetterPresetsHub() {
  const [headers, setHeaders] = useState<HeaderPreset[]>([]);
  const [footers, setFooters] = useState<FooterPreset[]>([]);
  const [signatures, setSignatures] = useState<SignatureBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [headerRows, footerRows, signatureRows] = await Promise.all([
        apiFetch<HeaderPreset[]>("/api/letters/header-presets"),
        apiFetch<FooterPreset[]>("/api/letters/footer-presets"),
        apiFetch<SignatureBlock[]>("/api/letters/signatures"),
      ]);
      setHeaders(headerRows);
      setFooters(footerRows);
      setSignatures(signatureRows);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load presets library.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Preset Library</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage reusable header, footer, and signature presets used across templates.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/settings/branding/letter-presets" className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Manage Letter Presets
          </Link>
          <Link href="/settings/branding/signatures" className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Manage Signatures
          </Link>
        </div>
      </div>

      <LettersWorkspaceNav />

      {error && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</div>}

      <section className="grid gap-4 sm:grid-cols-3">
        <article className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Header Presets</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{loading ? "-" : headers.length}</p>
          <p className="mt-1 text-xs text-gray-500">Default and custom letterhead layout presets.</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Footer Presets</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{loading ? "-" : footers.length}</p>
          <p className="mt-1 text-xs text-gray-500">Compliance and organization footer variants.</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs uppercase tracking-wide text-gray-500">Signature Presets</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{loading ? "-" : signatures.length}</p>
          <p className="mt-1 text-xs text-gray-500">Reusable staff sign-off identity blocks.</p>
        </article>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Template and Preset Workflow</h2>
        <p className="text-xs text-gray-600">
          Choose project type, pick template/preset, choose recipients, preview merge output, then generate and route to print, mail, or email draft.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/letters-printables/generate/template" className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
            Start Wizard
          </Link>
          <Link href="/letters-printables/templates" className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Open Template Library
          </Link>
        </div>
      </section>
    </div>
  );
}
