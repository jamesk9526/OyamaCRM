"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
interface Activity { id: string; action: string; createdAt: string; entityId: string; user: { firstName: string; lastName: string } | null }
export default function QuickBooksActivity() {
  const [items, setItems] = useState<Activity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { let active = true; apiFetch<{ items: Activity[] }>("/api/quickbooks/activity").then(result => { if (active) setItems(result.items); }).catch(error => { if (active) setError(error instanceof Error ? error.message : "Could not load activity."); }); return () => { active = false; }; }, []);
  return <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold text-slate-900">Recent sync activity</h2>{error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : !items ? <p className="mt-3 text-sm text-slate-500">Loading activity…</p> : !items.length ? <p className="mt-3 text-sm text-slate-500">No QuickBooks activity yet.</p> : <ul className="mt-3 divide-y">{items.map(item => <li key={item.id} className="py-3 text-sm"><p className="font-medium text-slate-800">{item.action.replace(/^QB_/, "").replaceAll("_", " ")}</p><p className="mt-1 text-slate-500">{item.user ? `${item.user.firstName} ${item.user.lastName}` : "System"} · {new Date(item.createdAt).toLocaleString()}</p><p className="mt-1 break-all text-xs text-slate-500">{item.entityId}</p></li>)}</ul>}</section>;
}
