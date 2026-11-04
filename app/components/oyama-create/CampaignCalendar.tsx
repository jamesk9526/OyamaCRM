"use client";

import Link from "next/link";
import { useState } from "react";
import { useCreateData } from "./use-create-data";
import { Heading } from "./ui";
import { channelNames, type Channel } from "./types";

type CalendarItem = { id: string; contentId: string; channel: Channel; name: string; scheduledAt: string; campaignId: string; campaign: { name: string; status: string } };
type CalendarPage = { items: CalendarItem[]; hasMore: boolean; nextCursor: string | null };

export default function CampaignCalendar() {
  const [date, setDate] = useState(new Date());
  const [after, setAfter] = useState<string | null>(null);
  const [previous, setPrevious] = useState<CalendarItem[]>([]);
  const resource = useCreateData<CalendarPage>(`/api/oyama-create/calendar${after ? `?after=${encodeURIComponent(after)}` : ""}`);
  const entries = [...new Map([...previous, ...(resource.data?.items || [])].map(item => [item.id, item])).values()].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const start = new Date(date.getFullYear(), date.getMonth(), 1), end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const days = Array.from({ length: start.getDay() + end.getDate() }, (_, index) => index < start.getDay() ? null : index - start.getDay() + 1);
  function loadMore() {
    if (!resource.data?.nextCursor || resource.loading) return;
    setPrevious(entries); setAfter(resource.data.nextCursor);
  }
  return <>
    <Heading title="Campaign calendar" subtitle="Channel delivery dates in your local time. Set a shared date or customize each format in the campaign workspace." action={<div className="oc-actions"><button className="oc-button" aria-label="Previous month" onClick={() => setDate(new Date(date.getFullYear(), date.getMonth() - 1, 1))}>←</button><strong>{date.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong><button className="oc-button" aria-label="Next month" onClick={() => setDate(new Date(date.getFullYear(), date.getMonth() + 1, 1))}>→</button></div>}/>
    {resource.error && <div className="oc-error" role="alert">{resource.error} <button className="oc-button small" onClick={() => void resource.reload()}>Try again</button></div>}
    {resource.loading && <p className="oc-help" role="status">Loading campaign dates…</p>}
    {resource.data?.hasMore && <div className="oc-notice" style={{ marginBottom: 18 }}><strong>More campaign content remains to be checked.</strong><p>Load the next portion to include all available delivery dates.</p><button className="oc-button" disabled={resource.loading} onClick={loadMore}>Load more calendar entries</button></div>}
    <div className="oc-calendar-month">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => <div className="oc-calendar-weekday" key={day}>{day}</div>)}
      {days.map((day, index) => <div className={`oc-calendar-day ${day ? "" : "oc-calendar-blank"}`} key={index}>{day && <><span>{day}</span>{entries.filter(item => { const scheduled = new Date(item.scheduledAt); return scheduled.getFullYear() === date.getFullYear() && scheduled.getMonth() === date.getMonth() && scheduled.getDate() === day; }).map(item => <Link title={`${item.campaign.name}: ${item.name}`} href={`/oyama-create/campaigns/${item.campaignId}?content=${item.contentId}`} key={item.id}><time dateTime={item.scheduledAt}>{new Date(item.scheduledAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time><br/>{item.name} · {channelNames[item.channel]}</Link>)}</>}</div>)}
    </div>
    {!entries.length && !resource.loading && !resource.error && <p className="oc-help" style={{ marginTop: 15 }}>{resource.data?.hasMore ? "No dates in this portion. Continue loading to check the remaining content." : "No content has a delivery date yet."}</p>}
  </>;
}
