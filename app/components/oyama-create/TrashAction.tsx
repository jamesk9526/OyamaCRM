"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { apiFetch } from "@/app/lib/auth-client";
import { message } from "./types";
import { Modal } from "./ui";

export type TrashKind = "CAMPAIGN" | "ASSET" | "SECTION" | "SIGNATURE" | "PRESET";
type Preview = { name: string; reviewToken: string; trashed: boolean; pendingDeliveries: number; activeDefault: boolean; usedBy: Array<{ id: string; name: string }>; usageMayBeIncomplete: boolean };
export default function TrashAction({ kind, resourceId, disabled = false, onChanged }: { kind: TrashKind; resourceId: string; disabled?: boolean; onChanged?: () => void | Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function inspect() {
    setOpen(true); setBusy(true); setError(""); setPreview(null);
    try { setPreview(await apiFetch<Preview>(`/api/oyama-create/trash/preview?kind=${kind}&id=${encodeURIComponent(resourceId)}`)); }
    catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!preview) return;
    setBusy(true); setError("");
    try {
      await apiFetch("/api/oyama-create/trash", { method: "POST", body: JSON.stringify({ kind, resourceId, reviewToken: preview.reviewToken, confirm: true }) });
      setOpen(false); await onChanged?.();
    } catch (error) { setError(message(error)); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" className="oc-button small" disabled={disabled || busy} onClick={() => void inspect()}><Trash2 size={13}/>Move to Trash</button>
    {open && <Modal title="Move to Trash" close={() => { if (!busy) setOpen(false); }}>
      {error && <p className="oc-error" role="alert">{error}</p>}
      {!preview && !error && <p role="status">Checking this item and its uses…</p>}
      {preview && <>
        <p><strong>{preview.name}</strong></p>
        <p>This removes the item from active lists and new-design pickers. Restore it later from Trash. Existing documents, public images, and campaign history remain available.</p>
        {!!preview.pendingDeliveries && <p className="oc-error">Review and cancel {preview.pendingDeliveries} pending deliveries before removing this campaign.</p>}
        {preview.activeDefault && <p className="oc-error">Choose and publish a replacement for this active default first.</p>}
        {preview.trashed && <p className="oc-notice">This item is already in Trash.</p>}
        {!!preview.usedBy.length && <><h3>Known uses</h3><ul>{preview.usedBy.map(item => <li key={item.id}>{item.name}</li>)}</ul></>}
        {preview.usageMayBeIncomplete && <p className="oc-help">Additional saved uses may exist. Their content remains available.</p>}
        <div className="oc-actions" style={{ marginTop: 20 }}><button className="oc-button" disabled={busy} onClick={() => setOpen(false)}>Keep item</button><button className="oc-button primary" disabled={busy || preview.trashed || !!preview.pendingDeliveries || preview.activeDefault} onClick={() => void remove()}>{busy ? "Moving…" : "Move to Trash"}</button></div>
      </>}
    </Modal>}
  </>;
}
