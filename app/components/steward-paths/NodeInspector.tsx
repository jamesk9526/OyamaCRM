/**
 * NodeInspector renders the full-height right-side node settings drawer.
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listStewardPathEmailCampaigns,
  listStewardPathLetterTemplates,
  type StewardPathEmailCampaignOption,
  type StewardPathLetterTemplateOption,
} from "./workflow-api";
import EmailDraftBuilderModal from "./EmailDraftBuilderModal";
import { PALETTE_ITEMS } from "./palette-catalog";
import {
  BRANCH_OPERATOR_OPTIONS,
  isBranchNode,
  type WorkflowBranchConditionGroup,
  type WorkflowNode,
} from "./workflow-types";

interface NodeInspectorProps {
  node: WorkflowNode | null;
  onChange: (next: WorkflowNode) => void;
  onAddBranchLane: (branchNodeId: string) => void;
  onRenameBranchLane: (branchNodeId: string, laneId: string, label: string) => void;
  onRemoveBranchLane: (branchNodeId: string, laneId: string) => void;
  onSetFallbackLane: (branchNodeId: string, laneId: string) => void;
  onAddConditionGroup: (branchNodeId: string, laneId: string) => void;
  onRemoveConditionGroup: (branchNodeId: string, laneId: string, conditionGroupId: string) => void;
  onUpdateConditionGroup: (
    branchNodeId: string,
    laneId: string,
    conditionGroupId: string,
    partial: Partial<WorkflowBranchConditionGroup>,
  ) => void;
  onClose?: () => void;
}

type BranchFieldInputKind = "text" | "number" | "boolean";

interface BranchFieldOption {
  value: string;
  label: string;
  hint: string;
  inputKind: BranchFieldInputKind;
}

const BRANCH_FIELD_OPTIONS: BranchFieldOption[] = [
  { value: "lastGiftAmount", label: "Last donation amount", hint: "Number value from latest donation", inputKind: "number" },
  { value: "totalLifetimeGiving", label: "Lifetime giving", hint: "Number value across all donations", inputKind: "number" },
  { value: "engagementScore", label: "Engagement score", hint: "0 to 100 score", inputKind: "number" },
  { value: "donorStatus", label: "Donor status", hint: "Active, Lapsed, New, and similar statuses", inputKind: "text" },
  { value: "constituentType", label: "Constituent type", hint: "Donor, Volunteer, Member, etc.", inputKind: "text" },
  { value: "doNotEmail", label: "Do not email", hint: "Boolean preference flag", inputKind: "boolean" },
  { value: "emailOptOut", label: "Email opt-out", hint: "Boolean preference flag", inputKind: "boolean" },
  { value: "doNotMail", label: "Do not mail", hint: "Boolean preference flag", inputKind: "boolean" },
  { value: "segmentMembership", label: "Segment membership", hint: "True when donor belongs to selected segment/tag", inputKind: "boolean" },
  { value: "city", label: "City", hint: "Constituent city field", inputKind: "text" },
  { value: "state", label: "State/region", hint: "Constituent state field", inputKind: "text" },
];

const EMAIL_UTILITY_NODE_KINDS = new Set([
  "email.send_review_request",
  "email.add_to_sequence",
  "email.wait_for_open",
  "email.mark_failed",
]);

const PRINT_OPERATION_NODE_KINDS = new Set([
  "print.add_to_print_queue",
  "print.require_print_approval",
  "print.mark_printed",
  "print.add_to_mail_queue",
  "print.mark_mailed",
]);

const TASK_OPERATION_NODE_KINDS = new Set([
  "task.assign_staff",
  "task.wait_for_completion",
  "task.escalate_overdue",
]);

const DONOR_DATA_NODE_KINDS = new Set([
  "donor.add_tag",
  "donor.remove_tag",
  "donor.update_status",
  "donor.adjust_engagement_score",
  "donor.add_note",
]);

const SAFETY_NODE_KINDS = new Set([
  "safety.require_human_approval",
  "safety.pause_path",
  "safety.notify_staff",
  "safety.stop_enrollment",
]);

/** Resolves branch field metadata used by the condition builder. */
function getBranchFieldOption(field: string): BranchFieldOption | null {
  return BRANCH_FIELD_OPTIONS.find((option) => option.value === field) ?? null;
}

/** Builds a human-readable lane condition summary. */
function summarizeConditionGroups(groups: WorkflowBranchConditionGroup[]): string {
  if (groups.length === 0) return "No conditions configured.";
  return groups
    .map((group) => {
      if (group.operator === "between") {
        return `${group.operator} ${group.value || "?"} and ${group.valueTo || "?"}`;
      }
      return `${group.operator} ${group.value || "?"}`;
    })
    .join(" AND ");
}

