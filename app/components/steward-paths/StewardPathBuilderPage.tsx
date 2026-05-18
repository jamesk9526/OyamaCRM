/**
 * StewardPathBuilderPage orchestrates the visual workflow builder shell.
 */
"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import NodeInspector from "./NodeInspector";
import NodePalette from "./NodePalette";
import PageInfoButton from "./PageInfoButton";
import { PALETTE_ITEMS } from "./palette-catalog";
import WorkflowCanvas from "./WorkflowCanvas";
import { describeInsertTarget } from "./workflow-layout";
import {
  analyzeWorkflowSupport,
  fromBackendTemplate,
  toLinearWorkflowExport,
  type BackendStewardPathTemplateResponse,
} from "./workflow-transformers";
import {
  addBranchLane,
  addBranchLaneConditionGroup,
  createNodeFromPalette,
  createWorkflowDocument,
  insertNodeAtTarget,
  moveNodeInContainer,
  relocateNode,
  removeBranchLane,
  removeBranchLaneConditionGroup,
  removeNode as removeWorkflowNode,
  renameBranchLane,
  setBranchFallbackLane,
  updateBranchLaneConditionGroup,
  updateNode as updateWorkflowNode,
} from "./workflow-utils";
import type {
  NodeInsertTarget,
  NodePaletteItem,
  WorkflowBranchConditionGroup,
  WorkflowDocument,
  WorkflowNode,
} from "./workflow-types";
import type { WorkflowContainerRef } from "./workflow-utils";
import { apiFetch } from "@/app/lib/auth-client";
import {
  ENGAGEMENT_STATUS_LEGEND,
} from "@/app/lib/engagement-status";

/** Generates ids for transient visual nodes/lanes and local document metadata. */
function makeBuilderId(): string {
  return `wf_${Math.random().toString(36).slice(2, 10)}`;
}

/** Converts one Date into a compact user-facing timestamp. */
function formatSavedAt(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleString();
}

/** Returns true when a node kind belongs to the "action" phase for quick progress hints. */
function isActionKind(kind: string): boolean {
  return kind.startsWith("email.")
    || kind.startsWith("print.")
    || kind.startsWith("task.")
    || kind.startsWith("donor.")
    || kind.startsWith("safety.");
}

type QuickStartPresetKey = "donor-welcome" | "lapsed-reengagement" | "event-follow-up";

interface QuickStartStepPreset {
  kind: string;
  title?: string;
  note?: string;
  config?: Record<string, unknown>;
}

interface QuickStartPreset {
  key: QuickStartPresetKey;
  name: string;
  pathName: string;
  audienceLabel: string;
  steps: QuickStartStepPreset[];
}

const QUICK_START_PRESETS: QuickStartPreset[] = [
  {
    key: "donor-welcome",
    name: "Donor Welcome",
    pathName: "Donor Welcome Journey",
    audienceLabel: "New donors",
    steps: [
      { kind: "trigger.new_donation", title: "New donation received" },
      { kind: "timing.delay", title: "Wait 2 days", config: { amount: 2, unit: "days" } },
      { kind: "email.create_draft", title: "Create thank-you draft", note: "Draft-first thank-you with personalization tokens." },
      { kind: "task.create", title: "Assign welcome call", config: { title: "Call donor to say thank you", priority: "MEDIUM" } },
    ],
  },
  {
    key: "lapsed-reengagement",
    name: "Lapsed Reengagement",
    pathName: "Lapsed Donor Reengagement",
    audienceLabel: "Lapsed donors",
    steps: [
      { kind: "trigger.donor_lapsed", title: "Donor lapsed trigger" },
      { kind: "logic.if_else", title: "Branch by last gift amount", config: { field: "lastGiftAmount" } },
      { kind: "email.create_draft", title: "Create re-engagement draft", note: "Personalize by donor history and stewardship tone." },
      { kind: "task.create", title: "Major donor follow-up task", config: { title: "Follow up with lapsed major donor", priority: "HIGH" } },
    ],
  },
  {
    key: "event-follow-up",
    name: "Event Follow-up",
    pathName: "Event Attendance Follow-up",
    audienceLabel: "Event attendees",
    steps: [
      { kind: "trigger.event_attended", title: "Event attendance captured" },
      { kind: "timing.delay", title: "Wait 1 day", config: { amount: 1, unit: "days" } },
      { kind: "email.create_draft", title: "Create post-event draft" },
      { kind: "print.generate_letter", title: "Generate follow-up letter", config: { templateId: "" } },
    ],
  },
];

