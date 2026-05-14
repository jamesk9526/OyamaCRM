/**
 * StewardPathBuilderPage orchestrates the visual workflow builder shell.
 */
"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

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

/** Three-panel builder with top controls, map canvas, and inspector drawer. */
export default function StewardPathBuilderPage({ templateIdFromRoute }: { templateIdFromRoute?: string }) {
  const searchParams = useSearchParams();
  const templateIdFromQuery = templateIdFromRoute || searchParams.get("templateId") || searchParams.get("pathId");

  const [doc, setDoc] = useState<WorkflowDocument>(() => createWorkflowDocument(makeBuilderId));
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [insertTarget, setInsertTarget] = useState<NodeInsertTarget | null>({ kind: "root-end" });
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<"save" | "activate" | "test" | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const supportReport = useMemo(() => analyzeWorkflowSupport(doc), [doc]);
  const insertTargetLabel = useMemo(() => describeInsertTarget(doc, insertTarget), [doc, insertTarget]);

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
          <div className="min-w-0">
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
              {loadingTemplate && (
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800">
                  Loading template...
                </span>
              )}
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
                "Node workspace routes: /steward-paths and /steward-paths/builder. /automations is deprecated and redirects to /steward-paths.",
              ]}
              buttonLabel="Legend"
            />

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
          {doc.persistence.templateId && <p>Template ID: {doc.persistence.templateId}</p>}
        </div>

        {feedbackMessage && (
          <div className="mt-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs text-sky-900">
            {feedbackMessage}
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        <NodePalette onAdd={addNode} insertionTargetLabel={insertTargetLabel} />

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
      </div>
    </div>
  );
}
