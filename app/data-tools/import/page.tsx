/**
 * Import Constituents page — hosts the VisualImportMapper tool.
 * Route: /data-tools/import
 *
 * Loads existing constituents from the API for duplicate detection,
 * then renders the full visual field-mapping wizard.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ImportWizard from "./ImportWizard";
import { apiFetch } from "@/app/lib/auth-client";
import GuidedImportWizard from "@/app/components/data-tools/GuidedImportWizard";

interface Constituent {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

/** Import constituents page — wraps VisualImportMapper with live CRM data for duplicate detection. */
export default function ImportPage() {
  const [constituents, setConstituents] = useState<Constituent[]>([]);
  const [loading, setLoading] = useState(true);
  const [audienceListMode, setAudienceListMode] = useState(false);
  const [importPreset, setImportPreset] = useState<"generic" | "ekyros" | "hubspot">("generic");
  const [showGuidedEntry, setShowGuidedEntry] = useState(true);

  // Load existing constituents for duplicate email detection
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAudienceListMode(params.get("target") === "list");
    setShowGuidedEntry(params.get("type") !== "contacts" && params.get("target") !== "list");
    const preset = params.get("preset");
    setImportPreset(preset === "hubspot" || preset === "ekyros" ? preset : "generic");
    apiFetch<Constituent[] | { items?: Constituent[] }>("/api/constituents?limit=all")
      .then((data) => {
        setConstituents(Array.isArray(data) ? data : (data as { items?: Constituent[] }).items ?? []);
      })
      .catch(() => { /* silently skip — duplicate detection just won't fire */ })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4 bg-[#f5f5f5] p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#d1d1d1] bg-white px-4 py-4">
        <div className="border-l-4 border-[#0f6cbd] pl-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0f548c]">Data tools</p>
          <h1 className="mt-0.5 text-xl font-semibold text-slate-900">Import center</h1>
          <p className="mt-0.5 text-sm text-slate-600">
            Upload a donor, organization, church, business, or audience CSV file, map fields to your CRM, and review data quality before importing.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <Link href="/data-tools/import/donation" className="border border-[#8a8886] bg-white px-3 py-2 text-slate-700 hover:bg-[#f3f2f1]">Donation import</Link>
          <Link href="/data-tools/import/events-guests" className="border border-[#8a8886] bg-white px-3 py-2 text-slate-700 hover:bg-[#f3f2f1]">Event guests</Link>
          <Link href="/data-tools/merge" className="border border-[#8a8886] bg-white px-3 py-2 text-slate-700 hover:bg-[#f3f2f1]">Resolve duplicates</Link>
          <Link href="/data-tools" className="border border-transparent px-3 py-2 text-[#0f548c] hover:bg-[#eff6fc]">All data tools</Link>
        </div>
      </div>

      <div className="border border-[#e1b96a] bg-[#fff4ce] px-4 py-3 text-sm text-[#5c3b00]">
        Client files should not be imported here. Import Compassion client records in the Compassion CRM client workspace so they stay out of donor data. If a client is also a donor, import them in Compassion first, then intentionally tag or link them as a donor.
      </div>

      {showGuidedEntry ? (
        <GuidedImportWizard />
      ) : loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400">
          Loading CRM data…
        </div>
      ) : (
        <ImportWizard existingConstituents={constituents} defaultAudienceListMode={audienceListMode} defaultImportPreset={importPreset} />
      )}
    </div>
  );
}
