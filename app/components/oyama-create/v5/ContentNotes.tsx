"use client";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { useCreateData } from "../use-create-data";
import type { EditorHandle } from "../SharedEditor";
import { message } from "../types";
type Notes = { text: string; revision: number; updatedAt: string | null };
export default forwardRef<EditorHandle, { contentId: string; readonly: boolean; onDirty: (dirty: boolean) => void }>(function ContentNotes({ contentId, readonly, onDirty }, ref) {
  const resource = useCreateData<Notes>(`/api/oyama-create/contents/${contentId}/notes`);
  const [text, setText] = useState(""), [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [comparison, setComparison] = useState<Notes | null>(null);
  const saving = useRef<Promise<boolean> | null>(null);
  const current = useRef({ text, dirty, revision: 0 });
  current.current.text = text; current.current.dirty = dirty;
  useEffect(() => { if (resource.data && !current.current.dirty) { setText(resource.data.text); current.current.revision = resource.data.revision; } }, [resource.data]);
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  function save(): Promise<boolean> {
    if (saving.current) return saving.current;
    if (!current.current.dirty) return Promise.resolve(true);
    if (readonly || !resource.data) return Promise.resolve(false);
    saving.current = persist().finally(() => { saving.current = null; });
    return saving.current;
  }
  async function persist() {
    const submitted = current.current.text;
    setBusy(true); setError(""); setComparison(null);
    try {
      const saved = await apiFetch<Notes>(`/api/oyama-create/contents/${contentId}/notes`, { method: "PUT", body: JSON.stringify({ text: submitted, revision: current.current.revision }) });
      current.current.revision = saved.revision;
      if (current.current.text === submitted) { setDirty(false); current.current.dirty = false; }
      resource.setData(saved); return current.current.text === submitted;
    } catch (value) { setError(message(value)); return false; } finally { setBusy(false); }
  }
  async function compareLatest() {
    setBusy(true);
    try {
      setComparison(await apiFetch<Notes>(`/api/oyama-create/contents/${contentId}/notes`));
    } catch (value) {
      setError(message(value));
    } finally { setBusy(false); }
  }
  useImperativeHandle(ref, () => ({ flush: save }));
  return <div className="v5-notes">
    <p>Internal notes shared with staff who can access this content. Notes never appear in your documents or delivery.</p>
    {resource.error && <p role="alert">{resource.error} <button onClick={() => void resource.reload()}>Retry</button></p>}
    <label>Draft notes<textarea aria-label="Shared draft notes" maxLength={20000} rows={16} disabled={readonly || !resource.data} value={text} onChange={event => { setText(event.target.value); setDirty(true); }}/></label>
    {error && <div role="alert">
      <p>{error}</p>
      <button disabled={busy} onClick={() => void compareLatest()}>Compare latest notes</button>
      {comparison && <><pre>{comparison.text || "No saved notes"}</pre><button onClick={() => {
        current.current.revision = comparison.revision;
        setComparison(null);
        setError("");
      }}>Use latest revision and keep my text</button></>}
    </div>}
    <button className="oc-button" disabled={readonly || !dirty || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save notes"}</button>
    <span role="status">{dirty ? "Unsaved notes" : resource.data ? "Notes saved" : "Loading notes…"}</span>
  </div>;
});
