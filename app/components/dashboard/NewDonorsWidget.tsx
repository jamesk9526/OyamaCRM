"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import CRMCard from "@/app/components/ui/crm/CRMCard";

interface Cohort {
  items: Array<{ id: string; firstName: string; lastName: string; firstGiftDate: string }>;
  total: number; totalPages: number;
}

export default function NewDonorsWidget() {
  const [month, setMonth] = useState<"current" | "previous">("current");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Cohort | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(null);
    apiFetch<Cohort>(`/api/reports/new-donors?month=${month}&page=${page}`)
      .then((value) => { if (active) setData(value); })
      .catch(() => { if (active) setError("New donors could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [month, page, retry]);
  return <CRMCard padding="md" className="min-w-0">
    <h2 className="text-lg font-semibold text-slate-900">New donors</h2>
    <p className="mt-1 text-xs text-slate-500">First gift recorded in the selected calendar month (UTC).</p>
    <div className="my-3 flex gap-2" aria-label="New donor month">
      {(["current", "previous"] as const).map((value) => <button key={value} type="button" aria-pressed={month === value} className="donor-button" onClick={() => { setMonth(value); setPage(1); }}>{value === "current" ? "This month" : "Previous month"}</button>)}
    </div>
    <div className="h-[26rem]" aria-live="polite" aria-busy={loading}>
      {loading ? <p className="py-4 text-sm text-slate-500">Loading new donors…</p> : error ? <p role="alert" className="text-sm text-amber-800">{error} <button className="underline" onClick={() => setRetry((value) => value + 1)}>Retry</button></p> : data && <>
        <p className="text-xs text-slate-500">{data.total.toLocaleString()} new donors</p>
        {!data.items.length ? <p className="py-4 text-sm text-slate-500">No first gifts recorded for this month.</p> : <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">{data.items.map((donor) => <li key={donor.id} className="flex justify-between gap-3 py-3 text-sm">
          <Link className="font-semibold text-[var(--crm-accent)] hover:underline" href={`/constituents/${encodeURIComponent(donor.id)}`}>{donor.firstName} {donor.lastName}</Link>
          <span className="text-xs text-slate-500">{new Date(donor.firstGiftDate).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })}</span>
        </li>)}</ul>}
        {data.totalPages > 1 && <div className="mt-3 flex items-center gap-3 text-xs"><button className="donor-button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} of {data.totalPages}</span><button className="donor-button" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Next</button></div>}
      </>}
    </div>
  </CRMCard>;
}
