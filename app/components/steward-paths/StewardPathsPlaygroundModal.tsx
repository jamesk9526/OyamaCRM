/**
 * Steward Paths Playground surface (modal + full-page modes).
 * Uses sandbox-only API endpoints that never write enrollments/timeline or send real emails.
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

type PlaybackAction = "step" | "auto" | "pause" | "fast-forward";

type StepResult = "passed" | "skipped" | "branched" | "blocked" | "failed";
type StepStatus = "pending" | "running" | StepResult;
type RunStatus = "ready" | "running" | "paused" | "completed";

interface PlaygroundScenario {
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

interface PlaygroundScenariosResponse {
  isSandbox: true;
  pathId: string;
  pathName: string;
  scenarios: PlaygroundScenario[];
  defaults?: {
    scenarioId?: string | null;
    skipDelays?: boolean;
  };
}

interface PlaygroundStepPreview {
  type: "email" | "letter" | "task" | "timing" | "condition" | "action";
  description: string;
  subject?: string;
  fromEmail?: string;
  templateName?: string;
  taskTitle?: string;
  taskPriority?: string;
  waitAmount?: number;
  waitUnit?: string;
}

interface PlaygroundRunStep {
  stepId: string;
  label: string;
  stepType: string;
  orderIndex: number;
  status: StepStatus;
  result: StepResult | null;
  plannedResult: StepResult;
  blockReason?: string;
  preview: PlaygroundStepPreview;
  executedAt: string | null;
}

interface PlaygroundRunSummary {
  totalSteps: number;
  completedSteps: number;
  passed: number;
  skipped: number;
  branched: number;
  blocked: number;
  failed: number;
  emailsSimulated: number;
  lettersSimulated: number;
  tasksSimulated: number;
  overall: "pass" | "warn" | "fail";
}

interface PlaygroundActivityItem {
  id: string;
  at: string;
  type: string;
  level: "info" | "warn" | "error";
  message: string;
}

interface PlaygroundRunResponse {
  runId: string;
  pathId: string;
  pathName: string;
  status: RunStatus;
  isSandbox: true;
  scenario: PlaygroundScenario;
  sourceConstituent: {
    id: string;
    name: string;
    email: string | null;
    source: "real" | "synthetic";
  };
  options: {
    skipDelays: boolean;
    testEmail: string | null;
  };
  cursor: number;
  steps: PlaygroundRunStep[];
  summary: PlaygroundRunSummary;
  activity: PlaygroundActivityItem[];
}

interface SandboxEmailPreviewResult {
  isSandbox: true;
  analyticsTracked: false;
  runId: string;
  toEmail: string;
  message: string;
  sentCount: number;
  skippedCount: number;
  items: Array<{
    stepId: string;
    label: string;
    toEmail: string;
    subject: string;
    status: "queued" | "skipped";
    reason?: string;
  }>;
}

interface StewardPathsPlaygroundModalProps {
  templateId: string;
  pathName?: string;
  initialConstituentId?: string;
  initialDonorName?: string;
  fullPage?: boolean;
  onClose?: () => void;
}

/** Returns a compact style token for one execution status. */
function statusClass(status: StepStatus): string {
  if (status === "passed") return "bg-emerald-100 text-emerald-700 border-emerald-200";
  if (status === "skipped") return "bg-amber-100 text-amber-700 border-amber-200";
  if (status === "branched") return "bg-violet-100 text-violet-700 border-violet-200";
  if (status === "blocked") return "bg-orange-100 text-orange-700 border-orange-200";
  if (status === "failed") return "bg-rose-100 text-rose-700 border-rose-200";
  if (status === "running") return "bg-sky-100 text-sky-700 border-sky-200";
  return "bg-slate-100 text-slate-500 border-slate-200";
}

/** Accent color family by step type for flow cards. */
function stepToneClass(stepType: string): string {
  if (stepType.startsWith("trigger.")) return "border-emerald-200 bg-emerald-50/70";
  if (stepType.startsWith("email.")) return "border-sky-200 bg-sky-50/70";
  if (stepType.startsWith("timing.")) return "border-violet-200 bg-violet-50/70";
  if (stepType.startsWith("logic.")) return "border-amber-200 bg-amber-50/70";
  if (stepType.startsWith("task.")) return "border-teal-200 bg-teal-50/70";
  if (stepType.startsWith("safety.")) return "border-rose-200 bg-rose-50/70";
  return "border-slate-200 bg-white";
}

