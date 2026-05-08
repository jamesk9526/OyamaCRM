// Data Tools page: CSV export, data-quality metrics, CSV import wizard, and merge workflow.
"use client";

import { useEffect, useMemo, useState } from "react";
import MergeWorkflow from "./merge/MergeWorkflow";
import { apiFetch } from "@/app/lib/auth-client";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Data Tools</h1>
        <p className="text-sm text-gray-500 mt-0.5">Export real data, import constituents, detect duplicates, and monitor profile quality.</p>
      </div>

      {/* ── Import Constituents (link to visual mapper) ── */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Import Constituents</h2>
            <p className="text-sm text-gray-500 mt-1">
              Upload a CSV file and use the visual field-mapping tool to import constituents.
              Auto-detects report headers, flags sensitive fields, and previews data quality before import.
            </p>
            <div className="flex gap-2 mt-3 flex-wrap">
              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">eKYROS export</span>
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">Bloomerang</span>
              <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">NeonCRM</span>
              <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">Any CSV</span>
            </div>
          </div>
          <a
            href="/data-tools/import"
            className="ml-4 flex-shrink-0 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-1.5"
          >
            Open Import Tool →
          </a>
        </div>
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
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Data Quality</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <QualityCard label="Missing Email" value={quality.missingEmail} hint="Profiles without an email address." />
          <QualityCard label="Duplicate Emails" value={quality.duplicateCount} hint="Email addresses used on multiple profiles." />
          <QualityCard label="Missing Phone" value={quality.missingPhone} hint="Profiles with no phone number." />
        </div>
      </div>

      {/* ── Merge Duplicate Records ── */}
      <MergeWorkflow constituents={constituents} />
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
