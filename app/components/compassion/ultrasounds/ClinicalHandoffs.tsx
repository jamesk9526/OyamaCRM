"use client";
import Link from "next/link";
import { ArrowRight, ScanLine } from "lucide-react";
import { CareCard, CareEmpty, CareError, useCareData } from "../care-ui";

export default function ClinicalHandoffs() {
  const summary = useCareData<{ DRAFT: number; REVIEW: number; openFollowUps: number; overdueFollowUps: number }>("/api/compassion/ultrasounds/summary");
  return <CareCard title="Clinical handoffs" description="Keep examinations moving toward the next step" action={<Link href="/compassion/ultrasounds">Ultrasounds <ArrowRight size={14} /></Link>}>
    <CareError error={summary.error} />{summary.loading ? <CareEmpty title="Loading clinical handoffs…" /> : summary.error ? <CareEmpty title="Clinical handoffs are unavailable"><button className="care-button secondary" onClick={() => void summary.reload()}>Try again</button></CareEmpty> : <div className="care-handoff-links"><Link href="/compassion/ultrasounds"><ScanLine size={20} /><span><strong>{summary.data?.DRAFT ?? 0} ultrasound drafts</strong><small>Continue examination documentation</small></span><ArrowRight size={15} /></Link><Link href="/compassion/ultrasounds?status=REVIEW"><strong>{summary.data?.REVIEW ?? 0}</strong><span>Examinations awaiting physician review</span><ArrowRight size={15} /></Link><Link href="/compassion/follow-ups"><strong>{summary.data?.openFollowUps ?? 0}</strong><span>Open examination follow-ups{summary.data?.overdueFollowUps ? ` · ${summary.data.overdueFollowUps} overdue` : ""}</span><ArrowRight size={15} /></Link></div>}
  </CareCard>;
}