/** Activity badge colors by log severity. */
function activityTone(level: PlaygroundActivityItem["level"]): string {
  if (level === "error") return "bg-rose-100 text-rose-700";
  if (level === "warn") return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

/** Formats seconds to mm:ss display used in run header. */
function formatElapsed(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rem = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}

/** Renders one result summary card with pass/warn/fail colors. */
function ResultCard({
  title,
  value,
  detail,
  state,
}: {
  title: string;
  value: string;
  detail: string;
  state: "pass" | "warn" | "fail";
}) {
  const tone = state === "pass"
    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : state === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-rose-200 bg-rose-50 text-rose-900";

  return (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide">{title}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
      <p className="mt-1 text-xs">{detail}</p>
    </div>
  );
}

/** Shared modal/page Playground UI. */
export default function StewardPathsPlaygroundModal({
  templateId,
  pathName,
  initialConstituentId,
  initialDonorName,
  fullPage = false,
  onClose,
}: StewardPathsPlaygroundModalProps) {
  const [resolvedPathName, setResolvedPathName] = useState(pathName || "Steward Path");
  const [constituentId, setConstituentId] = useState(initialConstituentId || "");
  const [donorName, setDonorName] = useState(initialDonorName || "");
  const [testEmail, setTestEmail] = useState("");
  const [skipDelays, setSkipDelays] = useState(true);
  const [playbackPreset, setPlaybackPreset] = useState<"auto" | "fast-forward">("auto");
  const [sendTestEmailEnabled, setSendTestEmailEnabled] = useState(true);

  const [scenarios, setScenarios] = useState<PlaygroundScenario[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState("");
  const [loadingScenarios, setLoadingScenarios] = useState(false);

  const [run, setRun] = useState<PlaygroundRunResponse | null>(null);
  const [busyAction, setBusyAction] = useState<PlaybackAction | "run" | "reset" | "email" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [emailPreview, setEmailPreview] = useState<SandboxEmailPreviewResult | null>(null);

  const hasTemplateId = templateId.trim().length > 0;

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? null,
    [scenarios, selectedScenarioId],
  );

  const progressPct = run
    ? Math.round((run.summary.completedSteps / Math.max(run.summary.totalSteps, 1)) * 100)
    : 0;

  const runIsDone = run?.status === "completed";

  const elapsedSeconds = useMemo(() => {
    if (!run) return 0;
    const marks = run.activity
      .map((item) => Date.parse(item.at))
      .filter((value) => Number.isFinite(value));
    if (marks.length >= 2) {
      const start = Math.min(...marks);
      const end = Math.max(...marks);
      return Math.max(1, Math.round((end - start) / 1000));
    }
    return Math.max(0, run.summary.completedSteps * 2);
  }, [run]);

  const elapsedLabel = formatElapsed(elapsedSeconds);

  const resultState: "pass" | "warn" | "fail" = run?.summary.overall || "pass";

  /** Loads available scenarios from sandbox endpoint. */
  const loadScenarios = useCallback(async () => {
    if (!hasTemplateId) return;
    setLoadingScenarios(true);
    setErrorMessage(null);

    try {
      const query = constituentId.trim()
        ? `?constituentId=${encodeURIComponent(constituentId.trim())}`
        : "";
      const response = await apiFetch<PlaygroundScenariosResponse>(
        `/api/steward-paths/${templateId}/playground/scenarios${query}`,
      );

      setScenarios(response.scenarios || []);
      setResolvedPathName(response.pathName || pathName || "Steward Path");
      setSelectedScenarioId((current) => {
        if (current && response.scenarios.some((scenario) => scenario.id === current)) return current;
        const fallback = response.defaults?.scenarioId;
        if (fallback && response.scenarios.some((scenario) => scenario.id === fallback)) return fallback;
        return response.scenarios[0]?.id || "";
      });
      if (typeof response.defaults?.skipDelays === "boolean") {
        setSkipDelays(response.defaults.skipDelays);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load sandbox scenarios.");
    } finally {
      setLoadingScenarios(false);
    }
  }, [constituentId, hasTemplateId, pathName, templateId]);

  useEffect(() => {
    void loadScenarios();
  }, [loadScenarios]);

  useEffect(() => {
    if (fullPage || !onClose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullPage, onClose]);

  /** Starts a new sandbox run. */
  const startRun = useCallback(async () => {
    if (!hasTemplateId) {
      setErrorMessage("Save this path first to use Playground.");
      return;
    }
    if (!constituentId.trim()) {
      setErrorMessage("Enter a test donor ID to start a sandbox run.");
      return;
    }

    setBusyAction("run");
    setErrorMessage(null);
    setFeedbackMessage(null);
    setEmailPreview(null);

    try {
      const response = await apiFetch<PlaygroundRunResponse>(`/api/steward-paths/${templateId}/playground/run`, {
        method: "POST",
        body: JSON.stringify({
          constituentId: constituentId.trim(),
          scenarioId: selectedScenarioId || undefined,
          options: {
            skipDelays,
            testEmail: testEmail.trim() || undefined,
          },
        }),
      });

      let nextRun = response;
      if (playbackPreset === "auto" || playbackPreset === "fast-forward") {
        nextRun = await apiFetch<PlaygroundRunResponse>(`/api/steward-paths/${templateId}/playground/step`, {
          method: "POST",
          body: JSON.stringify({ runId: response.runId, action: playbackPreset }),
        });
      }

      setRun(nextRun);
      if (!donorName.trim()) {
        setDonorName(nextRun.sourceConstituent.name || donorName);
      }
      setFeedbackMessage(
        playbackPreset === "fast-forward"
          ? "Sandbox run created and fast-forward playback started."
          : "Sandbox run created and auto playback started.",
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to start sandbox run.");
    } finally {
      setBusyAction(null);
    }
  }, [constituentId, donorName, hasTemplateId, playbackPreset, selectedScenarioId, skipDelays, templateId, testEmail]);

  /** Applies one playback control action to the active run. */
  const applyPlaybackAction = useCallback(async (action: PlaybackAction) => {
    if (!run) return;

    setBusyAction(action);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const next = await apiFetch<PlaygroundRunResponse>(`/api/steward-paths/${templateId}/playground/step`, {
        method: "POST",
        body: JSON.stringify({ runId: run.runId, action }),
      });
      setRun(next);
      if (action === "auto" || action === "fast-forward") {
        setFeedbackMessage("Playback completed in sandbox mode.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update sandbox playback.");
    } finally {
      setBusyAction(null);
    }
  }, [run, templateId]);

  /** Resets current run state back to all pending. */
  const resetRun = useCallback(async () => {
    if (!run) return;

    setBusyAction("reset");
    setErrorMessage(null);
    setFeedbackMessage(null);
    setEmailPreview(null);

    try {
      const next = await apiFetch<PlaygroundRunResponse>(`/api/steward-paths/${templateId}/playground/reset`, {
        method: "POST",
        body: JSON.stringify({ runId: run.runId }),
      });
      setRun(next);
      setFeedbackMessage("Run reset. All steps are pending again.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to reset run.");
    } finally {
      setBusyAction(null);
    }
  }, [run, templateId]);

  /** Builds sandbox-only test email previews. */
  const sendSandboxTestEmail = useCallback(async () => {
    if (!run) return;
    if (!testEmail.trim()) {
      setErrorMessage("Enter a test email before sending sandbox previews.");
      return;
    }

    setBusyAction("email");
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const preview = await apiFetch<SandboxEmailPreviewResult>(`/api/steward-paths/${templateId}/playground/send-test-email`, {
        method: "POST",
        body: JSON.stringify({
          runId: run.runId,
          testEmail: testEmail.trim(),
        }),
      });
      setEmailPreview(preview);
      setFeedbackMessage("Sandbox test email previews generated. No production sends occurred.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to generate sandbox email previews.");
    } finally {
      setBusyAction(null);
    }
  }, [run, templateId, testEmail]);

  const playbackDisabled = !run || busyAction !== null;
  const canStartRun = hasTemplateId && Boolean(selectedScenarioId) && constituentId.trim().length > 0;
  const runLabel = run?.scenario.name || selectedScenario?.name || "Choose a scenario";
  const runPresenceLabel = run?.status === "running"
    ? "Live"
    : run?.status === "paused"
      ? "Paused"
      : run?.status === "completed"
        ? "Completed"
        : "Ready";

  const content = (
    <div className={`relative flex h-full min-h-0 flex-col overflow-hidden rounded-[26px] border border-slate-200 bg-[#f8fafc] ${fullPage ? "shadow-none" : "shadow-[0_32px_90px_-34px_rgba(15,23,42,0.65)]"}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.16),_transparent_68%)]" />
      <span className="pointer-events-none absolute left-[26%] top-3 h-1.5 w-1.5 rounded-full bg-fuchsia-400/70" />
      <span className="pointer-events-none absolute left-[41%] top-5 h-1.5 w-1.5 rounded-full bg-amber-400/70" />
      <span className="pointer-events-none absolute right-[22%] top-4 h-1.5 w-1.5 rounded-full bg-sky-400/70" />

      <div className="relative flex items-start justify-between gap-3 border-b border-slate-200/90 bg-white/90 px-5 py-4 backdrop-blur">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700">Steward Paths Playground</p>
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">Beta</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Test your path in a safe sandbox environment.</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            Sandbox ON
          </span>
          {fullPage ? (
            <Link
              href={`/steward-paths/${encodeURIComponent(templateId)}/builder`}
              className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Back to Builder
            </Link>
          ) : (
            <Link
              href={`/steward-paths/${encodeURIComponent(templateId)}/playground`}
              className="inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Open Full Playground
            </Link>
          )}
          {!fullPage && onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              aria-label="Close Playground"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4 12 12M12 4 4 12" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
        <aside className="min-h-0 space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3">
          <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">1. Choose a test scenario</h3>
              <button
                type="button"
                onClick={() => void loadScenarios()}
                disabled={loadingScenarios || busyAction !== null}
                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {loadingScenarios ? "Loading" : "Refresh"}
              </button>
            </div>
            <div className="space-y-2">
              {scenarios.map((scenario, index) => {
                const selected = scenario.id === selectedScenarioId;
                const iconTone = index % 5 === 0
                  ? "bg-emerald-100 text-emerald-700"
                  : index % 5 === 1
                    ? "bg-sky-100 text-sky-700"
                    : index % 5 === 2
                      ? "bg-violet-100 text-violet-700"
                      : index % 5 === 3
                        ? "bg-amber-100 text-amber-700"
                        : "bg-rose-100 text-rose-700";

                return (
                  <button
                    key={scenario.id}
                    type="button"
                    onClick={() => setSelectedScenarioId(scenario.id)}
                    className={`flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left transition ${selected ? "border-emerald-300 bg-emerald-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}
                  >
                    <span className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold ${iconTone}`}>
                      {scenario.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-900">{scenario.name}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-600">{scenario.description}</span>
                    </span>
                    {selected ? (
                      <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                        <svg className="h-3 w-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m3.5 8 3 3 6-6" />
                        </svg>
                      </span>
                    ) : null}
                  </button>
                );
              })}
              {scenarios.length === 0 && !loadingScenarios ? (
                <p className="rounded-lg border border-dashed border-slate-300 bg-white p-2 text-xs text-slate-500">No scenarios available yet.</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <h3 className="text-sm font-semibold text-slate-900">2. Test donor details</h3>
            <div className="mt-2 space-y-2">
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-600">Donor name</span>
                <input
                  type="text"
                  value={donorName}
                  onChange={(event) => setDonorName(event.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                  placeholder="Test Donor"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-semibold text-slate-600">Test email address</span>
                <div className="relative mt-1">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(event) => setTestEmail(event.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 pr-16 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                    placeholder="test@example.com"
                  />
                  <span className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${testEmail.includes("@") ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {testEmail.includes("@") ? "Verified" : "Pending"}
                  </span>
                </div>
              </label>
              <div className="grid grid-cols-[auto_1fr] items-end gap-2">
                <label className="block">
                  <span className="text-[11px] font-semibold text-slate-600">Gift amount</span>
                  <div className="mt-1 flex h-9 items-center rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-700">
                    <span className="mr-1 text-slate-500">$</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      defaultValue={50}
                      className="w-20 bg-transparent text-slate-900 outline-none"
                    />
                  </div>
                </label>
                <label className="block">
                  <span className="text-[11px] font-semibold text-slate-600">Donor ID</span>
                  <input
                    type="text"
                    value={constituentId}
                    onChange={(event) => setConstituentId(event.target.value)}
                    className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                    placeholder="con_01"
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <h3 className="text-sm font-semibold text-slate-900">3. Test options</h3>
            <div className="mt-2 space-y-2">
              <div>
                <p className="text-[11px] font-semibold text-slate-600">Playback speed</p>
                <div className="mt-1 inline-flex rounded-lg border border-slate-200 bg-white p-1">
                  <button
                    type="button"
                    onClick={() => setPlaybackPreset("auto")}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${playbackPreset === "auto" ? "bg-emerald-100 text-emerald-700" : "text-slate-600"}`}
                  >
                    Auto Play
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlaybackPreset("fast-forward")}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${playbackPreset === "fast-forward" ? "bg-violet-100 text-violet-700" : "text-slate-600"}`}
                  >
                    Fast Forward
                  </button>
                </div>
              </div>

              <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                <span>Skip wait delays</span>
                <input
                  type="checkbox"
                  checked={skipDelays}
                  onChange={(event) => setSkipDelays(event.target.checked)}
                  className="rounded border-slate-300"
                />
              </label>

              <label className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                <span>Send test email preview</span>
                <input
                  type="checkbox"
                  checked={sendTestEmailEnabled}
                  onChange={(event) => setSendTestEmailEnabled(event.target.checked)}
                  className="rounded border-slate-300"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={() => void startRun()}
              disabled={!canStartRun || busyAction !== null}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-500 px-4 text-sm font-semibold text-white shadow-[0_10px_22px_-12px_rgba(99,102,241,0.85)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M5 3.3a1 1 0 0 1 1.53-.85l5.22 3.2a1 1 0 0 1 0 1.7l-5.22 3.2A1 1 0 0 1 5 9.7V3.3z" />
              </svg>
              {busyAction === "run" ? "Running Test..." : "Play Path Test"}
            </button>
            <p className="mt-2 text-center text-[11px] text-slate-500">Ready to run your test in sandbox mode.</p>
          </section>
        </aside>

        <section className="min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">Running test: {runLabel}</p>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${run?.status === "running" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  {runPresenceLabel}
                </span>
              </div>
              <span className="text-sm font-semibold text-slate-500">{elapsedLabel}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-400 transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-[radial-gradient(circle_at_10%_12%,rgba(99,102,241,0.08),transparent_45%),radial-gradient(circle_at_90%_88%,rgba(16,185,129,0.08),transparent_42%),#f8fafc] p-4">
            {run ? (
              <ol className="mx-auto max-w-[620px] space-y-3">
                {run.steps.map((step, index) => {
                  const markerTone = step.status === "passed"
                    ? "bg-emerald-500"
                    : step.status === "failed"
                      ? "bg-rose-500"
                      : step.status === "running"
                        ? "bg-sky-500"
                        : step.status === "branched"
                          ? "bg-violet-500"
                          : step.status === "blocked"
                            ? "bg-amber-500"
                            : "bg-slate-400";

                  return (
                    <li key={step.stepId} className="relative pl-11">
                      {index < run.steps.length - 1 ? (
                        <span className="absolute left-[14px] top-8 h-[calc(100%+12px)] w-px bg-slate-300" />
                      ) : null}
                      <span className={`absolute left-0 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full ${markerTone} text-white shadow-sm`}>
                        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m3.5 8 3 3 6-6" />
                        </svg>
                      </span>
                      <div className={`rounded-xl border px-3 py-2 shadow-sm ${stepToneClass(step.stepType)}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">{step.label}</p>
                            <p className="mt-0.5 text-xs text-slate-600">{step.preview.description}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass(step.status)}`}>
                            {step.status}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span>{step.stepType.replace(/\./g, " ")}</span>
                          <span>{step.executedAt ? new Date(step.executedAt).toLocaleTimeString() : "Pending"}</span>
                        </div>
                        {step.blockReason ? (
                          <p className="mt-1 rounded-md bg-amber-100 px-2 py-1 text-[11px] text-amber-800">{step.blockReason}</p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="mx-auto flex max-w-[540px] flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
                <p className="text-sm font-semibold text-slate-900">No test run yet</p>
                <p className="mt-1 text-xs text-slate-500">Choose a scenario and click Play Path Test to render live step flow and activity.</p>
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void applyPlaybackAction("step")}
              disabled={playbackDisabled || runIsDone}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Step
            </button>
            <button
              type="button"
              onClick={() => void applyPlaybackAction("auto")}
              disabled={playbackDisabled || runIsDone}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Auto
            </button>
            <button
              type="button"
              onClick={() => void applyPlaybackAction("fast-forward")}
              disabled={playbackDisabled || runIsDone}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Fast Forward
            </button>
            <button
              type="button"
              onClick={() => void applyPlaybackAction("pause")}
              disabled={playbackDisabled || runIsDone}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Pause
            </button>
            <button
              type="button"
              onClick={() => void resetRun()}
              disabled={busyAction !== null || !run}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => void startRun()}
              disabled={!canStartRun || busyAction !== null}
              className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50"
            >
              Run Again
            </button>
          </div>
        </section>

        <aside className="min-h-0 space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-3">
          <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Activity Log</h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${run?.status === "running" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                {run?.status === "running" ? "Live" : "Idle"}
              </span>
            </div>
            <div className="mt-2 max-h-80 space-y-2 overflow-y-auto pr-1">
              {run?.activity?.length ? run.activity.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                  <div className="flex items-start gap-2">
                    <span className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${activityTone(item.level)}`}>
                      {item.level === "error" ? "!" : item.level === "warn" ? "!" : "•"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[11px] font-semibold text-slate-800">{item.type}</p>
                        <span className="text-[10px] text-slate-400">{new Date(item.at).toLocaleTimeString()}</span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-600">{item.message}</p>
                    </div>
                  </div>
                </div>
              )) : (
                <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-500">Run a test to populate activity.</p>
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <h3 className="text-sm font-semibold text-slate-900">Test Result</h3>
            {run ? (
              <>
                <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 text-center">
                  <div className={`mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full ${resultState === "pass" ? "bg-emerald-100 text-emerald-700" : resultState === "warn" ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"}`}>
                    <svg className="h-6 w-6" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m3.5 8 3 3 6-6" />
                    </svg>
                  </div>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{resultState === "pass" ? "Passed!" : resultState === "warn" ? "Passed with Warnings" : "Action Needed"}</p>
                  <p className="mt-1 text-xs text-slate-600">Your path completed in sandbox mode.</p>
                  <button
                    type="button"
                    onClick={() => setFeedbackMessage(`Summary: ${run.summary.completedSteps}/${run.summary.totalSteps} steps completed, ${run.summary.failed} failed, ${run.summary.blocked} blocked.`)}
                    className="mt-3 inline-flex h-8 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    View Test Summary
                  </button>
                </div>
                <div className="mt-2 grid gap-2">
                  <ResultCard
                    title="Overall"
                    value={run.summary.overall.toUpperCase()}
                    detail={`${run.summary.completedSteps}/${run.summary.totalSteps} steps simulated`}
                    state={resultState}
                  />
                  <ResultCard
                    title="Branch Checks"
                    value={String(run.summary.branched)}
                    detail="Branch condition evaluations"
                    state={run.summary.branched > 0 ? "pass" : "warn"}
                  />
                </div>
              </>
            ) : (
              <p className="mt-2 rounded-lg border border-dashed border-slate-300 bg-white p-3 text-xs text-slate-500">Test results appear here after a run.</p>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-xs text-slate-600">
            <p className="font-semibold text-slate-800">Sandbox safety</p>
            <p className="mt-1">No enrollment writes, no timeline writes, no production analytics events, and no live outbound email.</p>
            <button
              type="button"
              onClick={() => void sendSandboxTestEmail()}
              disabled={busyAction !== null || !run || !testEmail.trim() || !sendTestEmailEnabled}
              className="mt-3 inline-flex h-8 w-full items-center justify-center rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              Send Test Email Preview
            </button>
            {emailPreview ? (
              <p className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] text-emerald-800">
                {emailPreview.sentCount} queued and {emailPreview.skippedCount} skipped. No production send performed.
              </p>
            ) : null}
          </section>
        </aside>
      </div>

      <div className="px-4 pb-4">
        {errorMessage ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-800">{errorMessage}</div>
        ) : null}
        {feedbackMessage ? (
          <div className="mt-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-xs text-sky-800">{feedbackMessage}</div>
        ) : null}
      </div>
    </div>
  );

  if (fullPage) {
    return <div className="h-full min-h-0 overflow-auto bg-slate-100 p-4 md:p-6">{content}</div>;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm md:p-6">
      <button
        type="button"
        aria-label="Close Playground"
        onClick={onClose}
        className="absolute inset-0"
      />
      <div className="relative z-10 h-[92vh] w-full max-w-[1340px]">{content}</div>
    </div>
  );
}
