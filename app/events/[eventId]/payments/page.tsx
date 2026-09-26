"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { RefreshCw, Search, TriangleAlert } from "lucide-react";
import { apiFetch } from "@/app/lib/auth-client";

interface EventOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number | string;
  paymentMethod?: string | null;
  paidAt?: string | null;
  createdAt: string;
  constituent?: { firstName?: string; lastName?: string; email?: string };
}

type CollectedPaymentMethod = "CASH" | "CHECK" | "CREDIT_CARD";

function currency(value: number): string {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function statusStyle(status: string): string {
  if (status === "CONFIRMED") return "bg-emerald-50 text-emerald-700";
  if (status === "REFUNDED") return "bg-slate-100 text-slate-700";
  if (status === "CANCELLED") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-800";
}

export default function EventPaymentsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recordingOrderId, setRecordingOrderId] = useState<string | null>(null);
  const [recordingMethod, setRecordingMethod] = useState<CollectedPaymentMethod>("CASH");
  const [savingOrderId, setSavingOrderId] = useState<string | null>(null);

  function loadPayments() {
    let active = true;
    setLoading(true);
    setError("");
    void apiFetch<EventOrder[]>(`/api/events/${eventId}/orders`)
      .then((items) => { if (active) setOrders(Array.isArray(items) ? items : []); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Payments could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }

  useEffect(() => loadPayments(), [eventId]);

  async function recordPayment(order: EventOrder) {
    if (savingOrderId) return;
    setSavingOrderId(order.id);
    setError("");
    try {
      const updated = await apiFetch<EventOrder>(`/api/events/orders/${order.id}/record-payment`, {
        method: "POST",
        body: JSON.stringify({ paymentMethod: recordingMethod }),
      });
      setOrders((current) => current.map((item) => item.id === order.id ? { ...item, ...updated } : item));
      setRecordingOrderId(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Payment could not be recorded. Refresh and review the order before retrying.");
    } finally {
      setSavingOrderId(null);
    }
  }

  const totals = useMemo(() => orders.reduce((summary, order) => {
    const amount = Number(order.totalAmount || 0);
    if (order.status === "CONFIRMED") summary.collected += amount;
    else if (order.status === "REFUNDED") summary.refunded += amount;
    else if (order.status !== "CANCELLED") summary.outstanding += amount;
    return summary;
  }, { collected: 0, outstanding: 0, refunded: 0 }), [orders]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return orders.filter((order) => !needle || [order.orderNumber, order.constituent?.firstName, order.constituent?.lastName, order.constituent?.email, order.status].some((value) => String(value ?? "").toLowerCase().includes(needle)));
  }, [orders, query]);

  return <div className="mx-auto max-w-6xl space-y-7 p-4 sm:p-6 lg:p-8">
    <header className="event-industrial-page-header">
      <div><p className="event-industrial-kicker">Finance / Event ledger</p><h1>Payments</h1><p>Review collected and outstanding event payments. Record money received at check-in after verifying it was collected.</p></div>
      <button type="button" onClick={() => void loadPayments()} disabled={loading} className="event-industrial-secondary"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />Refresh</button>
    </header>
    <section className="grid gap-5 border-y border-slate-200 py-6 sm:grid-cols-3">
      <div><p className="text-2xl font-semibold">{currency(totals.collected)}</p><p className="mt-1 text-sm text-slate-500">Collected</p></div>
      <div><p className="text-2xl font-semibold">{currency(totals.outstanding)}</p><p className="mt-1 text-sm text-slate-500">Outstanding</p></div>
      <div><p className="text-2xl font-semibold">{currency(totals.refunded)}</p><p className="mt-1 text-sm text-slate-500">Refunded</p></div>
    </section>
    {error ? <div role="alert" className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"><TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />{error}</div> : null}
    <section className="event-industrial-panel overflow-hidden">
      <div className="border-b border-slate-200 p-3"><label className="relative block max-w-sm"><span className="sr-only">Search payments</span><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search orders or people" className="h-9 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-amber-600 focus:ring-2 focus:ring-amber-100" /></label></div>
      {loading ? <div className="h-48 animate-pulse bg-slate-100" /> : !visible.length ? <div className="grid min-h-48 place-items-center p-8 text-center text-sm text-slate-500">{orders.length ? "No payments match this search." : "No event orders yet."}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Order</th><th className="px-4 py-3 font-semibold">Person</th><th className="px-4 py-3 text-right font-semibold">Amount</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Date</th><th className="px-4 py-3 font-semibold">Action</th></tr></thead>
        <tbody className="divide-y divide-slate-200">{visible.map((order) => {
          const canRecord = order.status === "PENDING" && !order.paidAt && Number(order.totalAmount) > 0 && order.paymentMethod !== "ONLINE";
          const isRecording = recordingOrderId === order.id;
          return <tr key={order.id} className="align-top hover:bg-slate-50">
            <td className="px-4 py-3 font-medium">{order.orderNumber}</td>
            <td className="px-4 py-3"><span className="block">{`${order.constituent?.firstName ?? ""} ${order.constituent?.lastName ?? ""}`.trim() || "Unknown"}</span><span className="text-xs text-slate-500">{order.constituent?.email}</span></td>
            <td className="px-4 py-3 text-right font-medium">{currency(Number(order.totalAmount || 0))}</td>
            <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyle(order.status)}`}>{order.status.replaceAll("_", " ")}</span>{order.paymentMethod ? <span className="mt-1 block text-xs text-slate-500">{order.paymentMethod.replaceAll("_", " ")}</span> : null}</td>
            <td className="px-4 py-3 text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</td>
            <td className="px-4 py-3">{canRecord ? isRecording ? <div className="min-w-48 space-y-2"><p className="text-xs text-slate-600">Confirm {currency(Number(order.totalAmount))} was received.</p><label className="block text-xs font-medium text-slate-700">Payment method<select value={recordingMethod} onChange={(event) => setRecordingMethod(event.target.value as CollectedPaymentMethod)} disabled={savingOrderId === order.id} className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900"><option value="CASH">Cash</option><option value="CHECK">Check</option><option value="CREDIT_CARD">Card (external terminal)</option></select></label><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void recordPayment(order)} disabled={Boolean(savingOrderId)} className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{savingOrderId === order.id ? "Saving…" : "Confirm received"}</button><button type="button" onClick={() => setRecordingOrderId(null)} disabled={Boolean(savingOrderId)} className="px-2 py-2 text-xs font-semibold text-slate-600">Cancel</button></div></div> : <button type="button" onClick={() => { setRecordingMethod("CASH"); setRecordingOrderId(order.id); }} className="min-h-9 rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100">Record payment</button> : <span className="text-xs text-slate-400">—</span>}</td>
          </tr>;
        })}</tbody>
      </table></div>}
    </section>
  </div>;
}