/** Builds a starter visual workflow document from a quick-start preset key. */
function buildQuickStartDocument(
  presetKey: string,
  idFactory: () => string,
): WorkflowDocument | null {
  const preset = QUICK_START_PRESETS.find((item) => item.key === presetKey);
  if (!preset) return null;

  let nextDoc = createWorkflowDocument(idFactory);
  nextDoc = {
    ...nextDoc,
    pathName: preset.pathName,
    audienceLabel: preset.audienceLabel,
    status: "draft",
  };

  for (const step of preset.steps) {
    const paletteItem = PALETTE_ITEMS.find((item) => item.kind === step.kind);
    if (!paletteItem) continue;

    const baseNode = createNodeFromPalette(paletteItem, idFactory);
    const nextNode: WorkflowNode = {
      ...baseNode,
      title: step.title ?? baseNode.title,
      note: step.note ?? baseNode.note,
      config: {
        ...baseNode.config,
        ...(step.config ?? {}),
      },
    };

    nextDoc = insertNodeAtTarget(nextDoc, { kind: "root-end" }, nextNode);
  }

  return nextDoc;
}

/** Three-panel builder with top controls, map canvas, and inspector drawer. */
export default function StewardPathBuilderPage({ templateIdFromRoute }: { templateIdFromRoute?: string }) {
  const searchParams = useSearchParams();
  const templateIdFromQuery = templateIdFromRoute || searchParams.get("templateId") || searchParams.get("pathId");
  const quickStartFromQuery = searchParams.get("quickStart");
  const isFullscreenCanvas = searchParams.get("canvas") === "fullscreen";

  const [doc, setDoc] = useState<WorkflowDocument>(() => createWorkflowDocument(makeBuilderId));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [insertTarget, setInsertTarget] = useState<NodeInsertTarget | null>({ kind: "root-end" });
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"save" | "activate" | "test" | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const supportReport = useMemo(() => analyzeWorkflowSupport(doc), [doc]);
  const insertTargetLabel = useMemo(() => describeInsertTarget(doc, insertTarget), [doc, insertTarget]);
  const allNodes = useMemo(() => Object.values(doc.nodesById), [doc.nodesById]);
  const stageProgress = useMemo(() => {
    const hasTrigger = allNodes.some((node) => node.kind.startsWith("trigger."));
    const hasCondition = allNodes.some((node) => node.kind === "logic.if_else");
    const hasAction = allNodes.some((node) => isActionKind(node.kind));
    const hasDelay = allNodes.some((node) => node.kind.startsWith("timing."));
    return { hasTrigger, hasCondition, hasAction, hasDelay };
  }, [allNodes]);

  const lifecycleState = useMemo<"draft" | "needs-review" | "active" | "paused" | "error">(() => {
    const hasError = Boolean(feedbackMessage && /fail|error|blocked/i.test(feedbackMessage));
    if (hasError) return "error";
    if (doc.status === "active") return "active";
    if (doc.status === "archived") return "paused";
    if (!supportReport.canActivate) return "needs-review";
    return "draft";
  }, [doc.status, feedbackMessage, supportReport.canActivate]);

  const selectedNode = useMemo(
    () => (selectedNodeId ? doc.nodesById[selectedNodeId] ?? null : null),
    [doc.nodesById, selectedNodeId],
  );

  /** Persists the current linear workflow to steward-paths APIs and returns template id. */
  const persistLinearWorkflow = useCallback(async (silent = false): Promise<string | null> => {
    try {
      const exportPayload = toLinearWorkflowExport(doc);
      if (!exportPayload.report.canSaveLinear) {
        if (!silent) {
          setFeedbackMessage(exportPayload.report.reasons[0] ?? "Workflow is not currently saveable.");
        }
        return null;
      }

      let templateId = doc.persistence.templateId;

      if (!templateId) {
        const created = await apiFetch<BackendStewardPathTemplateResponse>("/api/steward-paths/templates", {
          method: "POST",
          body: JSON.stringify(exportPayload.template),
        });
        templateId = created.id;
      } else {
        await apiFetch<BackendStewardPathTemplateResponse>(`/api/steward-paths/templates/${templateId}`, {
          method: "PATCH",
          body: JSON.stringify(exportPayload.template),
        });

        const existing = await apiFetch<BackendStewardPathTemplateResponse>(`/api/steward-paths/templates/${templateId}`);
        const activeStepIds = existing.steps
          .filter((step) => step.isActive !== false)
          .map((step) => step.id);

        for (const stepId of activeStepIds) {
          await apiFetch<void>(`/api/steward-paths/templates/${templateId}/steps/${stepId}`, {
            method: "DELETE",
          });
        }
      }

      for (const step of exportPayload.steps) {
        await apiFetch(`/api/steward-paths/templates/${templateId}/steps`, {
          method: "POST",
          body: JSON.stringify(step),
        });
      }

      const lastSavedAt = new Date().toISOString();
      setDoc((prev) => ({
        ...prev,
        persistence: {
          ...prev.persistence,
          mode: "api",
          templateId,
          lastSavedAt,
        },
      }));

      if (!silent) {
        setFeedbackMessage("Save Draft completed. Linear workflow persisted to /api/steward-paths.");
      }

      return templateId;
    } catch (error) {
      if (!silent) {
        setFeedbackMessage(error instanceof Error ? error.message : "Failed to save workflow.");
      }
      return null;
    }
  }, [doc]);

  /** Adds a new node from the palette at the current insertion target. */
  const addNode = useCallback((item: NodePaletteItem) => {
    const next = createNodeFromPalette(item, makeBuilderId);
    const resolvedTarget = insertTarget
      ?? (selectedNodeId ? { kind: "after-node", nodeId: selectedNodeId } as NodeInsertTarget : { kind: "root-end" });

    setDoc((prev) => insertNodeAtTarget(prev, resolvedTarget, next));
    setSelectedNodeId(next.id);
    setInsertTarget({ kind: "after-node", nodeId: next.id });
    setFeedbackMessage(`Added ${item.label}.`);
  }, [insertTarget, selectedNodeId]);

  /** Adds a palette node at an explicit target (used by drop zones). */
  const addNodeAtTarget = useCallback((item: NodePaletteItem, target: NodeInsertTarget) => {
    const next = createNodeFromPalette(item, makeBuilderId);
    setDoc((prev) => insertNodeAtTarget(prev, target, next));
    setSelectedNodeId(next.id);
    setInsertTarget({ kind: "after-node", nodeId: next.id });
    setFeedbackMessage(`Added ${item.label}.`);
  }, []);

  /** Writes one node update from the inspector back into the workflow document. */
  const patchNode = useCallback((next: WorkflowNode) => {
    setDoc((prev) => updateWorkflowNode(prev, next.id, next));
  }, []);

  /** Moves one node up/down within its current root or lane container. */
  const moveNode = useCallback((nodeId: string, delta: -1 | 1) => {
    setDoc((prev) => moveNodeInContainer(prev, nodeId, delta));
  }, []);

  /** Removes one node and any nested descendants from the workflow document. */
  const deleteNode = useCallback((nodeId: string) => {
    setDoc((prev) => removeWorkflowNode(prev, nodeId));
    setSelectedNodeId((current) => (current === nodeId ? null : current));
    setInsertTarget({ kind: "root-end" });
  }, []);

  /** Handles dropping an existing node into a container/index. */
  const handleDropNode = useCallback((nodeId: string, container: WorkflowContainerRef, index: number) => {
    setDoc((prev) => relocateNode(prev, nodeId, container, index));
    setSelectedNodeId(nodeId);
    if (container.kind === "root") {
      const fallbackIndex = Math.max(index - 1, 0);
      const previousNodeId = doc.rootNodeIds[fallbackIndex] ?? nodeId;
      setInsertTarget({ kind: "after-node", nodeId: previousNodeId });
    }
  }, [doc.rootNodeIds]);

  /** Handles dropping one palette block kind into a concrete map target. */
  const handleDropPaletteKind = useCallback((kind: string, target: NodeInsertTarget) => {
    const item = PALETTE_ITEMS.find((candidate) => candidate.kind === kind);
    if (!item) return;
    addNodeAtTarget(item, target);
  }, [addNodeAtTarget]);

  /** Saves workflow draft with busy state and user feedback. */
  const saveDraft = useCallback(async () => {
    setBusyAction("save");
    try {
      await persistLinearWorkflow(false);
    } finally {
      setBusyAction(null);
    }
  }, [persistLinearWorkflow]);

  /** Activates the workflow after ensuring persistence and support checks. */
  const activateWorkflow = useCallback(async () => {
    if (!supportReport.canActivate) {
      setFeedbackMessage(supportReport.reasons[0] ?? "Activation is blocked for this workflow.");
      return;
    }

    setBusyAction("activate");
    try {
      const templateId = doc.persistence.templateId ?? await persistLinearWorkflow(true);
      if (!templateId) {
        setFeedbackMessage("Save Draft failed. Activation was not performed.");
        return;
      }

      await apiFetch(`/api/steward-paths/templates/${templateId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "ACTIVE" }),
      });

      setDoc((prev) => ({ ...prev, status: "active" }));
      setFeedbackMessage("Workflow activated.");
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : "Failed to activate workflow.");
    } finally {
      setBusyAction(null);
    }
  }, [doc.persistence.templateId, persistLinearWorkflow, supportReport.canActivate, supportReport.reasons]);

  /** Starts a manual test enrollment for a provided constituent id. */
  const runTestEnrollment = useCallback(async () => {
    const templateId = doc.persistence.templateId;
    if (!templateId) {
      setFeedbackMessage("Save Draft first, then run a test enrollment.");
      return;
    }

    const constituentId = window.prompt("Enter a constituent ID for test enrollment:")?.trim();
    if (!constituentId) return;

    setBusyAction("test");
    try {
      await apiFetch(`/api/steward-paths/templates/${templateId}/enrollments`, {
        method: "POST",
        body: JSON.stringify({
          targetId: constituentId,
          targetType: "CONSTITUENT",
          constituentId,
        }),
      });
      setDoc((prev) => ({ ...prev, status: "test-mode" }));
      setFeedbackMessage(`Test enrollment started for constituent ${constituentId}.`);
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : "Failed to start test enrollment.");
    } finally {
      setBusyAction(null);
    }
  }, [doc.persistence.templateId]);

  /** Loads an existing template when pathId/templateId query parameter is present. */
  useEffect(() => {
    if (!templateIdFromQuery) return;

    let cancelled = false;

    async function loadTemplate(): Promise<void> {
      setLoadingTemplate(true);
      try {
        const template = await apiFetch<BackendStewardPathTemplateResponse>(`/api/steward-paths/templates/${templateIdFromQuery}`);
        if (cancelled) return;

        const loadedDoc = fromBackendTemplate(template, makeBuilderId);
        setDoc(loadedDoc);
        setSelectedNodeId(loadedDoc.rootNodeIds[0] ?? null);
        setInsertTarget({ kind: "root-end" });
        setFeedbackMessage(`Loaded workflow template: ${template.name}.`);
      } catch (error) {
        if (cancelled) return;
        setFeedbackMessage(error instanceof Error ? error.message : "Failed to load template.");
      } finally {
        if (!cancelled) setLoadingTemplate(false);
      }
    }

    void loadTemplate();

    return () => {
      cancelled = true;
    };
  }, [templateIdFromQuery]);

  /** Applies one quick-start preset when requested from query string and no template id is loaded. */
  useEffect(() => {
    if (templateIdFromQuery) return;
    if (!quickStartFromQuery) return;

    const nextDoc = buildQuickStartDocument(quickStartFromQuery, makeBuilderId);
    if (!nextDoc) {
      setFeedbackMessage("Unknown quick-start preset. Opening blank builder.");
      return;
    }

    setDoc(nextDoc);
    setSelectedNodeId(nextDoc.rootNodeIds[0] ?? null);
    setInsertTarget({ kind: "root-end" });
    setFeedbackMessage(`Quick-start loaded: ${nextDoc.pathName}.`);
  }, [quickStartFromQuery, templateIdFromQuery]);

  /** Updates branch lane labels. */
  const renameLane = useCallback((branchNodeId: string, laneId: string, label: string) => {
    setDoc((prev) => renameBranchLane(prev, branchNodeId, laneId, label));
  }, []);

  /** Adds a branch lane to the selected branch node. */
  const appendBranchLane = useCallback((branchNodeId: string) => {
    setDoc((prev) => addBranchLane(prev, branchNodeId, "New lane", makeBuilderId));
  }, []);

  /** Removes one branch lane and descendants. */
  const deleteBranchLane = useCallback((branchNodeId: string, laneId: string) => {
    setDoc((prev) => removeBranchLane(prev, branchNodeId, laneId));
  }, []);

  /** Marks a lane as fallback/otherwise. */
  const setFallbackLane = useCallback((branchNodeId: string, laneId: string) => {
    setDoc((prev) => setBranchFallbackLane(prev, branchNodeId, laneId));
  }, []);

  /** Adds one new condition group row to a lane. */
  const appendConditionGroup = useCallback((branchNodeId: string, laneId: string) => {
    setDoc((prev) => addBranchLaneConditionGroup(prev, branchNodeId, laneId, makeBuilderId));
  }, []);

  /** Removes one condition group row from a lane. */
  const deleteConditionGroup = useCallback((branchNodeId: string, laneId: string, conditionGroupId: string) => {
    setDoc((prev) => removeBranchLaneConditionGroup(prev, branchNodeId, laneId, conditionGroupId));
  }, []);

  /** Updates one condition group field. */
  const patchConditionGroup = useCallback((
    branchNodeId: string,
    laneId: string,
    conditionGroupId: string,
    partial: Partial<WorkflowBranchConditionGroup>,
  ) => {
    setDoc((prev) => updateBranchLaneConditionGroup(
      prev,
      branchNodeId,
      laneId,
      conditionGroupId,
      partial,
    ));
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              <span className="font-semibold uppercase tracking-wide text-gray-600">Steward Paths</span>
              <span>/</span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5">Visual Builder</span>
              {doc.persistence.templateId && (
                <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-[10px] text-gray-600">
                  {doc.persistence.templateId}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={doc.pathName}
                onChange={(event) => setDoc((prev) => ({ ...prev, pathName: event.target.value }))}
                className="border-b border-transparent bg-transparent px-1 text-base font-semibold text-gray-900 outline-none focus:border-gray-300"
              />
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800">
                Visual Canvas
              </span>
              {doc.status === "test-mode" && (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-medium text-indigo-800">
                  Test Mode
                </span>
              )}
              {loadingTemplate && (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                  Loading template...
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: "draft", label: "Draft" },
                { key: "needs-review", label: "Needs Review" },
                { key: "active", label: "Active" },
                { key: "paused", label: "Paused" },
                { key: "error", label: "Error" },
              ].map((item) => (
                <span
                  key={item.key}
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    lifecycleState === item.key
                      ? item.key === "active"
                        ? "border-green-300 bg-green-100 text-green-800"
                        : item.key === "needs-review"
                          ? "border-amber-300 bg-amber-100 text-amber-800"
                          : item.key === "paused"
                            ? "border-slate-300 bg-slate-100 text-slate-700"
                            : item.key === "error"
                              ? "border-rose-300 bg-rose-100 text-rose-800"
                              : "border-sky-300 bg-sky-100 text-sky-800"
                      : "border-gray-200 bg-gray-50 text-gray-500"
                  }`}
                >
                  {item.label}
                </span>
              ))}
            </div>

            <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Build path flow
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {[
                  { label: "Trigger", complete: stageProgress.hasTrigger },
                  { label: "Conditions", complete: stageProgress.hasCondition },
                  { label: "Actions", complete: stageProgress.hasAction },
                  { label: "Delays", complete: stageProgress.hasDelay },
                ].map((item, index, list) => (
                  <div key={item.label} className="inline-flex items-center gap-1.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 font-semibold ${
                        item.complete
                          ? "border-emerald-300 bg-emerald-100 text-emerald-800"
                          : "border-gray-200 bg-white text-gray-600"
                      }`}
                    >
                      {item.complete ? "Done" : "Pending"} {item.label}
                    </span>
                    {index < list.length - 1 && <span className="text-gray-300">→</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-md border border-gray-200 bg-gray-50 p-1">
              {[
                { key: "actions", label: "Actions" },
                { key: "settings", label: "Settings" },
                { key: "history", label: "History" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setDoc((prev) => ({ ...prev, activeTab: tab.key as WorkflowDocument["activeTab"] }))}
                  className={`rounded px-2.5 py-1 text-xs font-semibold ${doc.activeTab === tab.key ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <PageInfoButton
              modalTitle="Steward Paths Legend and Notes"
              intro="Steward Paths orchestrates tasks, letters, and communications. Keep outbound work in draft/review states unless explicitly approved."
              legendTitle="Visual Sequence Builder Language"
              legendItems={ENGAGEMENT_STATUS_LEGEND}
              notesTitle="Developer Notes"
              notes={[
                "Branch visualization and persistence are active.",
                "Save and activation include branch-aware workflow export.",
                "Use drag-and-drop to move nodes between root and branch lanes.",
                "Node workspace routes: /steward-paths and /steward-paths/builder.",
              ]}
              buttonLabel="Legend"
            />

            <Link
              href={`${doc.persistence.templateId ? `/steward-paths/builder/${encodeURIComponent(doc.persistence.templateId)}` : "/steward-paths/builder"}?canvas=fullscreen`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              Full Screen Canvas
            </Link>

            <select
              value={doc.status}
              onChange={(event) => setDoc((prev) => ({ ...prev, status: event.target.value as WorkflowDocument["status"] }))}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs"
            >
              <option value="draft">Draft</option>
              <option value="test-mode">Test Mode</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>

            <button
              type="button"
              onClick={() => {
                void saveDraft();
              }}
              disabled={busyAction !== null}
              title={supportReport.canSaveLinear ? "Save workflow to /api/steward-paths" : (supportReport.reasons[0] ?? "Cannot save this workflow shape yet")}
              className="rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busyAction === "save" ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={() => {
                void runTestEnrollment();
              }}
              disabled={busyAction !== null || !doc.persistence.templateId}
              title={doc.persistence.templateId ? "Start one manual test enrollment" : "Save first to create a template id"}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 disabled:opacity-50"
            >
              {busyAction === "test" ? "Testing..." : "Test Enrollment"}
            </button>
            <button
              type="button"
              onClick={() => {
                void activateWorkflow();
              }}
              disabled={busyAction !== null || !supportReport.canActivate}
              title={supportReport.canActivate ? "Activate workflow" : (supportReport.reasons[0] ?? "Activation blocked")}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 disabled:opacity-50"
            >
              {busyAction === "activate" ? "Activating..." : "Activate"}
            </button>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-[11px] text-gray-600">
          <p>
            Persistence mode: Working
            {" · "}
            Last saved: {formatSavedAt(doc.persistence.lastSavedAt)}
          </p>
          <div className="flex items-center gap-2">
             <Link href="/steward-paths" className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50">
               Saved paths
             </Link>
             {doc.persistence.templateId && (
               <Link
                 href={`/steward-paths/${encodeURIComponent(doc.persistence.templateId)}/history`}
                 className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-50"
               >
                 View history
               </Link>
             )}
           </div>
         </div>

        {feedbackMessage && (
          <div className="mt-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs text-sky-900">
            {feedbackMessage}
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {!isFullscreenCanvas && (
          <NodePalette onAdd={addNode} insertionTargetLabel={insertTargetLabel} />
        )}

        {doc.activeTab === "actions" ? (
          <WorkflowCanvas
            doc={doc}
            selectedNodeId={selectedNodeId}
            onSelect={(nodeId) => {
              setSelectedNodeId(nodeId);
              setInsertTarget({ kind: "after-node", nodeId });
            }}
            onMoveNode={moveNode}
            onRemove={deleteNode}
            onInsertTarget={setInsertTarget}
            onDropNode={handleDropNode}
            onDropPaletteKind={handleDropPaletteKind}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center bg-gray-100/80 p-6">
            <div className="w-full max-w-2xl rounded-xl border border-gray-200 bg-white p-5 text-sm text-gray-600">
              <h3 className="text-base font-semibold text-gray-900">
                {doc.activeTab === "settings" ? "Workflow settings" : "Workflow history"}
              </h3>
              <p className="mt-1">
                {doc.activeTab === "settings"
                  ? "Settings panel is available. Core status and persistence controls are available in the top bar."
                  : "History timeline is available from run history and /api/steward-paths/enrollments for operational logs."}
              </p>
            </div>
          </div>
        )}

        {!isFullscreenCanvas && (
          <NodeInspector
            node={selectedNode}
            onChange={patchNode}
            onAddBranchLane={appendBranchLane}
            onRenameBranchLane={renameLane}
            onRemoveBranchLane={deleteBranchLane}
            onSetFallbackLane={setFallbackLane}
            onAddConditionGroup={appendConditionGroup}
            onRemoveConditionGroup={deleteConditionGroup}
            onUpdateConditionGroup={patchConditionGroup}
          />
        )}
      </div>
    </div>
  );
}
