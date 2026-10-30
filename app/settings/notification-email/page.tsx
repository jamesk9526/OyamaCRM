"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { apiFetch } from "@/app/lib/auth-client";
type Settings = { enabled: boolean; subjectTemplate: string; minimumSeverity: string; deliveries: Array<{ id: string; status: string; createdAt: string; notification: { title: string } }> };
export default function NotificationEmailSettings() {
  const { user, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async (preserveDraft = false) => {
    setError("");
    try { const data = await apiFetch<Settings>("/api/notifications/email-settings"); setSettings(previous => preserveDraft && previous ? { ...previous, deliveries: data.deliveries } : data); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Settings unavailable."); }
  }, []);
  useEffect(() => { if (user?.role === "admin") void load(); }, [user?.role, load]);
  if (authLoading) return <p role="status">Loading account…</p>;
  if (user?.role !== "admin") return <p>This setting is available to administrators for their own notifications.</p>;
  return <div className="max-w-3xl space-y-5">
    <header><p className="text-sm text-teal-800">Personal delivery preferences</p><h1 className="mt-2 text-2xl font-semibold">Notification email</h1><p className="mt-2 text-sm leading-6 text-slate-600">Receive your own OyamaCRM alerts at <strong>{user.email}</strong>. Other staff members’ alerts are not included.</p></header>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error} <button type="button" onClick={() => void load()} className="underline">Reload settings</button></p>}
    {notice && <p role="status" className="rounded-lg bg-teal-50 p-4 text-teal-900">{notice}</p>}
    {!settings ? !error && <p role="status">Loading preferences…</p> : <>
      <form className="space-y-5 rounded-xl border border-slate-200 bg-white p-6" onSubmit={async event => {
        event.preventDefault(); if (busy) return; setBusy(true); setError(""); setNotice("");
        try { await apiFetch("/api/notifications/email-settings", { method: "PUT", body: JSON.stringify({ enabled: settings.enabled, subjectTemplate: settings.subjectTemplate, minimumSeverity: settings.minimumSeverity }) }); setNotice("Preferences saved. Newly created eligible alerts will follow these settings. An email already being sent may still arrive."); await load(); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save preferences."); }
        finally { setBusy(false); }
      }}>
        <fieldset disabled={busy} className="space-y-5">
          <label className="flex gap-3 text-sm font-semibold"><input type="checkbox" checked={settings.enabled} onChange={event => setSettings({ ...settings, enabled: event.target.checked })} />Email my notifications</label>
          <label className="grid gap-2 text-sm font-semibold">Which alerts?<select className="min-h-11 rounded-md border border-slate-300 px-3" value={settings.minimumSeverity} onChange={event => setSettings({ ...settings, minimumSeverity: event.target.value })}><option value="ALL">All priorities, all my workspaces</option><option value="HIGH">High and critical priority only</option></select></label>
          <label className="grid gap-2 text-sm font-semibold">Email subject template<input required maxLength={180} className="min-h-11 rounded-md border border-slate-300 px-3" value={settings.subjectTemplate} onChange={event => setSettings({ ...settings, subjectTemplate: event.target.value })} /><span className="text-xs font-normal text-slate-600">Use {"{title}"}, {"{module}"}, or {"{severity}"}. Maximum 180 characters.</span></label>
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Subject preview: {settings.subjectTemplate.replace(/\{title\}/g, "Task assigned: Welcome a new donor").replace(/\{module\}/g, "donor").replace(/\{severity\}/g, "HIGH")}</p>
          <p className="text-xs leading-5 text-slate-600">Delivery starts with new alerts after enrollment. Snoozed alerts wait until their return time; dismissed, archived and expired alerts are excluded. Mail uses your organization’s configured email service. This does not change your in-app inbox.</p>
          <button className="min-h-11 rounded-md bg-teal-800 px-5 text-sm font-semibold text-white">{busy ? "Saving…" : "Save email preferences"}</button>
        </fieldset>
      </form>
      <section className="rounded-xl border border-slate-200 bg-white p-6"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-semibold">Recent delivery attempts</h2><button type="button" disabled={busy} onClick={() => void load(true)} className="text-sm font-semibold text-teal-800">Refresh history</button></div><p className="mt-2 text-xs leading-5 text-slate-600">Sent means accepted by the mail service, not confirmed inbox delivery. Failed or interrupted attempts are not automatically resent, to avoid duplicate emails. Check mail settings before reviewing a failure.</p>{!settings.deliveries.length ? <p className="mt-4 text-sm text-slate-600">No email attempts yet.</p> : <ul className="mt-4 divide-y">{settings.deliveries.map(item => <li key={item.id} className="py-3 text-sm"><strong>{item.notification.title}</strong><p className="mt-1 text-slate-600">{item.status === "SENDING" ? "Sending / outcome not yet recorded" : item.status} · {new Date(item.createdAt).toLocaleString()}</p></li>)}</ul>}</section>
    </>}
    <Link href="/settings/email" className="inline-block text-sm font-semibold text-teal-800">Organization mail configuration →</Link>
  </div>;
}
