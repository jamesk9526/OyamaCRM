"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import {
  DEFAULT_BRANDING_SETTINGS,
  normalizeBrandingSettings,
  type BrandingSettings,
} from "@/app/lib/branding-settings";
import { buildLetterDocument } from "@/app/lib/letters/letter-document";
import LetterPage from "@/app/components/letters/LetterPage";

interface LetterPrintRouteProps {
  templateId: string;
}

interface PrintableLetterTemplate {
  id: string;
  name: string;
  printSubject?: string | null;
  printBody?: string | null;
}

export default function LetterPrintRoute({ templateId }: LetterPrintRouteProps) {
  const [template, setTemplate] = useState<PrintableLetterTemplate | null>(null);
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [templateResult, brandingResult] = await Promise.all([
        apiFetch<PrintableLetterTemplate>(`/api/letters/templates/${encodeURIComponent(templateId)}`),
        apiFetch<BrandingSettings>("/api/settings/branding"),
      ]);
      setTemplate(templateResult);
      setBranding(normalizeBrandingSettings(brandingResult));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load printable letter.");
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-100 text-sm font-semibold text-slate-600">Loading printable letter...</div>;
  }

  if (error || !template) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center bg-slate-100 p-6">
        <div className="max-w-lg rounded-md border border-amber-200 bg-white p-5 text-sm text-slate-700 shadow-sm">
          <p className="font-semibold text-amber-800">Printable letter unavailable</p>
          <p className="mt-2">{error || "The template could not be loaded."}</p>
          <Link href={`/oyama-letters/templates/${encodeURIComponent(templateId)}`} className="mt-4 inline-flex font-semibold text-emerald-700 hover:underline">Back to builder</Link>
        </div>
      </main>
    );
  }

  const document = buildLetterDocument({
    id: `template-print:${template.id}`,
    templateId: template.id,
    workspace: "oyamaLetters",
    title: template.name,
    branding,
    subject: template.printSubject || template.name,
    salutation: null,
    bodyHtml: template.printBody || "",
  });

  return (
    <main className="min-h-[100dvh] bg-slate-200 py-8 print:bg-white print:p-0">
      <div className="non-printing mx-auto mb-4 flex w-[816px] max-w-[calc(100vw-2rem)] items-center justify-between gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <Link href={`/oyama-letters/templates/${encodeURIComponent(templateId)}`} className="font-semibold text-slate-700 hover:text-emerald-700">Back to builder</Link>
        <button type="button" onClick={() => window.print()} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Print</button>
      </div>
      <div className="mx-auto w-[816px] max-w-[calc(100vw-2rem)] print:w-auto print:max-w-none">
        <LetterPage
          document={document}
          screenShadow={false}
        />
      </div>
    </main>
  );
}
