/**
 * Steward Paths page.
 * Lists workflow rules from /api/automations and lets teams automate stewardship work.
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import AutomationWorkflowEditorModal from "@/app/components/automations/AutomationWorkflowEditorModal";
import NewAutomationModal from "@/app/components/automations/NewAutomationModal";
import { apiFetch } from "@/app/lib/auth-client";

/** Trigger labels for display */
const TRIGGER_LABELS: Record<string, string> = {
  DONATION_RECEIVED: "Donation received",
  CONSTITUENT_CREATED: "New constituent added",
  TASK_DUE: "Task becomes due",
  PLEDGE_CREATED: "Pledge created",
  EMAIL_OPENED: "Email opened",
  EVENT_REGISTERED: "Event registration",
};

/** Action type labels */
const ACTION_LABELS: Record<string, string> = {
  SEND_EMAIL: "Send email",
  CREATE_TASK: "Create task",
  UPDATE_FIELD: "Update field",
  ADD_TAG: "Add tag",
  REMOVE_TAG: "Remove tag",
  ASSIGN_USER: "Assign user",
};

/** Status language shown in the visual legend to align paths with communications and letters. */
const SHARED_STATUS_LEGEND = [
  "Draft",
  "Needs Review",
  "Approved",
  "Scheduled",
  "Sent",
  "Generated",
  "Printed",
  "Mailed",
  "Completed",
  "Failed",
  "Canceled",
  "Archived",
];

/** Renders one compact icon for each action type in sequence cards. */
function ActionTypeIcon({ actionType }: { actionType: string }) {
  const cls = "w-3.5 h-3.5";
  if (actionType === "SEND_EMAIL") {
    return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
  }
  if (actionType === "CREATE_TASK") {
    return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>;
  }
  if (actionType === "UPDATE_FIELD") {
    return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M11 5h2M5 12h14M8 19h8" /></svg>;
  }
  if (actionType === "ADD_TAG" || actionType === "REMOVE_TAG") {
    return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M7 7h.01M3 11l8-8 10 10-8 8-10-10z" /></svg>;
  }
  return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
}

/** SVG icon for each trigger type (no emoji) */
function TriggerIcon({ trigger }: { trigger: string }) {
  const cls = "w-4 h-4";
  switch (trigger) {
    case "DONATION_RECEIVED":
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8V7m0 1v8m0 0v1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
    case "CONSTITUENT_CREATED":
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>;
    case "TASK_DUE":
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>;
    case "PLEDGE_CREATED":
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
    case "EMAIL_OPENED":
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
    case "EVENT_REGISTERED":
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
    default:
      return <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
  }
}

/** Creates practical suggestions so teams can configure Steward Paths faster. */
function getStewardSuggestions(automations: Automation[]): string[] {
  const active = automations.filter((a) => a.enabled);
  const triggers = new Set(active.map((a) => a.trigger));
  const actionTypes = new Set(active.flatMap((a) => a.actions.map((act) => act.type)));
  const suggestions: string[] = [];

  if (!triggers.has("DONATION_RECEIVED")) {
    suggestions.push("Add a donation-received Steward Path for thank-you outreach and follow-up tasks.");
  }
  if (!triggers.has("CONSTITUENT_CREATED")) {
    suggestions.push("Create a new-constituent onboarding path so profiles get assigned and tagged automatically.");
  }
  if (!actionTypes.has("CREATE_TASK")) {
    suggestions.push("Include at least one Create Task action so workflows produce actionable staff work.");
  }
  if (!actionTypes.has("ADD_TAG")) {
    suggestions.push("Use Add Tag actions to drive cleaner segmentation and smarter campaign targeting.");
  }
  if (suggestions.length === 0) {
    suggestions.push("Your Steward Paths cover core stewardship moments. Next step: tune task due dates and tag rules by donor tier.");
  }

  return suggestions.slice(0, 3);
}

interface AutomationAction {
  id: string;
  type: string;
  config: Record<string, unknown> | null;
  order: number;
}

interface Automation {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  enabled: boolean;
  runCount: number;
  lastRunAt: string | null;
  ownerId?: string | null;
  sharedWithOrganization?: boolean;
  actions: AutomationAction[];
}

