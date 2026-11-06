"use client";
import dynamic from "next/dynamic";
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { NativeEditorState } from "@/app/components/oyama-email/EmailBuilderKit";
import type { EditorHandle } from "./SharedEditor";
import { message } from "./types";
const Letters = dynamic(() => import("@/app/components/letters/OyamaLettersWorkspace"), { ssr: false });

/** Reuses the actual original canvas and its original proof/export actions. */
export default forwardRef<EditorHandle, { templateId: string; onDirty: (dirty: boolean) => void; onSaved: () => Promise<unknown> }>(function OriginalLetterCanvas({ templateId, onDirty, onSaved }, ref) {
  const editor = useRef<NativeEditorState | null>(null);
  const [error, setError] = useState("");
  const changed = useCallback((state: NativeEditorState) => { editor.current = state; onDirty(state.dirty); }, [onDirty]);
  useImperativeHandle(ref, () => ({ flush: async () => !editor.current?.dirty || await editor.current.save() }), []);
  async function saved() {
    try {
      await apiFetch("/api/oyama-create/legacy/import", { method: "POST", body: JSON.stringify({ channel: "LETTER", legacyId: templateId }) });
      setError(""); await onSaved();
    } catch (value) { setError(message(value)); }
  }
  return <section aria-label="Original OyamaCRM Letters canvas">
    <p className="oc-notice">This is the original Letters editor and canvas. Its PDF preview and export use the original letter output. Saves update the original template; compare and accept its source changes before using Create’s unified output.</p>
    {error && <div role="alert" className="oc-error">The original was saved, but Create could not refresh it: {error} <button type="button" className="oc-button small" onClick={() => void saved()}>Retry Create refresh</button></div>}
    <Letters embedded editorMode="original" view="builder" templateId={templateId} onEditorState={changed} onSaved={saved}/>
  </section>;
});
