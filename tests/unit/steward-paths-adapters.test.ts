// Unit tests for steward paths adapter and validation helpers.
import { describe, expect, it } from "vitest";
import {
  mapLegacyActionToStep,
  mapLegacyAutomationToStewardTemplate,
  mapLegacyTriggerToStewardTrigger,
} from "@/app/components/steward-paths/workflow-adapters";
import { validateWorkflowDocument } from "@/app/components/steward-paths/workflow-validation";
import { createNodeFromPalette, createWorkflowDocument, insertNodeAtTarget } from "@/app/components/steward-paths/workflow-utils";
import { PALETTE_ITEMS } from "@/app/components/steward-paths/palette-catalog";

function palette(kind: string) {
  const item = PALETTE_ITEMS.find((candidate) => candidate.kind === kind);
  if (!item) throw new Error(`Missing palette item ${kind}`);
  return item;
}

describe("steward-paths adapters", () => {
  it("maps legacy triggers to steward trigger types", () => {
    expect(mapLegacyTriggerToStewardTrigger("DONATION_RECEIVED")).toBe("DONATION_RECEIVED");
    expect(mapLegacyTriggerToStewardTrigger("EVENT_REGISTERED")).toBe("EVENT_REGISTERED");
  });

  it("maps legacy actions to compatible step types", () => {
    expect(mapLegacyActionToStep({ type: "SEND_EMAIL", order: 0 }).stepType).toBe("DRAFT_EMAIL");
    expect(mapLegacyActionToStep({ type: "CREATE_TASK", order: 1 }).stepType).toBe("CREATE_TASK");
    expect(mapLegacyActionToStep({ type: "UPDATE_FIELD", order: 2 }).stepType).toBe("STATUS_CHANGE");
  });

  it("converts a full legacy automation into template + ordered steps", () => {
    const converted = mapLegacyAutomationToStewardTemplate({
      name: "Legacy Path",
      trigger: "DONATION_RECEIVED",
      actions: [
        { type: "SEND_EMAIL", order: 1, config: { template: "thanks" } },
        { type: "CREATE_TASK", order: 0, config: { title: "Call donor" } },
      ],
    });

    expect(converted.template.triggerType).toBe("DONATION_RECEIVED");
    expect(converted.steps).toHaveLength(2);
    expect(converted.steps[0]?.stepType).toBe("CREATE_TASK");
    expect(converted.steps[1]?.stepType).toBe("DRAFT_EMAIL");
  });
});

describe("steward-paths validation", () => {
  it("blocks activation for unsupported node kinds", () => {
    let n = 0;
    const idFactory = () => `id_${++n}`;
    let doc = createWorkflowDocument(idFactory);

    const trigger = createNodeFromPalette(palette("trigger.new_donation"), idFactory);
    const unsupported = {
      id: idFactory(),
      nodeType: "action" as const,
      kind: "custom.unknown",
      title: "Unknown",
      config: {},
    };

    doc = insertNodeAtTarget(doc, { kind: "root-end" }, trigger);
    doc = insertNodeAtTarget(doc, { kind: "after-node", nodeId: trigger.id }, unsupported);

    const result = validateWorkflowDocument(doc);
    expect(result.canSave).toBe(false);
    expect(result.canActivate).toBe(false);
    expect(result.errors.some((item) => item.includes("Unsupported node kinds"))).toBe(true);
  });
});