interface ActionLink {
  href: string;
  label: string;
  title: string;
}

/** Reads one string value from action config JSON when available. */
function readActionConfigString(action: AutomationAction, key: string): string {
  if (!action.config || typeof action.config !== "object" || Array.isArray(action.config)) return "";
  const value = action.config[key];
  return typeof value === "string" ? value.trim() : "";
}

/** Resolves one action into primary/secondary edit destinations and setup state. */
function resolveActionLinks(action: AutomationAction): { primary: ActionLink | null; secondary: ActionLink[]; needsSetup: boolean } {
  if (action.type === "SEND_EMAIL") {
    const campaignId = readActionConfigString(action, "campaignId");
    const letterTemplateId = readActionConfigString(action, "letterTemplateId");

    if (!campaignId && !letterTemplateId) {
      return {
        primary: {
          href: "/communications?new=1&source=steward-path",
          label: "Set up",
          title: "Create or link an email campaign",
        },
        secondary: [],
        needsSetup: true,
      };
    }

    const primary: ActionLink | null = campaignId
      ? {
          href: `/communications/${encodeURIComponent(campaignId)}`,
          label: "Edit",
          title: "Edit linked email campaign",
        }
      : {
          href: `/letters-printables/templates/${encodeURIComponent(letterTemplateId)}`,
          label: "Edit",
          title: "Edit linked letter template",
        };

    const secondary: ActionLink[] = [];
    if (campaignId) {
      secondary.push({
        href: `/email-builder?campaign=${encodeURIComponent(campaignId)}&returnTo=${encodeURIComponent(`/communications/${campaignId}`)}`,
        label: "Builder",
        title: "Open linked email campaign in Email Builder",
      });
    }
    if (letterTemplateId) {
      secondary.push({
        href: `/letters-printables/templates/${encodeURIComponent(letterTemplateId)}`,
        label: "Letter",
        title: "Open linked letter template",
      });
    }

    return { primary, secondary, needsSetup: false };
  }

  if (action.type === "CREATE_TASK") {
    const taskId = readActionConfigString(action, "taskId");
    const generatedLetterId = readActionConfigString(action, "generatedLetterId");

    if (taskId) {
      return {
        primary: {
          href: `/tasks?taskId=${encodeURIComponent(taskId)}&focus=my`,
          label: "Edit",
          title: "Open linked task",
        },
        secondary: generatedLetterId
          ? [{
              href: `/letters-printables/generated?sourceTaskId=${encodeURIComponent(taskId)}`,
              label: "Letter",
              title: "Open generated letters linked to this task",
            }]
          : [],
        needsSetup: false,
      };
    }

    if (generatedLetterId) {
      return {
        primary: {
          href: "/letters-printables/generated",
          label: "Open",
          title: "Open generated letter context",
        },
        secondary: [],
        needsSetup: false,
      };
    }

    return {
      primary: {
        href: "/tasks?focus=my",
        label: "Set up",
        title: "Configure linked task context",
      },
      secondary: [],
      needsSetup: true,
    };
  }

  return { primary: null, secondary: [], needsSetup: false };
}

interface AutomationPreset {
  id: string;
  name: string;
  description: string;
  trigger: string;
  actions: Array<{ type: string; order: number }>;
}

interface StewardPathRun {
  id: string;
  runId: string;
  automationId: string;
  automationName: string;
  trigger: string;
  source: string;
  status: "SUCCESS" | "FAILED";
  actionsAttempted: number;
  actionsSucceeded: number;
  actionsFailed: number;
  constituentId: string | null;
  donationId: string | null;
  taskId: string | null;
  createdAt: string;
  results: Array<{
    actionId: string;
    type: string;
    success: boolean;
    message: string;
  }>;
}

