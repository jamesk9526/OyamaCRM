"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Search } from "lucide-react";
import { apiFetch } from "@/app/lib/auth-client";

interface EventOrder { id: string; orderNumber: string; status: string; totalAmount: number | string; createdAt: string; constituent?: { firstName?: string; lastName?: string; email?: string }; }
function currency(value: number): string { return value.toLocaleString("en-US", { style: "currency", currency: "USD" }); }
function statusStyle(status: string): string { return ["CONFIRMED", "PAID", "COMPLETED"].includes(status) ? "bg-emerald-50 text-emerald-700" : status === "REFUNDED" ? "bg-slate-100 text-slate-700" : status === "CANCELLED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"; }

export default function EventPaymentsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [orders, setOrders] = useState<EventOrder[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { let current = true; void apiFetch<EventOrder[]>(`/api/events/${eventId}/orders`).then((items) => { if (current) setOrders(items); }).finally(() => { if (current) setLoading(false); }); return () => { current = false; }; }, [eventId]);
  const totals = useMemo(() => orders.reduce((summary, order) => { const amount = Number(order.totalAmount || 0); if (["CONFIRMED", "PAID", "COMPLETED"].includes(order.status)) summary.collected += amount; else if (order.status === "REFUNDED") summary.refunded += amount; else if (!['CANCELLED'].includes(order.status)) summary.outstanding += amount; return summary; }, { collected: 0, outstanding: 0, refunded: 0 }), [orders]);
  const visible = useMemo(() => { const needle = query.trim().toLowerCase(); return orders.filter((order) => !needle || [order.orderNumber, order.constituent?.firstName, order.constituent?.lastName, order.constituent?.email, order.status].some((value) => String(value ?? "").toLowerCase().includes(needle))); }, [orders, query]);
  return <div className="mx-auto max-w-6xl space-y-7 p-4 sm:p-6 lg:p-8"><header><h2 className="text-2xl font-semibold tracking-tight">Payments</h2><p className="mt-2 text-sm text-slate-500">Event orders and payment status. Stripe remains the processor; Oyama CRM remains the operational record.</p></header>
    <section className="grid gap-5 border-y border-slate-200 py-6 sm:grid-cols-3"><div><p className="text-2xl font-semibold">{currency(totals.collected)}</p><p className="mt-1 text-sm text-slate-500">Collected</p></div><div><p className="text-2xl font-semibold">{currency(totals.outstanding)}</p><p className="mt-1 text-sm text-slate-500">Outstanding</p></div><div><p className="text-2xl font-semibold">{currency(totals.refunded)}</p><p className="mt-1 text-sm text-slate-500">Refunded</p></div></section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="border-b border-slate-200 p-3"><label className="relative block max-w-sm"><span className="sr-only">Search payments</span><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(input) => setQuery(input.target.value)} placeholder="Search orders or people" className="h-9 w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label></div>
      {loading ? <div className="h-48 animate-pulse bg-slate-100" /> : !visible.length ? <div className="grid min-h-48 place-items-center p-8 text-center text-sm text-slate-500">{orders.length ? "No payments match this search." : "No event orders yet."}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Order</th><th className="px-4 py-3 font-semibold">Person</th><th className="px-4 py-3 text-right font-semibold">Amount</th><th className="px-4 py-3 font-semibold">Status</th><th className="px-4 py-3 font-semibold">Date</th></tr></thead><tbody className="divide-y divide-slate-200">{visible.map((order) => <tr key={order.id} className="hover:bg-slate-50"><td className="px-4 py-3 font-medium">{order.orderNumber}</td><td className="px-4 py-3"><span className="block">{`${order.constituent?.firstName ?? ""} ${order.constituent?.lastName ?? ""}`.trim() || "Unknown"}</span><span className="text-xs text-slate-500">{order.constituent?.email}</span></td><td className="px-4 py-3 text-right font-medium">{currency(Number(order.totalAmount || 0))}</td><td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusStyle(order.status)}`}>{order.status.replaceAll("_", " ")}</span></td><td className="px-4 py-3 text-slate-500">{new Date(order.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
