"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Check, ClipboardCheck, ClipboardList, FileHeart, MessageSquare, Plus, RefreshCw, Users } from "lucide-react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { CareCard, CareEmpty, CareError, CareHeading, careWrite, useCareData } from "./care-ui";
import { useCareAccess } from "./CompassionShell";
interface Today { activeClients: number; activeCases: number; pendingApprovals: number | null; incompleteIntake: number; appointments: Array<{ id: string; startTime: string; status: string; appointmentType: string; location: string | null; client: { id: string; firstName: string; lastName: string } }>; followUps: Array<{ id: string; clientId: string; title: string; dueDate: string }> }
export default function TodayWorkspace() {
  const { user } = useAuth(); const access = useCareAccess();
  const start = new Date(); start.setHours(0, 0, 0, 0); const end = new Date(start); end.setDate(end.getDate() + 1);
  const { data, error, loading, reload } = useCareData<Today>(`/api/compassion/today?start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`);
  const [saving, setSaving] = useState<string | null>(null); const [actionError, setActionError] = useState(""); const [notice, setNotice] = useState("");
  const can = (capability: string) => access?.capabilities.includes(capability);
  async function complete(id: string) {
    setSaving(id); setActionError(""); setNotice("");
    try { await careWrite(`/follow-ups/${id}`, { status: "COMPLETED" }, "PATCH"); setNotice("Follow-up marked complete."); await reload(); }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : "Unable to complete follow-up."); }
    finally { setSaving(null); }
  }
  const cards = [
    { label: "Appointments today", value: data?.appointments.length, helper: "On today's schedule", icon: CalendarDays, href: can("schedule") ? "/compassion/appointments" : "/compassion/clients" },
    { label: "Active clients", value: data?.activeClients, helper: "People in your care", icon: Users, href: "/compassion/clients?status=ACTIVE" },
    { label: "Intake in progress", value: data?.incompleteIntake, helper: "Requested or awaiting processing", icon: ClipboardList, href: can("casework") ? "/compassion/intake" : "/compassion/clients" },
    { label: can("clinical") ? "Charts awaiting review" : "Open cases", value: can("clinical") ? data?.pendingApprovals : data?.activeCases, helper: can("clinical") ? "Awaiting physician sign-off" : "Active care coordination", icon: FileHeart, href: can("clinical") ? "/compassion/care" : can("casework") ? "/compassion/cases" : "/compassion/clients" },
  ];
  const tools = [
    { title: "Review intake", description: "Forms, answers, and consent", href: "/compassion/intake", icon: ClipboardList, capability: "casework" },
    { title: "Clinical workspace", description: "Charting and physician review", href: "/compassion/care", icon: FileHeart, capability: "clinical" },
    { title: "Client conversations", description: "Secure portal messages", href: "/compassion/messages", icon: MessageSquare, capability: "messages" },
  ].filter((tool) => can(tool.capability));
  return <>
    <div className="care-today-banner"><CareHeading title={`Welcome back${user?.firstName ? `, ${user.firstName}` : ""}`} description={start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} eyebrow="YOUR DAY IN CARE">{can("schedule") && <Link href="/compassion/appointments?new=1" className="care-button"><Plus size={16} /> Schedule appointment</Link>}<button className="care-button secondary care-icon-button" aria-label="Refresh today's workspace" disabled={loading} onClick={() => void reload()}><RefreshCw size={16} /></button></CareHeading><p className="care-banner-note">A clear view of your day. More time for the people who need you.</p></div>
    <CareError error={error || actionError} />{notice && <div className="care-notice" role="status">{notice}</div>}
    <div className="care-stats">{cards.map(({ label, value, helper, icon: Icon, href }) => <Link href={href} className="care-stat" key={label}><span className="care-stat-icon"><Icon size={19} /></span><p>{label}</p><strong>{loading ? "…" : error ? "—" : value ?? "—"}</strong><small>{helper}</small></Link>)}</div>
    <div className="care-grid care-today-grid"><CareCard title="Today's schedule" description="Your appointments, in order of arrival" action={can("schedule") ? <Link href="/compassion/appointments">Open calendar <ArrowRight size={14} /></Link> : undefined}>
      {loading ? <CareEmpty title="Loading your schedule…" /> : error ? <CareEmpty title="Your schedule is unavailable"><button className="care-button secondary" onClick={() => void reload()}>Try again</button></CareEmpty> : data?.appointments.length ? data.appointments.map((row) => <Link href={`/compassion/clients/${row.client.id}`} key={row.id} className="care-row care-appointment-row"><time className="care-time" dateTime={row.startTime}>{new Date(row.startTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</time><span className="care-person-avatar">{row.client.firstName[0]}{row.client.lastName[0]}</span><div className="care-row-main"><strong>{row.client.firstName} {row.client.lastName}</strong><small>{row.appointmentType.replaceAll("_", " ").toLowerCase()}{row.location ? ` · ${row.location}` : ""}</small></div><span className={`care-badge ${row.status === "COMPLETED" ? "teal" : ""}`}>{row.status.toLowerCase().replaceAll("_", " ")}</span><ArrowRight size={15} className="care-row-arrow" /></Link>) : <CareEmpty title="A little breathing room"><CalendarDays size={32} /><p>No appointments are scheduled today.</p>{can("schedule") && <Link href="/compassion/appointments?new=1" className="care-button secondary">Schedule an appointment</Link>}</CareEmpty>}
    </CareCard><div className="care-stack">{can("casework") && <CareCard title="Your follow-ups" description="Assigned to you · due today or overdue" action={<Link href="/compassion/follow-ups">View all <ArrowRight size={14} /></Link>}>
      {loading ? <CareEmpty title="Loading follow-ups…" /> : error ? <CareEmpty title="Follow-ups are unavailable" /> : data?.followUps.length ? data.followUps.map((row) => <div className="care-row" key={row.id}><span className={`care-task-dot ${new Date(row.dueDate) < start ? "overdue" : ""}`} /><div className="care-row-main"><Link href={`/compassion/clients/${row.clientId}`}><strong>{row.title}</strong></Link><small>{new Date(row.dueDate) < start ? "Overdue · " : "Due "}{new Date(row.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</small></div><button className="care-complete-button" aria-label={`Complete ${row.title}`} title="Mark complete" disabled={saving !== null} onClick={() => void complete(row.id)}>{saving === row.id ? "…" : <Check size={17} />}</button></div>) : <CareEmpty title="You're all caught up"><ClipboardCheck size={28} /><p>No assigned follow-ups are due.</p></CareEmpty>}
    </CareCard>}{tools.length > 0 && <CareCard title="Continue caring" description="The next step is close at hand"><div className="care-tool-links">{tools.map(({ title, description, href, icon: Icon }) => <Link href={href} className="care-tool-link" key={href}><span className="care-tool-icon"><Icon size={20} /></span><div><strong>{title}</strong><small>{description}</small></div><ArrowRight size={15} /></Link>)}</div></CareCard>}</div></div>
  </>;
}
