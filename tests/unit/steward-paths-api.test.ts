/** Contract tests for the client wrapper around the permissioned Steward Paths API. */
import { afterEach, describe, expect, it, vi } from "vitest";

import { setAccessToken } from "@/app/lib/auth-client";
import { stewardPathsApi } from "@/app/lib/steward-paths-api";

function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    json: async () => ({ data }),
    text: async () => JSON.stringify({ data }),
  } as unknown as Response;
}

describe("stewardPathsApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    setAccessToken(null);
  });

  it("uses encoded identifiers and the correct mutation contracts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    setAccessToken("test-token");

    await stewardPathsApi.updateTemplate("path/a?b", { name: "Updated" });
    await stewardPathsApi.addStep("path/a?b", { stepType: "CREATE_TASK" });
    await stewardPathsApi.archiveStep("path/a?b", "step/a?b");
    await stewardPathsApi.duplicateTemplate("path/a?b");
    await stewardPathsApi.runDueSteps(25);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:4000/api/steward-paths/templates/path%2Fa%3Fb",
      "http://localhost:4000/api/steward-paths/templates/path%2Fa%3Fb/steps",
      "http://localhost:4000/api/steward-paths/templates/path%2Fa%3Fb/steps/step%2Fa%3Fb",
      "http://localhost:4000/api/steward-paths/templates/path%2Fa%3Fb/duplicate",
      "http://localhost:4000/api/steward-paths/process-due",
    ]);
    expect(fetchMock.mock.calls.map(([, options]) => (options as RequestInit).method)).toEqual([
      "PATCH", "POST", "DELETE", "POST", "POST",
    ]);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ body: JSON.stringify({ name: "Updated" }) });
    expect(new Headers((fetchMock.mock.calls[0]?.[1] as RequestInit).headers).get("Authorization")).toBe("Bearer test-token");
    expect(fetchMock.mock.calls[4]?.[1]).toMatchObject({ body: JSON.stringify({ limit: 25 }) });
  });

  it("uses safe bounded defaults for history, enrollment, and due processing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await stewardPathsApi.getHistory("template id");
    await stewardPathsApi.listEnrollments();
    await stewardPathsApi.runDueSteps();

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "http://localhost:4000/api/steward-paths/templates/template%20id/history?limit=40",
      "http://localhost:4000/api/steward-paths/enrollments?limit=300",
      "http://localhost:4000/api/steward-paths/process-due",
    ]);
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({ body: JSON.stringify({ limit: 150 }) });
  });
});
