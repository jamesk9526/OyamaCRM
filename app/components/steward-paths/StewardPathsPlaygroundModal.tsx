"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

type Result = "passed" | "skipped" | "branched" | "blocked" | "failed";
type StepStatus = "pending" | "running" | Result;

interface Scenario {
  id: string;
  name: string;
  description: string;
  donorProfile: {
    donorStatus: string;
    totalLifetimeGiving: number;
    engagementScore: number;
    doNotEmail: boolean;
    doNotMail: boolean;
    doNotContact: boolean;
  };
}

interface Step {
  stepId: string;
  label: string;
  stepType: string;
  orderIndex: number;
  status: StepStatus;
  result: Result | null;
  blockReason?: string;
  executedAt: string | null;
  preview: {
    type: "email" | "letter" | "task" | "timing" | "condition" | "action";
    description: string;
    subject?: string;
    fromEmail?: string;
    templateName?: string;
    taskTitle?: string;
    taskPriority?: string;
    waitAmount?: number;
    waitUnit?: string;
  };
}

interface Activity { id: string; at: string; type: string; level: "info" | "warn" | "error"; message: string; }
interface Run {
  runId: string;
  pathName: string;
  status: "ready" | "running" | "paused" | "completed";
  isSandbox: true;
  scenario: Scenario;
  sourceConstituent: { id: string; name: string; email: string | null; source: "real" | "synthetic" };
  summary: { totalSteps: number; completedSteps: number; emailsSimulated: number; lettersSimulated: number; tasksSimulated: number; blocked: number; };
  steps: Step[];
  activity: Activity[];
}
interface MailPreview { toEmail: string; items: Array<{ stepId: string; subject: string; body: string; status: "queued" | "skipped"; reason?: string }>; }
interface Props { templateId: string; pathName?: string; initialConstituentId?: string; initialDonorName?: string; fullPage?: boolean; onClose?: () => void; }

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const resultTone: Record<StepStatus, string> = { pending: "bg-slate-100 text-slate-600", running: "bg-sky-100 text-sky-700", passed: "bg-emerald-100 text-emerald-700", skipped: "bg-amber-100 text-amber-800", branched: "bg-violet-100 text-violet-700", blocked: "bg-rose-100 text-rose-700", failed: "bg-rose-100 text-rose-700" };

function icon(type: Step["preview"]["type"]): string {
  return ({ email: "✉", letter: "▤", task: "✓", timing: "◷", condition: "◇", action: "•" })[type];
}

