/**
 * Import Constituents page — hosts the VisualImportMapper tool.
 * Route: /data-tools/import
 *
 * Loads existing constituents from the API for duplicate detection,
 * then renders the full visual field-mapping wizard.
 */
"use client";

import { useEffect, useState } from "react";
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Import Constituents</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Upload a donor, organization, church, business, or audience CSV file, map fields to your CRM, and review data quality before importing.
          </p>
        </div>
        <a
          href="/data-tools"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          ← Back to Data Tools
        </a>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
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
