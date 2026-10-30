"use client";
import { useState } from "react";
import Link from "next/link";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { DashboardData, DonorDashboardSummary } from "@/app/features/donor-dashboard/types";
import { formatDashboardCurrency } from "@/app/features/donor-dashboard/calculations/dashboard-calculations";

import { RefreshCw } from "lucide-react";

const slides = ["Giving momentum", "Donor relationships", "Your next steps"];
export default function DonorSpotlight({ data, summary, loading, unavailable, onRefresh }: { data: DashboardData | null; summary: DonorDashboardSummary | null; loading: boolean; unavailable: boolean; onRefresh: () => void }) {
  const [slide, setSlide] = useState(0);
  const points = data?.trendPoints ?? [];
  const trendUnavailable = unavailable || !data || data.errors.some(error => error.startsWith("Giving trend"));
  return <section className="donor-spotlight" aria-label="Donor workspace highlights" aria-roledescription="carousel">
    <div className="donor-spotlight-header"><div><p className="donor-spotlight-eyebrow">Your donor workspace</p><h2>Every connection moves your mission forward.</h2><p>{summary?.period?.label ?? "Your current reporting period"} · Insights and next actions</p></div><div className="donor-spotlight-controls"><button type="button" disabled={loading} aria-label="Refresh highlights" onClick={onRefresh}><RefreshCw size={16} className={loading ? "motion-safe:animate-spin" : ""} /></button><button type="button" aria-label="Previous highlight" onClick={() => setSlide(value => (value + 2) % 3)}>←</button><span>{slide + 1} / 3</span><button type="button" aria-label="Next highlight" onClick={() => setSlide(value => (value + 1) % 3)}>→</button></div></div>
    <div aria-live="polite" key={slide} className="donor-spotlight-slide" role="group" aria-roledescription="slide" aria-label={`${slide + 1} of 3: ${slides[slide]}`}>
      <div><h3>{slides[slide]}</h3><p>{slide === 0 ? "See how completed giving is moving through the reporting period." : slide === 1 ? "Welcome new supporters and keep your existing relationships strong." : "Turn the next follow-up into a meaningful conversation."}</p><Link href={slide === 0 ? "/reports" : slide === 1 ? "/constituents" : "/tasks"}>{slide === 0 ? "Explore reports" : slide === 1 ? "Open constituent workspace" : "Review tasks"} →</Link></div>
      <div className="donor-spotlight-visual">
        {loading ? <div role="status" className="donor-spotlight-loading"><span className="donor-loading-indicator">Loading highlights…</span><div aria-hidden="true" className="donor-spotlight-loading-bars">{[45, 65, 40, 80, 60, 95, 75, 55].map((height, index) => <i key={index} style={{ height: `${height}%` }} />)}</div></div> : slide === 0 ? trendUnavailable ? <p>Giving trend unavailable.</p> : !points.length ? <p>No completed giving to chart in this period.</p> : <><div className="h-44" role="img" aria-label="Monthly completed giving; exact values available below"><ResponsiveContainer width="100%" height="100%"><AreaChart data={points}><XAxis dataKey="label" tick={{ fill: "#dceef0", fontSize: 11 }} axisLine={false} tickLine={false} /><Tooltip contentStyle={{ background: "#10283f", border: "1px solid #639798", color: "#fff" }} labelStyle={{ color: "#fff" }} itemStyle={{ color: "#99f6e4" }} formatter={value => formatDashboardCurrency(Number(value))} /><Area dataKey="amount" name="Completed giving" stroke="#5eead4" fill="#2dd4bf" fillOpacity={0.2} strokeWidth={3} isAnimationActive={false} /></AreaChart></ResponsiveContainer></div><details><summary>View chart values</summary><ul>{points.map(point => <li key={point.label}>{point.label}: {formatDashboardCurrency(point.amount)}</li>)}</ul></details></> : unavailable || !summary ? <p>Summary unavailable.</p> : <div className="donor-spotlight-stats">{(slide === 1 ? [["New donors this month", summary.newDonorsThisMonth], ["Active donors", summary.activeDonors]] : [["Pending tasks", summary.pendingTasks], ["Overdue tasks", summary.overdueTasks]]).map(([label, value]) => <div key={label}><span>{label}</span><strong>{Number(value).toLocaleString()}</strong></div>)}</div>}
      </div>
    </div>
    <div className="donor-spotlight-tabs" role="group" aria-label="Choose highlight">{slides.map((label, index) => <button key={label} type="button" aria-pressed={slide === index} onClick={() => setSlide(index)}>{label}</button>)}</div>
  </section>;
}
