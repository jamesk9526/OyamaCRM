"use client";

import { useEffect, useMemo, useState } from "react";
import type { TriviaEvent, TriviaRegistrationSettings } from "@/app/apps/trivia/lib/trivia-types";
import { createDefaultTriviaRegistrationSettings } from "@/app/apps/trivia/lib/trivia-store";
import { apiFetch } from "@/app/lib/auth-client";

export default function TriviaRegistrationSettingsPanel({
  event,
  syncMode,
  connectionStatus,
  onSetSyncMode,
  onUpdate,
}: {
  event: TriviaEvent;
  syncMode: "local" | "server";
  connectionStatus: string;
  onSetSyncMode: (mode: "local" | "server") => void;
  onUpdate: (updates: Partial<TriviaRegistrationSettings>) => void;
}) {
  const settings = event.registrationSettings ?? createDefaultTriviaRegistrationSettings(event.name, event.id);
  const [origin, setOrigin] = useState("");
  const [message, setMessage] = useState("");
  const [inviteRecipients, setInviteRecipients] = useState("");
  const [inviteSubject, setInviteSubject] = useState(`You're invited: ${event.name}`);
  const [inviteMessage, setInviteMessage] = useState("Reserve your table or seats using the registration link below.");
  const [invitePermission, setInvitePermission] = useState(false);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [inviteResult, setInviteResult] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const publicUrl = `${origin}/trivia/${settings.publicSlug}`;
  const field = "h-11 w-full border border-slate-600 bg-slate-950 px-3 text-sm text-white outline-none focus:border-cyan-400";
  const paymentReady = settings.paymentMode === "free" || settings.paymentProvider === "offline" || /^https:\/\//i.test(settings.paymentUrl);
  const readiness = useMemo(() => [
    { label: "Server sync", ready: syncMode === "server" && connectionStatus === "connected", detail: syncMode === "server" ? connectionStatus : "Local only" },
    { label: "Public URL", ready: settings.publicSlug.length >= 3, detail: settings.publicSlug || "Add a slug" },
    { label: "Capacity", ready: settings.maximumTables > 0 && settings.maximumSeatsPerTable > 0, detail: `${settings.maximumTables} tables · ${settings.maximumSeatsPerTable} seats each` },
    { label: "Payment handoff", ready: paymentReady, detail: settings.paymentMode === "free" ? "Free registration" : settings.paymentProvider },
  ], [connectionStatus, paymentReady, settings, syncMode]);
  const parsedInviteRecipients = useMemo(() => inviteRecipients
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const named = item.match(/^(.*?)\s*<([^>]+)>$/);
      return named ? { name: named[1].trim(), email: named[2].trim().toLowerCase() } : { name: "", email: item.toLowerCase() };
    }), [inviteRecipients]);

  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setMessage("Public signup link copied."); }
    catch { setMessage("Copy was blocked. Select the URL and copy it manually."); }
  }

  async function sendInvitations() {
    setSendingInvites(true);
    setInviteResult("");
    try {
      const result = await apiFetch<{ sent: number; skipped: number; failed: number; results: Array<{ email: string; status: string; detail: string }> }>(`/api/apps/trivia/events/${event.id}/registration-invitations`, {
        method: "POST",
        body: JSON.stringify({
          recipients: parsedInviteRecipients,
          subject: inviteSubject,
          message: inviteMessage,
          confirmedPermission: invitePermission,
        }),
      });
      const failures = result.results.filter((item) => item.status !== "sent").slice(0, 3).map((item) => `${item.email}: ${item.detail}`).join(" · ");
      setInviteResult(`${result.sent} sent · ${result.skipped} skipped · ${result.failed} failed${failures ? ` — ${failures}` : ""}`);
      if (result.sent > 0 && result.failed === 0) setInviteRecipients("");
    } catch (error) {
      setInviteResult(error instanceof Error ? error.message : "Invitations could not be sent.");
    } finally {
      setSendingInvites(false);
    }
  }

  return (
    <section className="space-y-4">
      <header className="border border-slate-700 bg-slate-900/80 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-200">Registration studio</p>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold text-white">Public event page and signup</h1><p className="mt-1 max-w-3xl text-sm text-slate-300">Publish a guest-facing page, collect team and table-host details, control capacity, and send paid registrations to a hosted Stripe or PayPal checkout link.</p></div><div className="flex gap-2"><a href={publicUrl} target="_blank" rel="noopener noreferrer" className="border border-cyan-400/60 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20">Preview public page ↗</a></div></div>
      </header>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{readiness.map((item) => <div key={item.label} className={`border p-3 ${item.ready ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"}`}><p className="text-[10px] uppercase tracking-wide text-slate-300">{item.label}</p><p className="mt-1 text-sm font-semibold text-white">{item.ready ? "Ready" : "Review"}</p><p className="mt-1 truncate text-xs text-slate-300">{item.detail}</p></div>)}</div>

      {syncMode !== "server" ? <div className="flex flex-wrap items-center justify-between gap-3 border border-amber-400/50 bg-amber-500/10 p-4"><div><p className="font-semibold text-amber-100">Public signup requires server sync</p><p className="mt-1 text-xs text-amber-100/80">Local-only event data cannot be reached by guests or remote devices.</p></div><button onClick={() => onSetSyncMode("server")} className="bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950">Use server sync</button></div> : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <section className="border border-slate-700 bg-slate-900/70 p-4">
            <h2 className="font-semibold text-white">Page identity</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-300">Public page address<input className={`${field} mt-1`} value={settings.publicSlug} onChange={(e) => onUpdate({ publicSlug: e.target.value })} placeholder="community-trivia-night" /></label>
              <label className="text-xs font-semibold text-slate-300">Accent color<input type="color" className="mt-1 h-11 w-full border border-slate-600 bg-slate-950 p-1" value={settings.accentColor} onChange={(e) => onUpdate({ accentColor: e.target.value })} /></label>
              <label className="text-xs font-semibold text-slate-300 sm:col-span-2">Headline<input className={`${field} mt-1`} value={settings.headline} onChange={(e) => onUpdate({ headline: e.target.value })} /></label>
              <label className="text-xs font-semibold text-slate-300 sm:col-span-2">Public description<textarea className="mt-1 min-h-28 w-full border border-slate-600 bg-slate-950 p-3 text-sm text-white outline-none focus:border-cyan-400" value={settings.description} onChange={(e) => onUpdate({ description: e.target.value })} /></label>
              <label className="text-xs font-semibold text-slate-300">Public contact email<input type="email" className={`${field} mt-1`} value={settings.contactEmail} onChange={(e) => onUpdate({ contactEmail: e.target.value })} /></label>
              <label className="text-xs font-semibold text-slate-300">Confirmation message<input className={`${field} mt-1`} value={settings.confirmationMessage} onChange={(e) => onUpdate({ confirmationMessage: e.target.value })} /></label>
            </div>
          </section>

          <section className="border border-slate-700 bg-slate-900/70 p-4">
            <h2 className="font-semibold text-white">Tables and guest details</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-300">Maximum tables<input type="number" min={1} max={500} className={`${field} mt-1`} value={settings.maximumTables} onChange={(e) => onUpdate({ maximumTables: Number(e.target.value) })} /></label>
              <label className="text-xs font-semibold text-slate-300">Seats per table<input type="number" min={1} max={30} className={`${field} mt-1`} value={settings.maximumSeatsPerTable} onChange={(e) => onUpdate({ maximumSeatsPerTable: Number(e.target.value) })} /></label>
              <label className="flex items-center gap-2 border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200 sm:col-span-2"><input type="checkbox" checked={settings.collectMemberNames} onChange={(e) => onUpdate({ collectMemberNames: e.target.checked })} /> Collect every team member&apos;s name</label>
            </div>
          </section>

          <section className="border border-slate-700 bg-slate-900/70 p-4">
            <h2 className="font-semibold text-white">Who pays</h2>
            <p className="mt-1 text-xs text-slate-400">Mixed lets each registrant choose a full-table reservation or individual seats.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">{(["free", "per_seat", "per_table", "mixed"] as const).map((mode) => <button key={mode} type="button" onClick={() => onUpdate({ paymentMode: mode })} className={`min-h-12 border px-3 text-sm font-semibold capitalize ${settings.paymentMode === mode ? "border-cyan-400 bg-cyan-500/20 text-cyan-100" : "border-slate-600 bg-slate-950 text-slate-300"}`}>{mode.replace("_", " ")}</button>)}</div>
            {settings.paymentMode !== "free" ? <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {(settings.paymentMode === "per_seat" || settings.paymentMode === "mixed") ? <label className="text-xs font-semibold text-slate-300">Price per seat<input type="number" min={0} step="0.01" className={`${field} mt-1`} value={settings.seatPrice} onChange={(e) => onUpdate({ seatPrice: Number(e.target.value) })} /></label> : null}
              {(settings.paymentMode === "per_table" || settings.paymentMode === "mixed") ? <label className="text-xs font-semibold text-slate-300">Price per table<input type="number" min={0} step="0.01" className={`${field} mt-1`} value={settings.tablePrice} onChange={(e) => onUpdate({ tablePrice: Number(e.target.value) })} /></label> : null}
              <label className="text-xs font-semibold text-slate-300">Currency<input className={`${field} mt-1 uppercase`} maxLength={3} value={settings.currency} onChange={(e) => onUpdate({ currency: e.target.value.toUpperCase() })} /></label>
            </div> : null}
          </section>
        </div>

        <div className="space-y-4">
          <section className="border border-slate-700 bg-slate-900/70 p-4">
            <h2 className="font-semibold text-white">Payment handoff</h2>
            <p className="mt-1 text-xs leading-5 text-slate-400">Oyama records what is due. For online payment, paste a hosted Stripe Payment Link or PayPal checkout URL. Payment stays pending until staff or a future verified webhook marks it paid.</p>
            <label className="mt-3 block text-xs font-semibold text-slate-300">Provider<select className={`${field} mt-1`} value={settings.paymentProvider} onChange={(e) => onUpdate({ paymentProvider: e.target.value as TriviaRegistrationSettings["paymentProvider"] })}><option value="offline">Offline / pay at event</option><option value="stripe">Stripe hosted checkout</option><option value="paypal">PayPal hosted checkout</option></select></label>
            {settings.paymentProvider !== "offline" ? <label className="mt-3 block text-xs font-semibold text-slate-300">Secure checkout URL<input className={`${field} mt-1`} value={settings.paymentUrl} onChange={(e) => onUpdate({ paymentUrl: e.target.value })} placeholder={settings.paymentProvider === "stripe" ? "https://buy.stripe.com/…" : "https://paypal.me/…"} /></label> : null}
            <label className="mt-3 block text-xs font-semibold text-slate-300">Payment instructions<textarea className="mt-1 min-h-24 w-full border border-slate-600 bg-slate-950 p-3 text-sm text-white" value={settings.paymentInstructions} onChange={(e) => onUpdate({ paymentInstructions: e.target.value })} /></label>
          </section>

          <section className="border border-violet-500/40 bg-violet-500/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-violet-200">Invitation sender</p>
            <h2 className="mt-1 font-semibold text-white">Invite one person or a list</h2>
            <p className="mt-1 text-xs leading-5 text-slate-300">Paste one address per line, comma-separated addresses, or entries like <span className="font-mono text-violet-200">Jane Doe &lt;jane@example.org&gt;</span>. Suppressed, unsubscribed, duplicate, and invalid addresses are skipped automatically.</p>
            <label className="mt-3 block text-xs font-semibold text-slate-300">Recipients<textarea value={inviteRecipients} onChange={(e) => setInviteRecipients(e.target.value)} className="mt-1 min-h-32 w-full border border-slate-600 bg-slate-950 p-3 text-sm text-white outline-none focus:border-violet-400" placeholder={"jane@example.org\nAlex Smith <alex@example.org>"} /></label>
            <p className="mt-1 text-xs text-slate-400">{parsedInviteRecipients.length} recipient{parsedInviteRecipients.length === 1 ? "" : "s"} ready for review · maximum 200</p>
            <label className="mt-3 block text-xs font-semibold text-slate-300">Subject<input className={`${field} mt-1`} value={inviteSubject} onChange={(e) => setInviteSubject(e.target.value)} /></label>
            <label className="mt-3 block text-xs font-semibold text-slate-300">Invitation message<textarea value={inviteMessage} onChange={(e) => setInviteMessage(e.target.value)} className="mt-1 min-h-24 w-full border border-slate-600 bg-slate-950 p-3 text-sm text-white outline-none focus:border-violet-400" /></label>
            <label className="mt-3 flex items-start gap-2 border border-slate-700 bg-slate-950 p-3 text-xs text-slate-300"><input type="checkbox" checked={invitePermission} onChange={(e) => setInvitePermission(e.target.checked)} className="mt-0.5" /> I confirm these recipients may receive this event invitation. Email preferences, do-not-contact flags, and suppressions will still be enforced.</label>
            <button type="button" disabled={sendingInvites || !settings.enabled || syncMode !== "server" || connectionStatus !== "connected" || parsedInviteRecipients.length === 0 || parsedInviteRecipients.length > 200 || !invitePermission || !inviteSubject.trim()} onClick={() => void sendInvitations()} className="mt-3 min-h-11 w-full bg-violet-600 px-4 text-sm font-semibold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">{sendingInvites ? "Sending invitations…" : `Send ${parsedInviteRecipients.length || ""} invitation${parsedInviteRecipients.length === 1 ? "" : "s"}`}</button>
            {!settings.enabled ? <p className="mt-2 text-xs text-amber-200">Publish the public page before sending invitations.</p> : null}
            {inviteResult ? <p className="mt-3 text-xs leading-5 text-violet-100" aria-live="polite">{inviteResult}</p> : null}
          </section>

          <section className="border border-cyan-500/40 bg-cyan-500/10 p-4">
            <h2 className="font-semibold text-white">Publish and share</h2>
            <label className="mt-3 flex items-center justify-between gap-4 border border-slate-700 bg-slate-950 p-3 text-sm text-white"><span><strong>Publish public page</strong><small className="mt-0.5 block text-slate-400">Makes event details publicly readable.</small></span><input type="checkbox" disabled={syncMode !== "server" || connectionStatus !== "connected" || !paymentReady} checked={settings.enabled} onChange={(e) => onUpdate({ enabled: e.target.checked, signupOpen: e.target.checked ? settings.signupOpen : false })} /></label>
            <label className="mt-2 flex items-center justify-between gap-4 border border-slate-700 bg-slate-950 p-3 text-sm text-white"><span><strong>Open signup</strong><small className="mt-0.5 block text-slate-400">Allows new registrations while capacity remains.</small></span><input type="checkbox" disabled={!settings.enabled || syncMode !== "server" || connectionStatus !== "connected" || !paymentReady} checked={settings.signupOpen} onChange={(e) => onUpdate({ signupOpen: e.target.checked })} /></label>
            {!paymentReady ? <p className="mt-2 text-xs text-amber-200">Publishing is blocked until the hosted payment URL begins with https://.</p> : null}
            <label className="mt-3 block text-xs font-semibold text-slate-300">Complete public URL<input readOnly className={`${field} mt-1`} value={publicUrl} /></label>
            <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => void copy(publicUrl)} className="bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950">Copy signup link</button><a href={publicUrl} target="_blank" rel="noopener noreferrer" className="border border-cyan-400/60 px-3 py-2 text-center text-sm font-semibold text-cyan-100">Open page ↗</a></div>
            <p className="mt-3 text-xs leading-5 text-slate-300">Successful RSVPs automatically receive a confirmation email with the table number, named members, check-in code, amount due, and payment link or instructions.</p>
            {message ? <p className="mt-3 text-xs text-cyan-100">{message}</p> : null}
          </section>
        </div>
      </div>
    </section>
  );
}
