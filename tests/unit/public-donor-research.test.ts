import { describe, expect, it } from "vitest";
import {
  normalizeProPublicaPayload,
  normalizeSecPayload,
} from "../../server/src/services/public-donor-research";

describe("public donor research normalization", () => {
  it("keeps ProPublica asset values attributed to the source record", () => {
    const results = normalizeProPublicaPayload({
      organizations: [{
        ein: 123456789,
        name: "Example Family Foundation",
        city: "Chicago",
        state: "IL",
        ntee_code: "T20",
        latest_object: {
          tax_prd_yr: 2024,
          formtype: "990PF",
          totassetsend: 1_250_000,
          totrevenue: 175_000,
        },
      }],
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      provider: "propublica",
      sourceRecordId: "123456789",
      disclosedAmount: 1_250_000,
      disclosedAmountLabel: "Reported nonprofit total assets",
      suggestedMatchConfidence: "LOW",
    });
    expect(results[0].summary).toContain("reported total assets");
    expect(results[0].sourceUrl).toBe("https://projects.propublica.org/nonprofits/organizations/123456789");
  });

  it("does not turn an SEC filer record into a wealth estimate", () => {
    const results = normalizeSecPayload({
      cik: "320193",
      name: "Example Public Company",
      tickers: ["EXM"],
      exchanges: ["Nasdaq"],
      sicDescription: "Technology",
      filings: { recent: { form: ["10-K"], filingDate: ["2026-07-31"] } },
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      provider: "sec_edgar",
      sourceRecordId: "0000320193",
      disclosedAmount: null,
      signalType: "CORPORATE_AFFILIATION",
      suggestedMatchConfidence: "LOW",
    });
    expect(results[0].summary).toContain("does not by itself prove");
  });

  it("drops malformed SEC records without a CIK", () => {
    expect(normalizeSecPayload({ name: "No identifier" })).toEqual([]);
  });
});
