"use client";
import { useCreateData } from "./use-create-data";
import { channelNames } from "./types";

/** A grouped campaign may have differently named letter and email originals. */
export default function OriginalSourceNames({ contentId }: { contentId: string }) {
  const resource = useCreateData<{ items: Array<{ id: string; sourceType: string; name: string }> }>(`/api/oyama-create/imports/sources?contentId=${encodeURIComponent(contentId)}`);
  const sources = resource.data?.items.filter(item => item.sourceType === "LETTER" || item.sourceType === "EMAIL") || [];
  if (resource.error) return <p className="oc-help">Original source names could not load. <button type="button" className="oc-button small" onClick={() => void resource.reload()}>Retry source names</button></p>;
  if (!sources.length) return null;
  return <div className="oc-notice" aria-label="Original source names"><strong>Original names</strong>{sources.map(item => <p key={item.id}>{channelNames[item.sourceType as "LETTER" | "EMAIL"]}: {item.name}</p>)}</div>;
}
