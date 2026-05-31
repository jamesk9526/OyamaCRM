// Data Tools page: CSV export, data-quality metrics, CSV import wizard, and merge workflow.
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import MergeWorkflow from "./merge/MergeWorkflow";
import { apiFetch } from "@/app/lib/auth-client";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import CRMActionBar from "@/app/components/ui/crm/CRMActionBar";
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

interface Campaign {
  id: string;
  name: string;
  active: boolean;
  category?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  goal?: string | number | null;
  totalRaised?: string | number | null;
  _count?: {
    donations?: number;
    pledges?: number;
  };
}

interface Designation {
  id: string;
  name: string;
  description?: string | null;
  active?: boolean;
  _count?: {
    donations?: number;
  };
}

interface ImportHistoryItem {
  runId: string;
  mode: string;
  recordCount: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  rollbackSupported: boolean;
  rolledBackAt: string | null;
  createdAt: string;
  startedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface NameFixIssue {
  key: string;
  constituentId: string;
  reason: string;
  currentFirstName: string;
  currentLastName: string;
  suggestedFirstName: string;
  suggestedLastName: string;
}

interface IgnoredNameFixIssue extends NameFixIssue {
  ignoredAt: string;
}

/** Data tools page with real CSV exports and live data-quality metrics. */
export default function DataToolsPage() {
  const [constituents, setConstituents] = useState<Constituent[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [exporting, setExporting] = useState<"constituents" | "donations" | "campaigns" | "designations" | null>(null);
  const [nameFixOpen, setNameFixOpen] = useState(false);
  const [activeIssueKey, setActiveIssueKey] = useState<string | null>(null);
  const [ignoredNameIssues, setIgnoredNameIssues] = useState<IgnoredNameFixIssue[]>([]);
  const [nameFixDraft, setNameFixDraft] = useState<{ firstName: string; lastName: string }>({ firstName: "", lastName: "" });
  const [nameFixSaving, setNameFixSaving] = useState(false);
  const [nameFixError, setNameFixError] = useState<string | null>(null);

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
      setHistoryLoading(true);
      try {
        const [constData, donationData, importHistoryData] = await Promise.all([
          apiFetch<Constituent[]>("/api/constituents?limit=500"),
          apiFetch<{ items?: Donation[] } | Donation[]>("/api/donations?limit=500"),
          apiFetch<{ items?: ImportHistoryItem[] }>("/api/constituents/import/history?limit=5"),
        ]);
        setConstituents(Array.isArray(constData) ? constData : []);
        const d = donationData as { items?: Donation[] };
        setDonations(Array.isArray(donationData) ? donationData : (d.items ?? []));
        setImportHistory(Array.isArray(importHistoryData.items) ? importHistoryData.items : []);
      } finally {
        setLoading(false);
        setHistoryLoading(false);
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

  const detectedNameIssues = useMemo<NameFixIssue[]>(() => {
    const issues: NameFixIssue[] = [];
    for (const constituent of constituents) {
      const firstName = (constituent.firstName ?? "").trim();
      const lastName = (constituent.lastName ?? "").trim();
      if (!firstName) continue;

      const commaMatch = firstName.match(/^\s*([^,]+),\s*(.+)\s*$/);
      if (commaMatch) {
        const suggestedLast = commaMatch[1]?.trim() ?? "";
        const suggestedFirst = commaMatch[2]?.trim() ?? "";
        if (suggestedFirst && suggestedLast) {
          issues.push({
            key: `name-fix:${constituent.id}:comma`,
            constituentId: constituent.id,
            reason: "First name appears to contain 'Last, First'.",
            currentFirstName: firstName,
            currentLastName: lastName,
            suggestedFirstName: suggestedFirst,
            suggestedLastName: suggestedLast,
          });
          continue;
        }
      }

      if (!lastName && firstName.includes(" ")) {
        const tokens = firstName.split(/\s+/).filter(Boolean);
        if (tokens.length >= 2) {
          const suggestedFirst = tokens[0] ?? "";
          const suggestedLast = tokens.slice(1).join(" ");
          issues.push({
            key: `name-fix:${constituent.id}:split`,
            constituentId: constituent.id,
            reason: "First and last names may both be in First Name while Last Name is empty.",
            currentFirstName: firstName,
            currentLastName: lastName,
            suggestedFirstName: suggestedFirst,
            suggestedLastName: suggestedLast,
          });
        }
      }
    }
    return issues;
  }, [constituents]);

  const ignoredIssueKeySet = useMemo(() => new Set(ignoredNameIssues.map((issue) => issue.key)), [ignoredNameIssues]);

  const pendingNameIssues = useMemo(
    () => detectedNameIssues.filter((issue) => !ignoredIssueKeySet.has(issue.key)),
    [detectedNameIssues, ignoredIssueKeySet],
  );

  const activeNameIssue = useMemo(() => {
    if (pendingNameIssues.length === 0) return null;
    if (!activeIssueKey) return pendingNameIssues[0];
    return pendingNameIssues.find((issue) => issue.key === activeIssueKey) ?? pendingNameIssues[0];
  }, [activeIssueKey, pendingNameIssues]);

  useEffect(() => {
    if (!activeNameIssue) {
      setNameFixDraft({ firstName: "", lastName: "" });
      return;
    }
    setNameFixDraft({
      firstName: activeNameIssue.suggestedFirstName,
      lastName: activeNameIssue.suggestedLastName,
    });
  }, [activeNameIssue?.key]);

  async function approveActiveNameIssue() {
    if (!activeNameIssue) return;
    const nextFirst = nameFixDraft.firstName.trim();
    const nextLast = nameFixDraft.lastName.trim();
    if (!nextFirst || !nextLast) {
      setNameFixError("First and last names are both required before approval.");
      return;
    }

    setNameFixSaving(true);
    setNameFixError(null);
    try {
      await apiFetch(`/api/constituents/${activeNameIssue.constituentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: nextFirst,
          lastName: nextLast,
        }),
      });

      setConstituents((prev) => prev.map((item) => (
        item.id === activeNameIssue.constituentId
          ? { ...item, firstName: nextFirst, lastName: nextLast }
          : item
      )));
      setIgnoredNameIssues((prev) => prev.filter((issue) => issue.key !== activeNameIssue.key));

      const currentIndex = pendingNameIssues.findIndex((issue) => issue.key === activeNameIssue.key);
      const nextIssue = pendingNameIssues[currentIndex + 1] ?? pendingNameIssues[currentIndex - 1] ?? null;
      setActiveIssueKey(nextIssue?.key ?? null);
    } catch (error) {
      setNameFixError(error instanceof Error ? error.message : "Unable to update this constituent.");
    } finally {
      setNameFixSaving(false);
    }
  }

  function ignoreActiveNameIssue() {
    if (!activeNameIssue) return;
    setIgnoredNameIssues((prev) => {
      if (prev.some((issue) => issue.key === activeNameIssue.key)) return prev;
      return [...prev, { ...activeNameIssue, ignoredAt: new Date().toISOString() }];
    });
    setNameFixError(null);

    const currentIndex = pendingNameIssues.findIndex((issue) => issue.key === activeNameIssue.key);
    const nextIssue = pendingNameIssues[currentIndex + 1] ?? pendingNameIssues[currentIndex - 1] ?? null;
    setActiveIssueKey(nextIssue?.key ?? null);
  }

  function unignoreNameIssue(key: string) {
    setIgnoredNameIssues((prev) => prev.filter((issue) => issue.key !== key));
  }

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

  async function exportConstituents() {
    setExporting("constituents");
    try {
      const rows = await apiFetch<Constituent[]>("/api/constituents?limit=all");
      const csv = toCsv(
        (Array.isArray(rows) ? rows : []).map((c) => ({
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
    } finally {
      setExporting(null);
    }
  }

  async function exportDonations() {
    setExporting("donations");
    try {
      const response = await apiFetch<{ items?: Donation[] } | Donation[]>("/api/donations?limit=all");
      const rows = Array.isArray(response) ? response : (response.items ?? []);
      const csv = toCsv(
        rows.map((d) => ({
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
    } finally {
      setExporting(null);
    }
  }

  async function exportCampaigns() {
    setExporting("campaigns");
    try {
      const rows = await apiFetch<Campaign[]>("/api/campaigns?limit=all&scope=ALL_YEARS");
      const csv = toCsv(
        (Array.isArray(rows) ? rows : []).map((campaign) => ({
          id: campaign.id,
          name: campaign.name,
          active: campaign.active,
          category: campaign.category ?? "",
          startDate: campaign.startDate ?? "",
          endDate: campaign.endDate ?? "",
          goal: campaign.goal ?? "",
          totalRaised: campaign.totalRaised ?? "",
          donationsCount: campaign._count?.donations ?? 0,
          pledgesCount: campaign._count?.pledges ?? 0,
        }))
      );
      downloadCsv("oyamacrm-campaigns.csv", csv);
    } finally {
      setExporting(null);
    }
  }

  async function exportDesignations() {
    setExporting("designations");
    try {
      const rows = await apiFetch<Designation[]>("/api/designations");
      const csv = toCsv(
        (Array.isArray(rows) ? rows : []).map((designation) => ({
          id: designation.id,
          name: designation.name,
          description: designation.description ?? "",
          active: designation.active ?? true,
          donationsCount: designation._count?.donations ?? 0,
        }))
      );
      downloadCsv("oyamacrm-designations.csv", csv);
    } finally {
      setExporting(null);
    }
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

      <CRMActionBar
        context={{
          flags: {
            loading,
            exporting,
          },
        }}
        commandHandlers={{
          "open-import-area": () => scrollToSection("data-tools-import"),
          "open-import-history": () => scrollToSection("data-tools-history"),
          "export-constituents-data-tools": () => {
            if (loading || exporting !== null) return;
            void exportConstituents();
          },
          "export-donations-data-tools": () => {
            if (loading || exporting !== null) return;
            void exportDonations();
          },
          "export-campaigns-data-tools": () => {
            if (loading || exporting !== null) return;
            void exportCampaigns();
          },
          "export-designations-data-tools": () => {
            if (loading || exporting !== null) return;
            void exportDesignations();
          },
          "open-quality-metrics": () => scrollToSection("data-tools-quality"),
          "open-merge-records": () => scrollToSection("data-tools-merge"),
          "open-steward-paths-data-tools": () => scrollToSection("data-tools-steward-paths"),
        }}
      />

      <GuidedImportWizard />

      <div id="data-tools-import" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Use Guided Import for contacts, audience lists, donations, and Compassion client files. The wizard routes each file to the correct importer and keeps client data out of Donor CRM.
      </div>

      <div id="data-tools-history" className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Recent Import Runs</h2>
            <p className="text-sm text-gray-500">See recent donor import runs, who started them, and whether rollback is still supported.</p>
          </div>
          <Link href="/data-tools/import" className="text-xs font-semibold text-green-700 hover:text-green-900">
            Open full import workspace
          </Link>
        </div>
        {historyLoading ? (
          <p className="text-sm text-gray-500">Loading recent imports...</p>
        ) : importHistory.length === 0 ? (
          <p className="text-sm text-gray-500">No recent donor import runs found.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-2.5">Started</th>
                  <th className="px-4 py-2.5">Mode</th>
                  <th className="px-4 py-2.5">Results</th>
                  <th className="px-4 py-2.5">Rollback</th>
                  <th className="px-4 py-2.5">Started By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {importHistory.map((item) => (
                  <tr key={item.runId}>
                    <td className="px-4 py-3 text-gray-600">{new Date(item.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-gray-900">{item.mode.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {item.recordCount} rows · {item.created} created · {item.updated} updated · {item.skipped} skipped · {item.errors} errors
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${item.rolledBackAt ? "bg-slate-100 text-slate-700" : item.rollbackSupported ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {item.rolledBackAt ? "Rolled back" : item.rollbackSupported ? "Rollback available" : "Rollback unavailable"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.startedBy?.name || item.startedBy?.email || "Unknown"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Export Data ── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Export Data</h2>
        <p className="text-sm text-gray-500">Download full live CRM datasets as CSV without relying on the page's 500-row snapshot.</p>
        <div className="flex flex-wrap gap-3">
          <button onClick={() => void exportConstituents()} disabled={loading || exporting !== null}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            {exporting === "constituents" ? "Exporting Constituents..." : "Export Constituents (CSV)"}
          </button>
          <button onClick={() => void exportDonations()} disabled={loading || exporting !== null}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            {exporting === "donations" ? "Exporting Donations..." : "Export Donations (CSV)"}
          </button>
          <button onClick={() => void exportCampaigns()} disabled={loading || exporting !== null}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            {exporting === "campaigns" ? "Exporting Campaigns..." : "Export Campaigns (CSV)"}
          </button>
          <button onClick={() => void exportDesignations()} disabled={loading || exporting !== null}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
            {exporting === "designations" ? "Exporting Designations..." : "Export Designations (CSV)"}
          </button>
        </div>
      </div>

      {/* ── Data Quality ── */}
      <div id="data-tools-quality" className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Data Quality</h2>
            <p className="text-sm text-gray-500 mt-1">Review and correct profile issues before they affect segmentation, mail merges, and communications.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setNameFixOpen(true);
              setActiveIssueKey(pendingNameIssues[0]?.key ?? null);
              setNameFixError(null);
            }}
            className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          >
            Launch Name Correction ({pendingNameIssues.length})
          </button>
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <QualityCard label="Missing Email" value={quality.missingEmail} hint="Profiles without an email address." />
          <QualityCard label="Duplicate Emails" value={quality.duplicateCount} hint="Email addresses used on multiple profiles." />
          <QualityCard label="Missing Phone" value={quality.missingPhone} hint="Profiles with no phone number." />
          <QualityCard label="Name Issues" value={pendingNameIssues.length} hint="Possible first/last name field errors ready for guided correction." />
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ignored Name Issues</p>
          {ignoredNameIssues.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">No ignored entries yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {ignoredNameIssues.map((issue) => (
                <div key={issue.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 bg-white px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{issue.currentFirstName} {issue.currentLastName || "(no last name)"}</p>
                    <p className="text-xs text-gray-500">{issue.reason} · Ignored {new Date(issue.ignoredAt).toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => unignoreNameIssue(issue.key)}
                    className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                  >
                    Remove Ignore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Merge Duplicate Records ── */}
      <div id="data-tools-merge">
        <MergeWorkflow constituents={constituents} />
      </div>

      {nameFixOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-gray-900">Guided Name Corrections</p>
                <p className="text-xs text-gray-500">Step-by-step review of likely first/last name field errors.</p>
              </div>
              <button
                type="button"
                onClick={() => setNameFixOpen(false)}
                className="rounded-md border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              {activeNameIssue ? (
                <>
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Issue</p>
                    <p className="mt-1 text-sm text-blue-900">{activeNameIssue.reason}</p>
                    <p className="mt-2 text-xs text-blue-800">
                      Reviewing {pendingNameIssues.findIndex((issue) => issue.key === activeNameIssue.key) + 1} of {pendingNameIssues.length}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Current Record</p>
                      <p className="mt-2 text-sm text-gray-800">First Name: <span className="font-medium">{activeNameIssue.currentFirstName || "-"}</span></p>
                      <p className="text-sm text-gray-800">Last Name: <span className="font-medium">{activeNameIssue.currentLastName || "-"}</span></p>
                    </div>
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Suggested Split</p>
                      <p className="mt-2 text-sm text-green-900">First Name: <span className="font-medium">{activeNameIssue.suggestedFirstName || "-"}</span></p>
                      <p className="text-sm text-green-900">Last Name: <span className="font-medium">{activeNameIssue.suggestedLastName || "-"}</span></p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-sm font-medium text-gray-700">
                      Correct First Name
                      <input
                        value={nameFixDraft.firstName}
                        onChange={(event) => setNameFixDraft((prev) => ({ ...prev, firstName: event.target.value }))}
                        className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                      />
                    </label>
                    <label className="text-sm font-medium text-gray-700">
                      Correct Last Name
                      <input
                        value={nameFixDraft.lastName}
                        onChange={(event) => setNameFixDraft((prev) => ({ ...prev, lastName: event.target.value }))}
                        className="mt-1 h-10 w-full rounded-md border border-gray-300 px-3 text-sm"
                      />
                    </label>
                  </div>

                  {nameFixError ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{nameFixError}</p> : null}

                  <div className="flex flex-wrap justify-between gap-2 border-t border-gray-200 pt-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const currentIndex = pendingNameIssues.findIndex((issue) => issue.key === activeNameIssue.key);
                          const previousIssue = pendingNameIssues[currentIndex - 1] ?? null;
                          setActiveIssueKey(previousIssue?.key ?? activeNameIssue.key);
                          setNameFixError(null);
                        }}
                        disabled={pendingNameIssues.findIndex((issue) => issue.key === activeNameIssue.key) <= 0}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40"
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const currentIndex = pendingNameIssues.findIndex((issue) => issue.key === activeNameIssue.key);
                          const nextIssue = pendingNameIssues[currentIndex + 1] ?? null;
                          setActiveIssueKey(nextIssue?.key ?? activeNameIssue.key);
                          setNameFixError(null);
                        }}
                        disabled={pendingNameIssues.findIndex((issue) => issue.key === activeNameIssue.key) >= pendingNameIssues.length - 1}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-40"
                      >
                        Next
                      </button>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={ignoreActiveNameIssue}
                        disabled={nameFixSaving}
                        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 disabled:opacity-40"
                      >
                        Ignore
                      </button>
                      <button
                        type="button"
                        onClick={() => void approveActiveNameIssue()}
                        disabled={nameFixSaving}
                        className="rounded-md border border-green-700 bg-green-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                      >
                        {nameFixSaving ? "Saving..." : "Approve Correction"}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-6 text-center">
                  <p className="text-sm font-semibold text-green-800">No pending name issues.</p>
                  <p className="mt-1 text-xs text-green-700">All detected entries are either fixed or ignored.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

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
                      <Link
                        href="/steward-paths"
                        className="text-xs font-medium text-green-700 hover:text-green-900"
                      >
                        Open Steward Paths →
                      </Link>
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
