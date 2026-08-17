import { describe, expect, it } from "vitest";
import { buildAutomaticProfileQueries } from "../../server/src/services/oyama-profile-research";

describe("automatic OYAMADonorPROFILE research planning", () => {
  it("derives every query from the selected constituent without user-entered source terms", () => {
    const queries = buildAutomaticProfileQueries({
      id: "person-1",
      firstName: "John",
      lastName: "Smith",
      employer: "Community Hospital Foundation",
    }, []);
    expect(queries.nonprofitTerms).toEqual(["Community Hospital Foundation", "John Smith"]);
    expect(queries.secCiks).toEqual([]);
  });

  it("refreshes every known constituent-linked SEC CIK without guessing new identities", () => {
    const queries = buildAutomaticProfileQueries({ id: "person-1", firstName: "John", lastName: "Smith" }, [
      { id: "a", provider: "sec_edgar", sourceRecordId: "320193", sourceUrl: "https://www.sec.gov", signalType: "CORPORATE_AFFILIATION", title: "A", summary: "A", status: "VERIFIED", matchConfidence: "HIGH", matchRationale: "Verified filing relationship", createdAt: "2026-08-17" },
      { id: "b", provider: "sec_edgar", sourceRecordId: "320193", sourceUrl: "https://www.sec.gov", signalType: "CORPORATE_AFFILIATION", title: "B", summary: "B", status: "UNVERIFIED", matchConfidence: "LOW", matchRationale: "Possible filing relationship", createdAt: "2026-08-17" },
    ]);
    expect(queries.secCiks).toEqual(["320193"]);
  });
});

