// Payments page now shows only live donation payment data and hides mock processor UI.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { formatCurrency, formatDonationDate, methodLabel, statusColor, type DonationRow } from "@/app/components/donations/donation-utils";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { DonorPagination } from "@/app/components/donor-workspace/BrowsePrimitives";

interface PaymentHealthPayload {
  stripeReady: boolean;
  paypalReady: boolean;
  activeProvider: "stripe" | "paypal" | null;
  currency: string;
  issues: string[];
}

/**
 * PaymentsPage renders a real payment ledger sourced from live donation records.
 * Mock processor configuration tabs are intentionally hidden until backend APIs exist.
 */
export default function PaymentsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const [rows, setRows] = useState<DonationRow[]>([]);
  const [health, setHealth] = useState<PaymentHealthPayload | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthError, setHealthError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pageFilter, setPageFilter] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const requestId = useRef(0);
  const pageSize = 25;

  const loadLedger = useCallback(async () => {
      const current = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({ limit: String(pageSize), page: String(page) });
        if (search.trim()) query.set("search", search.trim());
        const data = await apiFetch<{ items: DonationRow[]; total: number }>(`/api/donations?${query}`);
        if (current !== requestId.current) return;
        const lastPage = Math.max(1, Math.ceil(data.total / pageSize));
        if (page > lastPage) { setPage(lastPage); return; }
        setRows(data.items); setTotal(data.total);
      } catch (err) {
        if (current === requestId.current) setError(err instanceof Error ? err.message : "Failed to load payment ledger.");
      } finally {
        if (current === requestId.current) setLoading(false);
      }
  }, [page, search]);
  const invalidateRequest = useCallback(() => { requestId.current++; }, []);
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => void loadLedger(), search ? 300 : 0);
    return () => { clearTimeout(timer); invalidateRequest(); };
  }, [loadLedger, search, invalidateRequest]);
  const loadHealth = useCallback(async () => {
    if (!isAdmin) return;
    setHealthLoading(true); setHealthError(""); setHealth(null);
    try { setHealth(await apiFetch<PaymentHealthPayload>("/api/payments/health")); }
    catch (reason) { setHealthError(reason instanceof Error ? reason.message : "Gateway status is unavailable."); }
    finally { setHealthLoading(false); }
  }, [isAdmin]);
  useEffect(() => { void loadHealth(); }, [loadHealth]);

  const filtered = useMemo(() => {
    const q = pageFilter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const fullName = `${row.constituent.firstName} ${row.constituent.lastName}`.toLowerCase();
      return (
        fullName.includes(q) ||
        (row.constituent.email ?? "").toLowerCase().includes(q) ||
        methodLabel(row.paymentMethod).toLowerCase().includes(q) ||
        (row.receiptNumber ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, pageFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Payments</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Live payment ledger sourced from recorded donations.
        </p>
      </div>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Gateway status</p>
        <p className="mt-1 text-sm text-amber-800">
          Stripe and PayPal are now configurable in settings. Donation embed checkout uses whichever provider is enabled and ready.
        </p>
        {!isAdmin ? <p className="mt-3 text-sm text-amber-900">Gateway configuration status is available to organization administrators. Recorded payments remain available below.</p>
        : healthLoading ? <p role="status" className="mt-3 text-sm text-amber-900">Checking gateway configuration…</p>
        : !health ? <div role="status" className="mt-3 text-sm text-amber-900"><p>Gateway configuration status unavailable. {healthError}</p><button type="button" className="mt-2 font-semibold underline" onClick={() => void loadHealth()}>Retry gateway status</button></div>
        : <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${health?.stripeReady ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            Stripe: {health?.stripeReady ? "Ready" : "Not Ready"}
          </span>
          <span className={`rounded-full px-2 py-0.5 font-semibold ${health?.paypalReady ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
            PayPal: {health?.paypalReady ? "Ready" : "Not Ready"}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
            Active: {health?.activeProvider ?? "None"}
          </span>
          <Link
            href="/integrations/stripe"
            className="inline-flex items-center rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 font-semibold text-amber-800 hover:bg-amber-100"
          >
            Open Payment Settings
          </Link>
        </div>}
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            aria-label="Search payment donors"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Search donor name or email across all payments…"
            className="w-full max-w-xl rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <Link
            href="/donations"
            className="inline-flex items-center rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Open full donations workspace
          </Link>
        </div>
        <label className="block max-w-xl text-xs text-gray-600">Filter the current page by donor, email, payment method, or receipt
          <input type="search" value={pageFilter} onChange={event => setPageFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </label>

        {loading ? (
          <div className="py-10 text-center text-sm text-gray-400">Loading payment ledger...</div>
        ) : error ? (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"><p>{error}</p><button type="button" className="mt-2 font-semibold underline" onClick={() => void loadLedger()}>Retry payment ledger</button></div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Donor</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Method</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-xs text-gray-600">{formatDonationDate(row.date)}</td>
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">{row.constituent.firstName} {row.constituent.lastName}</p>
                      <p className="text-xs text-gray-500">{row.constituent.email ?? "No email"}</p>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-gray-900">{formatCurrency(row.amount)}</td>
                    <td className="px-3 py-2 text-gray-700">{methodLabel(row.paymentMethod)}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusColor(row.status)}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">{row.receiptNumber ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-400">No payment rows found for this filter.</div>
            )}
          </div>
        )}
        {!error && <DonorPagination page={page} pageSize={pageSize} total={total} totalPages={Math.max(1, Math.ceil(total / pageSize))} loading={loading} onPage={setPage} />}
      </section>
    </div>
  );
}
