"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { CareCard, CareError, ClientPicker, careWrite, useCareData, type ClientOption } from "../care-ui";
import { ULTRASOUND_APPROACHES, ULTRASOUND_EXAM_TYPES, ULTRASOUND_NOTE_FIELDS, type UltrasoundChart } from "./types";

interface AppointmentOption { id: string; startTime: string; status: string; location?: string }
interface Props {
  chart?: UltrasoundChart;
  initialClientId?: string;
  amendment?: boolean;
  busy: boolean;
  run: (work: () => Promise<void>) => Promise<void>;
  onSaved: (id: string, notice: string) => Promise<void>;
  onDirty?: () => void;
}

export default function UltrasoundExamForm({ chart, initialClientId = "", amendment = false, busy, run, onSaved, onDirty }: Props) {
  const { user } = useAuth();
  const [clientId, setClientId] = useState(chart?.clientId || initialClientId);
  const [content, setContent] = useState<Record<string, string>>(() => ({
    examType: "LIMITED_OBSTETRIC",
    ...Object.fromEntries(Object.entries(chart?.content ?? {}).filter(([key, value]) => !key.startsWith("_") && typeof value === "string")),
    ...(amendment ? { amendmentReason: "" } : {}),
  }));
  const editable = !chart || amendment || (chart.status === "DRAFT" && chart.authorId === user?.id);
  const selectedClient = useCareData<ClientOption>(!chart && clientId ? `/api/compassion/clients/${encodeURIComponent(clientId)}` : null);
  const appointments = useCareData<AppointmentOption[]>(clientId ? `/api/compassion/appointments?clientId=${encodeURIComponent(clientId)}&appointmentType=ULTRASOUND&limit=100` : null);
  const set = (key: string, value: string) => { setContent((current) => ({ ...current, [key]: value })); onDirty?.(); };
  async function save(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (chart && !amendment) {
        await careWrite(`/charts/${chart.id}`, { content, expectedUpdatedAt: chart.updatedAt }, "PATCH");
        await onSaved(chart.id, "Ultrasound draft saved.");
      } else {
        const saved = await careWrite<{ id: string }>("/charts", { clientId, kind: "ULTRASOUND", content, ...(amendment && chart ? { previousId: chart.id } : {}) });
        await onSaved(saved.id, amendment ? "Amendment saved as a new draft. Add supporting scans before review." : "Exam draft created. Add findings and supporting scans when ready.");
      }
    });
  }
  return <CareCard title={amendment ? "Amend signed examination" : chart ? "Examination details" : "New ultrasound exam"} description={editable ? "Save your draft as you go. Complete results before submitting for review." : "Protected clinical documentation"}>
    <form onSubmit={(event) => void save(event)} className="care-card-body care-form care-ultrasound-form">
      {!chart && <><ClientPicker value={clientId} selectedClient={selectedClient.data} disabled={busy} onChange={(value) => {
        if (value === clientId) return;
        const hasDocumentation = Object.entries(content).some(([key, value]) => key !== "examType" && value.trim());
        if (hasDocumentation && !window.confirm("Change clients and clear this unsaved examination? Findings must stay with the correct client.")) return;
        setClientId(value); setContent({ examType: "LIMITED_OBSTETRIC" }); onDirty?.();
      }} /><CareError error={selectedClient.error} /></>}
      {(amendment || (chart && chart.version > 1)) && <label>Reason for amendment<textarea aria-label="Reason for amendment" required disabled={!editable || busy} maxLength={20000} value={content.amendmentReason || ""} onChange={(event) => set("amendmentReason", event.target.value)} /></label>}
      <fieldset disabled={!editable || busy} className="care-form">
        <div className="care-form-grid">
          <label>Exam date<input type="date" value={content.examDate || ""} onChange={(event) => set("examDate", event.target.value)} /></label>
          <label>Examination type<select aria-label="Examination type" value={content.examType || ""} onChange={(event) => set("examType", event.target.value)}><option value="">Not recorded</option>{Object.entries(ULTRASOUND_EXAM_TYPES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
          <label>Performed by<input maxLength={191} value={content.performedBy || ""} onChange={(event) => set("performedBy", event.target.value)} placeholder="Clinician or sonographer" /></label>
          <label>Scan approach<select aria-label="Scan approach" value={content.approach || ""} onChange={(event) => set("approach", event.target.value)}><option value="">Not recorded</option>{Object.entries(ULTRASOUND_APPROACHES).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        </div>
        <label>Linked ultrasound appointment<select aria-label="Linked ultrasound appointment" value={content.appointmentId || ""} onChange={(event) => set("appointmentId", event.target.value)}>
          <option value="">No linked appointment</option>
          {content.appointmentId && !appointments.data?.some((item) => item.id === content.appointmentId) && <option value={content.appointmentId}>Existing linked appointment</option>}
          {appointments.data?.map((item) => <option key={item.id} value={item.id}>{new Date(item.startTime).toLocaleString()} · {item.status.toLowerCase().replaceAll("_", " ")}{item.location ? ` · ${item.location}` : ""}</option>)}
        </select></label>
        {appointments.error && <p role="alert">Appointments could not be loaded. <button type="button" onClick={() => void appointments.reload()}>Try again</button></p>}
        {ULTRASOUND_NOTE_FIELDS.map(({ key, label }) => <label key={key}>{label}<textarea aria-label={label} rows={key === "findings" ? 4 : 3} maxLength={20000} value={content[key] || ""} onChange={(event) => set(key, event.target.value)} /></label>)}
        <details className="care-form-details" open={Boolean(content.gestationalAgeWeeks || content.estimatedDueDate || content.referringProvider || content.followUpDueDate)}><summary>Measurements & care planning</summary><div className="care-form">
          <p>Enter measurements and dates recorded by the care team.</p>
          <div className="care-form-grid"><label>Gestational age (weeks)<input type="number" min="0" max="60" step="1" value={content.gestationalAgeWeeks || ""} onChange={(event) => set("gestationalAgeWeeks", event.target.value)} /></label><label>Additional days<input type="number" min="0" max="6" step="1" value={content.gestationalAgeDays || ""} onChange={(event) => set("gestationalAgeDays", event.target.value)} /></label><label>Estimated due date<input type="date" value={content.estimatedDueDate || ""} onChange={(event) => set("estimatedDueDate", event.target.value)} /></label><label>Follow-up plan due date<input type="date" value={content.followUpDueDate || ""} onChange={(event) => set("followUpDueDate", event.target.value)} /></label></div>
          <label>Referring provider<input maxLength={191} value={content.referringProvider || ""} onChange={(event) => set("referringProvider", event.target.value)} /></label>
          <p>Create a care task below to assign and track this plan.</p>
        </div></details>
      </fieldset>
      {editable && <div className="care-actions"><button className="care-button" disabled={busy || !clientId}>{busy ? "Saving…" : amendment ? "Save amendment draft" : chart ? "Save examination" : "Create exam draft"}</button>{clientId && <Link className="care-button secondary" href={`/compassion/appointments?new=1&clientId=${encodeURIComponent(clientId)}&appointmentType=ULTRASOUND`}>Schedule visit</Link>}</div>}
    </form>
  </CareCard>;
}
