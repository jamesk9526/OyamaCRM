import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("report audience creation", () => {
  it("offers audience creation for every report with represented constituents", () => {
    const workspace = read("app/components/donor-reports/DonorReportsSpreadsheet.tsx");
    expect(workspace).toContain("reportCapabilities(report)");
    expect(workspace).toContain("report.audienceConstituentIds");
    expect(workspace).toContain("Save as audience list");
    expect(workspace).not.toContain('report.report === "lapsed-donor-history"');
    expect(workspace).toContain("recipientConstituentIds: audienceDonorIds");
  });

  it("exposes constituent membership for aggregate reports", () => {
    const library = read("server/src/services/donor-report-library.ts");
    for (const report of [
      "comprehensive-donor-analysis",
      "payment-method-summary",
      "designation-performance",
      "crm-performance-scorecard",
      "campaign-performance",
    ]) {
      expect(library).toContain(`emptyReport("${report}"`);
    }
    expect(library.match(/audienceConstituentIds:/g)?.length).toBeGreaterThanOrEqual(6);
  });
});
