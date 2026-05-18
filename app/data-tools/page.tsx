// Data Tools page: CSV export, data-quality metrics, CSV import wizard, and merge workflow.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MergeWorkflow from "./merge/MergeWorkflow";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import GuidedImportWizard from "@/app/components/data-tools/GuidedImportWizard";

interface Constituent {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  donorStatus: string;
}

interface Donation {
  id: string;
  amount: string | number;
  date: string;
  status: string;
  paymentMethod: string;
  constituent?: { firstName: string; lastName: string; email?: string };
}

/** Data tools page with real CSV exports and live data-quality metrics. */
export default function DataToolsPage() {
  const [constituents, setConstituents] = useState<Constituent[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);

  // Steward Paths CSV import state
  const [spImportStatus, setSpImportStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [spImportResult, setSpImportResult] = useState<{
    created: Array<{ name: string; id: string; stepCount: number }>;
    skipped: string[];
    errors: string[];
    summary: string;
  } | null>(null);
  const spFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [constData, donationData] = await Promise.all([
          apiFetch<Constituent[]>("/api/constituents?limit=500"),
          apiFetch<{ items?: Donation[] } | Donation[]>("/api/donations?limit=500"),
        ]);
        setConstituents(Array.isArray(constData) ? constData : []);
        const d = donationData as { items?: Donation[] };
        setDonations(Array.isArray(donationData) ? donationData : (d.items ?? []));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const quality = useMemo(() => {
    const missingEmail = constituents.filter((c) => !c.email).length;
    const duplicateEmails = constituents
      .map((c) => c.email?.toLowerCase().trim())
      .filter((e): e is string => Boolean(e))
      .reduce<Record<string, number>>((acc, email) => {
        acc[email] = (acc[email] ?? 0) + 1;
        return acc;
      }, {});
    const duplicateCount = Object.values(duplicateEmails).filter((n) => n > 1).length;
    const missingPhone = constituents.filter((c) => !c.phone).length;
    return { missingEmail, duplicateCount, missingPhone };
  }, [constituents]);

  function toCsv(rows: Array<Record<string, unknown>>) {
    if (rows.length === 0) return "";
    const headers = Object.keys(rows[0]);
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
    return [
      headers.join(","),
      ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
    ].join("\n");
  }

  function downloadCsv(filename: string, csv: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function exportConstituents() {
    const csv = toCsv(
      constituents.map((c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email ?? "",
        phone: c.phone ?? "",
        city: c.city ?? "",
        state: c.state ?? "",
        donorStatus: c.donorStatus,
      }))
    );
    downloadCsv("oyamacrm-constituents.csv", csv);
  }

  function exportDonations() {
    const csv = toCsv(
      donations.map((d) => ({
        id: d.id,
        amount: d.amount,
        date: d.date,
        status: d.status,
        paymentMethod: d.paymentMethod,
        donor: d.constituent ? `${d.constituent.firstName} ${d.constituent.lastName}` : "",
        donorEmail: d.constituent?.email ?? "",
      }))
    );
    downloadCsv("oyamacrm-donations.csv", csv);
  }

  function scrollToSection(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function handleStewardPathsCsvImport(file: File) {
    setSpImportStatus("uploading");
    setSpImportResult(null);
    try {
      const text = await file.text();
      const result = await apiFetch<{
        created: Array<{ name: string; id: string; stepCount: number }>;
        skipped: string[];
        errors: string[];
        summary: string;
      }>("/api/steward-paths/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text }),
      });
      setSpImportResult(result);
      setSpImportStatus("done");
    } catch (err) {
      setSpImportResult(null);
      setSpImportStatus("error");
      console.error("Steward Paths CSV import failed:", err);
    }
  }

  return (
    <div className="space-y-6">
      <WorkspaceBreadcrumbBar
        items={[
          { label: "Donor CRM", href: "/" },
          { label: "Data Tools" },
        ]}
        metadata={`${constituents.length} constituents · ${donations.length} donations loaded`}
      />

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Import">
          <WorkspaceRibbonButton label="Guided Import" href="/data-tools/import" variant="primary" />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Export">
          <WorkspaceRibbonButton label="Export Constituents" onClick={exportConstituents} disabled={loading} />
          <WorkspaceRibbonButton label="Export Donations" onClick={exportDonations} disabled={loading} />
        </WorkspaceRibbonGroup>

        <WorkspaceRibbonGroup label="Quality">
          <WorkspaceRibbonButton label="Import Area" onClick={() => scrollToSection("data-tools-import")} />
          <WorkspaceRibbonButton label="Quality Metrics" onClick={() => scrollToSection("data-tools-quality")} />
          <WorkspaceRibbonButton label="Merge Records" onClick={() => scrollToSection("data-tools-merge")} />
          <WorkspaceRibbonButton label="Steward Paths" onClick={() => scrollToSection("data-tools-steward-paths")} />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <GuidedImportWizard />

      <div id="data-tools-import" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Use Guided Import for contacts, audience lists, donations, and Compassion client files. The wizard routes each file to the correct importer and keeps client data out of Donor CRM.
      </div>

      {/* ── Export Data ── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Export Data</h2>
        <p className="text-sm text-gray-500">Download live CRM records as CSV.</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={exportConstituents} disabled={loading}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            Export Constituents (CSV)
          </button>
          <button onClick={exportDonations} disabled={loading}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            Export Donations (CSV)
          </button>
        </div>
      </div>

      {/* ── Data Quality ── */}
      <div id="data-tools-quality" className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Data Quality</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <QualityCard label="Missing Email" value={quality.missingEmail} hint="Profiles without an email address." />
          <QualityCard label="Duplicate Emails" value={quality.duplicateCount} hint="Email addresses used on multiple profiles." />
          <QualityCard label="Missing Phone" value={quality.missingPhone} hint="Profiles with no phone number." />
        </div>
      </div>

      {/* ── Merge Duplicate Records ── */}
      <div id="data-tools-merge">
        <MergeWorkflow constituents={constituents} />
      </div>

      {/* ── Steward Paths Workflow Import ── */}
      <div id="data-tools-steward-paths" className="bg-white rounded-lg border border-gray-200 p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Steward Paths — Import from CSV</h2>
          <p className="text-sm text-gray-500 mt-1">
            Upload a CSV file to automatically generate one or more Steward Path workflows. Each unique workflow in the CSV becomes a new path in Draft status.
          </p>
        </div>

        {/* Instructions */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
          <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">How to build a Steward Paths CSV</p>
          <ol className="list-decimal list-inside space-y-1.5 text-sm text-blue-800">
            <li><span className="font-medium">Download the sample CSV</span> below and open it in Excel or Google Sheets.</li>
            <li>Each <span className="font-medium">row is one step</span>. Multiple rows with the same <code className="bg-blue-100 px-1 rounded text-xs">workflow_name</code> create steps in a single workflow.</li>
            <li>Set <code className="bg-blue-100 px-1 rounded text-xs">step_order</code> (1, 2, 3…) to control step sequence within a workflow.</li>
            <li>
              Use one of these values for <code className="bg-blue-100 px-1 rounded text-xs">step_type</code>:
              <span className="ml-1 font-mono text-xs">DELAY · CREATE_TASK · GENERATE_LETTER · DRAFT_EMAIL · MANUAL_ACTION · INTERNAL_NOTE · STATUS_CHANGE</span>
            </li>
            <li>For <span className="font-medium">DELAY</span> steps, set <code className="bg-blue-100 px-1 rounded text-xs">delay_days</code> to a number of days to wait.</li>
            <li>For <span className="font-medium">CREATE_TASK</span> steps, fill in <code className="bg-blue-100 px-1 rounded text-xs">task_title</code> and optionally <code className="bg-blue-100 px-1 rounded text-xs">task_priority</code> (LOW / NORMAL / HIGH).</li>
            <li>For <span className="font-medium">DRAFT_EMAIL</span> steps, fill in <code className="bg-blue-100 px-1 rounded text-xs">email_subject</code> and <code className="bg-blue-100 px-1 rounded text-xs">email_body_preview</code>.</li>
            <li>Leave unused columns blank — they are safely ignored for each step type.</li>
            <li>Save as <span className="font-medium">.csv</span> and upload below. All imported workflows will be in <span className="font-medium">Draft</span> status so you can review and activate them from the Steward Paths workspace.</li>
          </ol>
          <div className="pt-1">
            <a
              href="/samples/steward-paths-sample.csv"
              download="steward-paths-sample.csv"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 border border-blue-300 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Sample CSV
            </a>
          </div>
        </div>

        {/* Upload area */}
        <div>
          <input
            ref={spFileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleStewardPathsCsvImport(file);
              // Reset so the same file can be re-uploaded if needed
              e.target.value = "";
            }}
          />
          <button
            type="button"
            disabled={spImportStatus === "uploading"}
            onClick={() => { setSpImportStatus("idle"); setSpImportResult(null); spFileInputRef.current?.click(); }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {spImportStatus === "uploading" ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Importing…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload Steward Paths CSV
              </>
            )}
          </button>
        </div>

        {/* Import result */}
        {spImportStatus === "error" && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Import failed. Please check the CSV format and try again.
          </div>
        )}

        {spImportStatus === "done" && spImportResult && (
          <div className="space-y-3">
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
              <p className="text-sm font-semibold text-green-800">{spImportResult.summary}</p>
            </div>

            {spImportResult.created.length > 0 && (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Created Workflows</p>
                </div>
                <ul className="divide-y divide-gray-100">
                  {spImportResult.created.map((item) => (
                    <li key={item.id} className="flex items-center justify-between px-4 py-2.5">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-400">{item.stepCount} step{item.stepCount !== 1 ? "s" : ""} · Draft</p>
                      </div>
                      <a
                        href="/steward-paths"
                        className="text-xs font-medium text-green-700 hover:text-green-900"
                      >
                        Open Steward Paths →
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {spImportResult.skipped.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Skipped</p>
                <ul className="space-y-0.5">
                  {spImportResult.skipped.map((msg, i) => (
                    <li key={i} className="text-xs text-amber-700">{msg}</li>
                  ))}
                </ul>
              </div>
            )}

            {spImportResult.errors.length > 0 && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-1">Row Errors</p>
                <ul className="space-y-0.5">
                  {spImportResult.errors.map((msg, i) => (
                    <li key={i} className="text-xs text-red-600">{msg}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function QualityCard({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 bg-gray-50">
      <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${value > 0 ? "text-amber-600" : "text-green-600"}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{hint}</p>
    </div>
  );
}
