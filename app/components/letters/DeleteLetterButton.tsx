"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2, X } from "lucide-react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { useDialogFocus } from "@/app/components/ui/useDialogFocus";
import { apiFetch } from "@/app/lib/auth-client";

type Props = { kind: "template" | "generated"; id: string; name: string; onDeleted: () => void };

/** One reviewed, typed-confirmation deletion flow for library and generated letters. */
export default function DeleteLetterButton(props: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const permitted = user?.permissions ? user.permissions.includes("letters.archive") || user.permissions.includes("*") : ["super_admin", "admin", "manager"].includes(user?.role.toLowerCase() ?? "");
  if (!permitted) return null;
  return <>
    <button type="button" className="letters-icon-button letters-delete-trigger" aria-label={`Delete ${props.name}`} title={`Delete ${props.kind === "template" ? "template" : "letter"}`} onClick={() => setOpen(true)}><Trash2 size={16} aria-hidden="true" /></button>
    {open ? <DeleteLetterDialog {...props} onClose={() => setOpen(false)} /> : null}
  </>;
}

function DeleteLetterDialog({ kind, id, name, onDeleted, onClose }: Props & { onClose: () => void }) {
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const dialog = useRef<HTMLElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  function close() { if (!inFlight.current) onClose(); }
  useDialogFocus(dialog, true, close);

  async function remove() {
    if (confirmation !== "delete" || inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      await apiFetch<void>(kind === "template" ? `/api/letters/templates/${encodeURIComponent(id)}/permanent` : `/api/letters/generated/${encodeURIComponent(id)}`, { method: "DELETE", body: JSON.stringify({ confirmation }) });
      onClose();
      onDeleted();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The letter could not be deleted. Try again.");
      setBusy(false);
    } finally { inFlight.current = false; }
  }

  return createPortal(<div className="letters-dialog-backdrop letters-workspace" onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className="letters-delete-dialog" tabIndex={-1}>
      <div className="letters-delete-dialog-heading"><span className="letters-delete-icon"><Trash2 size={22} aria-hidden="true" /></span><button type="button" className="letters-icon-button" onClick={close} disabled={busy} aria-label="Close deletion confirmation"><X size={18} aria-hidden="true" /></button></div>
      <h2 id={titleId}>{kind === "template" ? "Delete template?" : "Delete generated letter?"}</h2>
      <p className="letters-delete-name">{name}</p>
      <p id={descriptionId}>{kind === "template" ? "This permanently removes this reusable template. Templates with generated letters or a linked Steward Path must be cleared of those references first. Saved print proofs and revision history are retained." : "This permanently removes this generated letter from the list and its print/mail queues. Contact activity, linked email drafts and saved print proofs are retained. Downloaded files and letters already printed or sent cannot be recalled."}</p>
      <form onSubmit={event => { event.preventDefault(); void remove(); }}>
        <label htmlFor={inputId}>Type <strong>delete</strong> to confirm</label>
        <input id={inputId} value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} autoComplete="off" autoCapitalize="none" spellCheck={false} data-modal-autofocus />
        {error ? <p role="alert" className="letters-delete-error">{error}</p> : null}
        <div className="letters-delete-dialog-actions"><button type="button" className="letters-button" onClick={close} disabled={busy}>Cancel</button><button type="submit" className="letters-button letters-button-danger" disabled={confirmation !== "delete" || busy}>{busy ? "Deleting…" : kind === "template" ? "Delete template" : "Delete letter"}</button></div>
      </form>
    </section>
  </div>, document.body);
}
