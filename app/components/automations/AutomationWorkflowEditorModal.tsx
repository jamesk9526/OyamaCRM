/** Visual workflow editor modal for fully editing one existing Steward Path automation. */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import { resolveTopBarModuleKey, type TopBarModuleKey } from "@/app/lib/navigation-boundaries";

const TRIGGERS = [
  { value: "DONATION_RECEIVED", label: "Donation received" },
  { value: "CONSTITUENT_CREATED", label: "New constituent added" },
  { value: "TASK_DUE", label: "Task becomes due" },
  { value: "PLEDGE_CREATED", label: "Pledge created" },
  { value: "EMAIL_OPENED", label: "Email opened" },
  { value: "EVENT_REGISTERED", label: "Event registration" },
] as const;

const ACTION_TYPES = [
  { value: "SEND_EMAIL", label: "Create review-required email" },
  { value: "CREATE_TASK", label: "Create task" },
  { value: "ADD_TAG", label: "Add tag" },
  { value: "REMOVE_TAG", label: "Remove tag" },
  { value: "ASSIGN_USER", label: "Assign user" },
  { value: "UPDATE_FIELD", label: "Update field" },
] as const;

interface AccentTheme {
  primaryBg: string;
  primaryHoverBg: string;
  sidebarGradient: string;
  badgeBg: string;
  badgeText: string;
  inputRing: string;
}

interface AutomationAction {
  id: string;
  type: string;
  config: Record<string, unknown> | null;
  order: number;
}

interface AutomationRecord {
  id: string;
  name: string;
  description: string | null;
  trigger: string;
  triggerConfig?: Record<string, unknown> | null;
  actions: AutomationAction[];
}

interface LinkableCampaignOption {
  id: string;
  name: string;
  status?: string;
}

interface LinkableTemplateOption {
  id: string;
  name: string;
  status?: string;
}

interface ActionDraft {
  clientId: string;
  type: string;
  config: Record<string, unknown>;
}

interface WorkflowEditorDraft {
  name: string;
  description: string;
  trigger: string;
  firstDonationOnly: boolean;
  majorGiftMinAmount: string;
  actions: ActionDraft[];
}

interface AutomationWorkflowEditorModalProps {
  automation: AutomationRecord;
  onClose: () => void;
  onSaved: (automation: AutomationRecord) => void;
}

/** Returns workspace-aware accent classes so modal theme follows active CRM module. */
function getAccentTheme(moduleKey: TopBarModuleKey): AccentTheme {
  if (moduleKey === "compassion") {
    return {
      primaryBg: "bg-blue-600",
      primaryHoverBg: "hover:bg-blue-700",
      sidebarGradient: "from-blue-600 to-sky-600",
      badgeBg: "bg-blue-50",
      badgeText: "text-blue-700",
      inputRing: "focus:ring-blue-500",
    };
  }
  if (moduleKey === "events") {
    return {
      primaryBg: "bg-amber-600",
      primaryHoverBg: "hover:bg-amber-700",
      sidebarGradient: "from-amber-600 to-orange-600",
      badgeBg: "bg-amber-50",
      badgeText: "text-amber-700",
      inputRing: "focus:ring-amber-500",
    };
  }
  return {
    primaryBg: "bg-green-600",
    primaryHoverBg: "hover:bg-green-700",
    sidebarGradient: "from-green-600 to-emerald-600",
    badgeBg: "bg-green-50",
    badgeText: "text-green-700",
    inputRing: "focus:ring-green-500",
  };
}

/** Generates local client IDs for action draft rows. */
function localId(): string {
  return `act_${Math.random().toString(36).slice(2, 10)}`;
}

/** Builds local editor state from a persisted automation record. */
function buildDraft(automation: AutomationRecord): WorkflowEditorDraft {
  const triggerCfg = automation.triggerConfig && typeof automation.triggerConfig === "object"
    ? automation.triggerConfig
    : {};
  const firstDonationOnly = triggerCfg.firstDonationOnly === true;
  const majorGiftMinAmountRaw = typeof triggerCfg.majorGiftMinAmount === "number"
    ? String(triggerCfg.majorGiftMinAmount)
    : "";

  return {
    name: automation.name,
    description: automation.description || "",
    trigger: automation.trigger,
    firstDonationOnly,
    majorGiftMinAmount: majorGiftMinAmountRaw,
    actions: automation.actions
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((action) => ({
        clientId: localId(),
        type: action.type,
        config: action.config && typeof action.config === "object" && !Array.isArray(action.config)
          ? { ...action.config }
          : {},
      })),
  };
}

