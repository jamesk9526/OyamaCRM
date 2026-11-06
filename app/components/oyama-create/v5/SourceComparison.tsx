"use client";
import { useState } from "react";
import { useCreateData } from "../use-create-data";
import { Modal } from "../ui";
import ImportSourceReview, { type ImportedSource } from "../ImportSourceReview";
export default function SourceComparison({ contentId, close, changed }: { contentId: string; close: () => void; changed: () => Promise<unknown> }) {
  const resource = useCreateData<{ items: ImportedSource[] }>(`/api/oyama-create/imports/sources?contentId=${contentId}`), [selected, setSelected] = useState("");
  if (selected) return <ImportSourceReview id={selected} close={() => setSelected("")} changed={async () => { await changed(); await resource.reload(); }}/>;
  return <Modal title="Original sources & conversion history" close={close}><p className="oc-help">Create edits stay in this draft. Compare preserved originals and their branding before adopting a source change.</p>{resource.error && <p className="oc-error" role="alert">{resource.error}<button onClick={() => void resource.reload()}>Retry</button></p>}{!resource.data && !resource.error && <p role="status">Loading source history…</p>}{resource.data?.items.map(source => <div className="oc-list-item" key={source.id}><strong>{source.name}</strong><button className="oc-button" onClick={() => setSelected(source.id)}>Compare original</button></div>)}{resource.data && !resource.data.items.length && <p>This content was created in Create and has no imported original. Its saved changes remain in revision history.</p>}</Modal>;
}
