"use client";
import Link from "next/link";
export default function PluginsSettingsPage({ embedded = false }: { embedded?: boolean }) {
 return <div className="rounded-xl border border-slate-200 bg-white p-6">{!embedded && <h1 className="text-xl font-semibold">Plugins</h1>}<p className="mt-2 text-sm text-slate-600">QuickBooks connection, sending preferences, and historical sync are managed in the QuickBooks workspace.</p><Link className="mt-4 inline-flex font-semibold text-blue-700" href="/quickbooks-sync">Open QuickBooks workspace</Link></div>;
}
