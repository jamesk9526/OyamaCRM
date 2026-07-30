"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";

type AudienceDonor = { id: string; name: string; email: string | null; address: string; canMail: boolean; canEmail: boolean; giftCount: number; totalAmount: number };
type SavedAudience = { id: string; name: string; description: string; from: string; through: string; constituentIds: string[]; mailRecipientIds: string[]; recipientEmails: string[]; createdAt: string; updatedAt: string };

function localDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

export default function DonationAudienceTool({ onBack }: { onBack: () => void }) {
  const router = useRouter();
  const [from, setFrom] = useState(() => localDate(new Date(new Date().getFullYear(), 0, 1)));
  const [through, setThrough] = useState(() => localDate(new Date()));
  const [donors, setDonors] = useState<AudienceDonor[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [audiences, setAudiences] = useState<SavedAudience[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadAudiences = useCallback(async () => {
    try {
      const response = await apiFetch<{ audiences: SavedAudience[] }>("/api/reports/tools/donation-audiences");
      setAudiences(response.audiences ?? []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load saved audiences.");
    }
  }, []);

  useEffect(() => { void loadAudiences(); }, [loadAudiences]);

  const selectedDonors = useMemo(() => donors.filter((donor) => selectedIds.has(donor.id)), [donors, selectedIds]);
  const mailReady = selectedDonors.filter((donor) => donor.canMail);
  const recipientEmails = selectedDonors.filter((donor) => donor.canEmail).flatMap((donor) => donor.email ? [donor.email] : []);

  async function findDonors() {
    setLoading(true); setError(null); setMessage(null);
    try {
      const result = await apiFetch<{ donors: AudienceDonor[] }>(`/api/reports/tools/donation-audience?${new URLSearchParams({ from, through })}`);
      const rows = result.donors ?? [];
      setDonors(rows);
      setSelectedIds(new Set(rows.map((donor) => donor.id)));
      setName(`Donors who gave ${from} to ${through}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to find donors for this range.");
    } finally { setLoading(false); }
  }

  async function saveAudience() {
    if (!name.trim() || selectedDonors.length === 0) return;
    setSaving(true); setError(null); setMessage(null);
    try {
      const result = await apiFetch<{ audiences: SavedAudience[] }>("/api/reports/tools/donation-audiences", {
        method: "POST",
        body: JSON.stringify({ name, description, from, through, constituentIds: selectedDonors.map((donor) => donor.id), mailRecipientIds: mailReady.map((donor) => donor.id), recipientEmails }),
      });
      setAudiences(result.audiences ?? []);
      setMessage("Audience saved. It can be reused for letters or email drafts.");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to save this audience."); }
    finally { setSaving(false); }
  }

  async function deleteAudience(id: string) {
    if (!window.confirm("Delete this saved audience?")) return;
    try {
      const result = await apiFetch<{ audiences: SavedAudience[] }>(`/api/reports/tools/donation-audiences/${id}`, { method: "DELETE" });
      setAudiences(result.audiences ?? []); setMessage("Saved audience deleted.");
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Unable to delete this audience."); }
  }

  function openLetters(list: { name: string; constituentIds: string[]; mailRecipientIds?: string[] }) {
    const usable = (list.mailRecipientIds?.length ? list.mailRecipientIds : list.constituentIds).filter(Boolean);
    if (!usable.length) { setError("This audience has no donors eligible for the letters workspace."); return; }
    const id = `report-audience-${Date.now()}`;
    window.sessionStorage.setItem(`oyama-letters:temporary-recipient-list:${id}`, JSON.stringify({ name: list.name, constituentIds: usable, donationIds: [], createdAt: new Date().toISOString() }));
    router.push(`/oyama-letters/generate?mode=batch&temporaryListId=${encodeURIComponent(id)}&source=reports`);
  }

  function openEmail(list: { name: string; recipientEmails: string[] }) {
    const emails = Array.from(new Set(list.recipientEmails.map((email) => email.trim().toLowerCase()).filter(Boolean)));
    if (!emails.length) { setError("This audience has no email-eligible donors. Review contact preferences or use Letters."); return; }
    const id = `report-audience-${Date.now()}`;
    window.sessionStorage.setItem(`oyama-email:temporary-recipient-segment:${id}`, JSON.stringify({ name: list.name, recipientEmails: emails, donationIds: [], createdAt: new Date().toISOString(), source: "reports" }));
    router.push(`/oyama-email/campaigns/new?temporarySegmentId=${encodeURIComponent(id)}&source=reports`);
  }

  return <section className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
    <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#f8fbff_0%,#edf5fc_58%,#fff_100%)] px-5 py-5">
      <button type="button" onClick={onBack} className="text-sm font-medium text-[#0f6cbd] hover:underline">← All reports</button>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-[#0f6cbd]">New report tool</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Donation date-range audience</h1>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Find donors who gave in a date range, verify their mailing addresses, save the audience, then start a batch letter or an email draft.</p>
    </div>
    <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-semibold text-slate-700">Start date<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 block rounded border border-slate-300 bg-white px-2 py-2 text-sm font-normal" /></label>
        <label className="text-xs font-semibold text-slate-700">End date<input type="date" value={through} onChange={(event) => setThrough(event.target.value)} className="mt-1 block rounded border border-slate-300 bg-white px-2 py-2 text-sm font-normal" /></label>
        <button type="button" onClick={() => void findDonors()} disabled={loading || !from || !through} className="rounded bg-[#0f6cbd] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0b5a9d] disabled:opacity-60">{loading ? "Finding donors..." : "Find donors"}</button>
      </div>
    </div>
    <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr),310px]">
      <div>
        {error ? <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
        {message ? <p className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}
        {!donors.length ? <p className="rounded border border-dashed border-slate-300 px-4 py-12 text-center text-sm text-slate-500">Choose a date range and select Find donors to build a live audience.</p> : <>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600"><span><strong className="text-slate-900">{selectedDonors.length}</strong> selected · {mailReady.length} mail-ready · {recipientEmails.length} email-ready</span><button type="button" onClick={() => setSelectedIds(new Set(selectedIds.size === donors.length ? [] : donors.map((donor) => donor.id)))} className="font-semibold text-[#0f6cbd] hover:underline">{selectedIds.size === donors.length ? "Clear selection" : "Select all"}</button></div>
          <div className="overflow-x-auto rounded border border-slate-300"><table className="min-w-full text-sm"><thead className="bg-[#5d5d5d] text-left text-xs text-white"><tr><th className="px-3 py-2">Use</th><th className="px-3 py-2">Donor</th><th className="px-3 py-2">Mailing address</th><th className="px-3 py-2">Contact readiness</th><th className="px-3 py-2 text-right">Gifts</th></tr></thead><tbody>{donors.map((donor) => <tr key={donor.id} className="border-t border-slate-200"><td className="px-3 py-2"><input type="checkbox" checked={selectedIds.has(donor.id)} onChange={() => setSelectedIds((current) => { const next = new Set(current); if (next.has(donor.id)) next.delete(donor.id); else next.add(donor.id); return next; })} aria-label={`Include ${donor.name}`} /></td><td className="px-3 py-2 font-medium text-slate-900">{donor.name}<span className="block text-xs font-normal text-slate-500">{donor.email || "No email"}</span></td><td className="px-3 py-2 text-slate-700">{donor.address || <span className="font-medium text-amber-700">No mailing address</span>}</td><td className="px-3 py-2 text-xs"><span className={donor.canMail ? "text-emerald-700" : "text-slate-400"}>Mail {donor.canMail ? "ready" : "blocked"}</span><br /><span className={donor.canEmail ? "text-emerald-700" : "text-slate-400"}>Email {donor.canEmail ? "ready" : "blocked"}</span></td><td className="px-3 py-2 text-right tabular-nums">{donor.giftCount} · ${donor.totalAmount.toFixed(2)}</td></tr>)}</tbody></table></div>
        </>}
      </div>
      <aside className="space-y-4"><div className="rounded border border-slate-200 bg-slate-50 p-4"><h2 className="font-semibold text-slate-900">Save this audience</h2><label className="mt-3 block text-xs font-semibold text-slate-700">Audience name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm font-normal" /></label><label className="mt-3 block text-xs font-semibold text-slate-700">Notes<textarea value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 w-full rounded border border-slate-300 bg-white px-2 py-2 text-sm font-normal" rows={3} /></label><button type="button" onClick={() => void saveAudience()} disabled={saving || !name.trim() || !selectedDonors.length} className="mt-3 w-full rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">{saving ? "Saving..." : "Save audience"}</button></div>
      <div className="rounded border border-slate-200 p-4"><h2 className="font-semibold text-slate-900">Start from this selection</h2><button type="button" onClick={() => openLetters({ name: name.trim() || `Donors ${from} to ${through}`, constituentIds: mailReady.map((donor) => donor.id) })} disabled={!mailReady.length} className="mt-3 w-full rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Generate letters ({mailReady.length})</button><button type="button" onClick={() => openEmail({ name: name.trim() || `Donors ${from} to ${through}`, recipientEmails })} disabled={!recipientEmails.length} className="mt-2 w-full rounded border border-[#0f6cbd] bg-[#eff6fc] px-3 py-2 text-sm font-semibold text-[#0f548c] hover:bg-[#dceefa] disabled:opacity-60">Create email ({recipientEmails.length})</button></div>
      <div className="rounded border border-slate-200 p-4"><h2 className="font-semibold text-slate-900">Saved audiences</h2><div className="mt-3 space-y-2">{audiences.length ? audiences.map((audience) => <div key={audience.id} className="rounded border border-slate-200 p-2"><p className="font-medium text-slate-900">{audience.name}</p><p className="text-xs text-slate-500">{audience.constituentIds.length} donors · {audience.from} to {audience.through}</p><div className="mt-2 flex flex-wrap gap-2"><button type="button" onClick={() => openLetters(audience)} className="text-xs font-semibold text-[#0f6cbd] hover:underline">Letters</button><button type="button" onClick={() => openEmail(audience)} className="text-xs font-semibold text-[#0f6cbd] hover:underline">Email</button><button type="button" onClick={() => void deleteAudience(audience.id)} className="text-xs font-semibold text-red-700 hover:underline">Delete</button></div></div>) : <p className="text-sm text-slate-500">No saved audiences yet.</p>}</div></div></aside>
    </div>
  </section>;
}
