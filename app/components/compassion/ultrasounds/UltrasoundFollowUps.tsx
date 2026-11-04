"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { CareCard, CareEmpty, CareError, careWrite, useCareData } from "../care-ui";
import { formatCareDate, type UltrasoundFollowUp } from "./types";

export default function UltrasoundFollowUps({ chartId, dueDate, busy, run, onChanged }: { chartId: string; dueDate?: string; busy: boolean; run: (work: () => Promise<void>) => Promise<void>; onChanged: (notice: string) => Promise<void> }) {
  const { user } = useAuth();
  const followUps = useCareData<UltrasoundFollowUp[]>(`/api/compassion/follow-ups?chartId=${encodeURIComponent(chartId)}&limit=100`);
  const team = useCareData<Array<{ id: string; firstName: string; lastName: string }>>("/api/compassion/clinical-team");
  const [due, setDue] = useState(dueDate || ""); const [priority, setPriority] = useState("MEDIUM"); const [assignee, setAssignee] = useState(user?.id || "");
  const open = followUps.data?.some((item) => ["PENDING", "IN_PROGRESS", "OVERDUE"].includes(item.status));
  return <CareCard title="Next step in care" description="Turn the clinical plan into an assigned, trackable care task">
    <CareError error={followUps.error || team.error} />
    {followUps.loading ? <CareEmpty title="Loading care follow-ups…" /> : followUps.error ? <CareEmpty title="Follow-ups are unavailable"><button className="care-button secondary" onClick={() => void followUps.reload()}>Try again</button></CareEmpty> : <>
      {followUps.data?.map((item) => <div className="care-row" key={item.id}><div className="care-row-main"><strong>Client-care follow-up</strong><small>Due {formatCareDate(item.dueDate)} · {item.priority.toLowerCase()}</small></div><span className={`care-badge ${item.status === "COMPLETED" ? "teal" : ""}`}>{item.status.toLowerCase().replaceAll("_", " ")}</span>{["PENDING", "IN_PROGRESS", "OVERDUE"].includes(item.status) && <button className="care-button secondary" disabled={busy} onClick={() => void run(async () => { await careWrite(`/follow-ups/${item.id}`, { status: "COMPLETED" }, "PATCH"); await followUps.reload(); await onChanged("Care follow-up completed."); })}>Mark complete</button>}</div>)}
      {open ? <div className="care-card-body"><Link className="care-button secondary" href="/compassion/follow-ups">Manage care follow-ups</Link></div> : <form className="care-card-body care-form" onSubmit={(event) => { event.preventDefault(); void run(async () => { await careWrite(`/ultrasounds/${chartId}/follow-ups`, { approve: true, dueDate: new Date(`${due}T12:00:00`).toISOString(), priority, assignedStaffId: assignee || undefined }); await followUps.reload(); await onChanged("Care follow-up created and linked to this exam."); }); }}>
        <div className="care-form-grid"><label>Task due date<input type="date" required value={due} onChange={(event) => setDue(event.target.value)} /></label><label>Task priority<select value={priority} onChange={(event) => setPriority(event.target.value)}>{["LOW", "MEDIUM", "HIGH", "URGENT"].map((value) => <option value={value} key={value}>{value.toLowerCase()}</option>)}</select></label></div>
        <label>Assign care task to<select value={assignee} onChange={(event) => setAssignee(event.target.value)}><option value="">Unassigned</option>{user && !team.data?.some((member) => member.id === user.id) && <option value={user.id}>{user.firstName} {user.lastName} (me)</option>}{team.data?.map((member) => <option key={member.id} value={member.id}>{member.firstName} {member.lastName}{member.id === user?.id ? " (me)" : ""}</option>)}</select></label>
        <p>The task uses a general care title. Examination findings remain in this protected chart.</p>
        <button className="care-button" disabled={busy}>Review and create follow-up</button>
      </form>}
    </>}
  </CareCard>;
}
