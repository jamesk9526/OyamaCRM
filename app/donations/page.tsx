"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import DonationTable from "@/app/components/donations/DonationTable";
import { DonationRow, formatCurrency } from "@/app/components/donations/donation-utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function DonationsPage() {
  const [donations, setDonations] = useState<DonationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [apiDown, setApiDown] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [from,   setFrom]   = useState("");
  const [to,     setTo]     = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (search) params.set("search", search);
      if (status) params.set("status", status);
      if (from)   params.set("from", from);
      if (to)     params.set("to", to);
      const res = await fetch(`${API}/api/donations?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDonations(data.items ?? data ?? []);
      setTotal(data.total ?? (data.items ?? data).length);
      setApiDown(false);
    } catch {
      setApiDown(true);
    } finally {
      setLoading(false);
    }
  }, [search, status, from, to]);

  useEffect(() => { load(); }, [load]);

  const totalAmount = donations.reduce((sum, d) => sum + parseFloat(d.amount || "0"), 0);
  const completed   = donations.filter(d => d.status === "COMPLETED").length;
  const recurring   = donations.filter(d => d.isRecurring).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Donations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gift entry, history, and acknowledgments</p>
        </div>
        <Link href="/donations/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors">
          <span className="text-lg leading-none">+</span> Record Gift
        </Link>
      </div>

      {apiDown && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          ⚠️ API server not running — showing cached/empty data. Start with <code className="font-mono">pnpm start:server</code>.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Raised",  value: formatCurrency(totalAmount), color: "text-green-600" },
          { label: "Total Gifts",   value: total.toString(),            color: "text-gray-800"  },
          { label: "Completed",     value: completed.toString(),        color: "text-gray-800"  },
          { label: "Recurring",     value: recurring.toString(),        color: "text-blue-600"  },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-4 gap-3">
          <input type="text" placeholder="Search donor name or email…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="col-span-2 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-500">
            <option value="">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>
          <div className="flex gap-2">
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} title="From date"
              className="flex-1 rounded-lg border border-gray-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <input type="date" value={to} onChange={e => setTo(e.target.value)} title="To date"
              className="flex-1 rounded-lg border border-gray-200 px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-gray-400 text-sm animate-pulse">Loading donations…</div>
        ) : (
          <DonationTable donations={donations} />
        )}
      </div>
    </div>
  );
}
