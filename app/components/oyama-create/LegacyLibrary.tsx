"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Download, Search } from "lucide-react";
import { apiFetch } from "@/app/lib/auth-client";
import { Channels, Empty, Heading, Modal, Status } from "./ui";
import { message } from "./types";
import { useCreate } from "./CreateShell";
import styles from "./LegacyLibrary.module.css";

type Legacy = { id: string; channel: "EMAIL" | "LETTER"; name: string; status: string; historical: boolean; isTemplate: boolean; campaignId: string | null; contentId: string | null; canImport: boolean };
type Page = { items: Legacy[]; hasMore: boolean; nextCursor: string | null };

/** Reads original libraries independently of background conversion progress. */
export default function LegacyLibrary() {
  const router = useRouter(), query = useSearchParams();
  const { permissions } = useCreate();
  const focusedId = query.get("legacyId") || "";
  const focusedChannel = query.get("legacyChannel") || "";
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState(focusedChannel === "EMAIL" ? "EMAIL" : focusedChannel === "LETTER" || permissions.includes("letters.view") ? "LETTER" : "EMAIL");
  const [data, setData] = useState<Page | null>(null);
  const [selected, setSelected] = useState<Legacy | null>(null);
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const request = useRef(0);
  const invalidate = useCallback(() => { request.current++; }, []);
  const load = useCallback(async (after = "") => {
    const params = new URLSearchParams({ q: search, channel });
    if (focusedId) params.set("id", focusedId);
    if (after) params.set("after", after);
    const current = ++request.current;
    setLoading(true); setError("");
    try {
      const next = await apiFetch<Page>(`/api/oyama-create/legacy?${params}`);
      if (current !== request.current) return;
      setData(previous => after && previous ? { ...next, items: [...previous.items, ...next.items.filter(item => !previous.items.some(old => old.id === item.id && old.channel === item.channel))] } : next);
    } catch (value) { if (current === request.current) setError(message(value)); }
    finally { if (current === request.current) setLoading(false); }
  }, [search, channel, focusedId]);
  useEffect(() => {
    setData(null); setLoading(true);
    const timer = setTimeout(() => void load(), 200);
    return () => { clearTimeout(timer); invalidate(); };
  }, [load, invalidate]);
  async function bringIn() {
    if (!selected) return;
    setBusy(true); setError("");
    try {
      const result = await apiFetch<{ campaignId: string; contentId: string }>("/api/oyama-create/legacy/import", { method: "POST", body: JSON.stringify({ channel: selected.channel, legacyId: selected.id }) });
      router.push(`/oyama-create/campaigns/${result.campaignId}?content=${result.contentId}`);
    } catch (value) { setError(message(value)); }
    finally { setBusy(false); }
  }
  return <>
    <Heading title="Import existing letters & emails" subtitle="Choose from your original Oyama libraries. Original names, content and source history are retained." action={<Link className="oc-button" href="/oyama-create/library">Back to library</Link>}/>
    <div className="oc-toolbar">
      <div className="oc-search"><Search size={15} aria-hidden="true"/><input type="search" aria-label="Search original names" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search original template names…"/></div>
      <label>Source library<select aria-label="Source library" value={channel} onChange={event => setChannel(event.target.value)}><option value="LETTER">Oyama Letters</option><option value="EMAIL">Oyama Email</option><option value="">Both libraries</option></select></label>
      {focusedId && <Link href="/oyama-create/library/existing" className="oc-button">Show all templates</Link>}
      <Link className="oc-button" href="/oyama-create/library/legacy">Import progress & review</Link>
    </div>
    {error && !selected && <div className="oc-error" role="alert">{error} <button type="button" className="oc-button small" onClick={() => void load()}>Try again</button></div>}
    <section className={`oc-card ${styles.library}`} aria-label="Original letters and emails" aria-busy={loading}>
      <div className="oc-card-heading"><h2>Original letters & emails</h2><span className="oc-help">Names shown exactly as saved</span></div>
      {loading && !data ? <div className="oc-state" role="status">Loading original libraries…</div> : !data?.items.length ? <Empty title={error ? "Original library unavailable" : "No matching original content"}>Choose another library or search by the original name.</Empty> : <div className="oc-table-scroll"><table className="oc-table"><thead><tr><th>Original name</th><th>Format</th><th>Original status</th><th>Create library</th></tr></thead><tbody>{data.items.map(item => <tr key={`${item.channel}:${item.id}`}>
        <td><strong>{item.name}</strong><small>{item.historical ? "Historical communication · retained for reference" : item.isTemplate ? "Reusable template" : "Draft campaign"}</small></td>
        <td><Channels channels={[item.channel]}/></td><td><Status status={item.status}/></td>
        <td>{item.campaignId ? <Link className="oc-button small" href={`/oyama-create/campaigns/${item.campaignId}${item.contentId ? `?content=${encodeURIComponent(item.contentId)}` : ""}`}>Open in Create <ArrowRight size={12}/></Link> : item.canImport ? <button type="button" className="oc-button small" onClick={() => { setSelected(item); setError(""); }}><Download size={12}/>Import to library</button> : <span className="oc-help">Import requires edit permission from the owner or administrator.</span>}</td>
      </tr>)}</tbody></table></div>}
      {data?.hasMore && <div className="oc-card-body"><button type="button" className="oc-button" disabled={loading} onClick={() => void load(data.nextCursor || "")}>{loading ? "Loading…" : "Load more originals"}</button></div>}
    </section>
    <p className="oc-notice">Existing templates keep their names. Only verified letter/email relationships are grouped; each original name is retained. Sent communications remain history. Importing does not send or schedule anything.</p>
    <details className="oc-disclosure"><summary>Other import & history tools</summary><div className="oc-actions"><Link className="oc-button" href="/oyama-email/templates?legacy=1">Email file import / export</Link><Link className="oc-button" href="/oyama-create/tools/letters/history">Generated letters & PDFs</Link></div></details>
    {selected && <Modal title="Import to Create library" close={() => { if (!busy) setSelected(null); }}>
      <p><strong>{selected.name}</strong></p><p className="oc-help">This imports the original content under its saved name. The original remains unchanged. If it was already imported, Create reopens its existing binding.</p>
      {selected.historical && <p className="oc-notice">This sent or scheduled communication stays in History. Duplicate it into a fresh draft to reuse it.</p>}
      {error && <p role="alert" className="oc-error">{error}</p>}
      <button type="button" className="oc-button primary" disabled={busy} onClick={() => void bringIn()}>{busy ? "Importing…" : "Import and open"}</button>
    </Modal>}
  </>;
}