interface RunDiagnostics {
  totalRuns: number;
  failedRuns: number;
  failureRate: number;
  runsLast24h: number;
  byTrigger: Array<{ trigger: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
  lastFailedRuns: StewardPathRun[];
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [installingPreset, setInstallingPreset] = useState<string | null>(null);
  const [sharingUpdateId, setSharingUpdateId] = useState<string | null>(null);
  const [editingAutomationId, setEditingAutomationId] = useState<string | null>(null);
  const [presets, setPresets] = useState<AutomationPreset[]>([]);
  const [runs, setRuns] = useState<StewardPathRun[]>([]);
  const [runDiagnostics, setRunDiagnostics] = useState<RunDiagnostics | null>(null);
  const [runStatusFilter, setRunStatusFilter] = useState<"ALL" | "SUCCESS" | "FAILED">("ALL");
  const [runTriggerFilter, setRunTriggerFilter] = useState("ALL");
  const [runSourceFilter, setRunSourceFilter] = useState("ALL");
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"paths" | "history">("paths");
  const stewardSuggestions = getStewardSuggestions(automations);
  const editingAutomation = editingAutomationId
    ? automations.find((automation) => automation.id === editingAutomationId) ?? null
    : null;

  /** Fetch Steward Path run history from the API. */
  const loadRuns = useCallback(async () => {
    setRunsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "60" });
      if (runStatusFilter !== "ALL") params.set("status", runStatusFilter);
      if (runTriggerFilter !== "ALL") params.set("trigger", runTriggerFilter);
      if (runSourceFilter !== "ALL") params.set("source", runSourceFilter);

      const [runData, diagnostics] = await Promise.all([
        apiFetch<StewardPathRun[]>(`/api/automations/runs?${params.toString()}`),
        apiFetch<RunDiagnostics>("/api/automations/runs/diagnostics"),
      ]);
      setRuns(Array.isArray(runData) ? runData : []);
      setRunDiagnostics(diagnostics);
    } catch {
      setRuns([]);
      setRunDiagnostics(null);
    } finally {
      setRunsLoading(false);
    }
  }, [runSourceFilter, runStatusFilter, runTriggerFilter]);

  /** Fetch all automations from the API */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, presetData] = await Promise.all([
        apiFetch<Automation[]>("/api/automations"),
        apiFetch<AutomationPreset[]>("/api/automations/presets"),
      ]);
      setAutomations(Array.isArray(data) ? data : []);
      setPresets(Array.isArray(presetData) ? presetData : []);
    } catch {
      setAutomations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  /** Toggle the enabled state of an automation */
  async function toggle(a: Automation) {
    setToggling(a.id);
    try {
      await apiFetch(`/api/automations/${a.id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !a.enabled }),
      });
      setAutomations((prev) =>
        prev.map((x) => (x.id === a.id ? { ...x, enabled: !a.enabled } : x))
      );
    } finally {
      setToggling(null);
    }
  }

  /** Manually trigger a test run */
  async function runNow(id: string) {
    setRunning(id);
    try {
      const result = await apiFetch<{ automation: Automation }>(`/api/automations/${id}/run`, { method: "POST" });
      setAutomations((prev) => prev.map((x) => (x.id === id ? result.automation : x)));
      await loadRuns();
    } finally {
      setRunning(null);
    }
  }

  /** Delete an automation after confirmation */
  async function del(id: string) {
    if (!confirm("Delete this automation? This cannot be undone.")) return;
    await apiFetch(`/api/automations/${id}`, { method: "DELETE" });
    setAutomations((prev) => prev.filter((x) => x.id !== id));
  }

  /** Retries one failed Steward Path run using original trigger context. */
  async function retryRun(runId: string) {
    setRetryingRunId(runId);
    try {
      await apiFetch(`/api/automations/runs/${runId}/retry`, { method: "POST" });
      await loadRuns();
      await load();
    } finally {
      setRetryingRunId(null);
    }
  }

  /** Toggle whether this Steward Path is visible to other users in the organization. */
  async function toggleSharing(a: Automation) {
    setSharingUpdateId(a.id);
    try {
      const updated = await apiFetch<Automation>(`/api/automations/${a.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          sharedWithOrganization: !a.sharedWithOrganization,
        }),
      });
      setAutomations((prev) => prev.map((x) => (x.id === a.id ? updated : x)));
    } finally {
      setSharingUpdateId(null);
    }
  }

  /** Installs one of the predefined automation presets. */
  async function installPreset(presetId: string) {
    setInstallingPreset(presetId);
    try {
      const automation = await apiFetch<Automation>("/api/automations/from-preset", {
        method: "POST",
        body: JSON.stringify({ presetId }),
      });
      setAutomations((prev) => [automation, ...prev]);
    } finally {
      setInstallingPreset(null);
    }
  }

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Steward Paths</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Steward Paths automate repetitive stewardship work when key donor events happen.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Steward Path
        </button>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("paths")}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "paths"
              ? "border-green-600 text-green-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Steward Paths
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "history"
              ? "border-green-600 text-green-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Run History
        </button>
      </div>

      {activeTab === "paths" && (
        <>

      {!loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Visual Sequence Builder Language</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Steward paths orchestrate tasks, letters, and communications. Keep outbound work in draft/review states unless explicitly approved.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SHARED_STATUS_LEGEND.map((status) => (
                <span key={status} className="px-2 py-0.5 rounded-full text-[11px] font-medium border border-gray-200 bg-gray-50 text-gray-700">
                  {status}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <div className="bg-gradient-to-r from-green-50 to-white border border-green-100 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-600 text-white flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900">Steward Suggestions</h2>
              <p className="text-xs text-gray-600 mt-0.5">Steward is your AI teammate and your donor-care philosophy. These suggestions keep both aligned.</p>
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {stewardSuggestions.map((suggestion) => (
                  <div key={suggestion} className="rounded-lg border border-green-100 bg-white px-3 py-2 text-xs text-gray-700">
                    {suggestion}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats row ── */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: automations.length },
            { label: "Active", value: automations.filter((a) => a.enabled).length, green: true },
            { label: "Total Runs", value: automations.reduce((s, a) => s + a.runCount, 0) },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3 text-center">
              <p className={`text-2xl font-bold ${s.green ? "text-green-600" : "text-gray-900"}`}>{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Prebuilt workflow presets ── */}
      {!loading && presets.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Prebuilt Steward Paths</h2>
            <p className="text-xs text-gray-400">Install with one click</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {presets.map((p) => (
              <div key={p.id} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-900">{p.name}</h3>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{p.description}</p>
                <div className="mt-2 text-xs text-gray-400">{p.actions.length} actions</div>
                <button
                  onClick={() => installPreset(p.id)}
                  disabled={installingPreset === p.id}
                  className="mt-3 w-full text-xs font-medium px-3 py-1.5 rounded-md bg-white border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-60"
                >
                  {installingPreset === p.id ? "Installing..." : "Use preset"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Automations list ── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : automations.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-base font-medium text-gray-900">No Steward Paths yet</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Create your first Steward Path to save time on repetitive donor workflows.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            Create Steward Path
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map((a) => (
            <AutomationCard
              key={a.id}
              automation={a}
              onToggle={() => toggle(a)}
              onEdit={() => setEditingAutomationId(a.id)}
              onRun={() => runNow(a.id)}
              onDelete={() => del(a.id)}
              onToggleSharing={() => toggleSharing(a)}
              toggling={toggling === a.id}
              running={running === a.id}
              sharingUpdating={sharingUpdateId === a.id}
            />
          ))}
        </div>
      )}

        </>
      )}

      {activeTab === "history" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Steward Path Run History</h2>
            <button
              onClick={() => loadRuns()}
              className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-gray-300 hover:bg-gray-50"
            >
              Refresh
            </button>
          </div>

          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <select
                value={runStatusFilter}
                onChange={(event) => setRunStatusFilter(event.target.value as "ALL" | "SUCCESS" | "FAILED")}
                className="px-3 py-2 text-xs border border-gray-300 rounded-md bg-white"
              >
                <option value="ALL">All statuses</option>
                <option value="FAILED">Failed</option>
                <option value="SUCCESS">Success</option>
              </select>
              <select
                value={runTriggerFilter}
                onChange={(event) => setRunTriggerFilter(event.target.value)}
                className="px-3 py-2 text-xs border border-gray-300 rounded-md bg-white"
              >
                <option value="ALL">All triggers</option>
                {Object.keys(TRIGGER_LABELS).map((triggerKey) => (
                  <option key={triggerKey} value={triggerKey}>{TRIGGER_LABELS[triggerKey]}</option>
                ))}
              </select>
              <select
                value={runSourceFilter}
                onChange={(event) => setRunSourceFilter(event.target.value)}
                className="px-3 py-2 text-xs border border-gray-300 rounded-md bg-white"
              >
                <option value="ALL">All sources</option>
                <option value="manual">manual</option>
                <option value="manual_retry">manual_retry</option>
                <option value="queue">queue</option>
                <option value="unknown">unknown</option>
              </select>
              <button
                onClick={() => {
                  setRunStatusFilter("ALL");
                  setRunTriggerFilter("ALL");
                  setRunSourceFilter("ALL");
                }}
                className="px-3 py-2 text-xs font-medium rounded-md border border-gray-300 hover:bg-white"
              >
                Clear filters
              </button>
            </div>

            {runDiagnostics && (
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Total Runs</p>
                  <p className="text-sm font-semibold text-gray-900">{runDiagnostics.totalRuns}</p>
                </div>
                <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Failed Runs</p>
                  <p className="text-sm font-semibold text-red-600">{runDiagnostics.failedRuns} ({runDiagnostics.failureRate}%)</p>
                </div>
                <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-gray-500">Runs (24h)</p>
                  <p className="text-sm font-semibold text-gray-900">{runDiagnostics.runsLast24h}</p>
                </div>
              </div>
            )}
          </div>

          {runsLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">No run history yet. Run a Steward Path or wait for scheduled triggers.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {runs.map((run) => (
                <div key={run.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{run.automationName}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {TRIGGER_LABELS[run.trigger] ?? run.trigger} · {new Date(run.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{run.source}</p>
                      <p className={`text-xs mt-1 font-semibold ${run.status === "FAILED" ? "text-red-600" : "text-green-700"}`}>
                        {run.status}
                      </p>
                      <p className="text-xs mt-1">
                        <span className="text-green-700 font-semibold">{run.actionsSucceeded} passed</span>
                        <span className="text-gray-400"> · </span>
                        <span className="text-red-600 font-semibold">{run.actionsFailed} failed</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {run.results.map((result) => (
                      <div
                        key={`${run.id}-${result.actionId}-${result.type}`}
                        className={`rounded-md border px-3 py-2 text-xs ${
                          result.success
                            ? "border-green-200 bg-green-50 text-green-800"
                            : "border-red-200 bg-red-50 text-red-700"
                        }`}
                      >
                        <p className="font-semibold">{ACTION_LABELS[result.type] ?? result.type}</p>
                        <p className="mt-0.5">{result.message}</p>
                      </div>
                    ))}
                  </div>

                  {run.status === "FAILED" && (
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => retryRun(run.id)}
                        disabled={retryingRunId === run.id}
                        className="px-3 py-1.5 text-xs font-medium rounded-md border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        {retryingRunId === run.id ? "Retrying..." : "Retry Run"}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showModal && (
        <NewAutomationModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}

      {editingAutomation && (
        <AutomationWorkflowEditorModal
          automation={editingAutomation}
          onClose={() => setEditingAutomationId(null)}
          onSaved={(updated) => {
            setAutomations((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
            setEditingAutomationId(null);
          }}
        />
      )}
    </div>
  );
}

/** Individual automation card showing trigger, actions, stats, and controls. */
function AutomationCard({
  automation: a, onToggle, onEdit, onRun, onDelete, onToggleSharing, toggling, running, sharingUpdating,
}: {
  automation: Automation;
  onToggle: () => void;
  onEdit: () => void;
  onRun: () => void;
  onDelete: () => void;
  onToggleSharing: () => void;
  toggling: boolean;
  running: boolean;
  sharingUpdating: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border transition-all ${a.enabled ? "border-gray-200" : "border-gray-200 opacity-60"}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Trigger icon */}
          <span className="w-8 h-8 shrink-0 mt-0.5 rounded-md bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-500">
            <TriggerIcon trigger={a.trigger} />
          </span>

          <div className="flex-1 min-w-0">
            {/* Name + toggle */}
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2">
                <h3 className="font-semibold text-gray-900 truncate">{a.name}</h3>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${a.sharedWithOrganization ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                  {a.sharedWithOrganization ? "Shared" : "Private"}
                </span>
              </div>

              {/* Toggle switch */}
              <button
                onClick={onToggle}
                disabled={toggling}
                className={`relative inline-flex w-10 h-5 shrink-0 rounded-full transition-colors focus:outline-none ${
                  a.enabled ? "bg-green-600" : "bg-gray-300"
                } ${toggling ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                aria-label={a.enabled ? "Disable automation" : "Enable automation"}
              >
                <span className={`inline-block w-4 h-4 rounded-full bg-white shadow transition-transform mt-0.5 ${
                  a.enabled ? "translate-x-5" : "translate-x-0.5"
                }`} />
              </button>
            </div>

            {a.description && (
              <p className="text-sm text-gray-500 mt-0.5">{a.description}</p>
            )}

            {/* Trigger → actions flow */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              <span className="px-2 py-0.5 text-xs font-medium bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                When: {TRIGGER_LABELS[a.trigger] ?? a.trigger}
              </span>
              {a.actions.length > 0 && (
                <>
                  <svg className="w-3 h-3 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {a.actions.map((act, i) => {
                    const links = resolveActionLinks(act);
                    return (
                      <span key={act.id} className="flex items-center gap-1">
                        {i > 0 && <span className="text-gray-300 text-xs">then</span>}
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full border border-green-200">
                          {ACTION_LABELS[act.type] ?? act.type}
                        </span>
                        {links.primary && (
                          <Link
                            href={links.primary.href}
                            title={links.primary.title}
                            className="inline-flex items-center justify-center w-5 h-5 rounded-md border border-gray-200 bg-white text-gray-500 hover:text-green-700 hover:border-green-300 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h-6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2v-6" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </Link>
                        )}
                        {links.secondary.map((link) => (
                          <Link
                            key={`${act.id}-${link.href}`}
                            href={link.href}
                            title={link.title}
                            className="px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 border border-gray-200 rounded-md hover:border-green-300 hover:text-green-700"
                          >
                            {link.label}
                          </Link>
                        ))}
                        {links.needsSetup && (
                          <span className="px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md">
                            Needs setup
                          </span>
                        )}
                      </span>
                    );
                  })}
                </>
              )}
              {a.actions.length === 0 && (
                <span className="text-xs text-gray-400 italic">No actions configured</span>
              )}
            </div>

            {a.actions.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {a.actions.map((act, index) => {
                  const links = resolveActionLinks(act);
                  return (
                    <div key={`${a.id}-${act.id}-node`} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-1.5 text-gray-700">
                          <ActionTypeIcon actionType={act.type} />
                          <p className="text-xs font-semibold">{ACTION_LABELS[act.type] ?? act.type}</p>
                        </div>
                        <span className="text-[10px] font-semibold text-gray-500">Step {index + 1}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-gray-500">Status: {links.needsSetup ? "Needs Review" : "Ready"}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {links.primary && (
                          <Link
                            href={links.primary.href}
                            title={links.primary.title}
                            className="px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 border border-gray-300 rounded-md hover:bg-white"
                          >
                            {links.primary.label}
                          </Link>
                        )}
                        {links.secondary.map((link) => (
                          <Link
                            key={`${act.id}-${link.href}-node`}
                            href={link.href}
                            title={link.title}
                            className="px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 border border-gray-300 rounded-md hover:bg-white"
                          >
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer: stats + actions */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>{a.runCount} runs</span>
            {a.lastRunAt && (
              <span>
                Last run {new Date(a.lastRunAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleSharing}
              disabled={sharingUpdating}
              className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {sharingUpdating ? "Saving..." : a.sharedWithOrganization ? "Make Private" : "Share"}
            </button>
            <button
              onClick={onEdit}
              className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Edit workflow
            </button>
            <button
              onClick={onRun}
              disabled={running}
              className="text-xs px-2.5 py-1 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {running ? "Running…" : "▶ Test run"}
            </button>
            <button
              onClick={onDelete}
              className="text-xs px-2.5 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
