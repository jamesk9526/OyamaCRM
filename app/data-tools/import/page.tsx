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

interface Constituent {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

/** Import constituents page — wraps VisualImportMapper with live CRM data for duplicate detection. */
export default function ImportPage() {
  const [constituents, setConstituents] = useState<Constituent[]>([]);
  const [loading, setLoading] = useState(true);

  // Load existing constituents for duplicate email detection
  useEffect(() => {
    apiFetch<Constituent[] | { items?: Constituent[] }>("/api/constituents?limit=2000")
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
            Upload a CSV file, map fields to your CRM, and review data quality before importing.
          </p>
        </div>
        <a
          href="/data-tools"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          ← Back to Data Tools
        </a>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-gray-400">
          Loading CRM data…
        </div>
      ) : (
        <ImportWizard existingConstituents={constituents} />
      )}
    </div>
  );
}
