/**
 * StewardPathBuilderPage orchestrates the visual workflow builder shell.
 */
"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import ConstituentSearchCombobox from "./ConstituentSearchCombobox";
import NodeInspector from "./NodeInspector";
import NodePalette from "./NodePalette";
import PageInfoButton from "./PageInfoButton";
import TestRunModal from "./TestRunModal";
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

interface StewardPathHistoryResponse {
  pathId: string;
  pathName: string;
  items: Array<{
    id: string;
    eventType: string;
    message: string;
    createdAt: string;
    enrollmentId: string;
  }>;
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
  const [historyItems, setHistoryItems] = useState<StewardPathHistoryResponse["items"]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [showTestInput, setShowTestInput] = useState(false);
  const [testConstituentId, setTestConstituentId] = useState("");
  const [testDonorName, setTestDonorName] = useState("");
  const [showTestModal, setShowTestModal] = useState(false);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        event.preventDefault();
      }
      if (busyAction !== null) return;
      event.preventDefault();
      void saveDraft();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busyAction, saveDraft]);

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

  /** Opens the constituent search combobox so the user can pick a donor to test with. */
  const runTestEnrollment = useCallback(() => {
    if (!doc.persistence.templateId) {
      setFeedbackMessage("Save Draft first, then run a test enrollment.");
      return;
    }
    setShowTestInput(true);
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

  useEffect(() => {
    if (doc.activeTab !== "history") return;
    if (!doc.persistence.templateId) {
      setHistoryItems([]);
      setHistoryError("Save this workflow first to load run history.");
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);

    void apiFetch<StewardPathHistoryResponse>(`/api/steward-paths/templates/${doc.persistence.templateId}/history?limit=40`)
      .then((response) => {
        if (cancelled) return;
        setHistoryItems(response.items ?? []);
      })
      .catch((error) => {
        if (cancelled) return;
        setHistoryError(error instanceof Error ? error.message : "Failed to load workflow history.");
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [doc.activeTab, doc.persistence.templateId]);

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
    <div className="flex h-screen flex-col bg-[#f8faf9]">

      {/* ── Compact single-row header ── */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-4 py-0 h-11 flex items-center gap-3">

        {/* Back */}
        <Link
          href="/steward-paths"
          className="flex shrink-0 items-center gap-1 text-xs text-slate-500 transition hover:text-slate-800 pr-3 border-r border-slate-200"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 12L6 8l4-4" />
          </svg>
          Workflows
        </Link>

        {/* Workflow name + status */}
        <div className="flex flex-1 items-center gap-2 min-w-0">
          <input
            type="text"
            value={doc.pathName}
            onChange={(event) => setDoc((prev) => ({ ...prev, pathName: event.target.value }))}
            className="min-w-0 max-w-xs border-b border-transparent bg-transparent px-1 text-sm font-semibold text-slate-900 outline-none transition focus:border-slate-400"
          />
          <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
            doc.status === "active"
              ? "bg-green-100 text-green-700"
              : doc.status === "archived"
                ? "bg-slate-100 text-slate-600"
                : doc.status === "test-mode"
                  ? "bg-indigo-100 text-indigo-700"
                  : "bg-slate-100 text-slate-600"
          }`}>
            {doc.status === "active" ? "Active" : doc.status === "archived" ? "Archived" : doc.status === "test-mode" ? "Test Mode" : "Draft"}
          </span>
          {loadingTemplate && (
            <span className="inline-flex shrink-0 items-center rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700">
              Loading…
            </span>
          )}
        </div>

        {/* Right-side actions */}
        <div className="flex shrink-0 items-center gap-1.5">

          {/* Settings toggle */}
          <button
            type="button"
            onClick={() => setDoc((prev) => ({ ...prev, activeTab: prev.activeTab === "settings" ? "actions" : "settings" }))}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${doc.activeTab === "settings" ? "bg-green-50 text-green-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="8" cy="8" r="2.5" />
              <path strokeLinecap="round" d="M8 1.5V3M8 13v1.5M1.5 8H3M13 8h1.5M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1" />
            </svg>
            Settings
          </button>

          {/* Analytics toggle */}
          <button
            type="button"
            onClick={() => setDoc((prev) => ({ ...prev, activeTab: prev.activeTab === "history" ? "actions" : "history" }))}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition ${doc.activeTab === "history" ? "bg-green-50 text-green-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-800"}`}
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 12l4-5 3 3 2.5-4 2.5 3" />
            </svg>
            Analytics
          </button>

          <div className="h-4 w-px bg-slate-200" />

          {/* Save status */}
          {doc.persistence.lastSavedAt && (
            <span className="flex items-center gap-1 text-[11px] text-slate-400 pr-1">
              <svg className="h-3 w-3 text-green-500" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                <path d="M5 8l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Saved
            </span>
          )}

          {/* Save icon */}
          <button
            type="button"
            onClick={() => void saveDraft()}
            disabled={busyAction !== null}
            title="Save workflow (Ctrl+S)"
            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.5 2H3a1 1 0 00-1 1v10a1 1 0 001 1h10a1 1 0 001-1V5l-2.5-3z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 2v3.5H5V2M5 9.5h6" />
            </svg>
          </button>

          <div className="h-4 w-px bg-slate-200" />

          {/* Test Workflow */}
          {showTestInput ? (
            <ConstituentSearchCombobox
              disabled={busyAction !== null}
              onConfirm={(id, name) => {
                setTestConstituentId(id);
                setTestDonorName(name);
                setShowTestInput(false);
                setShowTestModal(true);
              }}
              onCancel={() => { setShowTestInput(false); setTestConstituentId(""); setTestDonorName(""); }}
            />
          ) : (
            <button
              type="button"
              onClick={() => runTestEnrollment()}
              disabled={busyAction !== null || !doc.persistence.templateId}
              title={doc.persistence.templateId ? "Start one manual test enrollment" : "Save first to enable test"}
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M5.5 3.5l7 4.5-7 4.5V3.5z" />
              </svg>
              {busyAction === "test" ? "Testing…" : "Test"}
            </button>
          )}

          {/* Publish */}
          <button
            type="button"
            onClick={() => void activateWorkflow()}
            disabled={busyAction !== null || !supportReport.canActivate}
            title={supportReport.canActivate ? "Publish and activate workflow" : (supportReport.reasons[0] ?? "Activation blocked")}
            className="rounded-md bg-slate-900 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyAction === "activate" ? "Publishing…" : "Publish"}
          </button>
        </div>
      </header>

      {/* ── Feedback / warning banners ── */}
      {feedbackMessage && (
        <div className="flex shrink-0 items-center justify-between border-b border-sky-200 bg-sky-50 px-6 py-1.5 text-xs text-sky-900">
          <span>{feedbackMessage}</span>
          <button type="button" onClick={() => setFeedbackMessage(null)} className="ml-4 text-sky-500 hover:text-sky-800" aria-label="Dismiss">×</button>
        </div>
      )}
      {!supportReport.canSaveLinear && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-6 py-1.5 text-xs text-amber-900">
          <span className="font-semibold">Save blocked: </span>
          {supportReport.reasons[0] ?? "Resolve workflow issues to enable save."}
        </div>
      )}

      {/* ── Three-panel body: palette | canvas/content | inspector ── */}
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
        ) : doc.activeTab === "settings" ? (
          <div className="flex flex-1 overflow-auto bg-[#f8faf9] p-6">
            <div className="w-full max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-slate-900">Workflow Settings</h3>
                <button
                  type="button"
                  onClick={() => setDoc((prev) => ({ ...prev, activeTab: "actions" }))}
                  className="text-xs text-slate-400 hover:text-slate-700"
                >
                  ← Back to canvas
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Path name</span>
                  <input
                    type="text"
                    value={doc.pathName}
                    onChange={(event) => setDoc((prev) => ({ ...prev, pathName: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                  />
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Audience label</span>
                  <input
                    type="text"
                    value={doc.audienceLabel}
                    onChange={(event) => setDoc((prev) => ({ ...prev, audienceLabel: event.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-green-500 focus:bg-white focus:ring-2 focus:ring-green-500/20"
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: "Root nodes", value: doc.rootNodeIds.length },
                  { label: "Total nodes", value: allNodes.length },
                  { label: "Persistence", value: doc.persistence.mode === "api" ? "API" : "Memory" },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{stat.label}</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{stat.value}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => void saveDraft()}
                  disabled={busyAction !== null}
                  className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {busyAction === "save" ? "Saving..." : "Save Draft"}
                </button>
                {doc.persistence.templateId && (
                  <Link
                    href={`/steward-paths/${encodeURIComponent(doc.persistence.templateId)}/history`}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    View run history →
                  </Link>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Analytics / history tab */
          <div className="flex flex-1 overflow-auto bg-[#f8faf9] p-6">
            <div className="w-full max-w-3xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Analytics &amp; Run History</h3>
                  <p className="mt-0.5 text-xs text-slate-500">Timeline events from this workflow template.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDoc((prev) => ({ ...prev, activeTab: "actions" }))}
                  className="text-xs text-slate-400 hover:text-slate-700"
                >
                  ← Back to canvas
                </button>
              </div>
              {historyLoading ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Loading…</p>
              ) : historyError ? (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{historyError}</p>
              ) : historyItems.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">No history events yet for this path.</p>
              ) : (
                <div className="space-y-2">
                  {historyItems.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-semibold text-slate-800">{item.eventType}</span>
                        <span className="text-slate-400">{new Date(item.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-700">{item.message || "No message"}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">Enrollment: {item.enrollmentId}</p>
                    </div>
                  ))}
                </div>
              )}
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

      {/* Test Run Modal — visual dry-run simulation */}
      {showTestModal && (
        <TestRunModal
          doc={doc}
          constituentId={testConstituentId}
          donorName={testDonorName}
          onClose={() => {
            setShowTestModal(false);
            setTestConstituentId("");
            setTestDonorName("");
            setDoc((prev) => ({ ...prev, status: "test-mode" }));
            setFeedbackMessage(`Dry run complete for ${testDonorName || testConstituentId}.`);
          }}
        />
      )}
    </div>
  );
}
