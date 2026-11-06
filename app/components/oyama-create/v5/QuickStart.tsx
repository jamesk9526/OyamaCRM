"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import { useCreate } from "../CreateShell";
import { Modal } from "../ui";
import { message } from "../types";
const options = [{ kind: "LETTER", label: "Letter", letters: true }, { kind: "EMAIL", label: "Email" }, { kind: "NEWSLETTER", label: "Newsletter" }, { kind: "APPEAL", label: "Appeal", letters: true, both: true }, { kind: "ACKNOWLEDGMENT", label: "Thank-you", letters: true }, { kind: "EVENT", label: "Event promotion" }];
export default function QuickStart() {
  const { permissions } = useCreate(), router = useRouter();
  const [kind, setKind] = useState(""), [name, setName] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function start() { setBusy(true); setError(""); try { const value = await apiFetch<{ campaignId: string; contentId: string }>("/api/oyama-create/workspace/start", { method: "POST", body: JSON.stringify({ kind, name }) }); router.push(`/oyama-create/campaigns/${value.campaignId}?content=${value.contentId}&studio=1`); } catch (value) { setError(message(value)); setBusy(false); } }
  return <section className="oc-card v5-quick-start"><h2>Start creating</h2><p>Open a draft now. Choose recipients and delivery when you’re ready.</p><div>{options.filter(option => (!option.letters || permissions.includes("letters.create") && permissions.includes("letters.edit")) && (option.letters && !option.both || permissions.includes("edit:communications"))).map(option => <button className="oc-button" key={option.kind} onClick={() => { setKind(option.kind); setName(""); setError(""); }}>{option.label}</button>)}</div>{kind && <Modal title={`New ${options.find(option => option.kind === kind)?.label.toLowerCase()}`} close={() => { if (!busy) setKind(""); }}><form className="oc-form" onSubmit={event => { event.preventDefault(); void start(); }}><label>Document name<input autoFocus required maxLength={191} value={name} onChange={event => setName(event.target.value)} placeholder="Name your draft"/></label><p className="oc-help">This creates a campaign draft with no audience or scheduled delivery.</p>{error && <p role="alert" className="oc-error">{error}</p>}<button className="oc-button primary" disabled={busy || !name.trim()}>{busy ? "Opening…" : "Start writing"}</button></form></Modal>}</section>;
}
