// Regression tests for E2E base URL/auth contract and route path safety.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/** Reads file text from workspace-relative path. */
function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("e2e contract regression", () => {
  it("keeps E2E scripts defaulting to localhost:3000 web base", () => {
    const uiSmoke = read("tests/e2e/ui-production-smoke.mjs");
    const livecom = read("tests/e2e/livecom-ui-smoke.mjs");

    expect(uiSmoke.includes('"http://localhost:3000"')).toBe(true);
    expect(livecom.includes('"http://localhost:3000"')).toBe(true);
  });

  it("keeps mobile audit authenticating against API base", () => {
    const mobileAudit = read("tests/e2e/mobile-readiness-audit.mjs");
    expect(mobileAudit.includes('const API_BASE = process.env.E2E_API_BASE_URL || "http://localhost:4000";')).toBe(true);
    expect(mobileAudit.includes('page.request.post(`${API_BASE}/api/auth/login`')).toBe(true);
  });

  it("keeps letters publish actions in template publish workspace", () => {
    const workspace = read("app/components/letters/OyamaLettersWorkspace.tsx");
    const templatePage = read("app/oyama-letters/templates/[templateId]/page.tsx");
    const publishPage = read("app/oyama-letters/templates/[templateId]/publish/page.tsx");

    expect(workspace.includes("/letters-printables/generate?templateId=")).toBe(false);
    expect(workspace.includes("/oyama-letters/templates/${id}/publish")).toBe(true);
    expect(templatePage.includes('view="builder"')).toBe(true);
    expect(publishPage.includes('view="publish"')).toBe(true);
  });
});
