/**
 * TestRunModal — wide two-panel dry-run simulation for a Steward Path workflow.
 * Left panel: animated step-by-step simulation list.
 * Right panel: rich "what would happen" preview cards from the server dry-run API.
 * Default mode is pure simulation; optional test sends can target one explicit staff email.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { PALETTE_ITEMS } from "./palette-catalog";
import { type WorkflowDocument, type WorkflowNode } from "./workflow-types";
import { apiFetch } from "@/app/lib/auth-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StepStatus = "pending" | "running" | "passed" | "skipped" | "branched" | "blocked" | "failed";

interface SimulatedStep {
  nodeId: string;
  label: string;
  kind: string;
  description: string;
  status: StepStatus;
  campaignId?: string;
}

/** Shape returned by POST /api/steward-paths/templates/:id/test-run */
interface DryRunStepPreview {
  type: string;
  subject?: string;
  fromEmail?: string;
  templateName?: string;
  taskTitle?: string;
  taskPriority?: string;
  waitAmount?: number;
  waitUnit?: string;
  description: string;
}

interface DryRunStep {
  stepId: string;
  label: string;
  stepType: string;
  orderIndex: number;
  result: "passed" | "skipped" | "branched" | "blocked";
  blockReason?: string;
  preview: DryRunStepPreview;
}

interface DryRunSummary {
  totalSteps: number;
  emailsQueued: number;
  tasksCreated: number;
  lettersGenerated: number;
  timingStepsSkipped: number;
  blocked: number;
}

interface DryRunResponse {
  dryRun: true;
  pathId: string;
  pathName: string;
  constituent: {
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    donorStatus: string;
  };
  steps: DryRunStep[];
  summary: DryRunSummary;
}

