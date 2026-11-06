"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { channelNames, message, type Channel, type Content } from "./types";
import { Modal } from "./ui";

const formats = ["EMAIL", "WEB", "SOCIAL", "SMS"] as const;
type Target = typeof formats[number];
type Comparison = {
  review: string; linked: boolean; warnings: string[];
  changes: Array<{ id: number; before: string; after: string; current?: string; action: "add" | "replace" | "remove" | "conflict" }>;
};

export default function LetterConversionDialog({ content, initial, close, applied }: {
  content: Content; initial?: Target; close: () => void; applied: (channel: Channel, open: boolean) => Promise<void>;
}) {
  const [channel, setChannel] = useState<Target>(initial || "EMAIL");
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const endpoint = `/api/oyama-create/contents/${content.id}/letter/adaptations/${channel}`;

  useEffect(() => {
    const controller = new AbortController();
    setBusy(true); setComparison(null); setError("");
    void apiFetch<Comparison>(endpoint, { method: "POST", body: JSON.stringify({ action: "preview" }), signal: controller.signal }).then(result => {
      if (!controller.signal.aborted) {
        setComparison(result);
        setSelected(result.changes.filter(change => change.action !== "conflict").map(change => change.id));
      }
    }).catch(value => { if (!controller.signal.aborted) setError(message(value)); })
      .finally(() => { if (!controller.signal.aborted) setBusy(false); });
    return () => controller.abort();
  }, [endpoint]);

  async function review(action: "apply" | "keep") {
    if (!comparison) return;
    setBusy(true); setError("");
    try {
      await apiFetch(endpoint, { method: "POST", body: JSON.stringify({ action, review: comparison.review, selected }) });
      await applied(channel, action === "apply");
    } catch (value) { setError(message(value)); }
    finally { setBusy(false); }
  }
  return <Modal title="Convert Letter to another format" wide close={close}>
    <div className="oc-form classic-conversion">
      <label>Destination<select value={channel} disabled={busy} onChange={event => setChannel(event.target.value as Target)}>
        {formats.map(value => <option key={value} value={value}>{channelNames[value]}</option>)}
      </select></label>
      <p className="oc-help">Review the copy that will go into this draft. Channel-specific edits and settings stay in place.</p>
      {error && <p className="oc-error" role="alert">{error}</p>}
      {busy && !comparison && <p role="status">Preparing a conversion preview…</p>}
      {comparison?.warnings.map(warning => <p className="oc-notice" key={warning}>{warning}</p>)}
      {comparison && <div className="classic-conversion-changes">
        {comparison.changes.length === 0 && <p>There are no copy changes to apply.</p>}
        {comparison.changes.map(change => <label className="classic-conversion-change" key={change.id}>
          <input type="checkbox" checked={selected.includes(change.id)} disabled={busy || change.action === "conflict"} onChange={event => setSelected(value => event.target.checked ? [...value, change.id] : value.filter(id => id !== change.id))}/>
          <span><strong>{change.action === "conflict" ? "Channel edit kept" : change.action === "replace" ? "Replace section" : change.action === "remove" ? "Remove section" : "Add section"}</strong>
            {change.before && <span className="classic-copy-before">{change.before}</span>}
            {change.after && <span className="classic-copy-after">{change.after}</span>}
            {change.current !== undefined && <span>Current channel copy: {change.current || "Section removed"}</span>}
          </span>
        </label>)}
      </div>}
      <div className="oc-actions">
        {comparison?.linked && <button className="oc-button" disabled={busy} onClick={() => void review("keep")}>Keep current draft</button>}
        <button className="oc-button primary" disabled={busy || !comparison || !!comparison.changes.length && !selected.length} onClick={() => void review("apply")}>
          {comparison?.linked ? "Apply selected updates" : "Open converted draft"}
        </button>
      </div>
      <p className="oc-help">New formats start outside delivery. Include them in format settings after review.</p>
    </div>
  </Modal>;
}
