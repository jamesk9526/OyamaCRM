"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { useCreateData } from "../use-create-data";
import { message } from "../types";
export default function WorkspaceRollout() {
  const resource = useCreateData<{ shellEnabled: boolean; unifiedEditorEnabled: boolean; classicLettersEnabled: boolean }>("/api/oyama-create/workspace/config");
  const [shell, setShell] = useState(false), [unified, setUnified] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [classic, setClassic] = useState(false);
  useEffect(() => { if (resource.data) { setShell(resource.data.shellEnabled); setUnified(resource.data.unifiedEditorEnabled); setClassic(resource.data.classicLettersEnabled); } }, [resource.data]);
  async function save() {
    setBusy(true); setError("");
    try { await apiFetch("/api/oyama-create/workspace/config", { method: "PUT", body: JSON.stringify({ shellEnabled: shell, unifiedEditorEnabled: unified, classicLettersEnabled: classic, confirm: true }) }); await resource.reload(); window.dispatchEvent(new Event("oyama-create-config-updated")); } catch (value) { setError(message(value)); } finally { setBusy(false); }
  }
  return <section className="oc-card" style={{ marginTop: 20 }}><div className="oc-card-heading"><h2>v5 workspace rollout</h2></div><div className="oc-card-body oc-form">{(error || resource.error) && <p className="oc-error" role="alert">{error || resource.error}</p>}<label className="oc-check"><input type="checkbox" checked={shell} onChange={event => setShell(event.target.checked)}/>Use the v5 desktop workspace</label><label className="oc-check"><input type="checkbox" checked={unified} onChange={event => setUnified(event.target.checked)}/>Use the current Studio document format</label><label className="oc-check"><input type="checkbox" checked={classic} onChange={event => setClassic(event.target.checked)}/>Pilot the classic Letters canvas in Create</label><p className="oc-help">Saved classic drafts reopen in the classic canvas after rollback. Review test proofs before expanding the pilot.</p><button className="oc-button" disabled={busy || !resource.data} onClick={() => void save()}>{busy ? "Applying…" : "Apply workspace settings"}</button></div></section>;
}