/** A purpose-built, ephemeral simulator. All POSTs address the in-memory playground API only. */
export default function StewardPathsPlaygroundModal({ templateId, pathName, initialConstituentId = "", initialDonorName = "", fullPage = false, onClose }: Props) {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState("");
  const [constituentId, setConstituentId] = useState(initialConstituentId);
  const [run, setRun] = useState<Run | null>(null);
  const [mail, setMail] = useState<MailPreview | null>(null);
  const [selectedMailId, setSelectedMailId] = useState<string | null>(null);
  const [inbox, setInbox] = useState<"donor" | "team">("donor");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedScenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
  const completed = run?.summary.completedSteps ?? 0;
  const progress = run ? Math.round((completed / Math.max(1, run.summary.totalSteps)) * 100) : 0;
  const donorMail = useMemo(() => mail?.items ?? [], [mail]);
  const teamItems = useMemo(() => run?.steps.filter((step) => step.status !== "pending" && (step.preview.type === "task" || step.preview.type === "letter" || step.preview.type === "action")) ?? [], [run]);
  const selectedMail = donorMail.find((item) => item.stepId === selectedMailId) ?? donorMail[0];

  const loadScenarios = useCallback(async () => {
    try {
      const suffix = constituentId.trim() ? `?constituentId=${encodeURIComponent(constituentId.trim())}` : "";
      const response = await apiFetch<{ scenarios: Scenario[] }>(`/api/steward-paths/${encodeURIComponent(templateId)}/playground/scenarios${suffix}`);
      setScenarios(response.scenarios ?? []);
      setScenarioId((current) => current || response.scenarios?.[0]?.id || "");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load sandbox scenarios."); }
  }, [constituentId, templateId]);

  useEffect(() => { void loadScenarios(); }, [loadScenarios]);

  const start = useCallback(async () => {
    setBusy(true); setError(null); setNotice(null); setMail(null); setSelectedMailId(null);
    try {
      const next = await apiFetch<Run>(`/api/steward-paths/${encodeURIComponent(templateId)}/playground/run`, { method: "POST", body: JSON.stringify({ constituentId: constituentId.trim() || undefined, scenarioId: scenarioId || undefined, options: { skipDelays: true } }) });
      setRun(next);
      setNotice("Mission loaded. Advance one action at a time or run the full simulation.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to start this sandbox mission."); } finally { setBusy(false); }
  }, [constituentId, scenarioId, templateId]);

  const control = useCallback(async (action: "step" | "auto" | "reset") => {
    if (!run) return;
    setBusy(true); setError(null);
    try {
      const route = action === "reset" ? "reset" : "step";
      const body = action === "reset" ? { runId: run.runId } : { runId: run.runId, action };
      const next = await apiFetch<Run>(`/api/steward-paths/${encodeURIComponent(templateId)}/playground/${route}`, { method: "POST", body: JSON.stringify(body) });
      setRun(next); setMail(null); setSelectedMailId(null);
      setNotice(action === "reset" ? "Mission reset. Nothing was changed outside this sandbox." : action === "step" ? "One simulated action completed." : "Simulation completed in sandbox mode.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update the simulation."); } finally { setBusy(false); }
  }, [run, templateId]);

  const openInbox = useCallback(async () => {
    if (!run) return;
    setBusy(true); setError(null);
    try {
      const preview = await apiFetch<MailPreview>(`/api/steward-paths/${encodeURIComponent(templateId)}/playground/send-test-email`, { method: "POST", body: JSON.stringify({ runId: run.runId, testEmail: "sandbox-preview@local.invalid" }) });
      setMail(preview); setInbox("donor"); setSelectedMailId(preview.items[0]?.stepId ?? null);
      setNotice("Inbox rendered locally. No email was delivered and no analytics were recorded.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to render sandbox inbox."); } finally { setBusy(false); }
  }, [run, templateId]);

  const frame = (
    <main className="min-h-full bg-[#07111f] text-slate-100">
      <div className="border-b border-white/10 bg-[#0a1729]/95 px-4 py-3 backdrop-blur md:px-7">
        <div className="mx-auto flex max-w-[1660px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-indigo-500 text-lg shadow-lg shadow-fuchsia-950/40">✦</div><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Steward Paths · Simulator</p><h1 className="text-base font-semibold text-white">{run?.pathName || pathName || "Steward Path"}</h1></div></div>
          <div className="flex items-center gap-2"><span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">● isolated sandbox</span>{fullPage ? <Link href={`/steward-paths/${encodeURIComponent(templateId)}/builder`} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">Back to builder</Link> : <button onClick={onClose} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10">Close</button>}</div>
        </div>
      </div>

      <div className="mx-auto grid max-w-[1660px] gap-4 p-4 lg:grid-cols-[300px_minmax(0,1fr)_360px] lg:p-6">
        <aside className="space-y-4">
          <section className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 shadow-2xl shadow-black/20"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Mission setup</p><h2 className="mt-2 text-lg font-semibold text-white">Choose the donor reality</h2><p className="mt-1 text-xs leading-5 text-slate-400">Scenarios change only the in-memory profile used to evaluate this path.</p>
            <label className="mt-4 block text-xs font-semibold text-slate-300">Optional real donor ID<input value={constituentId} onChange={(event) => setConstituentId(event.target.value)} onBlur={() => void loadScenarios()} placeholder="Leave blank for synthetic donor" className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-[#0c1b30] px-3 text-sm text-white outline-none focus:border-cyan-400" /></label>
            <div className="mt-3 space-y-2">{scenarios.map((item) => <button key={item.id} type="button" onClick={() => setScenarioId(item.id)} className={`w-full rounded-xl border p-3 text-left transition ${item.id === selectedScenario?.id ? "border-cyan-400/80 bg-cyan-400/10" : "border-white/10 bg-white/[0.025] hover:bg-white/[0.07]"}`}><span className="block text-sm font-semibold text-white">{item.name}</span><span className="mt-1 block text-xs leading-4 text-slate-400">{item.description}</span></button>)}</div>
            <button type="button" disabled={busy || !selectedScenario} onClick={() => void start()} className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-950/40 disabled:opacity-50">{busy ? "Preparing…" : "Start simulation"}</button>
          </section>
          {selectedScenario ? <section className="rounded-2xl border border-white/10 bg-[#0c1b30] p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Simulation profile</p><p className="mt-2 font-semibold text-white">{initialDonorName || (constituentId ? "Selected CRM donor" : "Synthetic sandbox donor")}</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-white/[0.06] p-2"><span className="block text-slate-500">Status</span>{selectedScenario.donorProfile.donorStatus}</div><div className="rounded-lg bg-white/[0.06] p-2"><span className="block text-slate-500">Giving</span>{currency.format(selectedScenario.donorProfile.totalLifetimeGiving)}</div><div className="rounded-lg bg-white/[0.06] p-2"><span className="block text-slate-500">Engagement</span>{selectedScenario.donorProfile.engagementScore}/100</div><div className="rounded-lg bg-white/[0.06] p-2"><span className="block text-slate-500">Email</span>{selectedScenario.donorProfile.doNotEmail ? "Opted out" : "Allowed"}</div></div></section> : null}
        </aside>

        <section className="min-w-0 rounded-2xl border border-white/10 bg-[#0c1b30] p-4 md:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-300">Live pathboard</p><h2 className="mt-1 text-xl font-semibold text-white">{run ? `${completed} of ${run.summary.totalSteps} actions simulated` : "Your path, played safely"}</h2></div>{run ? <div className="flex gap-2"><button onClick={() => void control("step")} disabled={busy || run.status === "completed"} className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40">Play next</button><button onClick={() => void control("auto")} disabled={busy || run.status === "completed"} className="rounded-lg border border-cyan-400/50 px-3 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-400/10 disabled:opacity-40">Run all</button><button onClick={() => void control("reset")} disabled={busy} className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10">Reset</button></div> : null}</div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-fuchsia-500 transition-all duration-500" style={{ width: `${progress}%` }} /></div>
          <div className="mt-5 space-y-3">{run?.steps.map((step, index) => <article key={step.stepId} className={`relative rounded-xl border p-4 ${step.status === "pending" ? "border-white/10 bg-white/[0.025]" : "border-cyan-300/25 bg-cyan-300/[0.045]"}`}><div className="flex gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-sm">{icon(step.preview.type)}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-white">{index + 1}. {step.label}</h3><span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${resultTone[step.status]}`}>{step.status}</span></div><p className="mt-1 text-sm text-slate-400">{step.preview.description}</p>{step.preview.type === "email" && step.status !== "pending" ? <p className="mt-2 rounded-lg border border-sky-300/15 bg-sky-300/[0.06] px-2.5 py-2 text-xs text-sky-100">To donor inbox · <strong>{step.preview.subject || "No subject configured"}</strong> · from {step.preview.fromEmail || "configured sender"}</p> : null}{step.preview.type === "task" && step.status !== "pending" ? <p className="mt-2 text-xs text-teal-200">Team task: {step.preview.taskTitle || step.label} · {step.preview.taskPriority || "MEDIUM"}</p> : null}{step.blockReason ? <p className="mt-2 text-xs font-medium text-rose-300">Guardrail: {step.blockReason}</p> : null}</div></div></article>) ?? <div className="grid min-h-[410px] place-items-center rounded-2xl border border-dashed border-white/15 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.10),transparent_45%)] p-8 text-center"><div><p className="text-4xl">◉</p><h3 className="mt-3 text-lg font-semibold text-white">Ready at the starting line</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-400">Select a donor scenario, then start the simulation. Every effect you see stays in this sandbox.</p></div></div>}</div>
        </section>

        <aside className="space-y-4"><section className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1b30]"><div className="flex border-b border-white/10"><button onClick={() => setInbox("donor")} className={`flex-1 px-3 py-3 text-xs font-bold ${inbox === "donor" ? "bg-cyan-400/10 text-cyan-300" : "text-slate-400"}`}>Donor inbox</button><button onClick={() => setInbox("team")} className={`flex-1 px-3 py-3 text-xs font-bold ${inbox === "team" ? "bg-cyan-400/10 text-cyan-300" : "text-slate-400"}`}>Team inbox</button></div>{inbox === "donor" ? <div className="p-3">{!mail ? <div className="rounded-xl border border-dashed border-white/15 p-5 text-center"><p className="text-sm font-semibold text-white">No messages rendered</p><p className="mt-1 text-xs leading-5 text-slate-400">Complete the path, then render the donor inbox. The preview never leaves Playground.</p><button disabled={!run || busy} onClick={() => void openInbox()} className="mt-3 rounded-lg bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40">Render inbox</button></div> : <><div className="max-h-44 space-y-2 overflow-auto">{donorMail.map((item) => <button key={item.stepId} onClick={() => setSelectedMailId(item.stepId)} className={`w-full rounded-lg border p-2.5 text-left ${item.stepId === selectedMail?.stepId ? "border-cyan-400/60 bg-cyan-400/10" : "border-white/10"}`}><p className="truncate text-xs font-semibold text-white">{item.subject}</p><p className="mt-1 text-[11px] text-slate-400">{item.status === "queued" ? "Simulated delivery" : item.reason}</p></button>)}</div>{selectedMail ? <article className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-3"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">To: sandbox-preview@local.invalid</p><h3 className="mt-2 text-sm font-semibold text-white">{selectedMail.subject}</h3><pre className="mt-3 whitespace-pre-wrap font-sans text-xs leading-5 text-slate-300">{selectedMail.body}</pre></article> : null}</>}</div> : <div className="space-y-2 p-3">{teamItems.length ? teamItems.map((step) => <article key={step.stepId} className="rounded-xl border border-white/10 bg-white/[0.035] p-3"><p className="text-[10px] font-bold uppercase tracking-wide text-teal-300">{step.preview.type === "task" ? "Task created" : step.preview.type === "letter" ? "Letter queue" : "CRM action"}</p><p className="mt-1 text-sm font-semibold text-white">{step.preview.taskTitle || step.preview.templateName || step.label}</p><p className="mt-1 text-xs text-slate-400">Sandbox-only output · no CRM record created</p></article>) : <p className="rounded-xl border border-dashed border-white/15 p-5 text-center text-xs leading-5 text-slate-400">Play an action to see internal work appear here.</p>}</div>}</section>
          <section className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4"><p className="text-sm font-bold text-emerald-200">Sandbox guarantee</p><p className="mt-1 text-xs leading-5 text-emerald-100/75">No enrollment, timeline, task, donor, or email record is written. No email is sent. The only server state is an expiring in-memory simulation.</p></section>
          {run ? <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Outcome</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><span className="block text-slate-500">Emails</span><strong>{run.summary.emailsSimulated}</strong></div><div><span className="block text-slate-500">Tasks</span><strong>{run.summary.tasksSimulated}</strong></div><div><span className="block text-slate-500">Letters</span><strong>{run.summary.lettersSimulated}</strong></div><div><span className="block text-slate-500">Guardrails</span><strong>{run.summary.blocked}</strong></div></div></section> : null}
        </aside>
      </div>
      {(error || notice) ? <div className="fixed bottom-4 left-1/2 z-20 w-[min(600px,calc(100%-2rem))] -translate-x-1/2 rounded-xl border border-white/15 bg-[#12233c] px-4 py-3 text-sm shadow-2xl">{error ? <span className="text-rose-300">{error}</span> : <span className="text-cyan-100">{notice}</span>}</div> : null}
    </main>
  );
  return fullPage ? frame : <div className="fixed inset-0 z-[80] overflow-auto bg-[#07111f]">{frame}</div>;
}
