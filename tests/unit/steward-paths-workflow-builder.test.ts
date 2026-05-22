/**
 * Unit tests for Steward Paths visual builder workflow utilities and adapters.
 */
import { describe, expect, it } from "vitest";

import { PALETTE_ITEMS } from "@/app/components/steward-paths/palette-catalog";
import {
  analyzeWorkflowSupport,
  toLinearWorkflowExport,
} from "@/app/components/steward-paths/workflow-transformers";
import {
  addBranchLane,
  createNodeFromPalette,
  createWorkflowDocument,
  insertNodeAtTarget,
  relocateNode,
  removeBranchLane,
  resetCanvasLayout,
  setNodeCanvasOffset,
  updateNodeConfig,
} from "@/app/components/steward-paths/workflow-utils";
import { getReadinessBadge, isBranchNode } from "@/app/components/steward-paths/workflow-types";

/** Creates deterministic IDs for tests so snapshots/ordering stay stable. */
function createTestIdFactory(): () => string {
  let n = 0;
  return () => `id_${++n}`;
}

/** Looks up one palette item by kind and fails loudly if missing. */
function palette(kind: string) {
  const item = PALETTE_ITEMS.find((candidate) => candidate.kind === kind);
  if (!item) {
    throw new Error(`Palette kind not found in test: ${kind}`);
  }
  return item;
}

describe("workflow-utils", () => {
  it("adds a node after another node", () => {
    const idFactory = createTestIdFactory();
    let doc = createWorkflowDocument(idFactory);

    const trigger = createNodeFromPalette(palette("trigger.new_donation"), idFactory);
    const task = createNodeFromPalette(palette("task.create"), idFactory);

    doc = insertNodeAtTarget(doc, { kind: "root-end" }, trigger);
    doc = insertNodeAtTarget(doc, { kind: "after-node", nodeId: trigger.id }, task);

    expect(doc.rootNodeIds).toEqual([trigger.id, task.id]);
  });

  it("adds a branch node with starter lanes", () => {
    const idFactory = createTestIdFactory();
    let doc = createWorkflowDocument(idFactory);

    const branch = createNodeFromPalette(palette("logic.if_else"), idFactory);
    doc = insertNodeAtTarget(doc, { kind: "root-end" }, branch);

    const stored = doc.nodesById[branch.id];
    expect(isBranchNode(stored)).toBe(true);
    if (!isBranchNode(stored)) return;
    expect(stored.lanes.length).toBeGreaterThanOrEqual(3);
  });

  it("adds and removes branch lanes", () => {
    const idFactory = createTestIdFactory();
    let doc = createWorkflowDocument(idFactory);

    const branch = createNodeFromPalette(palette("logic.if_else"), idFactory);
    doc = insertNodeAtTarget(doc, { kind: "root-end" }, branch);

    doc = addBranchLane(doc, branch.id, "Major donor lane", idFactory);
    const withExtraLane = doc.nodesById[branch.id];
    expect(isBranchNode(withExtraLane)).toBe(true);
    if (!isBranchNode(withExtraLane)) return;

    const addedLane = withExtraLane.lanes.find((lane) => lane.label === "Major donor lane");
    expect(addedLane).toBeTruthy();

    doc = removeBranchLane(doc, branch.id, addedLane?.id || "");
    const removed = doc.nodesById[branch.id];
    expect(isBranchNode(removed)).toBe(true);
    if (!isBranchNode(removed)) return;

    expect(removed.lanes.some((lane) => lane.label === "Major donor lane")).toBe(false);
  });

  it("adds a node inside a branch lane", () => {
    const idFactory = createTestIdFactory();
    let doc = createWorkflowDocument(idFactory);

    const branch = createNodeFromPalette(palette("logic.if_else"), idFactory);
    doc = insertNodeAtTarget(doc, { kind: "root-end" }, branch);

    const branchNode = doc.nodesById[branch.id];
    expect(isBranchNode(branchNode)).toBe(true);
    if (!isBranchNode(branchNode)) return;

    const firstLane = branchNode.lanes[0];
    const email = createNodeFromPalette(palette("email.create_draft"), idFactory);

    doc = insertNodeAtTarget(doc, {
      kind: "branch-lane",
      branchNodeId: branch.id,
      laneId: firstLane.id,
    }, email);

    const updatedBranch = doc.nodesById[branch.id];
    expect(isBranchNode(updatedBranch)).toBe(true);
    if (!isBranchNode(updatedBranch)) return;

    const updatedLane = updatedBranch.lanes.find((lane) => lane.id === firstLane.id);
    expect(updatedLane?.nodeIds).toContain(email.id);
  });

  it("updates node config", () => {
    const idFactory = createTestIdFactory();
    let doc = createWorkflowDocument(idFactory);

    const task = createNodeFromPalette(palette("task.create"), idFactory);
    doc = insertNodeAtTarget(doc, { kind: "root-end" }, task);
    doc = updateNodeConfig(doc, task.id, "priority", "HIGH");

    expect(doc.nodesById[task.id]?.config.priority).toBe("HIGH");
  });

  it("stores and resets free-drag canvas offsets without changing node order", () => {
    const idFactory = createTestIdFactory();
    let doc = createWorkflowDocument(idFactory);

    const trigger = createNodeFromPalette(palette("trigger.new_donation"), idFactory);
    const task = createNodeFromPalette(palette("task.create"), idFactory);

    doc = insertNodeAtTarget(doc, { kind: "root-end" }, trigger);
    doc = insertNodeAtTarget(doc, { kind: "after-node", nodeId: trigger.id }, task);

    doc = setNodeCanvasOffset(doc, task.id, { x: 48.4, y: -24.2 });

    expect(doc.rootNodeIds).toEqual([trigger.id, task.id]);
    expect(doc.canvasLayout.nodeOffsets[task.id]).toEqual({ x: 48, y: -24 });

    doc = resetCanvasLayout(doc);

    expect(doc.rootNodeIds).toEqual([trigger.id, task.id]);
    expect(doc.canvasLayout.nodeOffsets).toEqual({});
  });

  it("relocates a node between root and branch lane containers", () => {
    const idFactory = createTestIdFactory();
    let doc = createWorkflowDocument(idFactory);

    const trigger = createNodeFromPalette(palette("trigger.new_donation"), idFactory);
    const branch = createNodeFromPalette(palette("logic.if_else"), idFactory);
    const note = createNodeFromPalette(palette("donor.add_note"), idFactory);

    doc = insertNodeAtTarget(doc, { kind: "root-end" }, trigger);
    doc = insertNodeAtTarget(doc, { kind: "after-node", nodeId: trigger.id }, branch);
    doc = insertNodeAtTarget(doc, { kind: "after-node", nodeId: branch.id }, note);

    const branchNode = doc.nodesById[branch.id];
    expect(isBranchNode(branchNode)).toBe(true);
    if (!isBranchNode(branchNode)) return;

    doc = relocateNode(
      doc,
      note.id,
      { kind: "branch-lane", branchNodeId: branch.id, laneId: branchNode.lanes[0].id },
      0,
    );

    const movedBranch = doc.nodesById[branch.id];
    expect(isBranchNode(movedBranch)).toBe(true);
    if (!isBranchNode(movedBranch)) return;

    expect(movedBranch.lanes[0]?.nodeIds).toContain(note.id);
    expect(doc.rootNodeIds).not.toContain(note.id);
  });
});

