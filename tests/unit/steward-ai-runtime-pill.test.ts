import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import StewardAiRuntimePill, { statusCopy } from "@/app/components/layout/StewardAiRuntimePill";

describe("steward-ai-runtime-pill", () => {
  it("maps connected status to connected label copy", () => {
    const copy = statusCopy("connected");
    expect(copy.label).toBe("Steward: Connected");
  });

  it("maps running task status to spinner copy", () => {
    const copy = statusCopy("running_task");
    expect(copy.label).toBe("Steward: Running Task");
    expect(copy.spinner).toBe(true);
  });

  it("renders connected status text for topbar pill", () => {
    const html = renderToStaticMarkup(
      React.createElement(StewardAiRuntimePill, {
        canRunConnectionTest: false,
        onOpenSettings: () => undefined,
        initialState: {
          enabled: true,
          status: "connected",
          mode: "local",
          endpointUrl: "http://127.0.0.1:11434",
          model: "deepseek-r1:8b",
          thinkingModel: "deepseek-r1:8b",
          activeTaskCount: 0,
          currentTaskLabel: null,
          lastCheckedAt: null,
          lastSuccessAt: null,
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      })
    );

    expect(html).toContain("Steward: Connected");
  });
});
