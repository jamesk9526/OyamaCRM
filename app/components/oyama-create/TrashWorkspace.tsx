"use client";
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { apiFetch } from "@/app/lib/auth-client";
import { useCreateData } from "./use-create-data";
import { Empty, Heading } from "./ui";
import { message } from "./types";
type Entry = { id: string; kind: string; resourceId: string; name: string; revision: number; removedAt: string; removedBy: string };
const labels: Record<string, string> = { CAMPAIGN: "Campaigns & templates", ASSET: "Images & uploads", SECTION: "Saved sections", SIGNATURE: "Signatures", PRESET: "Brand presets" };
export default function TrashWorkspace() {
  const [kind, setKind] = useState("");
  const resource = useCreateData<{ items: Entry[]; hasMore: boolean }>(`/api/oyama-create/trash${kind ? `?kind=${kind}` : ""}`);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function restore(item: Entry) {
    setBusy(item.id); setError(""); setNotice("");
    try {
      await apiFetch(`/api/oyama-create/trash/${item.id}/restore`, { method: "POST", body: JSON.stringify({ revision: item.revision, confirm: true }) });
      setNotice(`${item.name} restored. Review its settings before using it.`); await resource.reload();
    } catch (error) { setError(message(error)); }
    finally { setBusy(""); }
  }
  return <>
    <Heading title="Trash" subtitle="Restore campaigns and library items under their original IDs. Delivery resumes only through a new reviewed release."/>
    <div className="oc-toolbar"><label>Item type<select value={kind} onChange={event => setKind(event.target.value)}><option value="">All types</option>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label></div>
    {(error || resource.error) && <p role="alert" className="oc-error">{error || resource.error}</p>}
    {notice && <p role="status" className="oc-success">{notice}</p>}
    <section className="oc-card">
      {resource.loading && !resource.data ? <p role="status" className="oc-state">Loading Trash…</p> : !resource.data?.items.length ? <Empty title="Trash is empty">Items you can restore appear here after they are removed.</Empty> : <div className="oc-table-scroll"><table className="oc-table"><thead><tr><th>Item</th><th>Type</th><th>Removed</th><th>Removed by</th><th>Restore</th></tr></thead><tbody>{resource.data.items.map(item => <tr key={item.id}><td><strong>{item.name}</strong></td><td>{labels[item.kind] || item.kind}</td><td>{new Date(item.removedAt).toLocaleString()}</td><td>{item.removedBy}</td><td><button className="oc-button small" disabled={!!busy} onClick={() => void restore(item)}><RotateCcw size={13}/>{busy === item.id ? "Restoring…" : "Restore"}</button></td></tr>)}</tbody></table></div>}
      {resource.data?.hasMore && <p className="oc-help">Filter by item type to find earlier entries.</p>}
    </section>
  </>;
}
