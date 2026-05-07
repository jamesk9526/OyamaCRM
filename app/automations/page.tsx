/**
 * Automations page.
 * Lists workflow automation rules from /api/automations.
 * Users can toggle enable/disable, run manually, and create new automations.
 * Full execution engine is a future feature — actions are stored but not run server-side yet.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import NewAutomationModal from "@/app/components/automations/NewAutomationModal";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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

/** Trigger icon mapping */
const TRIGGER_ICONS: Record<string, string> = {
  DONATION_RECEIVED: "💰",
  CONSTITUENT_CREATED: "👤",
  TASK_DUE: "📋",
  PLEDGE_CREATED: "🤝",
  EMAIL_OPENED: "📧",
  EVENT_REGISTERED: "📅",
};

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
  actions: AutomationAction[];
}

interface AutomationPreset {
  id: string;
  name: string;
  description: string;
  trigger: string;
  actions: Array<{ type: string; order: number }>;
}

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [installingPreset, setInstallingPreset] = useState<string | null>(null);
  const [presets, setPresets] = useState<AutomationPreset[]>([]);

  /** Fetch all automations from the API */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/automations`);
      const presetRes = await fetch(`${API}/api/automations/presets`);
      const [data, presetData] = await Promise.all([res.json(), presetRes.json()]);
      setAutomations(Array.isArray(data) ? data : []);
      setPresets(Array.isArray(presetData) ? presetData : []);
    } catch {
      setAutomations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /** Toggle the enabled state of an automation */
  async function toggle(a: Automation) {
    setToggling(a.id);
    try {
      await fetch(`${API}/api/automations/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
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
      const res = await fetch(`${API}/api/automations/${id}/run`, { method: "POST" });
      const { automation } = await res.json();
      setAutomations((prev) => prev.map((x) => (x.id === id ? automation : x)));
    } finally {
      setRunning(null);
    }
  }

  /** Delete an automation after confirmation */
  async function del(id: string) {
    if (!confirm("Delete this automation? This cannot be undone.")) return;
    await fetch(`${API}/api/automations/${id}`, { method: "DELETE" });
    setAutomations((prev) => prev.filter((x) => x.id !== id));
  }

  /** Installs one of the predefined automation presets. */
  async function installPreset(presetId: string) {
    setInstallingPreset(presetId);
    try {
      const res = await fetch(`${API}/api/automations/from-preset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId }),
      });
      if (!res.ok) throw new Error("Failed to install preset");
      const automation = await res.json();
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
          <h1 className="text-xl font-semibold text-gray-900">Automations</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Automate repetitive workflows — trigger actions when key events happen
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Automation
        </button>
      </div>

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
            <h2 className="text-sm font-semibold text-gray-900">Prebuilt Automations</h2>
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
          <div className="text-4xl mb-3">⚙️</div>
          <h3 className="text-base font-medium text-gray-900">No automations yet</h3>
          <p className="text-sm text-gray-500 mt-1 mb-4">
            Create your first automation to save time on repetitive tasks
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            Create automation
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map((a) => (
            <AutomationCard
              key={a.id}
              automation={a}
              onToggle={() => toggle(a)}
              onRun={() => runNow(a.id)}
              onDelete={() => del(a.id)}
              toggling={toggling === a.id}
              running={running === a.id}
            />
          ))}
        </div>
      )}

      {showModal && (
        <NewAutomationModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); load(); }}
        />
      )}
    </div>
  );
}

/** Individual automation card showing trigger, actions, stats, and controls. */
function AutomationCard({
  automation: a, onToggle, onRun, onDelete, toggling, running,
}: {
  automation: Automation;
  onToggle: () => void;
  onRun: () => void;
  onDelete: () => void;
  toggling: boolean;
  running: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border transition-all ${a.enabled ? "border-gray-200" : "border-gray-200 opacity-60"}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Trigger icon */}
          <span className="text-2xl shrink-0 mt-0.5">{TRIGGER_ICONS[a.trigger] ?? "⚡"}</span>

          <div className="flex-1 min-w-0">
            {/* Name + toggle */}
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-gray-900 truncate">{a.name}</h3>

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
                  {a.actions.map((act, i) => (
                    <span key={act.id} className="flex items-center gap-1">
                      {i > 0 && <span className="text-gray-300 text-xs">then</span>}
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-50 text-green-700 rounded-full border border-green-200">
                        {ACTION_LABELS[act.type] ?? act.type}
                      </span>
                    </span>
                  ))}
                </>
              )}
              {a.actions.length === 0 && (
                <span className="text-xs text-gray-400 italic">No actions configured</span>
              )}
            </div>
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