/** Reads a string value from the node config safely. */
function readString(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  return typeof value === "string" ? value : "";
}

/** Reads a numeric value from the node config safely. */
function readNumber(config: Record<string, unknown>, key: string, fallback: number): number {
  const value = config[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** Formats one ISO string into datetime-local input value. */
function toDateTimeLocalInput(value: string): string {
  if (!value.trim()) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const offset = parsed.getTimezoneOffset() * 60000;
  return new Date(parsed.getTime() - offset).toISOString().slice(0, 16);
}

/** Converts one datetime-local input value to ISO string. */
function fromDateTimeLocalInput(value: string): string {
  if (!value.trim()) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

/** Placeholder text used by branch value inputs based on operator and position. */
function getConditionValuePlaceholder(
  option: BranchFieldOption | null,
  operator: WorkflowBranchConditionGroup["operator"],
  upperBound: boolean,
): string {
  if (operator === "between") return upperBound ? "Upper value" : "Lower value";
  if (operator === "in" || operator === "not_in") return "Comma-separated values";
  if (option?.inputKind === "number") return "Numeric value";
  return "Value";
}

/** Right-panel inspector for the selected node. */
export default function NodeInspector({
  node,
  onChange,
  onAddBranchLane,
  onRenameBranchLane,
  onRemoveBranchLane,
  onSetFallbackLane,
  onAddConditionGroup,
  onRemoveConditionGroup,
  onUpdateConditionGroup,
  onClose,
}: NodeInspectorProps) {
  const [templateSearch, setTemplateSearch] = useState("");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [letterTemplates, setLetterTemplates] = useState<StewardPathLetterTemplateOption[]>([]);
  const [emailCampaigns, setEmailCampaigns] = useState<StewardPathEmailCampaignOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [campaignError, setCampaignError] = useState<string | null>(null);
  const [emailBuilderOpen, setEmailBuilderOpen] = useState(false);

  const palette = PALETTE_ITEMS.find((item) => item.kind === node?.kind);

  useEffect(() => {
    setTemplateSearch("");
    setCampaignSearch("");
    setTemplateError(null);
    setCampaignError(null);
    setEmailBuilderOpen(false);
  }, [node?.id]);

  useEffect(() => {
    if (node?.kind !== "print.generate_letter") return;
    let cancelled = false;
    setTemplatesLoading(true);
    setTemplateError(null);

    void listStewardPathLetterTemplates(templateSearch)
      .then((items) => {
        if (!cancelled) setLetterTemplates(items);
      })
      .catch((error) => {
        if (cancelled) return;
        setTemplateError(error instanceof Error ? error.message : "Failed to load letter templates.");
      })
      .finally(() => {
        if (!cancelled) setTemplatesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [node?.kind, templateSearch]);

  useEffect(() => {
    if (node?.kind !== "email.create_draft" && node?.kind !== "email.schedule_blast") return;
    let cancelled = false;
    setCampaignsLoading(true);
    setCampaignError(null);

    void listStewardPathEmailCampaigns(campaignSearch)
      .then((items) => {
        if (!cancelled) setEmailCampaigns(items);
      })
      .catch((error) => {
        if (cancelled) return;
        setCampaignError(error instanceof Error ? error.message : "Failed to load email campaigns.");
      })
      .finally(() => {
        if (!cancelled) setCampaignsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [node?.kind, campaignSearch]);

  if (!node) {
    return (
      <aside className="w-[420px] shrink-0 border-l border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-5">
          <h2 className="text-base font-semibold text-slate-950">Step Config</h2>
          <p className="mt-0.5 text-xs text-slate-500">Select a step on the canvas to edit settings.</p>
        </div>
        <div className="p-5">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
            <svg className="h-8 w-8 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="3" /><path strokeLinecap="round" d="M8 12h8M12 8v8" />
            </svg>
            <p className="text-xs text-slate-500">Click any step to view and edit its settings here.</p>
          </div>
        </div>
      </aside>
    );
  }

  const activeNode = node;

  function updateConfig(key: string, value: unknown) {
    onChange({ ...activeNode, config: { ...activeNode.config, [key]: value } });
  }

  function updateConfigEntries(partial: Record<string, unknown>) {
    onChange({ ...activeNode, config: { ...activeNode.config, ...partial } });
  }

  const draftSavedAt = readString(activeNode.config, "emailBuilderSavedAt");
  const configuredCampaignId = readString(activeNode.config, "campaignId");
  const isDemoCampaignLinked = configuredCampaignId.trim().toLowerCase().startsWith("demo_");
  const builderCampaignId = isDemoCampaignLinked ? "" : configuredCampaignId;
  const createDraftCampaignOptions = emailCampaigns.filter((campaign) => !campaign.id.trim().toLowerCase().startsWith("demo_"));

  const configuredBranchField = isBranchNode(activeNode)
    ? (readString(activeNode.config, "field") || (activeNode.kind === "logic.segment_condition" ? "segmentMembership" : "lastGiftAmount"))
    : "lastGiftAmount";
  const selectedBranchField = isBranchNode(activeNode) ? getBranchFieldOption(configuredBranchField) : null;
  const usingCustomBranchField = isBranchNode(activeNode) && selectedBranchField === null;

  return (
    <aside className="w-[420px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-5 py-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <rect x="2" y="2" width="12" height="12" rx="1.5" /><path strokeLinecap="round" strokeLinejoin="round" d="M5.5 8l2 2 3-3" />
              </svg>
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-slate-950">{palette?.label ?? activeNode.kind}</h2>
              {palette?.summary && (
                <p className="truncate text-[11px] text-slate-500">{palette.summary}</p>
              )}
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100" aria-label="Close inspector selection">
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4 12 12M12 4 4 12" />
            </svg>
          </button>
        </div>
        <div className="mt-5 flex gap-6 border-b border-slate-200">
          <button type="button" className="-mb-px border-b-2 border-slate-950 pb-3 text-sm font-semibold text-slate-950">
            Config
          </button>
          <button type="button" className="-mb-px border-b-2 border-transparent pb-3 text-sm font-medium text-slate-500 hover:text-slate-700">
            Preview
          </button>
        </div>
      </div>

      <div className="space-y-5 p-5">
        <label className="block">
          <span className="text-xs font-medium text-slate-700">Step label</span>
          <input
            type="text"
            value={activeNode.title}
            onChange={(event) => onChange({ ...activeNode, title: event.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
          />
        </label>

        {isBranchNode(activeNode) && (
          <div className="space-y-3 rounded-xl border border-green-200 bg-green-50/50 p-3">
            <p className="text-xs font-semibold text-green-800">Branch logic</p>

            <label className="block">
              <span className="text-xs font-medium text-slate-700">Condition field</span>
              <select
                value={usingCustomBranchField ? "__custom__" : configuredBranchField}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  if (nextValue === "__custom__") {
                    updateConfig("field", "");
                    return;
                  }
                  updateConfig("field", nextValue);
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
              >
                {BRANCH_FIELD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
                <option value="__custom__">Custom field...</option>
              </select>
            </label>

            {usingCustomBranchField && (
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Custom field key</span>
                <input
                  type="text"
                  value={configuredBranchField}
                  onChange={(event) => updateConfig("field", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                  placeholder="Example: lastGiftAmount"
                />
              </label>
            )}

            <p className="rounded-lg border border-green-200 bg-white px-2 py-1 text-[11px] text-green-800">
            {selectedBranchField?.hint ?? "Custom fields use text-based comparison by default in this editor."}
          </p>

            {activeNode.kind === "logic.segment_condition" && (
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Segment or tag name</span>
                <input
                  type="text"
                  value={readString(activeNode.config, "segmentKey")}
                  onChange={(event) => updateConfigEntries({
                    segmentKey: event.target.value,
                    field: "segmentMembership",
                  })}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                  placeholder="Example: Major Donor"
                />
              </label>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-slate-700">Branch lanes</p>
              <button
                type="button"
                onClick={() => onAddBranchLane(activeNode.id)}
                className="rounded-md border border-emerald-300 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                + Add lane
              </button>
            </div>

            <div className="space-y-2">
              {activeNode.lanes.map((lane) => (
                <div key={lane.id} className="rounded-md border border-gray-200 bg-white p-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={lane.label}
                      onChange={(event) => onRenameBranchLane(activeNode.id, lane.id, event.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-900 outline-none transition focus:border-green-500 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => onSetFallbackLane(activeNode.id, lane.id)}
                      className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${lane.isFallback ? "border-slate-300 bg-slate-100 text-slate-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                    >
                      {lane.isFallback ? "Fallback" : "Set Fallback"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveBranchLane(activeNode.id, lane.id)}
                      className="rounded-md border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50"
                    >
                      Remove
                    </button>
                  </div>

                  {!lane.isFallback && (
                    <div className="mt-2 space-y-2">
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-700">
                        {summarizeConditionGroups(lane.conditionGroups)}
                      </p>

                      {lane.conditionGroups.map((group, index) => {
                        const inputKind = selectedBranchField?.inputKind ?? "text";
                        const isListOperator = group.operator === "in" || group.operator === "not_in";
                        const isBetween = group.operator === "between";

                        return (
                          <div key={group.id} className="space-y-1 rounded-xl border border-slate-200 bg-slate-50/60 p-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                              Condition {index + 1}
                            </p>

                            <div className="grid grid-cols-[1fr_1fr_auto] gap-1">
                              <select
                                value={group.operator}
                                onChange={(event) => onUpdateConditionGroup(activeNode.id, lane.id, group.id, { operator: event.target.value as WorkflowBranchConditionGroup["operator"] })}
                                className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-900 outline-none transition focus:border-green-500 focus:bg-white"
                              >
                                {BRANCH_OPERATOR_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                              </select>

                              {inputKind === "boolean" && !isListOperator && !isBetween ? (
                                <select
                                  value={group.value}
                                  onChange={(event) => onUpdateConditionGroup(activeNode.id, lane.id, group.id, { value: event.target.value })}
                                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-900 outline-none transition focus:border-green-500 focus:bg-white"
                                >
                                  <option value="">Select</option>
                                  <option value="true">True</option>
                                  <option value="false">False</option>
                                </select>
                              ) : (
                                <input
                                  type={inputKind === "number" && !isListOperator ? "number" : "text"}
                                  value={group.value}
                                  onChange={(event) => onUpdateConditionGroup(activeNode.id, lane.id, group.id, { value: event.target.value })}
                                  className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] text-slate-900 outline-none transition focus:border-green-500 focus:bg-white"
                                  placeholder={getConditionValuePlaceholder(selectedBranchField, group.operator, false)}
                                />
                              )}

                              <button
                                type="button"
                                onClick={() => onRemoveConditionGroup(activeNode.id, lane.id, group.id)}
                                className="rounded-md border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50"
                              >
                                x
                              </button>

                              {isBetween && (
                                <input
                                  type={inputKind === "number" ? "number" : "text"}
                                  value={group.valueTo ?? ""}
                                  onChange={(event) => onUpdateConditionGroup(activeNode.id, lane.id, group.id, { valueTo: event.target.value })}
                                  className="col-span-2 rounded-md border border-gray-300 px-1.5 py-1 text-[11px]"
                                  placeholder={getConditionValuePlaceholder(selectedBranchField, group.operator, true)}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => onAddConditionGroup(activeNode.id, lane.id)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-[10px] font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        + Add AND condition
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeNode.kind === "timing.delay" && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-xs font-semibold text-slate-700">Timing controls</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Amount</span>
                <input
                  type="number"
                  min={1}
                  value={readNumber(activeNode.config, "amount", 1)}
                  onChange={(event) => updateConfig("amount", Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Unit</span>
                <select
                  value={readString(activeNode.config, "unit") || "days"}
                  onChange={(event) => updateConfig("unit", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {activeNode.kind === "trigger.added_to_segment" && (
          <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-semibold text-green-800">Segment trigger</p>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Segment or tag name</span>
              <input
                type="text"
                value={readString(activeNode.config, "segmentKey")}
                onChange={(event) => updateConfig("segmentKey", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                placeholder="Example: Major Donor"
              />
            </label>
            <p className="text-[11px] text-green-800">
              Enrollment triggers when this donor is added to the selected segment/tag.
            </p>
          </div>
        )}

        {activeNode.kind.startsWith("trigger.") && activeNode.kind !== "trigger.added_to_segment" && (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div>
              <p className="text-xs font-semibold text-emerald-900">Trigger setup</p>
              <p className="mt-0.5 text-[11px] text-emerald-800">Define when constituents should enter this path.</p>
            </div>

            {activeNode.kind === "trigger.new_donation" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-700">Minimum gift</span>
                  <input
                    type="number"
                    min={0}
                    value={readNumber(activeNode.config, "minimumAmount", 0)}
                    onChange={(event) => updateConfig("minimumAmount", Number(event.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-700">Designation</span>
                  <input
                    type="text"
                    value={readString(activeNode.config, "designation")}
                    onChange={(event) => updateConfig("designation", event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                    placeholder="Any fund"
                  />
                </label>
              </div>
            )}

            {activeNode.kind === "trigger.donor_lapsed" && (
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Days since last donation</span>
                <input
                  type="number"
                  min={1}
                  value={readNumber(activeNode.config, "daysSinceLastGift", 365)}
                  onChange={(event) => updateConfig("daysSinceLastGift", Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                />
              </label>
            )}

            {activeNode.kind === "trigger.pledge_due" && (
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-700">Due window</span>
                  <input
                    type="number"
                    min={0}
                    value={readNumber(activeNode.config, "dueWithinDays", 14)}
                    onChange={(event) => updateConfig("dueWithinDays", Number(event.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-700">Minimum pledge</span>
                  <input
                    type="number"
                    min={0}
                    value={readNumber(activeNode.config, "minimumPledgeAmount", 0)}
                    onChange={(event) => updateConfig("minimumPledgeAmount", Number(event.target.value))}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  />
                </label>
              </div>
            )}

            {activeNode.kind === "trigger.event_attended" && (
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Event name or type</span>
                <input
                  type="text"
                  value={readString(activeNode.config, "eventFilter")}
                  onChange={(event) => updateConfig("eventFilter", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  placeholder="Any event"
                />
              </label>
            )}

            {activeNode.kind === "trigger.manual_enrollment" && (
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Enrollment note</span>
                <input
                  type="text"
                  value={readString(activeNode.config, "enrollmentNote")}
                  onChange={(event) => updateConfig("enrollmentNote", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  placeholder="Staff manually enrolls a constituent"
                />
              </label>
            )}
          </div>
        )}

        {activeNode.kind === "timing.until_date" && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-xs font-semibold text-slate-700">Wait until date</p>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Date and time</span>
              <input
                type="datetime-local"
                value={toDateTimeLocalInput(readString(activeNode.config, "dateIso") || readString(activeNode.config, "date"))}
                onChange={(event) => {
                  const nextIso = fromDateTimeLocalInput(event.target.value);
                  updateConfigEntries({
                    mode: "until_date",
                    dateIso: nextIso,
                    date: nextIso,
                  });
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
              />
            </label>
            <p className="text-[11px] text-gray-600">
              This stores config.dateIso for the sequence engine and uses your local timezone while editing.
            </p>
          </div>
        )}

        {activeNode.kind === "timing.until_weekday_time" && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-xs font-semibold text-slate-700">Wait until weekday/time</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Weekday</span>
                <select
                  value={String(readNumber(activeNode.config, "weekday", 1))}
                  onChange={(event) => updateConfig("weekday", Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                >
                  <option value="0">Sunday</option>
                  <option value="1">Monday</option>
                  <option value="2">Tuesday</option>
                  <option value="3">Wednesday</option>
                  <option value="4">Thursday</option>
                  <option value="5">Friday</option>
                  <option value="6">Saturday</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Hour (24h)</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={readNumber(activeNode.config, "hour", 9)}
                  onChange={(event) => updateConfig("hour", Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Minute</span>
              <input
                type="number"
                min={0}
                max={59}
                value={readNumber(activeNode.config, "minute", 0)}
                onChange={(event) => updateConfig("minute", Number(event.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
              />
            </label>
          </div>
        )}

        {activeNode.kind === "timing.after_last_gift" && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-xs font-semibold text-slate-700">After last donation delay</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Amount</span>
                <input
                  type="number"
                  min={1}
                  value={readNumber(activeNode.config, "amount", 30)}
                  onChange={(event) => updateConfig("amount", Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Unit</span>
                <select
                  value={readString(activeNode.config, "unit") || "days"}
                  onChange={(event) => updateConfig("unit", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                >
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {activeNode.kind === "task.create" && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-xs font-semibold text-slate-700">Task controls</p>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Task title</span>
              <input
                type="text"
                value={readString(activeNode.config, "title")}
                onChange={(event) => updateConfig("title", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Priority</span>
              <select
                value={readString(activeNode.config, "priority") || "MEDIUM"}
                onChange={(event) => updateConfig("priority", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </label>
          </div>
        )}

        {activeNode.kind === "print.generate_letter" && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-xs font-semibold text-slate-700">Print template controls</p>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Search templates</span>
              <input
                type="text"
                value={templateSearch}
                onChange={(event) => setTemplateSearch(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                placeholder="Search by template name"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Letter template</span>
              <select
                value={readString(activeNode.config, "templateId")}
                onChange={(event) => {
                  const nextId = event.target.value;
                  const selected = letterTemplates.find((item) => item.id === nextId) ?? null;
                  updateConfigEntries({
                    templateId: nextId,
                    templateName: selected?.name ?? "",
                    templateStatus: selected?.status ?? "",
                  });
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
              >
                <option value="">Select a template</option>
                {letterTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Template ID (manual override)</span>
              <input
                type="text"
                value={readString(activeNode.config, "templateId")}
                onChange={(event) => updateConfig("templateId", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                placeholder="Open Letters & Printables to copy a template ID"
              />
            </label>
            <div className="rounded-md border border-gray-200 bg-white p-2 text-[11px] text-gray-700 space-y-1">
              <p><span className="font-semibold">Linked template:</span> {readString(activeNode.config, "templateName") || "Not linked"}</p>
              <p><span className="font-semibold">Template status:</span> {readString(activeNode.config, "templateStatus") || "Unknown"}</p>
              <Link
                href="/letters-printables"
                className="inline-flex rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
              >
                Open Letters & Printables
              </Link>
            </div>
            {templatesLoading ? <p className="text-[11px] text-gray-600">Loading templates...</p> : null}
            {templateError ? <p className="text-[11px] text-rose-700">{templateError}</p> : null}
          </div>
        )}

        {activeNode.kind === "email.create_draft" && (
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-amber-900">Email draft safety</p>
                <p className="text-xs text-amber-800">
                  Outbound email stays draft-first and review-first by default. Open the builder to edit, save, preview, and test this draft.
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${draftSavedAt ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                {draftSavedAt ? "Saved" : "Draft"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isDemoCampaignLinked) {
                    updateConfigEntries({
                      campaignId: "",
                      campaignName: "",
                      campaignStatus: "DRAFT",
                    });
                  }
                  setEmailBuilderOpen(true);
                }}
                className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Open Builder
              </button>
              <Link
                href={builderCampaignId ? `/email-builder?campaign=${encodeURIComponent(builderCampaignId)}` : "/email-builder"}
                className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-center text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                Full Builder
              </Link>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Search campaign</span>
              <input
                type="text"
                value={campaignSearch}
                onChange={(event) => setCampaignSearch(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                placeholder="Search by campaign name"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Email campaign (optional)</span>
              <select
                value={readString(activeNode.config, "campaignId")}
                onChange={(event) => {
                  const nextId = event.target.value;
                  const selected = emailCampaigns.find((item) => item.id === nextId) ?? null;
                  updateConfigEntries({
                    campaignId: nextId,
                    campaignName: selected?.name ?? "",
                    campaignStatus: selected?.status ?? "",
                  });
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
              >
                <option value="">Not linked</option>
                {createDraftCampaignOptions.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Campaign ID (manual override)</span>
              <input
                type="text"
                value={readString(activeNode.config, "campaignId")}
                onChange={(event) => updateConfig("campaignId", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                placeholder="Open Communications to copy campaign ID"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Draft subject template</span>
              <input
                type="text"
                value={readString(activeNode.config, "subjectTemplate")}
                onChange={(event) => updateConfig("subjectTemplate", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                placeholder="Thanks for your support, {{firstName}}"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Review assignee</span>
              <input
                type="text"
                value={readString(activeNode.config, "reviewAssignee")}
                onChange={(event) => updateConfig("reviewAssignee", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                placeholder="Development Director"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Body template</span>
              <textarea
                value={readString(activeNode.config, "bodyTemplate")}
                onChange={(event) => updateConfig("bodyTemplate", event.target.value)}
                rows={4}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                placeholder="Hello {{firstName}},\n\nThank you for your support..."
              />
            </label>
            <div className="rounded-md border border-amber-300/80 bg-white p-2">
              <p className="text-xs font-semibold text-amber-900">Content block settings</p>
              <div className="mt-2 space-y-2">
                <label className="block">
                  <span className="text-xs font-medium text-slate-700">Preheader text</span>
                  <input
                    type="text"
                    value={readString(activeNode.config, "preheaderText")}
                    onChange={(event) => updateConfig("preheaderText", event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-700">Layout</span>
                  <select
                    value={readString(activeNode.config, "contentLayout") || "single-column"}
                    onChange={(event) => updateConfig("contentLayout", event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                  >
                    <option value="single-column">Single column</option>
                    <option value="two-column">Two column</option>
                    <option value="narrative">Narrative</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">CTA label</span>
                    <input
                      type="text"
                      value={readString(activeNode.config, "ctaLabel")}
                      onChange={(event) => updateConfig("ctaLabel", event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-slate-700">CTA URL</span>
                    <input
                      type="text"
                      value={readString(activeNode.config, "ctaUrl")}
                      onChange={(event) => updateConfig("ctaUrl", event.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                    />
                  </label>
                </div>
                <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={Boolean(activeNode.config.includeUnsubscribeLink ?? true)}
                    onChange={(event) => updateConfig("includeUnsubscribeLink", event.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Include unsubscribe link in draft content
                </label>
              </div>
            </div>
            <div className="rounded-md border border-amber-300/80 bg-white p-2 text-[11px] text-amber-900 space-y-1">
              <p><span className="font-semibold">Linked campaign:</span> {readString(activeNode.config, "campaignName") || "Not linked"}</p>
              <p><span className="font-semibold">Campaign status:</span> {readString(activeNode.config, "campaignStatus") || "Unknown"}</p>
              <p><span className="font-semibold">Review assignee:</span> {readString(activeNode.config, "reviewAssignee") || "Not assigned"}</p>
              <p><span className="font-semibold">Last saved:</span> {draftSavedAt ? new Date(draftSavedAt).toLocaleString() : "Not saved from builder yet"}</p>
              <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-700">
                <p className="font-semibold text-slate-900">Preview</p>
                <p className="mt-1 truncate"><span className="font-semibold">Subject:</span> {readString(activeNode.config, "subjectTemplate") || activeNode.title}</p>
                <p className="mt-1 line-clamp-3 whitespace-pre-line text-slate-600">
                  {readString(activeNode.config, "bodyTemplate") || "Open the builder to compose this review-required email draft."}
                </p>
              </div>
              <Link
                href="/communications"
                className="inline-flex rounded-md border border-amber-300 px-2 py-1 text-[11px] font-medium text-amber-900 hover:bg-amber-100"
              >
                Open Communications
              </Link>
            </div>
            {campaignsLoading ? <p className="text-[11px] text-gray-700">Loading campaigns...</p> : null}
            {campaignError ? <p className="text-[11px] text-rose-700">{campaignError}</p> : null}
          </div>
        )}

        {activeNode.kind === "email.schedule_blast" && (
          <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs font-semibold text-blue-900">Campaign scheduling</p>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Search campaign</span>
              <input
                type="text"
                value={campaignSearch}
                onChange={(event) => setCampaignSearch(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                placeholder="Search by campaign name"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Email campaign</span>
              <select
                value={readString(activeNode.config, "campaignId")}
                onChange={(event) => {
                  const nextId = event.target.value;
                  const selected = emailCampaigns.find((item) => item.id === nextId) ?? null;
                  updateConfigEntries({
                    campaignId: nextId,
                    campaignName: selected?.name ?? "",
                    campaignStatus: selected?.status ?? "",
                  });
                }}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
              >
                <option value="">Select campaign</option>
                {emailCampaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Campaign ID (manual override)</span>
              <input
                type="text"
                value={readString(activeNode.config, "campaignId")}
                onChange={(event) => updateConfig("campaignId", event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                placeholder="Open Communications to copy campaign ID"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Schedule send date/time (optional)</span>
              <input
                type="datetime-local"
                value={toDateTimeLocalInput(readString(activeNode.config, "scheduleAt"))}
                onChange={(event) => updateConfig("scheduleAt", fromDateTimeLocalInput(event.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
              />
            </label>
            <div className="rounded-md border border-blue-300/80 bg-white p-2 text-[11px] text-blue-900 space-y-1">
              <p><span className="font-semibold">Linked campaign:</span> {readString(activeNode.config, "campaignName") || "Not linked"}</p>
              <p><span className="font-semibold">Campaign status:</span> {readString(activeNode.config, "campaignStatus") || "Unknown"}</p>
              <Link
                href="/communications"
                className="inline-flex rounded-md border border-blue-300 px-2 py-1 text-[11px] font-medium text-blue-900 hover:bg-blue-100"
              >
                Open Communications
              </Link>
            </div>
            {campaignsLoading ? <p className="text-[11px] text-gray-700">Loading campaigns...</p> : null}
            {campaignError ? <p className="text-[11px] text-rose-700">{campaignError}</p> : null}
          </div>
        )}

        {EMAIL_UTILITY_NODE_KINDS.has(activeNode.kind) && (
          <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
            <div>
              <p className="text-xs font-semibold text-blue-900">Email workflow controls</p>
              <p className="mt-0.5 text-[11px] text-blue-800">Configure how this email-related step should behave.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Reviewer or owner</span>
                <input
                  type="text"
                  value={readString(activeNode.config, "owner")}
                  onChange={(event) => updateConfig("owner", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  placeholder="Development Director"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Due / wait days</span>
                <input
                  type="number"
                  min={0}
                  value={readNumber(activeNode.config, "waitDays", activeNode.kind === "email.wait_for_open" ? 7 : 1)}
                  onChange={(event) => updateConfig("waitDays", Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Email sequence or campaign name</span>
              <input
                type="text"
                value={readString(activeNode.config, "sequenceName") || readString(activeNode.config, "campaignName")}
                onChange={(event) => updateConfigEntries({ sequenceName: event.target.value, campaignName: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                placeholder="Welcome Series"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Instruction</span>
              <textarea
                value={readString(activeNode.config, "instruction")}
                onChange={(event) => updateConfig("instruction", event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                placeholder="Describe what staff should review, wait for, or record."
              />
            </label>
          </div>
        )}

        {PRINT_OPERATION_NODE_KINDS.has(activeNode.kind) && (
          <div className="space-y-3 rounded-xl border border-cyan-200 bg-cyan-50 p-3">
            <div>
              <p className="text-xs font-semibold text-cyan-900">Print and mail controls</p>
              <p className="mt-0.5 text-[11px] text-cyan-800">Set queue, approval, and mailing details for this print step.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Queue</span>
                <select
                  value={readString(activeNode.config, "queue") || "standard"}
                  onChange={(event) => updateConfig("queue", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                >
                  <option value="standard">Standard</option>
                  <option value="major-gifts">Major gifts</option>
                  <option value="receipts">Receipts</option>
                  <option value="board-review">Board review</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Owner</span>
                <input
                  type="text"
                  value={readString(activeNode.config, "owner")}
                  onChange={(event) => updateConfig("owner", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  placeholder="Stewardship team"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Print instruction</span>
              <textarea
                value={readString(activeNode.config, "instruction")}
                onChange={(event) => updateConfig("instruction", event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                placeholder="Describe print, approval, or mailing requirements."
              />
            </label>
          </div>
        )}

        {TASK_OPERATION_NODE_KINDS.has(activeNode.kind) && (
          <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50 p-3">
            <div>
              <p className="text-xs font-semibold text-indigo-900">Task workflow controls</p>
              <p className="mt-0.5 text-[11px] text-indigo-800">Configure assignment, completion wait, or escalation behavior.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Assignee</span>
                <input
                  type="text"
                  value={readString(activeNode.config, "assignee")}
                  onChange={(event) => updateConfig("assignee", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  placeholder="Team member or role"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">SLA days</span>
                <input
                  type="number"
                  min={0}
                  value={readNumber(activeNode.config, "slaDays", 3)}
                  onChange={(event) => updateConfig("slaDays", Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Escalation / wait instruction</span>
              <textarea
                value={readString(activeNode.config, "instruction")}
                onChange={(event) => updateConfig("instruction", event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                placeholder="Example: wait until welcome call is completed, then continue."
              />
            </label>
          </div>
        )}

        {DONOR_DATA_NODE_KINDS.has(activeNode.kind) && (
          <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <div>
              <p className="text-xs font-semibold text-emerald-900">Donor data controls</p>
              <p className="mt-0.5 text-[11px] text-emerald-800">Choose exactly what should be written to the donor record.</p>
            </div>
            {(activeNode.kind === "donor.add_tag" || activeNode.kind === "donor.remove_tag") && (
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Tag name</span>
                <input
                  type="text"
                  value={readString(activeNode.config, "tag")}
                  onChange={(event) => updateConfig("tag", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  placeholder="Engaged Donor"
                />
              </label>
            )}
            {activeNode.kind === "donor.update_status" && (
              <label className="block">
                <span className="text-xs font-medium text-slate-700">New donor status</span>
                <select
                  value={readString(activeNode.config, "value") || "ACTIVE"}
                  onChange={(event) => updateConfig("value", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                >
                  <option value="NEW">New</option>
                  <option value="ACTIVE">Active</option>
                  <option value="MAJOR">Major donor</option>
                  <option value="LAPSED">Lapsed</option>
                  <option value="PROSPECT">Prospect</option>
                </select>
              </label>
            )}
            {activeNode.kind === "donor.adjust_engagement_score" && (
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Engagement score</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={readNumber(activeNode.config, "value", 50)}
                  onChange={(event) => updateConfig("value", Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                />
              </label>
            )}
            {activeNode.kind === "donor.add_note" && (
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Note template</span>
                <textarea
                  value={readString(activeNode.config, "noteTemplate")}
                  onChange={(event) => updateConfig("noteTemplate", event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  placeholder="Donor completed this stewardship path step."
                />
              </label>
            )}
          </div>
        )}

        {SAFETY_NODE_KINDS.has(activeNode.kind) && (
          <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-3">
            <div>
              <p className="text-xs font-semibold text-rose-900">Safety and review controls</p>
              <p className="mt-0.5 text-[11px] text-rose-800">Use these guardrails before sensitive or high-touch actions continue.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Approver / notify</span>
                <input
                  type="text"
                  value={readString(activeNode.config, "approver") || readString(activeNode.config, "notify")}
                  onChange={(event) => updateConfigEntries({ approver: event.target.value, notify: event.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                  placeholder="Manager or team"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Priority</span>
                <select
                  value={readString(activeNode.config, "priority") || "MEDIUM"}
                  onChange={(event) => updateConfig("priority", event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-slate-700">Instruction</span>
              <textarea
                value={readString(activeNode.config, "instruction")}
                onChange={(event) => updateConfig("instruction", event.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                placeholder="Explain the approval, pause, notification, or stop condition."
              />
            </label>
          </div>
        )}

        {activeNode.kind === "logic.if_else" && (
          <div className="rounded-xl border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
            Branching visuals and execution persistence are active. Configure lane conditions to control route jumps.
          </div>
        )}

        {/* Notes — always visible at the bottom */}
        <div className="pt-2">
          <label className="block">
            <span className="text-xs font-medium text-slate-700">Notes</span>
            <textarea
              value={activeNode.note ?? ""}
              onChange={(event) => onChange({ ...activeNode, note: event.target.value })}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20 resize-none"
              rows={3}
              placeholder="Add internal notes about this step…"
            />
          </label>
          <p className="mt-1 text-[11px] text-slate-400">These notes are only visible to your team.</p>
        </div>
      </div>
      {emailBuilderOpen && activeNode.kind === "email.create_draft" ? (
        <EmailDraftBuilderModal
          node={activeNode}
          onChange={onChange}
          onClose={() => setEmailBuilderOpen(false)}
        />
      ) : null}
    </aside>
  );
}
