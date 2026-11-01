"use client";
import { useRef, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { apiFetch } from "@/app/lib/auth-client";

export default function StewardFeedback({ messageId, content, provider }: { messageId: string; content: string; provider?: string }) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [reason, setReason] = useState("helpful");
  const [note, setNote] = useState("");
  const [include, setInclude] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const id = useRef(crypto.randomUUID());
  const saved = status === "Saved to the improvements log.";
  return <div className="steward-feedback">
    {!rating && !saved ? <div className="steward-feedback-vote"><span>Was this helpful?</span><button aria-label="Helpful response" onClick={() => { setRating("up"); setReason("helpful"); }}><ThumbsUp size={14} /></button><button aria-label="Unhelpful response" onClick={() => { setRating("down"); setReason("incorrect"); }}><ThumbsDown size={14} /></button></div> : null}
    {rating && !saved ? <form onSubmit={async event => {
      event.preventDefault(); if (busy) return; setBusy(true); setStatus("");
      try { await apiFetch("/api/steward-feedback", { method: "POST", body: JSON.stringify({ reportId: id.current, messageId, rating, reason, note, provider, excerpt: include ? content.slice(0, 2000) : "" }) }); setStatus("Saved to the improvements log."); }
      catch { setStatus("Feedback was not saved. Please retry."); } finally { setBusy(false); }
    }}><label>Reason<select value={reason} onChange={event => setReason(event.target.value)}>{(rating === "up" ? [["helpful", "Helpful next steps"], ["accurate", "Accurate answer"], ["clear", "Clear explanation"]] : [["incorrect", "Incorrect or invented facts"], ["missing_context", "Missing CRM context"], ["unsafe", "Unsafe recommendation"], ["slow", "Too slow"], ["format", "Hard to read"], ["other", "Other"]]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Details (optional)<textarea maxLength={1500} value={note} onChange={event => setNote(event.target.value)} placeholder="What should Steward improve?" /></label><label className="steward-feedback-check"><input type="checkbox" checked={include} onChange={event => setInclude(event.target.checked)} />Include this response excerpt (may contain CRM data)</label><button disabled={busy} type="submit">{busy ? "Saving…" : "Submit feedback"}</button><button type="button" disabled={busy} onClick={() => setRating(null)}>Cancel</button></form> : null}
    {status ? <p role="status">{status}</p> : null}
  </div>;
}
