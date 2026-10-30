"use client";

import Link from "next/link";
import { useState } from "react";
import CRMCard from "@/app/components/ui/crm/CRMCard";
import { findDonorReports, donorReportHref } from "@/app/features/donor-dashboard/report-finder";
import type { DonorDashboardSummary } from "@/app/features/donor-dashboard/types";
import { useDebouncedValue } from "@/app/lib/use-debounced-value";

export default function DashboardReportFinder({ period }: { period?: DonorDashboardSummary["period"] }) {
  const [query, setQuery] = useState("");
  const settled = useDebouncedValue(query, 180);
  const pending = query !== settled;
  const reports = findDonorReports(settled);
  const visual = /\b(chart|charts|graph|graphs)\b/i.test(settled);
  return <CRMCard padding="md" className="min-w-0">
    <h2 className="text-lg font-semibold text-slate-900">Find a report or chart</h2>
    <p className="mt-2 text-sm text-slate-600">Search existing reporting tools. Open a result to review real data and adjust the period.</p>
    <label htmlFor="dashboard-report-search" className="mt-4 block text-xs font-semibold text-slate-700">What would you like to review?</label>
    <input id="dashboard-report-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Monthly giving chart, first-time donors, annual statements…" className="mt-2 min-h-11 w-full rounded-[3px] border border-slate-400 bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-accent)]" />
    <div role="status" className="mt-2 min-h-6 text-xs text-slate-500">{pending ? "Finding matching tools…" : `${reports.length} supported ${visual ? "chart" : "report"}${reports.length === 1 ? "" : "s"}`}</div>
    <div aria-busy={pending} inert={pending ? true : undefined} className="donor-content-enter">
      {!reports.length ? <p className="py-4 text-sm text-slate-600">No supported tool matches this request. Try a report topic such as giving, donors or campaigns.</p> : <ul className="grid gap-3 md:grid-cols-2">{reports.slice(0, query ? 6 : 4).map((report) => <li key={report.key} className="min-w-0 rounded-[3px] border border-slate-200 p-4">
        <Link href={donorReportHref(report, visual, period)} className="text-sm font-semibold text-[var(--crm-accent)] hover:underline">{report.title}{visual ? " chart" : ""} →</Link>
        <p className="mt-2 text-xs leading-5 text-slate-600">{report.description}</p>
        <p className="mt-2 text-xs text-slate-500">{report.capabilities}</p>
      </li>)}</ul>}
    </div>
    <Link href="/reports" className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--crm-accent)] hover:underline">Browse the complete report library →</Link>
  </CRMCard>;
}
