"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCheck, ClipboardEdit, FileCheck2, Plus, RefreshCw, Search, ScanLine } from "lucide-react";
import { useCareAccess } from "../CompassionShell";
import { CareCard, CareEmpty, CareError, CareHeading, useCareData } from "../care-ui";
import UltrasoundExamForm from "./UltrasoundExamForm";
import UltrasoundExamPanel from "./UltrasoundExamPanel";
import { chartStatusLabel, formatCareDate, type UltrasoundWorklist } from "./types";

export default function UltrasoundWorkspace({ initialClientId = "", initialExamId = "", initialStatus = "", startNew = false }: { initialClientId?: string; initialExamId?: string; initialStatus?: string; startNew?: boolean }) {
  const access = useCareAccess(); const router = useRouter(); const canRead = Boolean(access?.capabilities.includes("clinical"));
  const [status, setStatus] = useState(["DRAFT", "REVIEW", "SIGNED"].includes(initialStatus) ? initialStatus : ""); const [search, setSearch] = useState(""); const [page, setPage] = useState(1);
  const [examId, setExamId] = useState(initialExamId); const [creating, setCreating] = useState(startNew);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const params = new URLSearchParams({ page: String(page) });
  if (initialClientId) params.set("clientId", initialClientId);
  if (status) params.set("status", status);
  if (search.trim()) params.set("search", search.trim());
  const worklist = useCareData<UltrasoundWorklist>(canRead ? `/api/compassion/ultrasounds?${params}` : null);
  useEffect(() => { if ((examId || creating) && window.matchMedia("(max-width: 1000px)").matches) panel.current?.scrollIntoView({ block: "start" }); }, [examId, creating]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const followLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.pathname === window.location.pathname && destination.search === window.location.search && destination.origin === window.location.origin) return;
      if (!window.confirm("Leave this exam without saving your changes?")) { event.preventDefault(); event.stopPropagation(); }
    };
    const navigation = (window as Window & { navigation?: EventTarget }).navigation;
    const traverse = (event: Event) => {
      if ((event as Event & { navigationType?: string }).navigationType === "traverse" && event.cancelable && !window.confirm("Leave this exam without saving your changes?")) event.preventDefault();
    };
    window.addEventListener("beforeunload", unload); document.addEventListener("click", followLink, true); navigation?.addEventListener("navigate", traverse);
    return () => { window.removeEventListener("beforeunload", unload); document.removeEventListener("click", followLink, true); navigation?.removeEventListener("navigate", traverse); };
  }, [dirty]);
  function navigate(id: string, newExam = false, saved = false) {
    if (dirty && !saved && !window.confirm("Leave this exam without saving your changes?")) return;
    setDirty(false);
    setExamId(id); setCreating(newExam); setError("");
    const query = new URLSearchParams(); if (initialClientId) query.set("clientId", initialClientId); if (id) query.set("examId", id); if (newExam) query.set("new", "1");
    router.replace(`/compassion/ultrasounds${query.size ? `?${query}` : ""}`, { scroll: false });
  }
  async function run(work: () => Promise<void>) { setBusy(true); setError(""); setNotice(""); try { await work(); } catch (failure) { setError(failure instanceof Error ? failure.message : "Unable to create the examination."); } finally { setBusy(false); } }
  if (!canRead) return <><CareHeading title="Ultrasounds" description="Protected examination records and clinical review." /><CareEmpty title="Clinical access required">Ask your Compassion administrator for a clinical role to manage ultrasound examinations.</CareEmpty></>;
  const counts = worklist.data?.counts;
  const stats = [
    { label: "Examinations", value: counts ? counts.DRAFT + counts.REVIEW + counts.SIGNED : undefined, status: "", icon: ScanLine, helper: initialClientId ? "For this client" : "Across your care workspace" },
    { label: "In progress", value: counts?.DRAFT, status: "DRAFT", icon: ClipboardEdit, helper: "Drafts to finish documenting" },
    { label: "Awaiting review", value: counts?.REVIEW, status: "REVIEW", icon: FileCheck2, helper: "Ready for physician review" },
    { label: "Signed reports", value: counts?.SIGNED, status: "SIGNED", icon: CheckCheck, helper: "Preserved clinical records" },
  ];
  return <>
    <CareHeading title="Ultrasounds" description="From the first scan to the next step in care. Keep each examination, its images, and its review together." eyebrow="CLINICAL CARE">
      <Link href={`/compassion/appointments?new=1&appointmentType=ULTRASOUND${initialClientId ? `&clientId=${encodeURIComponent(initialClientId)}` : ""}`} className="care-button secondary"><CalendarDays size={16} /> Schedule ultrasound</Link>
      <button className="care-button" onClick={() => navigate("", true)}><Plus size={16} /> New examination</button>
    </CareHeading>
    {initialClientId && <div className="care-scope-bar"><span>Showing examinations for the selected client</span><Link href={`/compassion/clients/${initialClientId}`}>Client record</Link><Link href="/compassion/ultrasounds">All clients</Link></div>}
    <div className="care-stats care-exam-stats">{stats.map(({ label, value, status: filter, icon: Icon, helper }) => <button className="care-stat" key={label} onClick={() => { setStatus(filter); setPage(1); }} aria-pressed={status === filter}><span className="care-stat-icon"><Icon size={19} /></span><p>{label}</p><strong>{worklist.error ? "—" : value ?? "…"}</strong><small>{helper}</small></button>)}</div>
    <CareError error={worklist.error || error} />{notice && <div className="care-notice" role="status">{notice}</div>}
    <div className={`care-ultrasound-workspace ${examId || creating ? "has-exam" : ""}`}>
      <CareCard title="Examination worklist" description="Most recently updated first" action={<button className="care-button secondary care-icon-button" disabled={worklist.loading} aria-label="Refresh ultrasound worklist" onClick={() => void worklist.reload()}><RefreshCw size={15} /></button>}>
        <div className="care-card-body care-exam-filters"><label className="care-search-field"><Search size={16} /><input type="search" className="care-input" aria-label="Search ultrasound clients" placeholder="Find a client by name" maxLength={100} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label><div className="care-segmented" aria-label="Filter ultrasound charts">{["", "DRAFT", "REVIEW", "SIGNED"].map((filter) => <button key={filter} aria-pressed={status === filter} onClick={() => { setStatus(filter); setPage(1); }}>{filter ? chartStatusLabel(filter) : "All exams"}</button>)}</div></div>
        {worklist.loading ? <CareEmpty title="Loading ultrasound examinations…" /> : worklist.error ? <CareEmpty title="Examinations are unavailable"><button className="care-button secondary" onClick={() => void worklist.reload()}>Try again</button></CareEmpty> : worklist.data?.items.length ? <div className="care-exam-list">{worklist.data.items.map((row) => {
          const overdue = row.followUps.some((task) => task.status === "OVERDUE" || (["PENDING", "IN_PROGRESS"].includes(task.status) && new Date(task.dueDate) < new Date()));
          return <button className={`care-exam-item ${examId === row.id ? "selected" : ""}`} key={row.id} onClick={() => navigate(row.id)} aria-pressed={examId === row.id}>
            <span className="care-exam-item-top"><strong>{row.client.firstName} {row.client.lastName}</strong><span className={`care-badge ${row.status === "SIGNED" ? "teal" : row.status === "REVIEW" ? "review" : ""}`}>{chartStatusLabel(row.status)}</span></span>
            <span className="care-exam-item-date">{formatCareDate(row.examDate)} · Version {row.version}{row.performedBy ? ` · ${row.performedBy}` : ""}</span>
            <span className="care-exam-item-bottom"><span>{row.attachmentCount} supporting {row.attachmentCount === 1 ? "file" : "files"}</span>{row.appointment && <span>{row.appointment.status.toLowerCase().replaceAll("_", " ")} · {new Date(row.appointment.startTime).toLocaleDateString()}</span>}{overdue && <span className="care-badge attention">Follow-up overdue</span>}</span>
          </button>;
        })}</div> : <CareEmpty title={search || status ? "No examinations match these filters" : "A clear place for every ultrasound"}><ScanLine size={34} /><p>{search || status ? "Try a different client name or chart status." : "Create an examination to connect findings, supporting scans, physician review, and follow-up."}</p><button className="care-button secondary" onClick={() => search || status ? (setSearch(""), setStatus(""), setPage(1)) : navigate("", true)}>{search || status ? "Clear filters" : "Create first examination"}</button></CareEmpty>}
        {worklist.data && worklist.data.total > 0 && <div className="care-exam-pagination"><span>{Math.min((page - 1) * worklist.data.pageSize + 1, worklist.data.total)}–{Math.min(page * worklist.data.pageSize, worklist.data.total)} of {worklist.data.total}</span><button className="care-button secondary" disabled={page <= 1 || worklist.loading} onClick={() => setPage(page - 1)}>Previous</button><button className="care-button secondary" disabled={page * worklist.data.pageSize >= worklist.data.total || worklist.loading} onClick={() => setPage(page + 1)}>Next</button></div>}
      </CareCard>
      {(examId || creating) && <div ref={panel} className="care-exam-detail" tabIndex={-1}>{creating ? <div className="care-stack"><div className="care-actions"><button className="care-button secondary" onClick={() => navigate("")}>Cancel new examination</button></div><UltrasoundExamForm initialClientId={initialClientId} busy={busy} run={run} onDirty={() => setDirty(true)} onSaved={async (id, message) => { setNotice(message); setStatus(""); setSearch(""); setPage(1); navigate(id, false, true); await worklist.reload(); }} /></div> : <UltrasoundExamPanel key={examId} examId={examId} onChanged={worklist.reload} onOpen={(id, message) => { setNotice(message); navigate(id, false, true); }} onClose={() => navigate("")} onDirtyChange={setDirty} />}</div>}
    </div>
  </>;
}
