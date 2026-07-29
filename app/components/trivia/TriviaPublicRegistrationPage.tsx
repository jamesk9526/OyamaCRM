"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { API_BASE } from "@/app/lib/auth-client";

interface PublicPayload {
  event: { id: string; name: string; venue: string; hostName: string; startAt: string };
  registration: {
    signupOpen: boolean; publicSlug: string; headline: string; description: string; accentColor: string; contactEmail: string;
    maximumTables: number; maximumSeatsPerTable: number; collectMemberNames: boolean; paymentMode: "free" | "per_seat" | "per_table" | "mixed";
    seatPrice: number; tablePrice: number; currency: string; paymentProvider: "offline" | "stripe" | "paypal"; paymentUrl: string;
    paymentInstructions: string; confirmationMessage: string;
  };
  availability: { registeredTables: number; remainingTables: number };
}

interface Confirmation {
  registration: { teamId: string; teamName: string; tableHostName: string; registrationCode: string; tableNumber: string; seatCount: number; amountDue: number; currency: string; paymentStatus: string };
  payment: { provider: string; checkoutUrl: string; instructions: string };
  confirmationMessage: string;
  email?: { status: "sent" | "skipped" | "failed"; detail: string };
}

function money(amount: number, currency: string): string {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

export default function TriviaPublicRegistrationPage({ slug }: { slug: string }) {
  const [payload, setPayload] = useState<PublicPayload | null>(null);
  const [loadError, setLoadError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [form, setForm] = useState({
    teamName: "", tableHostName: "", contactEmail: "", contactPhone: "", seatCount: 4, members: "", paymentChoice: "table" as "table" | "seat",
    payerName: "", payerEmail: "", notes: "", consent: false,
  });

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API_BASE}/api/apps/trivia/public/registration/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.error?.message ?? "This event page is unavailable.");
        setPayload(body as PublicPayload);
      })
      .catch((requestError) => { if (requestError?.name !== "AbortError") setLoadError(requestError instanceof Error ? requestError.message : "This event page is unavailable."); });
    return () => controller.abort();
  }, [slug]);

  const amountDue = useMemo(() => {
    if (!payload || payload.registration.paymentMode === "free") return 0;
    const choice = payload.registration.paymentMode === "per_table" ? "table" : payload.registration.paymentMode === "per_seat" ? "seat" : form.paymentChoice;
    return choice === "table" ? payload.registration.tablePrice : payload.registration.seatPrice * form.seatCount;
  }, [form.paymentChoice, form.seatCount, payload]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!payload || !form.consent) { setError("Confirm that the event organizer may use these details for registration and check-in."); return; }
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/apps/trivia/public/registration/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          members: form.members.split("\n").map((name) => name.trim()).filter(Boolean),
          payerName: form.payerName || form.tableHostName,
          payerEmail: form.payerEmail || form.contactEmail,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message ?? "Registration could not be completed.");
      setConfirmation(body as Confirmation);
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Registration could not be completed."); }
    finally { setSubmitting(false); }
  }

  if (loadError) return <main className="flex min-h-screen items-center justify-center bg-[#07111f] p-5 text-white"><div className="max-w-lg border border-rose-400/40 bg-rose-500/10 p-6"><h1 className="text-xl font-semibold">Registration unavailable</h1><p className="mt-2 text-sm text-rose-100">{loadError}</p></div></main>;
  if (!payload) return <main className="flex min-h-screen items-center justify-center bg-[#07111f] text-cyan-100"><p>Loading trivia night…</p></main>;
  const { registration, availability } = payload;
  const accent = registration.accentColor || "#38bdf8";
  const input = "mt-1 h-11 w-full rounded-md border border-slate-600 bg-[#0b1728] px-3 text-sm text-white outline-none focus:border-cyan-400";

  if (confirmation) return (
    <main className="min-h-screen bg-[#07111f] p-5 text-white">
      <section className="mx-auto mt-10 max-w-2xl overflow-hidden rounded-2xl border border-emerald-400/40 bg-[#0d1b2e] shadow-2xl">
        <div className="p-7 text-center" style={{ background: `linear-gradient(135deg, ${accent}33, transparent)` }}><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">Registration confirmed</p><h1 className="mt-2 text-3xl font-semibold">{confirmation.registration.teamName}</h1><p className="mt-2 text-slate-300">{confirmation.confirmationMessage}</p></div>
        <div className="grid gap-3 border-y border-slate-700 bg-[#081321] p-5 sm:grid-cols-3"><div><p className="text-xs text-slate-400">Table</p><p className="mt-1 text-lg font-semibold">{confirmation.registration.tableNumber}</p></div><div><p className="text-xs text-slate-400">Seats</p><p className="mt-1 text-lg font-semibold">{confirmation.registration.seatCount}</p></div><div><p className="text-xs text-slate-400">Amount due</p><p className="mt-1 text-lg font-semibold">{money(confirmation.registration.amountDue, confirmation.registration.currency)}</p></div></div>
        <div className="p-7 text-center"><p className="text-sm text-slate-300">Show this four-digit code at check-in</p><p className="mt-3 font-mono text-5xl font-bold tracking-[0.32em]" style={{ color: accent }}>{confirmation.registration.registrationCode}</p>{confirmation.email ? <p className={`mx-auto mt-4 max-w-lg rounded-md border p-3 text-sm ${confirmation.email.status === "sent" ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100" : "border-amber-400/40 bg-amber-500/10 text-amber-100"}`}>{confirmation.email.detail}</p> : null}<p className="mt-5 text-sm text-slate-300">{confirmation.payment.instructions}</p>{confirmation.payment.checkoutUrl ? <a href={confirmation.payment.checkoutUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex min-h-12 items-center justify-center rounded-md px-6 text-sm font-semibold text-slate-950" style={{ backgroundColor: accent }}>Continue to {confirmation.payment.provider === "stripe" ? "Stripe" : "PayPal"} payment ↗</a> : null}<p className="mt-4 text-xs text-slate-500">Save this page or write down your code. Online payments remain pending until confirmed by event staff.</p></div>
      </section>
    </main>
  );

  return (
    <main className="min-h-screen bg-[#07111f] text-white">
      <header className="border-b border-slate-700 bg-[#091628] px-5 py-4"><div className="mx-auto flex max-w-6xl items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg font-bold text-slate-950" style={{ backgroundColor: accent }}>T</span><div><p className="font-semibold">Oyama Trivia</p><p className="text-xs text-slate-400">Public event registration</p></div></div></header>
      <section className="border-b border-slate-700 px-5 py-12" style={{ background: `radial-gradient(circle at 20% 10%, ${accent}33, transparent 42%), #081321` }}><div className="mx-auto max-w-6xl"><p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: accent }}>Join the game</p><h1 className="mt-3 max-w-4xl text-4xl font-semibold sm:text-5xl">{registration.headline}</h1><p className="mt-4 max-w-3xl text-lg leading-8 text-slate-300">{registration.description}</p><div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-200"><span className="rounded-full border border-slate-600 bg-slate-900/60 px-4 py-2">{new Date(payload.event.startAt).toLocaleString([], { dateStyle: "long", timeStyle: "short" })}</span><span className="rounded-full border border-slate-600 bg-slate-900/60 px-4 py-2">{payload.event.venue || "Venue to be announced"}</span><span className="rounded-full border border-slate-600 bg-slate-900/60 px-4 py-2">{availability.remainingTables} tables remaining</span></div></div></section>
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 lg:grid-cols-[1fr_340px]">
        <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-700 bg-[#0d1b2e] p-5 sm:p-7">
          <div><p className="text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>Team registration</p><h2 className="mt-1 text-2xl font-semibold">Reserve your place</h2></div>
          {!registration.signupOpen ? <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-4 text-sm text-amber-100">Online signup is currently closed.{registration.contactEmail ? <> Contact <a className="underline" href={`mailto:${registration.contactEmail}`}>{registration.contactEmail}</a>.</> : null}</div> : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-200">Team name<input required className={input} value={form.teamName} onChange={(e) => setForm((current) => ({ ...current, teamName: e.target.value }))} /></label>
            <label className="text-sm font-semibold text-slate-200">Table host name<input required className={input} value={form.tableHostName} onChange={(e) => setForm((current) => ({ ...current, tableHostName: e.target.value }))} /></label>
            <label className="text-sm font-semibold text-slate-200">Contact email<input required type="email" className={input} value={form.contactEmail} onChange={(e) => setForm((current) => ({ ...current, contactEmail: e.target.value }))} /></label>
            <label className="text-sm font-semibold text-slate-200">Contact phone<input className={input} value={form.contactPhone} onChange={(e) => setForm((current) => ({ ...current, contactPhone: e.target.value }))} /></label>
          </div>
          {registration.paymentMode === "mixed" ? <div><p className="text-sm font-semibold text-slate-200">How are you registering?</p><div className="mt-2 grid grid-cols-2 gap-2"><button type="button" onClick={() => setForm((current) => ({ ...current, paymentChoice: "table" }))} className={`min-h-12 rounded-md border text-sm font-semibold ${form.paymentChoice === "table" ? "border-cyan-400 bg-cyan-500/20" : "border-slate-600 bg-[#081321]"}`}>Whole table · {money(registration.tablePrice, registration.currency)}</button><button type="button" onClick={() => setForm((current) => ({ ...current, paymentChoice: "seat" }))} className={`min-h-12 rounded-md border text-sm font-semibold ${form.paymentChoice === "seat" ? "border-cyan-400 bg-cyan-500/20" : "border-slate-600 bg-[#081321]"}`}>Individual seats · {money(registration.seatPrice, registration.currency)} each</button></div></div> : null}
          <label className="block text-sm font-semibold text-slate-200">Number of team members<input type="number" min={1} max={registration.maximumSeatsPerTable} className={`${input} max-w-40`} value={form.seatCount} onChange={(e) => setForm((current) => ({ ...current, seatCount: Math.max(1, Math.min(registration.maximumSeatsPerTable, Number(e.target.value) || 1)) }))} /></label>
          {registration.collectMemberNames ? <label className="block text-sm font-semibold text-slate-200">Team member names<textarea className="mt-1 min-h-32 w-full rounded-md border border-slate-600 bg-[#0b1728] p-3 text-sm text-white outline-none focus:border-cyan-400" value={form.members} onChange={(e) => setForm((current) => ({ ...current, members: e.target.value }))} placeholder="One person per line" /><span className="mt-1 block text-xs font-normal text-slate-400">Add up to {registration.maximumSeatsPerTable} names. You can update the roster with event staff later.</span></label> : null}
          {amountDue > 0 ? <div className="grid gap-4 border border-slate-700 bg-[#081321] p-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-200">Name responsible for payment<input className={input} value={form.payerName} onChange={(e) => setForm((current) => ({ ...current, payerName: e.target.value }))} placeholder={form.tableHostName || "Payer name"} /></label><label className="text-sm font-semibold text-slate-200">Payer email<input type="email" className={input} value={form.payerEmail} onChange={(e) => setForm((current) => ({ ...current, payerEmail: e.target.value }))} placeholder={form.contactEmail || "Payer email"} /></label></div> : null}
          <label className="block text-sm font-semibold text-slate-200">Notes or accessibility needs<textarea className="mt-1 min-h-20 w-full rounded-md border border-slate-600 bg-[#0b1728] p-3 text-sm text-white" value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} /></label>
          <label className="flex items-start gap-3 text-sm text-slate-300"><input required type="checkbox" className="mt-1" checked={form.consent} onChange={(e) => setForm((current) => ({ ...current, consent: e.target.checked }))} /> I agree to share this information with the event organizer for registration, payment follow-up, table management, and check-in.</label>
          {error ? <p className="rounded-md border border-rose-400/40 bg-rose-500/10 p-3 text-sm text-rose-100" aria-live="polite">{error}</p> : null}
          <button disabled={submitting || !registration.signupOpen || availability.remainingTables <= 0} className="min-h-12 w-full rounded-md text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50" style={{ backgroundColor: accent }}>{submitting ? "Reserving…" : availability.remainingTables <= 0 ? "Event is full" : amountDue > 0 ? `Reserve · ${money(amountDue, registration.currency)} due` : "Register team"}</button>
        </form>
        <aside className="space-y-4">
          <section className="rounded-xl border border-slate-700 bg-[#0d1b2e] p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Your reservation</p><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt className="text-slate-400">Seats</dt><dd className="font-semibold">{form.seatCount}</dd></div><div className="flex justify-between gap-3"><dt className="text-slate-400">Payment basis</dt><dd className="font-semibold capitalize">{registration.paymentMode === "mixed" ? form.paymentChoice : registration.paymentMode.replace("per_", "")}</dd></div><div className="flex justify-between gap-3 border-t border-slate-700 pt-3"><dt className="text-slate-300">Amount due</dt><dd className="text-lg font-semibold" style={{ color: accent }}>{money(amountDue, registration.currency)}</dd></div></dl></section>
          <section className="rounded-xl border border-slate-700 bg-[#0d1b2e] p-5"><h3 className="font-semibold">What happens next?</h3><ol className="mt-3 space-y-3 text-sm text-slate-300"><li><strong className="text-white">1.</strong> Your table is reserved immediately.</li><li><strong className="text-white">2.</strong> You receive a four-digit check-in code.</li>{amountDue > 0 ? <li><strong className="text-white">3.</strong> Continue to {registration.paymentProvider === "offline" ? "the organizer's payment instructions" : `${registration.paymentProvider} checkout`}.</li> : null}</ol></section>
        </aside>
      </div>
    </main>
  );
}
