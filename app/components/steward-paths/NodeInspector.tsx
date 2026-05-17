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
import { PALETTE_ITEMS } from "./palette-catalog";
import {
  BRANCH_OPERATOR_OPTIONS,
  getReadinessBadge,
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
}: NodeInspectorProps) {
  const [templateSearch, setTemplateSearch] = useState("");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [letterTemplates, setLetterTemplates] = useState<StewardPathLetterTemplateOption[]>([]);
  const [emailCampaigns, setEmailCampaigns] = useState<StewardPathEmailCampaignOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [campaignError, setCampaignError] = useState<string | null>(null);

  const palette = PALETTE_ITEMS.find((item) => item.kind === node?.kind);
  const badge = getReadinessBadge(palette?.readiness ?? "not-implemented");

  useEffect(() => {
    setTemplateSearch("");
    setCampaignSearch("");
    setTemplateError(null);
    setCampaignError(null);
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
      <aside className="w-[360px] shrink-0 border-l border-gray-200 bg-white">
        <div className="bg-emerald-600 px-4 py-3 text-white">
          <h2 className="text-sm font-semibold">Inspector</h2>
          <p className="mt-0.5 text-xs text-emerald-50">Select a node to edit workflow settings.</p>
        </div>
        <div className="p-4">
          <p className="rounded-md border border-dashed border-gray-300 bg-gray-50 p-3 text-xs text-gray-600">
            Node settings appear here: title, timing, conditions, templates, approval controls, and readiness state.
          </p>
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

  return (
    <aside className="w-[360px] shrink-0 overflow-y-auto border-l border-gray-200 bg-white">
      <div className="border-b border-emerald-500 bg-emerald-600 px-4 py-3 text-white">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold">Inspector</h2>
          <span className="rounded-full border border-white/30 bg-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {badge.label}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-emerald-50">{palette?.label ?? activeNode.kind}</p>
      </div>

      <div className="space-y-3 p-4">
        <label className="block">
          <span className="text-xs font-medium text-gray-700">Title</span>
          <input
            type="text"
            value={activeNode.title}
            onChange={(event) => onChange({ ...activeNode, title: event.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-xs font-medium text-gray-700">Note</span>
          <textarea
            value={activeNode.note ?? ""}
            onChange={(event) => onChange({ ...activeNode, note: event.target.value })}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
            rows={2}
            placeholder="Optional note shown beneath the title."
          />
        </label>

        {isBranchNode(activeNode) && (
          <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
            <p className="text-xs font-semibold text-emerald-800">Branch logic</p>

            <label className="block">
              <span className="text-xs font-medium text-gray-700">Condition field</span>
              <input
                type="text"
                value={readString(activeNode.config, "field") || "lastGiftAmount"}
                onChange={(event) => updateConfig("field", event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                placeholder="Example: lastGiftAmount"
              />
            </label>

            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-gray-700">Branch lanes</p>
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
                      className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs"
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
                      {lane.conditionGroups.map((group) => (
                        <div key={group.id} className="grid grid-cols-[1fr_1fr_auto] gap-1">
                          <select
                            value={group.operator}
                            onChange={(event) => onUpdateConditionGroup(activeNode.id, lane.id, group.id, { operator: event.target.value as WorkflowBranchConditionGroup["operator"] })}
                            className="rounded-md border border-gray-300 px-1.5 py-1 text-[11px]"
                          >
                            {BRANCH_OPERATOR_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={group.value}
                            onChange={(event) => onUpdateConditionGroup(activeNode.id, lane.id, group.id, { value: event.target.value })}
                            className="rounded-md border border-gray-300 px-1.5 py-1 text-[11px]"
                            placeholder="Value"
                          />
                          <button
                            type="button"
                            onClick={() => onRemoveConditionGroup(activeNode.id, lane.id, group.id)}
                            className="rounded-md border border-red-200 px-2 py-1 text-[10px] font-semibold text-red-600 hover:bg-red-50"
                          >
                            x
                          </button>
                          {group.operator === "between" && (
                            <input
                              type="text"
                              value={group.valueTo ?? ""}
                              onChange={(event) => onUpdateConditionGroup(activeNode.id, lane.id, group.id, { valueTo: event.target.value })}
                              className="col-span-2 rounded-md border border-gray-300 px-1.5 py-1 text-[11px]"
                              placeholder="Upper value"
                            />
                          )}
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => onAddConditionGroup(activeNode.id, lane.id)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-[10px] font-semibold text-gray-700 hover:bg-gray-50"
                      >
                        + Add condition group
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeNode.kind === "timing.delay" && (
          <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-700">Timing controls</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Amount</span>
                <input
                  type="number"
                  min={1}
                  value={readNumber(activeNode.config, "amount", 1)}
                  onChange={(event) => updateConfig("amount", Number(event.target.value))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Unit</span>
                <select
                  value={readString(activeNode.config, "unit") || "days"}
                  onChange={(event) => updateConfig("unit", event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
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

        {activeNode.kind === "timing.until_date" && (
          <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-700">Wait until date</p>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Date and time</span>
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
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
            <p className="text-[11px] text-gray-600">
              This stores config.dateIso for the sequence engine and uses your local timezone while editing.
            </p>
          </div>
        )}

        {activeNode.kind === "timing.until_weekday_time" && (
          <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-700">Wait until weekday/time</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Weekday</span>
                <select
                  value={String(readNumber(activeNode.config, "weekday", 1))}
                  onChange={(event) => updateConfig("weekday", Number(event.target.value))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
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
                <span className="text-xs font-medium text-gray-700">Hour (24h)</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={readNumber(activeNode.config, "hour", 9)}
                  onChange={(event) => updateConfig("hour", Number(event.target.value))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Minute</span>
              <input
                type="number"
                min={0}
                max={59}
                value={readNumber(activeNode.config, "minute", 0)}
                onChange={(event) => updateConfig("minute", Number(event.target.value))}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
          </div>
        )}

        {activeNode.kind === "timing.after_last_gift" && (
          <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-700">After last donation delay</p>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Amount</span>
                <input
                  type="number"
                  min={1}
                  value={readNumber(activeNode.config, "amount", 30)}
                  onChange={(event) => updateConfig("amount", Number(event.target.value))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-700">Unit</span>
                <select
                  value={readString(activeNode.config, "unit") || "days"}
                  onChange={(event) => updateConfig("unit", event.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
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
          <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-700">Task controls</p>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Task title</span>
              <input
                type="text"
                value={readString(activeNode.config, "title")}
                onChange={(event) => updateConfig("title", event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Priority</span>
              <select
                value={readString(activeNode.config, "priority") || "MEDIUM"}
                onChange={(event) => updateConfig("priority", event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </label>
          </div>
        )}

        {activeNode.kind === "print.generate_letter" && (
          <div className="space-y-2 rounded-md border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold text-gray-700">Print template controls</p>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Search templates</span>
              <input
                type="text"
                value={templateSearch}
                onChange={(event) => setTemplateSearch(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                placeholder="Search by template name"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Letter template</span>
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
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="">Select a template</option>
                {letterTemplates.map((template) => (
                  <option key={template.id} value={template.id}>{template.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Template ID (manual override)</span>
              <input
                type="text"
                value={readString(activeNode.config, "templateId")}
                onChange={(event) => updateConfig("templateId", event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                placeholder="Open Letters & Printables to copy a template ID"
              />
            </label>
            <div className="rounded-md border border-gray-200 bg-white p-2 text-[11px] text-gray-700 space-y-1">
              <p><span className="font-semibold">Linked template:</span> {readString(activeNode.config, "templateName") || "Not linked"}</p>
              <p><span className="font-semibold">Template status:</span> {readString(activeNode.config, "templateStatus") || "Unknown"}</p>
              <a
                href="/letters-printables"
                className="inline-flex rounded-md border border-gray-300 px-2 py-1 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
              >
                Open Letters & Printables
              </a>
            </div>
            {templatesLoading ? <p className="text-[11px] text-gray-600">Loading templates...</p> : null}
            {templateError ? <p className="text-[11px] text-rose-700">{templateError}</p> : null}
          </div>
        )}

        {activeNode.kind === "email.create_draft" && (
          <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-900">Email draft safety</p>
            <p className="text-xs text-amber-800">
              Outbound email stays draft-first and review-first by default. Select templates and reviewer routing in Communications before final send.
            </p>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Search campaign</span>
              <input
                type="text"
                value={campaignSearch}
                onChange={(event) => setCampaignSearch(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                placeholder="Search by campaign name"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Email campaign (optional)</span>
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
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="">Not linked</option>
                {emailCampaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Campaign ID (manual override)</span>
              <input
                type="text"
                value={readString(activeNode.config, "campaignId")}
                onChange={(event) => updateConfig("campaignId", event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                placeholder="Open Communications to copy campaign ID"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Draft subject template</span>
              <input
                type="text"
                value={readString(activeNode.config, "subjectTemplate")}
                onChange={(event) => updateConfig("subjectTemplate", event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                placeholder="Thanks for your support, {{firstName}}"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Body template</span>
              <textarea
                value={readString(activeNode.config, "bodyTemplate")}
                onChange={(event) => updateConfig("bodyTemplate", event.target.value)}
                rows={4}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                placeholder="Hello {{firstName}},\n\nThank you for your support..."
              />
            </label>
            <div className="rounded-md border border-amber-300/80 bg-white p-2">
              <p className="text-xs font-semibold text-amber-900">Content block settings</p>
              <div className="mt-2 space-y-2">
                <label className="block">
                  <span className="text-xs font-medium text-gray-700">Preheader text</span>
                  <input
                    type="text"
                    value={readString(activeNode.config, "preheaderText")}
                    onChange={(event) => updateConfig("preheaderText", event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-700">Layout</span>
                  <select
                    value={readString(activeNode.config, "contentLayout") || "single-column"}
                    onChange={(event) => updateConfig("contentLayout", event.target.value)}
                    className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                  >
                    <option value="single-column">Single column</option>
                    <option value="two-column">Two column</option>
                    <option value="narrative">Narrative</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className="text-xs font-medium text-gray-700">CTA label</span>
                    <input
                      type="text"
                      value={readString(activeNode.config, "ctaLabel")}
                      onChange={(event) => updateConfig("ctaLabel", event.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-gray-700">CTA URL</span>
                    <input
                      type="text"
                      value={readString(activeNode.config, "ctaUrl")}
                      onChange={(event) => updateConfig("ctaUrl", event.target.value)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
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
              <span className="text-xs font-medium text-gray-700">Search campaign</span>
              <input
                type="text"
                value={campaignSearch}
                onChange={(event) => setCampaignSearch(event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                placeholder="Search by campaign name"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Email campaign</span>
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
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                <option value="">Select campaign</option>
                {emailCampaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Campaign ID (manual override)</span>
              <input
                type="text"
                value={readString(activeNode.config, "campaignId")}
                onChange={(event) => updateConfig("campaignId", event.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                placeholder="Open Communications to copy campaign ID"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Schedule send date/time (optional)</span>
              <input
                type="datetime-local"
                value={toDateTimeLocalInput(readString(activeNode.config, "scheduleAt"))}
                onChange={(event) => updateConfig("scheduleAt", fromDateTimeLocalInput(event.target.value))}
                className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
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

        {activeNode.kind === "logic.if_else" && (
          <div className="rounded-md border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
            Branching visuals and execution persistence are active. Configure lane conditions to control route jumps.
          </div>
        )}
      </div>
    </aside>
  );
}
