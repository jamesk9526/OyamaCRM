"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/components/auth/AuthProvider";

const improvements = [
  ["A calmer workspace", "More breathing room, clearer navigation, responsive layouts and motion that respects your accessibility preferences."],
  ["A dashboard built around your day", "Giving trends, new donors, staff reminders and report discovery, plus customizable widget order, visibility and sizes."],
  ["Tables that work harder", "Spreadsheet-style cell navigation, gridlines, sticky headers, row density controls and clearer selection feedback."],
  ["Faster donor and gift search", "Search waits for a short typing pause. Enter searches immediately, and filters keep your current scope clear."],
  ["Easier donor follow-up", "New-donor shortcuts to giving history, tasks and path enrollment; enrollment history and linked tasks help staff see what happened."],
  ["Reminders within reach", "Staff reminder snooze and dismiss actions, dashboard refresh, and notification refresh when you reconnect or return to the tab."],
  ["More dependable communications", "Roomier letter and email builders, save overlap guards, preservation of edits made during email saves, clearer publish review and PDF feedback."],
];

export default function ReleaseBanner() {
  const { user } = useAuth();
  const key = user ? `oyama:release:2.0:${user.organizationId}:${user.id}` : null;
  const [readyKey, setReadyKey] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    if (!key) return;
    try { setDismissed(localStorage.getItem(key) === "seen"); }
    catch { setDismissed(false); }
    setReadyKey(key);
  }, [key]);
  if (!key || readyKey !== key) return null;
  if (dismissed) return <div className="mb-4 flex justify-end"><button type="button" className="text-xs font-semibold text-[var(--crm-accent)] hover:underline" onClick={() => setDismissed(false)}>What’s new in OyamaCRM v2</button></div>;
  return <section aria-labelledby="release-v2-title" className="mb-6 overflow-hidden rounded-xl border border-teal-200 bg-white shadow-sm">
    <div className="crm-release-hero flex flex-wrap items-start justify-between gap-4 bg-gradient-to-r from-slate-900 to-teal-900 p-6 text-white">
      <div className="max-w-2xl"><p className="text-xs font-semibold uppercase tracking-widest text-teal-200">Your workspace, refreshed · Version 2.0</p><h2 id="release-v2-title" className="mt-2 text-2xl font-semibold">Welcome to OyamaCRM v2</h2><p className="mt-2 text-sm leading-6 text-slate-200">More room to work. Clearer next steps. Better tools for caring for your donors. Here’s what has changed since 1.45b.</p></div>
      <button type="button" className="min-h-11 rounded-md border border-white/40 px-4 text-sm font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4" onClick={() => { try { localStorage.setItem(key, "seen"); } catch { /* Dismiss for this session when storage is unavailable. */ } setDismissed(true); }}>Got it, let’s get started</button>
    </div>
    <details className="p-5"><summary className="cursor-pointer text-sm font-semibold text-teal-800">Explore the improvements</summary><div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{improvements.map(([title, description]) => <div key={title}><h3 className="font-semibold text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></div>)}</div><p className="mt-5 text-xs leading-5 text-slate-500">Availability depends on your permissions and organization setup. Scheduled workflow delivery requires a running worker. Mailing schedules and durable batch manifests remain in development.</p><Link href="/settings/about" className="mt-3 inline-block text-sm font-semibold text-teal-800 hover:underline">About this build →</Link></details>
  </section>;
}
