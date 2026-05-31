import { describe, expect, it } from "vitest";

import {
  advancePlaygroundRun,
  buildPlaygroundScenarios,
  createPlaygroundRun,
  getPlaygroundRunActivity,
  getPlaygroundRunSnapshot,
  previewSandboxTestEmails,
  resetPlaygroundRun,
  type PlaygroundConstituentSnapshot,
  type PlaygroundTemplateStep,
} from "@/server/src/services/steward-paths-playground";

const ORG_ID = "org_test_playground";
const PATH_ID = "path_test_playground";

function baseConstituent(): PlaygroundConstituentSnapshot {
  return {
    id: "con_01",
    firstName: "Avery",
    lastName: "Ng",
    email: "avery@example.org",
    donorStatus: "ACTIVE",
    totalLifetimeGiving: 1250,
    lastGiftAmount: 100,
    lastGiftDate: new Date("2025-01-10T00:00:00.000Z"),
    engagementScore: 66,
    doNotEmail: false,
    doNotMail: false,
    doNotContact: false,
  };
}

function baseSteps(): PlaygroundTemplateStep[] {
  return [
    {
      id: "step_delay",
      orderIndex: 0,
      name: "Wait 2 days",
      stepType: "DELAY",
      configJson: { amount: 2, unit: "days" },
    },
    {
      id: "step_email",
      orderIndex: 1,
      name: "Draft thank-you email",
      stepType: "DRAFT_EMAIL",
      configJson: { subjectTemplate: "Thank you for your gift" },
    },
    {
      id: "step_task",
      orderIndex: 2,
      name: "Create follow-up task",
      stepType: "CREATE_TASK",
      configJson: { titleTemplate: "Call {{firstName}}" },
    },
  ];
}

describe("steward paths playground service", () => {
  it("builds scenario catalog including guardrail scenario", () => {
    const scenarios = buildPlaygroundScenarios(baseConstituent());

    expect(scenarios.length).toBeGreaterThanOrEqual(4);
    const guardrail = scenarios.find((scenario) => scenario.id === "opt-out-guardrails");
    expect(guardrail).toBeTruthy();
    expect(guardrail?.donorProfile.doNotContact).toBe(true);
  });

  it("creates and advances sandbox runs without external dependencies", () => {
    const run = createPlaygroundRun({
      organizationId: ORG_ID,
      pathId: PATH_ID,
      pathName: "Retention Path",
      constituent: baseConstituent(),
      steps: baseSteps(),
      scenarioId: "baseline",
      skipDelays: true,
    });

    expect(run.isSandbox).toBe(true);
    expect(run.summary.completedSteps).toBe(0);
    expect(run.steps.every((step) => step.status === "pending")).toBe(true);

    const completed = advancePlaygroundRun({
      organizationId: ORG_ID,
      pathId: PATH_ID,
      runId: run.runId,
      action: "auto",
    });

    expect(completed).toBeTruthy();
    expect(completed?.status).toBe("completed");
    expect(completed?.summary.completedSteps).toBe(3);
    expect(completed?.summary.failed).toBe(0);

    const snapshot = getPlaygroundRunSnapshot({
      organizationId: ORG_ID,
      pathId: PATH_ID,
      runId: run.runId,
    });
    expect(snapshot?.runId).toBe(run.runId);

    const events = getPlaygroundRunActivity({
      organizationId: ORG_ID,
      pathId: PATH_ID,
      runId: run.runId,
    });
    expect(events).toBeTruthy();
    expect((events || []).length).toBeGreaterThan(0);

    const reset = resetPlaygroundRun({
      organizationId: ORG_ID,
      pathId: PATH_ID,
      runId: run.runId,
    });
    expect(reset?.summary.completedSteps).toBe(0);
    expect(reset?.steps.every((step) => step.status === "pending")).toBe(true);
  });

  it("generates sandbox email previews with safety prefixes and no analytics", () => {
    const run = createPlaygroundRun({
      organizationId: ORG_ID,
      pathId: PATH_ID,
      pathName: "Retention Path",
      constituent: baseConstituent(),
      steps: baseSteps(),
      scenarioId: "baseline",
      skipDelays: true,
    });

    const advanced = advancePlaygroundRun({
      organizationId: ORG_ID,
      pathId: PATH_ID,
      runId: run.runId,
      action: "auto",
    });
    expect(advanced?.status).toBe("completed");

    const preview = previewSandboxTestEmails({
      organizationId: ORG_ID,
      pathId: PATH_ID,
      runId: run.runId,
      testEmail: "qa@example.org",
    });

    expect(preview).toBeTruthy();
    expect(preview?.isSandbox).toBe(true);
    expect(preview?.analyticsTracked).toBe(false);
    expect(preview?.items.length).toBeGreaterThan(0);
    expect(preview?.items[0]?.subject.startsWith("[SANDBOX TEST]")).toBe(true);
  });
});
