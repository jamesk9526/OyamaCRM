"use client";
import Link from "next/link";
import { CareCard, CareEmpty, CareError, useCareData } from "../care-ui";
import { chartStatusLabel, formatCareDate, type UltrasoundWorklist } from "./types";

export default function ClientUltrasounds({ clientId }: { clientId: string }) {
  const exams = useCareData<UltrasoundWorklist>(`/api/compassion/ultrasounds?clientId=${encodeURIComponent(clientId)}`);
  return <CareCard title="Ultrasound history" description="Examinations, scans, signed reports, and next steps" action={<Link href={`/compassion/ultrasounds?clientId=${encodeURIComponent(clientId)}&new=1`}>New examination →</Link>}>
    <CareError error={exams.error} />{exams.loading ? <CareEmpty title="Loading ultrasound history…" /> : exams.error ? <CareEmpty title="Examinations are unavailable"><button className="care-button secondary" onClick={() => void exams.reload()}>Try again</button></CareEmpty> : exams.data?.items.length ? exams.data.items.map((exam) => <div key={exam.id} className="care-row"><div className="care-row-main"><strong>{formatCareDate(exam.examDate)}</strong><small>Version {exam.version} · {exam.attachmentCount} supporting files{exam.performedBy ? ` · ${exam.performedBy}` : ""}</small></div><span className="care-badge">{chartStatusLabel(exam.status)}</span><Link className="care-button secondary" href={`/compassion/ultrasounds?clientId=${encodeURIComponent(clientId)}&examId=${encodeURIComponent(exam.id)}`}>Open examination</Link>{exam.status === "SIGNED" && <Link className="care-button secondary" href={`/compassion/care/reports/${exam.id}`}>Signed report</Link>}</div>) : <CareEmpty title="No ultrasound examinations recorded">Create the first examination to keep this client&apos;s scans and clinical review together.</CareEmpty>}<div className="care-card-body"><Link className="care-button secondary" href={`/compassion/ultrasounds?clientId=${encodeURIComponent(clientId)}`}>Manage client ultrasounds{exams.data && exams.data.total > 25 ? ` (${exams.data.total})` : ""}</Link></div>
  </CareCard>;
}
