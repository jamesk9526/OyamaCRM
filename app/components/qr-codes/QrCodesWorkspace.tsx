"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { BarChart3, Check, Copy, Download, ExternalLink, Link2, Loader2, Pause, Play, Plus, QrCode, RefreshCw, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import QRCode from "qrcode";
import EnterprisePageShell from "@/app/components/layout/EnterprisePageShell";
import CRMPageHeader from "@/app/components/ui/crm/CRMPageHeader";
import CRMCard from "@/app/components/ui/crm/CRMCard";
import ActionButton from "@/app/components/ui/ActionButton";
import { apiFetch } from "@/app/lib/auth-client";

interface QrLink {
  id: string;
  name: string;
  slug: string;
  destinationUrl: string;
  notes?: string | null;
  shortUrl: string;
  active: boolean;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  scanCount: number;
  lastScannedAt?: string | null;
}

interface LinkListResponse {
  items: QrLink[];
  summary: { totalLinks: number; activeLinks: number; totalScans: number; uniqueVisitors: number };
}

interface Analytics {
  days: number;
  totals: { scans: number; uniqueVisitors: number };
  daily: Array<{ date: string; count: number }>;
  devices: Array<{ device: string; count: number }>;
  recentScans: Array<{ id: string; scannedAt: string; device: string; referrer?: string | null }>;
}

const EMPTY_SUMMARY = { totalLinks: 0, activeLinks: 0, totalScans: 0, uniqueVisitors: 0 };
const fieldClass = "mt-1.5 min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-100";

function readableDate(value?: string | null, includeTime = false): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}