describe("workflow-transformers", () => {
  it("translates a simple linear visual workflow into backend step shape", () => {
    const idFactory = createTestIdFactory();
    let doc = createWorkflowDocument(idFactory);

    const trigger = createNodeFromPalette(palette("trigger.new_donation"), idFactory);
    const delay = createNodeFromPalette(palette("timing.delay"), idFactory);
    const task = createNodeFromPalette(palette("task.create"), idFactory);

    doc = insertNodeAtTarget(doc, { kind: "root-end" }, trigger);
    doc = insertNodeAtTarget(doc, { kind: "after-node", nodeId: trigger.id }, delay);
    doc = insertNodeAtTarget(doc, { kind: "after-node", nodeId: delay.id }, task);

    const exported = toLinearWorkflowExport(doc);

    expect(exported.report.canSaveLinear).toBe(true);
    expect(exported.template.triggerType).toBe("DONATION_RECEIVED");
    expect(exported.steps).toHaveLength(2);
    expect(exported.steps[0]?.stepType).toBe("DELAY");
    expect(exported.steps[1]?.stepType).toBe("CREATE_TASK");
  });

  it("exports branch workflows with activation support", () => {
    const idFactory = createTestIdFactory();
    let doc = createWorkflowDocument(idFactory);

    const trigger = createNodeFromPalette(palette("trigger.new_donation"), idFactory);
    const branch = createNodeFromPalette(palette("logic.if_else"), idFactory);

    doc = insertNodeAtTarget(doc, { kind: "root-end" }, trigger);
    doc = insertNodeAtTarget(doc, { kind: "after-node", nodeId: trigger.id }, branch);

    const support = analyzeWorkflowSupport(doc);
    const exported = toLinearWorkflowExport(doc);

    expect(support.hasBranchNodes).toBe(true);
    expect(support.canActivate).toBe(true);
    expect(support.canSaveLinear).toBe(true);
    expect(exported.steps.some((step) => step.stepType === "BRANCH_PLACEHOLDER")).toBe(true);
  });

  it("exports every non-trigger palette node kind from a simple workflow", () => {
    const nonTriggerItems = PALETTE_ITEMS.filter((item) => !item.kind.startsWith("trigger."));

    for (const item of nonTriggerItems) {
      const idFactory = createTestIdFactory();
      let doc = createWorkflowDocument(idFactory);
      const trigger = createNodeFromPalette(palette("trigger.manual_enrollment"), idFactory);
      const node = createNodeFromPalette(item, idFactory);

      doc = insertNodeAtTarget(doc, { kind: "root-end" }, trigger);
      doc = insertNodeAtTarget(doc, { kind: "after-node", nodeId: trigger.id }, node);

      const exported = toLinearWorkflowExport(doc);
      expect(exported.report.canSaveLinear, item.kind).toBe(true);
      expect(exported.steps.length, item.kind).toBeGreaterThan(0);
    }
  });
});

describe("readiness labels", () => {
  it("preserves Working / Partially Working / Not Implemented badge labels", () => {
    expect(getReadinessBadge("working").label).toBe("Working");
    expect(getReadinessBadge("partially-working").label).toBe("Partially Working");
    expect(getReadinessBadge("not-implemented").label).toBe("Not Implemented");
  });
});