/** Renders one friendly action label. */
function actionLabel(type: string): string {
  return ACTION_TYPES.find((item) => item.value === type)?.label || type;
}

/** Visual editor modal for one existing workflow. */
export default function AutomationWorkflowEditorModal({ automation, onClose, onSaved }: AutomationWorkflowEditorModalProps) {
  const pathname = usePathname();
  const moduleKey = useMemo(() => resolveTopBarModuleKey(pathname || "/"), [pathname]);
  const theme = useMemo(() => getAccentTheme(moduleKey), [moduleKey]);

  const [draft, setDraft] = useState<WorkflowEditorDraft>(() => buildDraft(automation));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [campaignOptions, setCampaignOptions] = useState<LinkableCampaignOption[]>([]);
  const [templateOptions, setTemplateOptions] = useState<LinkableTemplateOption[]>([]);

  useEffect(() => {
    setDraft(buildDraft(automation));
  }, [automation]);

  const loadOptions = useCallback(async () => {
    setOptionsLoading(true);
    try {
      const [campaigns, templates] = await Promise.all([
        apiFetch<LinkableCampaignOption[]>("/api/email-campaigns"),
        apiFetch<LinkableTemplateOption[]>("/api/letters/templates?status=ACTIVE"),
      ]);
      setCampaignOptions(Array.isArray(campaigns) ? campaigns : []);
      setTemplateOptions(Array.isArray(templates) ? templates : []);
    } catch {
      setCampaignOptions([]);
      setTemplateOptions([]);
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (draft.actions.some((action) => action.type === "SEND_EMAIL")) {
      void loadOptions();
    }
  }, [draft.actions, loadOptions]);

  /** Updates one top-level draft field. */
  function setDraftField<K extends keyof WorkflowEditorDraft>(key: K, value: WorkflowEditorDraft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  /** Updates one action row field. */
  function setActionField(clientId: string, updates: Partial<ActionDraft>) {
    setDraft((prev) => ({
      ...prev,
      actions: prev.actions.map((action) => (action.clientId === clientId ? { ...action, ...updates } : action)),
    }));
  }

  /** Updates one action config key. */
  function setActionConfig(clientId: string, key: string, value: unknown) {
    setDraft((prev) => ({
      ...prev,
      actions: prev.actions.map((action) => {
        if (action.clientId !== clientId) return action;
        const nextConfig = { ...action.config };
        if (value === "" || value === null || value === undefined) {
          delete nextConfig[key];
        } else {
          nextConfig[key] = value;
        }
        return { ...action, config: nextConfig };
      }),
    }));
  }

  /** Adds a new action row to the end of the sequence. */
  function addAction() {
    setDraft((prev) => ({
      ...prev,
      actions: [...prev.actions, { clientId: localId(), type: "CREATE_TASK", config: {} }],
    }));
  }

  /** Removes one action row. */
  function removeAction(clientId: string) {
    setDraft((prev) => ({
      ...prev,
      actions: prev.actions.filter((action) => action.clientId !== clientId),
    }));
  }

  /** Moves one action row by offset for visual sequencing. */
  function moveAction(clientId: string, direction: -1 | 1) {
    setDraft((prev) => {
      const index = prev.actions.findIndex((action) => action.clientId === clientId);
      if (index < 0) return prev;
      const target = index + direction;
      if (target < 0 || target >= prev.actions.length) return prev;
      const next = prev.actions.slice();
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return { ...prev, actions: next };
    });
  }

  /** Saves complete workflow edits back to the automation API. */
  async function saveWorkflow() {
    if (!draft.name.trim()) {
      setError("Workflow name is required.");
      return;
    }
    if (!draft.actions.length) {
      setError("Add at least one action to this workflow.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const triggerConfig: Record<string, unknown> = {};
      if (draft.trigger === "DONATION_RECEIVED") {
        if (draft.firstDonationOnly) triggerConfig.firstDonationOnly = true;
        if (draft.majorGiftMinAmount.trim()) {
          const parsed = Number.parseFloat(draft.majorGiftMinAmount);
          if (!Number.isFinite(parsed) || parsed < 0) {
            setError("Major gift threshold must be a valid positive number.");
            setSaving(false);
            return;
          }
          triggerConfig.majorGiftMinAmount = parsed;
        }
      }

      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        trigger: draft.trigger,
        triggerConfig,
        actions: draft.actions.map((action) => ({
          type: action.type,
          config: action.config,
        })),
      };

      const updated = await apiFetch<AutomationRecord>(`/api/automations/${automation.id}/workflow`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      onSaved(updated);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save workflow.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-5xl bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden">
        <div className="grid lg:grid-cols-[280px_1fr]">
          <aside className={`relative bg-gradient-to-b ${theme.sidebarGradient} text-white p-5`}>
            <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-white/80">Visual Workflow Editor</p>
            <h2 className="mt-2 text-xl font-semibold">Edit Steward Path</h2>
            <p className="mt-2 text-sm text-white/85 leading-relaxed">Fully edit trigger rules and action sequence with a visual step-by-step workflow model.</p>
            <div className="mt-4 space-y-2 text-xs text-white/90">
              <p>1. Update trigger and guardrails</p>
              <p>2. Edit action cards visually</p>
              <p>3. Save complete workflow sequence</p>
            </div>
          </aside>

          <div>
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Workflow Designer</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close editor">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-5 max-h-[85vh] overflow-y-auto space-y-4">
              {error && (
                <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">{error}</div>
              )}

              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-sm text-gray-700">
                  Name
                  <input
                    value={draft.name}
                    onChange={(event) => setDraftField("name", event.target.value)}
                    className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${theme.inputRing}`}
                  />
                </label>
                <label className="text-sm text-gray-700">
                  Trigger
                  <select
                    value={draft.trigger}
                    onChange={(event) => setDraftField("trigger", event.target.value)}
                    className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${theme.inputRing}`}
                  >
                    {TRIGGERS.map((trigger) => (
                      <option key={trigger.value} value={trigger.value}>{trigger.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="text-sm text-gray-700 block">
                Description
                <input
                  value={draft.description}
                  onChange={(event) => setDraftField("description", event.target.value)}
                  className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${theme.inputRing}`}
                />
              </label>

              {draft.trigger === "DONATION_RECEIVED" && (
                <div className={`rounded-lg border ${theme.badgeBg} border-gray-200 p-3 space-y-2`}>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${theme.badgeText}`}>Donation Guardrails</p>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={draft.firstDonationOnly}
                      onChange={(event) => setDraftField("firstDonationOnly", event.target.checked)}
                      className="rounded border-gray-300"
                    />
                    Run only for first donation
                  </label>
                  <label className="text-sm text-gray-700 block">
                    Major gift minimum (optional)
                    <input
                      value={draft.majorGiftMinAmount}
                      onChange={(event) => setDraftField("majorGiftMinAmount", event.target.value)}
                      placeholder="1000"
                      className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${theme.inputRing}`}
                    />
                  </label>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900">Action Sequence</h4>
                  <button
                    type="button"
                    onClick={addAction}
                    className="text-xs font-medium px-3 py-1.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    + Add Action
                  </button>
                </div>

                {draft.actions.map((action, index) => (
                  <div key={action.clientId} className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Step {index + 1}</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => moveAction(action.clientId, -1)}
                          className="px-2 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50"
                          disabled={index === 0}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveAction(action.clientId, 1)}
                          className="px-2 py-1 text-xs border border-gray-200 rounded-md hover:bg-gray-50"
                          disabled={index === draft.actions.length - 1}
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          onClick={() => removeAction(action.clientId)}
                          className="px-2 py-1 text-xs border border-red-200 text-red-600 rounded-md hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <label className="text-sm text-gray-700 block">
                      Action type
                      <select
                        value={action.type}
                        onChange={(event) => setActionField(action.clientId, { type: event.target.value, config: {} })}
                        className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${theme.inputRing}`}
                      >
                        {ACTION_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>{type.label}</option>
                        ))}
                      </select>
                    </label>

                    <div className={`rounded-lg border ${theme.badgeBg} border-gray-200 p-3 space-y-2`}>
                      <p className={`text-xs font-semibold ${theme.badgeText}`}>Action Configuration: {actionLabel(action.type)}</p>

                      {action.type === "SEND_EMAIL" && (
                        <>
                          <label className="text-sm text-gray-700 block">
                            Campaign
                            <select
                              value={typeof action.config.campaignId === "string" ? action.config.campaignId : ""}
                              onChange={(event) => setActionConfig(action.clientId, "campaignId", event.target.value)}
                              className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${theme.inputRing}`}
                            >
                              <option value="">Select campaign</option>
                              {campaignOptions.map((campaign) => (
                                <option key={campaign.id} value={campaign.id}>
                                  {campaign.name}{campaign.status ? ` (${campaign.status})` : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="text-sm text-gray-700 block">
                            Letter template
                            <select
                              value={typeof action.config.letterTemplateId === "string" ? action.config.letterTemplateId : ""}
                              onChange={(event) => setActionConfig(action.clientId, "letterTemplateId", event.target.value)}
                              className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${theme.inputRing}`}
                            >
                              <option value="">Select template</option>
                              {templateOptions.map((template) => (
                                <option key={template.id} value={template.id}>
                                  {template.name}{template.status ? ` (${template.status})` : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                          {optionsLoading && <p className="text-xs text-gray-500">Loading campaign and template options...</p>}
                        </>
                      )}

                      {action.type === "CREATE_TASK" && (
                        <>
                          <label className="text-sm text-gray-700 block">
                            Task title
                            <input
                              value={typeof action.config.title === "string" ? action.config.title : ""}
                              onChange={(event) => setActionConfig(action.clientId, "title", event.target.value)}
                              className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${theme.inputRing}`}
                            />
                          </label>
                          <label className="text-sm text-gray-700 block">
                            Priority
                            <select
                              value={typeof action.config.priority === "string" ? action.config.priority : "MEDIUM"}
                              onChange={(event) => setActionConfig(action.clientId, "priority", event.target.value)}
                              className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${theme.inputRing}`}
                            >
                              <option value="LOW">Low</option>
                              <option value="MEDIUM">Medium</option>
                              <option value="HIGH">High</option>
                              <option value="URGENT">Urgent</option>
                            </select>
                          </label>
                        </>
                      )}

                      {(action.type === "ADD_TAG" || action.type === "REMOVE_TAG") && (
                        <label className="text-sm text-gray-700 block">
                          Tag
                          <input
                            value={typeof action.config.tag === "string" ? action.config.tag : ""}
                            onChange={(event) => setActionConfig(action.clientId, "tag", event.target.value)}
                            className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${theme.inputRing}`}
                          />
                        </label>
                      )}

                      {action.type === "UPDATE_FIELD" && (
                        <>
                          <label className="text-sm text-gray-700 block">
                            Field
                            <input
                              value={typeof action.config.field === "string" ? action.config.field : ""}
                              onChange={(event) => setActionConfig(action.clientId, "field", event.target.value)}
                              className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${theme.inputRing}`}
                            />
                          </label>
                          <label className="text-sm text-gray-700 block">
                            Value
                            <input
                              value={typeof action.config.value === "string" ? action.config.value : ""}
                              onChange={(event) => setActionConfig(action.clientId, "value", event.target.value)}
                              className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${theme.inputRing}`}
                            />
                          </label>
                        </>
                      )}

                      {action.type === "ASSIGN_USER" && (
                        <label className="text-sm text-gray-700 block">
                          Assignment role hint
                          <input
                            value={typeof action.config.role === "string" ? action.config.role : "staff"}
                            onChange={(event) => setActionConfig(action.clientId, "role", event.target.value)}
                            className={`mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 ${theme.inputRing}`}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveWorkflow()}
                  disabled={saving}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 ${theme.primaryBg} ${theme.primaryHoverBg}`}
                >
                  {saving ? "Saving..." : "Save Workflow"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
