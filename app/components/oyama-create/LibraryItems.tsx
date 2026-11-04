"use client";
import { useState } from "react";
import { useCreateData } from "./use-create-data";
import { Empty, Heading } from "./ui";
import TrashAction, { type TrashKind } from "./TrashAction";
import AssetPreview from "./studio/AssetPreview";
type Item = { id: string; name: string; kind: TrashKind; url?: string; canTrash: boolean };
export default function LibraryItems() {
  const resource = useCreateData<Item[]>("/api/oyama-create/library/items");
  const [filter, setFilter] = useState("");
  const items = resource.data?.filter(item => !filter || item.kind === filter) || [];
  return <>
    <Heading title="Library items" subtitle="Manage uploaded artwork, saved sections, signatures and brand presets."/>
    <div className="oc-toolbar"><label>Item type<select value={filter} onChange={event => setFilter(event.target.value)}><option value="">All library items</option><option value="ASSET">Images</option><option value="SECTION">Saved sections</option><option value="SIGNATURE">Signatures</option><option value="PRESET">Brand presets</option></select></label></div>
    {resource.error && <p className="oc-error" role="alert">{resource.error}</p>}
    <section className="oc-card"><div className="oc-card-body">
      {resource.loading && !resource.data ? <p role="status">Loading library…</p> : !items.length ? <Empty title="No matching library items">Upload artwork, save a section, or create a brand preset in Studio and Brand Hub.</Empty> : items.map(item => <div className="oc-list-item" key={`${item.kind}:${item.id}`}><div style={{ maxWidth: 120 }}>{item.url && <AssetPreview src={item.url} alt={item.name}/>}</div><div><strong>{item.name}</strong><p>{item.kind.toLowerCase()}</p></div><TrashAction kind={item.kind} resourceId={item.id} disabled={!item.canTrash} onChanged={resource.reload}/></div>)}
    </div></section>
  </>;
}