interface TestRunModalProps {
  doc: WorkflowDocument;
  constituentId: string;
  /** Display name resolved from the constituent search. */
  donorName?: string;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Maps a node kind to a brief "what would happen" description. */
function describeAction(node: WorkflowNode): string {
  const { kind, config } = node;
  const cfg = config as Record<string, unknown>;

  if (kind === "trigger.new_donation") return "Enrollment triggered by new donation event.";
  if (kind === "trigger.added_to_segment") {
    const seg = typeof cfg.segmentKey === "string" && cfg.segmentKey ? cfg.segmentKey : "segment";
    return `Enrollment triggered when constituent is added to "${seg}".`;
  }
  if (kind.startsWith("trigger.")) return "Enrollment trigger evaluated.";
  if (kind === "timing.delay") {
    const amt = typeof cfg.amount === "number" ? cfg.amount : 1;
    const unit = typeof cfg.unit === "string" ? cfg.unit : "days";
    return `Wait ${amt} ${unit} — skipped in dry-run (timing steps are simulated as instant).`;
  }
  if (kind.startsWith("timing.")) return "Timing step — skipped in dry-run.";
  if (kind === "email.create_draft") {
    const subject = typeof cfg.subjectTemplate === "string" && cfg.subjectTemplate
      ? `"${cfg.subjectTemplate}"`
      : "email draft";
    return `Would create an outbound email draft: ${subject}. Draft-first; no email sent.`;
  }
  if (kind === "email.schedule_blast") return "Would schedule a bulk email campaign send (draft-first; no email sent).";
  if (kind === "print.generate_letter") {
    const name = typeof cfg.templateName === "string" && cfg.templateName ? cfg.templateName : "letter template";
    return `Would generate a print letter using template: "${name}".`;
  }
  if (kind === "task.create") {
    const title = typeof cfg.title === "string" && cfg.title ? cfg.title : "follow-up task";
    const priority = typeof cfg.priority === "string" ? cfg.priority : "MEDIUM";
    return `Would create a ${priority.toLowerCase()}-priority task: "${title}".`;
  }
  if (kind === "logic.if_else" || kind === "logic.segment_condition") {
    return "Condition evaluated — branch lane selected based on constituent data (simulated).";
  }
  if (kind.startsWith("donor-data.")) return "Would update constituent record field(s).";
  if (kind.startsWith("safety.")) return "Safety check passed — opt-out and preference flags verified.";
  return "Step would execute.";
}

/** Returns the step status category for a node kind. */
function resolveStepResult(kind: string): StepStatus {
  if (kind.startsWith("timing.")) return "skipped";
  if (kind.startsWith("logic.")) return "branched";
  return "passed";
}

/** Flattens one ordered node chain, including branch lane children, for end-to-end simulation. */
function flattenNodeChain(doc: WorkflowDocument, nodeIds: string[], prefix = ""): SimulatedStep[] {
  return nodeIds.flatMap((id) => {
    const node = doc.nodesById[id];
    if (!node) return [];
    const palette = PALETTE_ITEMS.find((item) => item.kind === node.kind);
    const campaignId = typeof node.config.campaignId === "string" ? node.config.campaignId : undefined;
    const base: SimulatedStep = {
      nodeId: node.id,
      label: `${prefix}${node.title || palette?.label || node.kind}`,
      kind: node.kind,
      description: describeAction(node),
      status: "pending",
      campaignId,
    };

    if (node.nodeType !== "branch") return [base];

    const laneSteps = node.lanes.flatMap((lane, laneIndex) => {
      const laneLetter = String.fromCharCode(65 + laneIndex);
      return flattenNodeChain(doc, lane.nodeIds, `${laneLetter}: `);
    });
    return [base, ...laneSteps];
  });
}

/** Flattens the workflow into an ordered step list for the simulation. */
function flattenSteps(doc: WorkflowDocument): SimulatedStep[] {
  return flattenNodeChain(doc, doc.rootNodeIds);
}

/** Builds a client-side preview for a step when server data is unavailable. */
function buildClientPreview(step: SimulatedStep): DryRunStep {
  const kindType = step.kind.startsWith("timing.")
    ? "timing"
    : step.kind.startsWith("email.")
      ? "email"
      : step.kind.startsWith("print.")
        ? "letter"
        : step.kind.startsWith("task.")
          ? "task"
          : step.kind.startsWith("logic.")
            ? "condition"
            : "action";
  return {
    stepId: step.nodeId,
    label: step.label,
    stepType: step.kind,
    orderIndex: 0,
    result: resolveStepResult(step.kind) as "passed" | "skipped" | "branched" | "blocked",
    preview: { type: kindType, description: step.description },
  };
}

// ---------------------------------------------------------------------------
// Status icon
// ---------------------------------------------------------------------------

function StepStatusIcon({ status }: { status: StepStatus }) {
  if (status === "pending") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-slate-200 bg-white">
        <span className="h-2 w-2 rounded-full bg-slate-200" />
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="flex h-6 w-6 shrink-0 animate-spin items-center justify-center rounded-full border-2 border-green-500 border-t-transparent bg-white" />
    );
  }
  if (status === "passed") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500">
        <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 8.5l3 3 6-6" />
        </svg>
      </span>
    );
  }
  if (status === "skipped") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100">
        <svg className="h-3.5 w-3.5 text-amber-600" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 4v4M8 11v1" />
        </svg>
      </span>
    );
  }
  if (status === "branched") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100">
        <svg className="h-3.5 w-3.5 text-violet-600" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v4M5 7l3 2 3-2M5 11h6" />
        </svg>
      </span>
    );
  }
  if (status === "blocked") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100">
        <svg className="h-3.5 w-3.5 text-orange-600" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="8" cy="8" r="5.5" />
          <path strokeLinecap="round" d="M5.5 8h5" />
        </svg>
      </span>
    );
  }
  // failed
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500">
      <svg className="h-3.5 w-3.5 text-white" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
        <path strokeLinecap="round" d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Preview card (right panel)
// ---------------------------------------------------------------------------