/** Complete responsive workspace for creating redirectable QR codes and reviewing scans. */
export default function QrCodesWorkspace() {
  const [data, setData] = useState<LinkListResponse>({ items: [], summary: EMPTY_SUMMARY });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [days, setDays] = useState(30);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({ name: "", destinationUrl: "", slug: "", expiresAt: "", notes: "" });

  const selected = useMemo(() => data.items.find((item) => item.id === selectedId) ?? null, [data.items, selectedId]);

  const loadLinks = useCallback(async (preferredId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<LinkListResponse>("/api/qr-codes");
      setData(response);
      setSelectedId((current) => preferredId ?? (response.items.some((item) => item.id === current) ? current : response.items[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "QR codes could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadLinks(); }, [loadLinks]);

  useEffect(() => {
    if (!selected) { setQrDataUrl(""); setAnalytics(null); return; }
    let cancelled = false;
    void QRCode.toDataURL(selected.shortUrl, { width: 720, margin: 3, errorCorrectionLevel: "H", color: { dark: "#0f172a", light: "#ffffff" } })
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setError("The QR image could not be generated."); });
    void apiFetch<Analytics>(`/api/qr-codes/${selected.id}/analytics?days=${days}`)
      .then(setAnalytics)
      .catch((err) => setError(err instanceof Error ? err.message : "Analytics could not be loaded."));
    return () => { cancelled = true; };
  }, [selected, days]);

  async function createLink(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError(null); setNotice(null);
    try {
      const created = await apiFetch<QrLink>("/api/qr-codes", { method: "POST", body: JSON.stringify({ ...form, slug: form.slug || undefined, expiresAt: form.expiresAt || null }) });
      setForm({ name: "", destinationUrl: "", slug: "", expiresAt: "", notes: "" });
      setShowCreate(false);
      setNotice("QR code created. Its destination can be changed without reprinting the code.");
      await loadLinks(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "QR code could not be created.");
    } finally { setSaving(false); }
  }

  async function updateSelected(patch: Partial<Pick<QrLink, "name" | "destinationUrl" | "active" | "notes">>) {
    if (!selected) return;
    setSaving(true); setError(null);
    try {
      await apiFetch(`/api/qr-codes/${selected.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setNotice(patch.active === undefined ? "QR link updated." : patch.active ? "QR link activated." : "QR link paused. Scans will show an inactive message.");
      await loadLinks(selected.id);
    } catch (err) { setError(err instanceof Error ? err.message : "QR code could not be updated."); }
    finally { setSaving(false); }
  }

  async function deleteSelected() {
    if (!selected || !window.confirm(`Delete “${selected.name}” and its scan history? This cannot be undone.`)) return;
    setSaving(true); setError(null);
    try {
      await apiFetch(`/api/qr-codes/${selected.id}`, { method: "DELETE" });
      setNotice("QR code and scan history deleted.");
      await loadLinks();
    } catch (err) { setError(err instanceof Error ? err.message : "QR code could not be deleted."); }
    finally { setSaving(false); }
  }

  async function copyShortUrl() {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.shortUrl);
    setCopied(true); setTimeout(() => setCopied(false), 1800);
  }

  function downloadQr() {
    if (!selected || !qrDataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = qrDataUrl;
    anchor.download = `${selected.slug}-qr-code.png`;
    anchor.click();
  }

  const maxDaily = Math.max(1, ...(analytics?.daily.map((item) => item.count) ?? [1]));

  return (
    <EnterprisePageShell>
      <div className="space-y-4 pb-8">
        <CRMPageHeader
          breadcrumb={<><Link href="/" className="hover:text-emerald-700">Donor CRM</Link><span aria-hidden="true">/</span><span>QR Codes</span></>}
          title="QR codes & trackable links"
          description="Create one durable QR code, update where it sends people later, and measure scans without storing raw IP addresses."
          primaryAction={<ActionButton label="Create QR code" icon={<Plus size={16} />} variant="primary" size="md" onClick={() => setShowCreate(true)} />}
          secondaryActions={<ActionButton label="Refresh" icon={<RefreshCw size={15} />} onClick={() => void loadLinks(selectedId ?? undefined)} disabled={loading} />}
        />

        {error ? <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
        {notice ? <div role="status" className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><Check className="mt-0.5 shrink-0" size={16} />{notice}</div> : null}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["QR links", data.summary.totalLinks, "Created links"], ["Active", data.summary.activeLinks, "Accepting scans"],
            ["Total scans", data.summary.totalScans, "All time"], ["Unique visitors", data.summary.uniqueVisitors, "Privacy-safe estimate"],
          ].map(([label, value, helper]) => <CRMCard key={String(label)} padding="sm"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-2xl font-semibold text-slate-950">{loading ? "—" : Number(value).toLocaleString()}</p><p className="mt-1 text-xs text-slate-500">{helper}</p></CRMCard>)}
        </div>

        {showCreate ? (
          <CRMCard className="border-emerald-300" padding="lg">
            <form onSubmit={createLink} className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-base font-semibold text-slate-950">Create a trackable QR code</h2><p className="mt-1 text-sm text-slate-600">The printed code points to a short link, so the final destination remains editable.</p></div><button type="button" onClick={() => setShowCreate(false)} className="min-h-11 rounded-md px-3 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button></div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-sm font-medium text-slate-700">Name<span className="text-red-600"> *</span><input required maxLength={160} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={fieldClass} placeholder="Fall appeal postcard" /></label>
                <label className="text-sm font-medium text-slate-700">Destination URL<span className="text-red-600"> *</span><input required type="url" value={form.destinationUrl} onChange={(e) => setForm({ ...form, destinationUrl: e.target.value })} className={fieldClass} placeholder="https://example.org/donate" /></label>
                <label className="text-sm font-medium text-slate-700">Custom alias <span className="font-normal text-slate-500">(optional)</span><input pattern="[a-zA-Z0-9][a-zA-Z0-9-]{1,62}[a-zA-Z0-9]" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} className={fieldClass} placeholder="fall-appeal" /><span className="mt-1 block text-xs font-normal text-slate-500">3–64 letters, numbers, and hyphens.</span></label>
                <label className="text-sm font-medium text-slate-700">Expiration <span className="font-normal text-slate-500">(optional)</span><input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} className={fieldClass} /></label>
              </div>
              <label className="block text-sm font-medium text-slate-700">Internal notes <span className="font-normal text-slate-500">(optional)</span><textarea rows={3} maxLength={4000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={fieldClass} placeholder="Placement, print run, or campaign context" /></label>
              <div className="flex justify-end"><button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={16} /> : <QrCode size={16} />}Generate QR code</button></div>
            </form>
          </CRMCard>
        ) : null}

        <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(250px,0.7fr)_minmax(0,1.5fr)]">
          <CRMCard padding="none" className="min-w-0 overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3"><h2 className="font-semibold text-slate-950">Saved QR codes</h2><p className="mt-0.5 text-xs text-slate-500">Select a link to manage it and view tracking.</p></div>
            <div className="max-h-[680px] overflow-y-auto">
              {loading ? <div className="flex items-center gap-2 p-5 text-sm text-slate-500"><Loader2 className="animate-spin" size={16} />Loading QR codes…</div> : null}
              {!loading && data.items.length === 0 ? <div className="p-6 text-center"><QrCode className="mx-auto text-slate-400" size={30} /><p className="mt-3 font-medium text-slate-800">No QR codes yet</p><p className="mt-1 text-sm text-slate-500">Create one for print, signs, events, or direct mail.</p></div> : null}
              {data.items.map((item) => (
                <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`w-full border-b border-slate-100 px-4 py-3 text-left transition last:border-0 ${selectedId === item.id ? "bg-emerald-50 shadow-[inset_3px_0_0_#047857]" : "hover:bg-slate-50"}`}>
                  <span className="flex min-w-0 items-center justify-between gap-2"><span className="truncate text-sm font-semibold text-slate-900">{item.name}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.active ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>{item.active ? "Active" : "Paused"}</span></span>
                  <span className="mt-1 block truncate text-xs text-slate-500">/{item.slug} · {item.scanCount.toLocaleString()} scans</span>
                </button>
              ))}
            </div>
          </CRMCard>

          {selected ? (
            <div className="min-w-0 space-y-4">
              <CRMCard padding="lg">
                <div className="grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="flex min-w-0 flex-col items-center rounded-md border border-slate-200 bg-white p-4">
                    {qrDataUrl ? <Image src={qrDataUrl} alt={`QR code for ${selected.name}`} width={190} height={190} unoptimized className="aspect-square w-full max-w-[190px]" /> : <div className="flex aspect-square w-full max-w-[190px] items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-slate-400" /></div>}
                    <button type="button" onClick={downloadQr} disabled={!qrDataUrl} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Download size={16} />Download PNG</button>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Trackable redirect</p><h2 className="mt-1 break-words text-xl font-semibold text-slate-950">{selected.name}</h2></div><div className="flex flex-wrap gap-2"><ActionButton label={selected.active ? "Pause" : "Activate"} icon={selected.active ? <Pause size={15} /> : <Play size={15} />} onClick={() => void updateSelected({ active: !selected.active })} disabled={saving} /><ActionButton label="Delete" icon={<Trash2 size={15} />} variant="danger" onClick={() => void deleteSelected()} disabled={saving} /></div></div>
                    <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-medium text-slate-500">Short URL encoded in the QR image</p><div className="mt-1 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center"><code className="min-w-0 flex-1 break-all text-sm text-slate-800">{selected.shortUrl}</code><button type="button" onClick={() => void copyShortUrl()} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50">{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy"}</button></div></div>
                    <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); const fd = new FormData(event.currentTarget); void updateSelected({ name: String(fd.get("name")), destinationUrl: String(fd.get("destinationUrl")), notes: String(fd.get("notes")) }); }}>
                      <label className="block text-sm font-medium text-slate-700">Name<input name="name" key={`name-${selected.id}-${selected.updatedAt}`} defaultValue={selected.name} required maxLength={160} className={fieldClass} /></label>
                      <label className="block text-sm font-medium text-slate-700">Redirect destination<input name="destinationUrl" key={`url-${selected.id}-${selected.updatedAt}`} defaultValue={selected.destinationUrl} required type="url" className={fieldClass} /></label>
                      <label className="block text-sm font-medium text-slate-700">Internal notes<textarea name="notes" key={`notes-${selected.id}-${selected.updatedAt}`} defaultValue={selected.notes ?? ""} rows={2} maxLength={4000} className={fieldClass} /></label>
                      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-slate-500">Created {readableDate(selected.createdAt)} · Last scan {readableDate(selected.lastScannedAt, true)}</p><button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60">{saving && <Loader2 className="animate-spin" size={15} />}Save changes</button></div>
                    </form>
                  </div>
                </div>
              </CRMCard>

              <CRMCard padding="lg">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><BarChart3 size={18} className="text-emerald-700" /><h2 className="font-semibold text-slate-950">Scan analytics</h2></div><p className="mt-1 text-sm text-slate-500">Traffic for this QR code. Automated preview bots are labeled separately.</p></div><label className="text-sm font-medium text-slate-600">Period<select value={days} onChange={(e) => setDays(Number(e.target.value))} className="ml-2 min-h-11 rounded-md border border-slate-300 bg-white px-2"><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label></div>
                <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-slate-500">Scans in period</p><p className="mt-1 text-2xl font-semibold">{analytics?.totals.scans.toLocaleString() ?? "—"}</p></div><div className="rounded-md bg-slate-50 p-3"><p className="text-xs text-slate-500">Unique visitors</p><p className="mt-1 text-2xl font-semibold">{analytics?.totals.uniqueVisitors.toLocaleString() ?? "—"}</p></div></div>
                <div className="mt-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Daily scans</p><div className="mt-3 flex h-36 items-end gap-1 overflow-hidden" aria-label="Daily scan bar chart">{analytics?.daily.map((item) => <div key={item.date} className="group flex h-full min-w-0 flex-1 items-end" title={`${readableDate(item.date)}: ${item.count} scans`}><div className="w-full min-h-[2px] rounded-t-sm bg-emerald-600 transition group-hover:bg-emerald-500" style={{ height: `${Math.max(2, (item.count / maxDaily) * 100)}%` }} /></div>)}</div><div className="mt-1 flex justify-between text-[11px] text-slate-500"><span>{analytics?.daily[0]?.date ? readableDate(analytics.daily[0].date) : ""}</span><span>{analytics?.daily.at(-1)?.date ? readableDate(analytics.daily.at(-1)!.date) : ""}</span></div></div>
                <div className="mt-5 grid gap-5 lg:grid-cols-2"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Devices</p><div className="mt-2 space-y-2">{analytics?.devices.length ? analytics.devices.map((item) => <div key={item.device} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm"><span className="capitalize">{item.device}</span><strong>{item.count.toLocaleString()}</strong></div>) : <p className="text-sm text-slate-500">No scans in this period.</p>}</div></div><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent activity</p><div className="mt-2 max-h-48 overflow-y-auto rounded-md border border-slate-200">{analytics?.recentScans.length ? analytics.recentScans.slice(0, 12).map((scan) => <div key={scan.id} className="flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-0"><span className="min-w-0"><span className="block capitalize text-slate-800">{scan.device}</span><span className="block truncate text-xs text-slate-500">{scan.referrer || "Direct / camera scan"}</span></span><time className="shrink-0 text-xs text-slate-500">{readableDate(scan.scannedAt, true)}</time></div>) : <p className="p-3 text-sm text-slate-500">No scan activity yet.</p>}</div></div></div>
              </CRMCard>
              <p className="flex items-start gap-2 px-1 text-xs leading-5 text-slate-500"><Link2 className="mt-0.5 shrink-0" size={14} />Tracking stores a one-way visitor hash, device category, referrer, and timestamp. Raw IP addresses are not retained. <a href={selected.shortUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-emerald-700 hover:underline">Test redirect <ExternalLink size={12} /></a></p>
            </div>
          ) : !loading ? <CRMCard className="flex min-h-72 items-center justify-center text-center"><div><QrCode className="mx-auto text-slate-400" size={36} /><p className="mt-3 font-medium text-slate-800">Choose or create a QR code</p><p className="mt-1 text-sm text-slate-500">Its editable redirect and scan analytics will appear here.</p></div></CRMCard> : null}
        </div>
      </div>
    </EnterprisePageShell>
  );
}
