"use client";

// TODO(staff-workflows #8,#12): Add mailing-preparation deadline producers once mailing batches exist; preserve the shared inbox snooze/dismiss lifecycle. See docs/plans/staff-workflows.md.


import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import CRMCard from "@/app/components/ui/crm/CRMCard";
import { useNotificationFeed } from "@/app/components/notifications/useNotificationFeed";
import { changeNotification, safeNotificationHref } from "@/app/components/notifications/notification-client";

/** Use durable inbox actions: dismissing an alert never completes its underlying task. */
export default function DashboardReminders() {
  const router = useRouter();
  const feed = useNotificationFeed({ module: "donor", pageSize: 10 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function act(id: string, days?: number) {
    setBusy(true); setError(null);
    try {
      const until = days ? new Date(Date.now() + days * 86400000).toISOString() : undefined;
      await changeNotification(id, days ? "snooze" : "dismiss", until);
      await feed.refresh();
    } catch { setError("The reminder could not be updated. Please retry."); }
    finally { setBusy(false); }
  }
  return <CRMCard padding="md" className="min-w-0">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold text-slate-900">Staff reminders</h2><Link href="/notifications?module=donor" className="text-sm font-semibold text-[var(--crm-accent)] hover:underline">All reminders →</Link></div>
    <p className="mt-1 text-xs text-slate-500">Workflow and task alerts, including missed follow-ups. Snooze or dismiss the alert without closing the task.</p>
    <Link href="/tasks" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--crm-accent)] hover:underline">Upcoming and overdue tasks →</Link>
    {(error || feed.error) && <p role="alert" className="my-2 text-sm text-amber-800">{error || feed.error} <button onClick={() => { setError(null); void feed.refresh(); }} className="underline">Refresh</button></p>}
    <div aria-live="polite" aria-busy={feed.loading}>
      {feed.loading && !feed.items.length ? <p className="py-4 text-sm text-slate-500">Loading reminders…</p> : !feed.items.length ? <p className="py-4 text-sm text-slate-500">{feed.error ? "Reminders unavailable." : "No active reminders."}</p> : <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">{feed.items.map((item) => <li key={item.id} className="py-3">
        <button className="text-left text-sm font-semibold text-[var(--crm-accent)] hover:underline" onClick={() => router.push(safeNotificationHref(item.href))}>{item.title}</button>
        <p className="mt-1 text-xs leading-5 text-slate-600">{item.message}</p>
        <p className="mt-1 text-xs text-slate-500">Alert created {new Date(item.createdAt).toLocaleDateString()}</p>
        <div className="mt-2 flex flex-wrap gap-2">{[1, 7].map((days) => <button key={days} disabled={busy} className="donor-button text-xs" onClick={() => void act(item.id, days)}>Snooze {days === 1 ? "1 day" : "1 week"}</button>)}<button disabled={busy} className="donor-button text-xs" onClick={() => void act(item.id)}>Dismiss</button></div>
      </li>)}</ul>}
    </div>
  </CRMCard>;
}
