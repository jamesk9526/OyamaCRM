import { describe, expect, it } from "vitest";
import {
  beginStewardAiTask,
  getStewardAiRuntimeState,
  withStewardAiTask,
} from "@/server/src/services/steward-ai-runtime-status";
import type { StewardAiConfig } from "@/server/src/services/steward-ai-ollama";

const validConfig: StewardAiConfig = {
  mode: "local",
  endpointUrl: "http://127.0.0.1:11434",
  model: "llama3.2:3b",
  thinkingModel: "deepseek-r1:8b",
  reasoningMode: "thinking",
  agenticMultiStage: true,
  chatHeadEnabled: true,
  temperature: 0.3,
  maxTokens: 600,
  timeoutMs: 36500,
  systemPrompt: "test",
  apiKey: null,
};

describe("steward-ai-runtime-status", () => {
  it("returns not_configured when required runtime fields are blank", () => {
    const state = getStewardAiRuntimeState({
      organizationId: "org-not-configured",
      enabled: true,
      config: {
        ...validConfig,
        endpointUrl: "",
        model: "",
        thinkingModel: "",
      },
    });

    expect(state.status).toBe("not_configured");
  });

  it("tracks active task count while a task is running", async () => {
    let resolveTask: () => void = () => undefined;
    const taskPromise = withStewardAiTask(
      {
        organizationId: "org-running",
        enabled: true,
        config: validConfig,
        label: "Generating donor engagement recommendations",
        status: "running_task",
      },
      () => new Promise<void>((resolve) => {
        resolveTask = resolve;
      })
    );

    const running = getStewardAiRuntimeState({
      organizationId: "org-running",
      enabled: true,
      config: validConfig,
    });

    expect(running.status).toBe("running_task");
    expect(running.activeTaskCount).toBeGreaterThan(0);
    expect(running.currentTaskLabel).toBe("Generating donor engagement recommendations");

    resolveTask();
    await taskPromise;

    const settled = getStewardAiRuntimeState({
      organizationId: "org-running",
      enabled: true,
      config: validConfig,
    });

    expect(settled.activeTaskCount).toBe(0);
    expect(settled.currentTaskLabel).toBeNull();
  });

  it("moves to disabled when runtime is switched off", () => {
    beginStewardAiTask({
      organizationId: "org-disabled",
      enabled: true,
      config: validConfig,
      label: "Thinking",
      status: "thinking",
    });

    const disabledState = getStewardAiRuntimeState({
      organizationId: "org-disabled",
      enabled: false,
      config: validConfig,
    });

    expect(disabledState.status).toBe("disabled");
    expect(disabledState.enabled).toBe(false);
  });
});
