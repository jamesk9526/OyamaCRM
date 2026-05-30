/** Smoke coverage for Data Tools guided name correction workflow source contract. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("data tools name-fix workflow source contract", () => {
  it("includes guided name issue detection and correction controls", () => {
    const page = read("app/data-tools/page.tsx");

    expect(page).toContain("Guided Name Corrections");
    expect(page).toContain("Launch Name Correction");
    expect(page).toContain("Approve Correction");
    expect(page).toContain("Ignore");
    expect(page).toContain("Ignored Name Issues");
    expect(page).toContain("No ignored entries yet");
    expect(page).toContain("name-fix:");
  });
});
