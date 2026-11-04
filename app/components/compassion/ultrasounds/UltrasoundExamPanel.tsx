"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { useCareAccess } from "../CompassionShell";
import { CareCard, CareError, careWrite, useCareData } from "../care-ui";
import UltrasoundExamForm from "./UltrasoundExamForm";
import UltrasoundDocuments from "./UltrasoundDocuments";
import UltrasoundFollowUps from "./UltrasoundFollowUps";
import { chartStatusLabel, ULTRASOUND_NOTE_FIELDS, type UltrasoundChart } from "./types";

export default function UltrasoundExamPanel({ examId, onChanged, onOpen, onClose, onDirtyChange }: { examId: string; onChanged: () => Promise<void>; onOpen: (id: string, notice: string) => void; onClose: () => void; onDirtyChange: (dirty: boolean) => void }) {
  const chart = useCareData<UltrasoundChart>(`/api/compassion/charts/${encodeURIComponent(examId)}`);
  const { user } = useAuth(); const access = useCareAccess();
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false); const [amendment, setAmendment] = useState(false); const [attest, setAttest] = useState(false); const [reason, setReason] = useState("");
  const row = chart.data;
  const editable = row?.status === "DRAFT" && row.authorId === user?.id;
  async function run(work: () => Promise<void>) { setBusy(true); setError(""); setNotice(""); try { await work(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to update the exam."); } finally { setBusy(false); } }
  async function saved(id: string, message: string) { setDirty(false); onDirtyChange(false); setAmendment(false); setNotice(message); await onChanged(); if (id === examId) await chart.reload(); else onOpen(id, message); }
  if (chart.loading && !row) return <p role="status">Opening ultrasound exam…</p>;
  if (chart.error || !row || row.kind !== "ULTRASOUND") return <CareCard title="Unable to open this examination"><div className="care-card-body"><CareError error={chart.error || "Ultrasound chart not found."} /><button className="care-button secondary" onClick={() => void chart.reload()}>Try again</button><button className="care-button secondary" onClick={onClose}>Back to worklist</button></div></CareCard>;
  const feedback = row.content._review as { reason?: string } | undefined;
  const missing = [!row.content.examDate && "exam date", ...ULTRASOUND_NOTE_FIELDS.filter(({ key }) => !String(row.content[key] || "").trim()).map(({ label }) => label.toLowerCase())].filter(Boolean);
  return <div className="care-stack care-exam-panel" aria-label="Selected ultrasound examination">
    <CareCard title={row.client ? `${row.client.firstName} ${row.client.lastName}` : "Ultrasound examination"} description={`Ultrasound · version ${row.version} · ${chartStatusLabel(row.status)}`} action={<button className="care-button secondary" onClick={onClose}>Close exam</button>}>
      <div className="care-card-body care-form"><Link className="care-exam-client-link" href={`/compassion/clients/${row.clientId}`}>Open client record →</Link>
        <ol className="care-exam-progress" aria-label="Exam progress">{["DRAFT", "REVIEW", "SIGNED"].map((step, index) => <li key={step} aria-current={row.status === step ? "step" : undefined}><span>{index + 1}</span>{chartStatusLabel(step)}</li>)}</ol>
        {feedback?.reason && <div className="care-notice"><strong>Reviewer feedback</strong><p>{feedback.reason}</p></div>}
        <CareError error={error} />{notice && <p role="status" className="care-notice">{notice}</p>}
        {editable && <><p>{dirty ? "Save your changes before submitting for review." : missing.length ? `Still to record: ${missing.join(", ")}.` : "Clinical fields are complete. Review the supporting scans before submitting."}</p><button className="care-button" disabled={busy || dirty || missing.length > 0} onClick={() => void run(async () => { await careWrite(`/charts/${row.id}/submit`, { expectedUpdatedAt: row.updatedAt }); await saved(row.id, "Exam submitted for physician review. This version is locked while under review."); })}>Submit for physician review</button></>}
        {row.status === "DRAFT" && !editable && <p>This draft is editable by its author. You can review the saved information and supporting scans.</p>}
        {row.status === "REVIEW" && access?.capabilities.includes("sign") && <><label className="care-checkbox"><input type="checkbox" checked={attest} onChange={(event) => setAttest(event.target.checked)} /> I reviewed this examination and all supporting scans.</label><button className="care-button" disabled={busy || !attest} onClick={() => void run(async () => { await careWrite(`/charts/${row.id}/sign`, { attest: true, expectedUpdatedAt: row.updatedAt }); setAttest(false); await saved(row.id, "Physician sign-off recorded. The signed report is ready."); })}>Sign examination</button><details className="care-form-details"><summary>Request a correction</summary><div className="care-form"><label>Correction requested<textarea maxLength={5000} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain what the author needs to correct" /></label><button className="care-button secondary" disabled={busy || !reason.trim()} onClick={() => void run(async () => { await careWrite(`/charts/${row.id}/return`, { reason, expectedUpdatedAt: row.updatedAt }); setReason(""); await saved(row.id, "Exam returned to its author with your correction request."); })}>Return to author</button></div></details></>}
        {row.status === "REVIEW" && !access?.capabilities.includes("sign") && <p>Awaiting physician review. This examination and its attachments are locked.</p>}
        {row.status === "SIGNED" && <div className="care-actions"><Link href={`/compassion/care/reports/${row.id}`} className="care-button">Open signed report</Link><button className="care-button secondary" disabled={busy} onClick={() => { if (amendment && dirty && !window.confirm("Discard the unsaved amendment?")) return; setDirty(false); onDirtyChange(false); setAmendment(!amendment); }}>{amendment ? "Cancel amendment" : "Prepare amendment"}</button></div>}
      </div>
    </CareCard>
    <UltrasoundExamForm key={`${row.id}:${row.updatedAt}:${amendment}`} chart={row} amendment={amendment} busy={busy} run={run} onSaved={saved} onDirty={() => { setDirty(true); onDirtyChange(true); }} />
    <UltrasoundDocuments key={row.id} clientId={row.clientId} chartId={row.id} editable={editable && !amendment} busy={busy} run={run} onChanged={async () => { setNotice("Supporting files updated."); await onChanged(); }} />
    <UltrasoundFollowUps key={`${row.id}:${row.updatedAt}`} chartId={row.id} dueDate={typeof row.content.followUpDueDate === "string" ? row.content.followUpDueDate : undefined} busy={busy} run={run} onChanged={async (message) => { setNotice(message); await onChanged(); }} />
  </div>;
}