function StepPreviewCard({
  step,
  active,
  completed,
}: {
  step: DryRunStep;
  active: boolean;
  completed: boolean;
}) {
  const { preview } = step;
  const dimmed = !completed && !active;
  const base = `rounded-xl border p-3 transition-all duration-200 ${dimmed ? "opacity-40" : "opacity-100"}`;

  if (preview.type === "email") {
    const bg = active ? "border-blue-300 bg-blue-50 shadow-sm" : completed ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50";
    return (
      <div className={`${base} ${bg}`}>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100">
            <svg className="h-3.5 w-3.5 text-blue-600" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <rect x="1.5" y="3.5" width="13" height="9" rx="1" />
              <path strokeLinecap="round" d="M1.5 5.5l6.5 4 6.5-4" />
            </svg>
          </span>
          <span className="text-xs font-semibold text-blue-700">Email Draft</span>
          {step.result === "blocked" && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">BLOCKED</span>}
        </div>
        {preview.subject && <p className="mb-0.5 text-xs font-medium text-slate-700">Subject: <span className="font-normal">{preview.subject}</span></p>}
        {preview.fromEmail && <p className="text-xs text-slate-500">From: {preview.fromEmail}</p>}
        {step.blockReason
          ? <p className="mt-1 text-[11px] text-orange-600">{step.blockReason}</p>
          : <p className="mt-1 text-[11px] text-slate-400">Draft queued for staff review before send.</p>}
      </div>
    );
  }

  if (preview.type === "letter") {
    const bg = active ? "border-indigo-300 bg-indigo-50 shadow-sm" : completed ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50";
    return (
      <div className={`${base} ${bg}`}>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100">
            <svg className="h-3.5 w-3.5 text-indigo-600" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <rect x="2.5" y="1.5" width="11" height="13" rx="1" />
              <path strokeLinecap="round" d="M5 5.5h6M5 7.5h6M5 9.5h4" />
            </svg>
          </span>
          <span className="text-xs font-semibold text-indigo-700">Print Letter</span>
          {step.result === "blocked" && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700">BLOCKED</span>}
        </div>
        <p className="text-xs text-slate-600">
          {preview.templateName ? <>Template: <span className="font-medium">{preview.templateName}</span></> : "Default letter template."}
        </p>
        {step.blockReason
          ? <p className="mt-1 text-[11px] text-orange-600">{step.blockReason}</p>
          : <p className="mt-1 text-[11px] text-slate-400">Letter generated and added to print queue.</p>}
      </div>
    );
  }

  if (preview.type === "task") {
    const bg = active ? "border-green-300 bg-green-50 shadow-sm" : completed ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50";
    const pc =
      preview.taskPriority === "HIGH" || preview.taskPriority === "URGENT"
        ? "text-red-600 bg-red-50"
        : preview.taskPriority === "MEDIUM"
          ? "text-amber-600 bg-amber-50"
          : "text-slate-600 bg-slate-100";
    return (
      <div className={`${base} ${bg}`}>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100">
            <svg className="h-3.5 w-3.5 text-green-700" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <rect x="2" y="2" width="12" height="12" rx="1.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 8l2 2 4-4" />
            </svg>
          </span>
          <span className="text-xs font-semibold text-green-800">Create Task</span>
          {preview.taskPriority && <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pc}`}>{preview.taskPriority}</span>}
        </div>
        {preview.taskTitle && <p className="text-xs font-medium text-slate-700">{preview.taskTitle}</p>}
        <p className="mt-0.5 text-[11px] text-slate-400">Task assigned per path settings.</p>
      </div>
    );
  }

  if (preview.type === "timing") {
    const bg = active ? "border-amber-300 bg-amber-50 shadow-sm" : "border-slate-100 bg-slate-50";
    return (
      <div className={`${base} ${bg}`}>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <svg className="h-3.5 w-3.5 text-amber-600" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="8" cy="8" r="5.5" />
              <path strokeLinecap="round" d="M8 5v3.5l2 1.5" />
            </svg>
          </span>
          <span className="text-xs font-semibold text-amber-700">Wait / Delay</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-600">INSTANT IN TEST</span>
        </div>
        <p className="text-xs text-slate-500">
          Would wait <span className="font-semibold">{preview.waitAmount ?? 1}&nbsp;{preview.waitUnit ?? "days"}</span> in production.
        </p>
      </div>
    );
  }

  if (preview.type === "condition") {
    const bg = active ? "border-violet-300 bg-violet-50 shadow-sm" : completed ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50";
    return (
      <div className={`${base} ${bg}`}>
        <div className="mb-1.5 flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-100">
            <svg className="h-3.5 w-3.5 text-violet-700" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path strokeLinecap="round" d="M8 3v3.5M5.5 6.5L8 9l2.5-2.5M5 10h6" />
            </svg>
          </span>
          <span className="text-xs font-semibold text-violet-700">Branch Condition</span>
        </div>
        <p className="text-xs text-slate-500">Condition evaluated. Dry run follows first available branch.</p>
      </div>
    );
  }

  // Generic
  const bg = active ? "border-slate-300 bg-slate-50 shadow-sm" : "border-slate-100 bg-slate-50";
  return (
    <div className={`${base} ${bg}`}>
      <p className="text-xs font-medium text-slate-700">{step.label}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{preview.description}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type LoadPhase = "ready" | "loading" | "simulating" | "done" | "error";

interface TestSendResult {
  campaignId: string;
  status: "sent" | "skipped" | "failed";
  message: string;
}

export default function TestRunModal({ doc, constituentId, donorName, onClose }: TestRunModalProps) {
  const [steps, setSteps] = useState<SimulatedStep[]>(() => flattenSteps(doc));
  const [serverSteps, setServerSteps] = useState<DryRunStep[] | null>(null);
  const [serverSummary, setServerSummary] = useState<DryRunSummary | null>(null);
  const [loadPhase, setLoadPhase] = useState<LoadPhase>("ready");
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [skipDelays, setSkipDelays] = useState(true);
  const [sendTestEmails, setSendTestEmails] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testSendResults, setTestSendResults] = useState<TestSendResult[]>([]);
  const cancelledRef = useRef(false);

  // ── Step 1: Fetch validation from server (or fall back to client-only) ───
  async function startTestRun() {
    const initialSteps = flattenSteps(doc).map((step) => ({ ...step, status: "pending" as StepStatus }));
    setSteps(initialSteps);
    setServerSteps(null);
    setServerSummary(null);
    setCurrentIndex(-1);
    setErrorMessage(null);
    setTestSendResults([]);
    setLoadPhase("loading");

    const templateId = doc.persistence?.templateId;
    if (!templateId) {
      setServerSteps(initialSteps.map(buildClientPreview));
      setLoadPhase("simulating");
      return;
    }

    try {
      const data = await apiFetch<DryRunResponse>(`/api/steward-paths/templates/${templateId}/test-run`, {
        method: "POST",
        body: JSON.stringify({
          constituentId,
          options: {
            skipDelays,
            sendTestEmails,
            testEmail: testEmail.trim().toLowerCase() || undefined,
          },
        }),
      });
      setServerSteps(data.steps.length >= initialSteps.length ? data.steps : initialSteps.map(buildClientPreview));
      setServerSummary(data.summary);
      setLoadPhase("simulating");
    } catch (err: unknown) {
      setServerSteps(initialSteps.map(buildClientPreview));
      console.warn("[TestRunModal] Server dry-run fallback:", err instanceof Error ? err.message : err);
      setLoadPhase("simulating");
    }
  }

  /** Sends linked campaign drafts to the explicit test inbox after the dry-run succeeds. */
  async function sendLinkedCampaignTests() {
    const toEmail = testEmail.trim().toLowerCase();
    if (!sendTestEmails || !toEmail) return;
    const uniqueCampaignIds = Array.from(new Set(steps.map((step) => step.campaignId).filter(Boolean))) as string[];
    if (uniqueCampaignIds.length === 0) {
      setTestSendResults([{ campaignId: "none", status: "skipped", message: "No linked email draft campaigns were found in this path." }]);
      return;
    }

    const results: TestSendResult[] = [];
    for (const campaignId of uniqueCampaignIds) {
      try {
        await apiFetch(`/api/email-campaigns/${campaignId}/send-test`, {
          method: "POST",
          body: JSON.stringify({ toEmail }),
        });
        results.push({ campaignId, status: "sent", message: `Sent test email to ${toEmail}.` });
      } catch (err) {
        results.push({
          campaignId,
          status: "failed",
          message: err instanceof Error ? err.message : "Test send failed.",
        });
      }
    }
    setTestSendResults(results);
  }

  // ── Step 2: Run the animation once server data is ready ──────────────────
  useEffect(() => {
    if (loadPhase !== "simulating") return;
    if (steps.length === 0) {
      setLoadPhase("done");
      return;
    }

    // Reset on every effect invocation — fixes React StrictMode double-run bug
    cancelledRef.current = false;

    let idx = 0;

    function runNext() {
      if (cancelledRef.current) return;
      if (idx >= steps.length) {
        setLoadPhase("done");
        return;
      }
      setCurrentIndex(idx);
      setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, status: "running" } : s)));

      setTimeout(() => {
        if (cancelledRef.current) return;
        const srv = serverSteps?.[idx];
        const baseResult: StepStatus = srv
          ? (srv.result as StepStatus)
          : resolveStepResult(steps[idx].kind);
        const result: StepStatus = !skipDelays && steps[idx].kind.startsWith("timing.")
          ? "passed"
          : baseResult;
        setSteps((prev) =>
          prev.map((s, i) => (i === idx ? { ...s, status: result } : s)),
        );
        idx += 1;
        setTimeout(runNext, skipDelays ? 250 : 450);
      }, skipDelays || !steps[idx].kind.startsWith("timing.") ? 600 : 1100);
    }

    const init = setTimeout(runNext, 400);
    return () => {
      cancelledRef.current = true;
      clearTimeout(init);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPhase]);

  useEffect(() => {
    if (loadPhase !== "done") return;
    void sendLinkedCampaignTests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadPhase]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const passedCount = steps.filter((s) => s.status === "passed").length;
  const skippedCount = steps.filter((s) => s.status === "skipped").length;
  const branchedCount = steps.filter((s) => s.status === "branched").length;
  const blockedCount = steps.filter((s) => s.status === "blocked").length;
  const isDone = loadPhase === "done";

  // Align client steps with server-enriched previews
  const effectivePreviews: DryRunStep[] = steps.map((s, i) =>
    serverSteps?.[i] ?? buildClientPreview(s),
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50">
              <svg className="h-4 w-4 text-green-600" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h6M7 3v7L4 15a1 1 0 00.88 1.5h10.24A1 1 0 0016 15l-3-5V3" />
              </svg>
            </span>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Workflow Dry Run</h2>
              <p className="text-xs text-slate-500">
                {donorName
                  ? <><span className="font-medium text-slate-700">{donorName}</span>&nbsp;·&nbsp;</>
                  : <><span className="font-mono font-medium text-slate-700">{constituentId}</span>&nbsp;·&nbsp;</>}
                {doc.pathName || "Untitled path"}&nbsp;
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  SIMULATION ONLY
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Setup */}
        {loadPhase === "ready" && (
          <div className="grid gap-4 p-6 md:grid-cols-[1fr_320px]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Test path settings</p>
              <p className="mt-1 text-xs text-slate-500">
                Validate the path, preview each action, and optionally send linked email drafts to one test inbox.
              </p>
              <div className="mt-4 space-y-3">
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <input
                    type="checkbox"
                    checked={skipDelays}
                    onChange={(event) => setSkipDelays(event.target.checked)}
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-800">Skip delays</span>
                    <span className="block text-xs text-slate-500">Wait steps run instantly but still appear in the path audit.</span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
                  <input
                    type="checkbox"
                    checked={sendTestEmails}
                    onChange={(event) => setSendTestEmails(event.target.checked)}
                    className="mt-0.5 rounded border-slate-300"
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-800">Send linked drafts to a test email</span>
                    <span className="block text-xs text-slate-500">Only campaigns linked to email draft nodes are sent, and only to the address below.</span>
                  </span>
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-700">Test email address</span>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(event) => setTestEmail(event.target.value)}
                    disabled={!sendTestEmails}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20 disabled:bg-slate-100"
                    placeholder="staff@example.org"
                  />
                </label>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Path Coverage</p>
              <div className="mt-3 space-y-2 text-sm text-slate-700">
                <p><span className="font-semibold text-slate-950">{steps.length}</span> total steps including branch lanes</p>
                <p><span className="font-semibold text-slate-950">{steps.filter((step) => step.kind.startsWith("email.")).length}</span> email steps</p>
                <p><span className="font-semibold text-slate-950">{steps.filter((step) => step.kind.startsWith("timing.")).length}</span> delay steps</p>
                <p><span className="font-semibold text-slate-950">{steps.filter((step) => step.campaignId).length}</span> linked draft campaigns</p>
              </div>
              <button
                type="button"
                onClick={() => void startTestRun()}
                disabled={sendTestEmails && !testEmail.trim()}
                className="mt-5 w-full rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Start Test Run
              </button>
              {sendTestEmails && !testEmail.trim() ? (
                <p className="mt-2 text-xs text-amber-700">Enter a test email address before starting.</p>
              ) : null}
            </div>
          </div>
        )}

        {/* Loading */}
        {loadPhase === "loading" && (
          <div className="flex flex-1 items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3 text-slate-500">
              <span className="h-8 w-8 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
              <p className="text-sm">Preparing dry run…</p>
            </div>
          </div>
        )}

        {/* Error */}
        {loadPhase === "error" && errorMessage && (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="max-w-sm rounded-xl border border-red-200 bg-red-50 p-4 text-center">
              <p className="text-sm font-semibold text-red-800">Dry run failed</p>
              <p className="mt-1 text-xs text-red-700">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* Two-panel layout */}
        {(loadPhase === "simulating" || loadPhase === "done") && (
          <div className="flex min-h-0 flex-1 divide-x divide-slate-200">

            {/* Left: simulation */}
            <div className="flex w-[44%] shrink-0 flex-col">
              <div className="border-b border-slate-100 px-4 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Simulation</p>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {steps.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-500">
                    No steps to simulate yet.
                  </p>
                ) : (
                  <ol className="space-y-2">
                    {steps.map((step, i) => {
                      const isActive = i === currentIndex && loadPhase === "simulating";
                      return (
                        <li
                          key={step.nodeId}
                          className={`flex items-start gap-2.5 rounded-xl border px-3 py-2.5 transition-all ${
                            isActive
                              ? "border-green-300 bg-green-50 shadow-sm"
                              : step.status === "pending"
                                ? "border-slate-100 bg-slate-50 opacity-50"
                                : step.status === "blocked"
                                  ? "border-orange-200 bg-orange-50"
                                  : step.status === "failed"
                                    ? "border-red-200 bg-red-50"
                                    : "border-slate-200 bg-white"
                          }`}
                        >
                          <StepStatusIcon status={step.status} />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium leading-tight text-slate-900">{step.label}</p>
                            {step.status === "running" && (
                              <p className="mt-0.5 text-[11px] text-green-600">Simulating…</p>
                            )}
                            {step.status !== "pending" && step.status !== "running" && (
                              <p className="mt-0.5 text-[11px] leading-snug text-slate-500">{step.description}</p>
                            )}
                          </div>
                          {step.status !== "pending" && step.status !== "running" && (
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                              step.status === "passed" ? "bg-green-100 text-green-700"
                              : step.status === "skipped" ? "bg-amber-100 text-amber-700"
                              : step.status === "branched" ? "bg-violet-100 text-violet-700"
                              : step.status === "blocked" ? "bg-orange-100 text-orange-700"
                              : "bg-red-100 text-red-700"
                            }`}>
                              {step.status}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}

                {/* Summary bar */}
                {isDone && (
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Run Summary</p>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {passedCount > 0 && <span className="flex items-center gap-1.5 text-green-700"><span className="h-1.5 w-1.5 rounded-full bg-green-500" />{passedCount} would execute</span>}
                      {skippedCount > 0 && <span className="flex items-center gap-1.5 text-amber-700"><span className="h-1.5 w-1.5 rounded-full bg-amber-400" />{skippedCount} timing (instant)</span>}
                      {branchedCount > 0 && <span className="flex items-center gap-1.5 text-violet-700"><span className="h-1.5 w-1.5 rounded-full bg-violet-400" />{branchedCount} branch evaluated</span>}
                      {blockedCount > 0 && <span className="flex items-center gap-1.5 text-orange-700"><span className="h-1.5 w-1.5 rounded-full bg-orange-400" />{blockedCount} blocked (opt-out)</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: preview panel */}
            <div className="flex flex-1 flex-col">
              <div className="border-b border-slate-100 px-4 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">What Would Happen</p>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {effectivePreviews.length === 0 ? (
                  <p className="pt-4 text-center text-xs text-slate-500">No steps to preview.</p>
                ) : (
                  <div className="space-y-2">
                    {effectivePreviews.map((preview, i) => (
                      <StepPreviewCard
                        key={`${preview.stepId}-${i}`}
                        step={preview}
                        active={i === currentIndex && loadPhase === "simulating"}
                        completed={
                          steps[i]?.status !== "pending" && steps[i]?.status !== "running"
                        }
                      />
                    ))}
                  </div>
                )}

                {/* Server-validated summary */}
                {isDone && serverSummary && (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                      {sendTestEmails ? "Dry run complete" : "Nothing was sent or saved"}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-emerald-800">
                      {serverSummary.emailsQueued > 0 && <span>{serverSummary.emailsQueued} email draft{serverSummary.emailsQueued > 1 ? "s" : ""} would be queued</span>}
                      {serverSummary.lettersGenerated > 0 && <span>{serverSummary.lettersGenerated} letter{serverSummary.lettersGenerated > 1 ? "s" : ""} would be generated</span>}
                      {serverSummary.tasksCreated > 0 && <span>{serverSummary.tasksCreated} task{serverSummary.tasksCreated > 1 ? "s" : ""} would be created</span>}
                      {serverSummary.timingStepsSkipped > 0 && <span>{serverSummary.timingStepsSkipped} wait step{serverSummary.timingStepsSkipped > 1 ? "s" : ""} ({skipDelays ? "instant" : "simulated wait"})</span>}
                      {serverSummary.blocked > 0 && <span className="text-orange-700">{serverSummary.blocked} step{serverSummary.blocked > 1 ? "s" : ""} blocked by opt-out flags</span>}
                    </div>
                  </div>
                )}
                {isDone && testSendResults.length > 0 && (
                  <div className="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5">
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">Test Email Results</p>
                    <div className="space-y-1">
                      {testSendResults.map((result) => (
                        <p key={result.campaignId} className={`text-[11px] ${result.status === "failed" ? "text-rose-700" : "text-blue-800"}`}>
                          <span className="font-semibold">{result.campaignId}:</span> {result.message}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3">
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="8" cy="8" r="6" />
              <path strokeLinecap="round" d="M8 6v2.5M8 11v.5" />
            </svg>
            {sendTestEmails ? "Dry run writes no donor records · test sends only go to the explicit test inbox" : "No data written · No emails or letters sent"}
          </span>
          <div className="flex items-center gap-2">
            {loadPhase === "simulating" && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500">
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
                Simulating…
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {isDone ? "Close" : "Cancel"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
