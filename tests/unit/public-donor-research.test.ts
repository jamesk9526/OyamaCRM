import { afterEach, describe, expect, it, vi } from "vitest";
import {
  lookupWealthEnginePerson,
  normalizeProPublicaPayload,
  normalizeSecPayload,
  normalizeWealthEnginePayload,
} from "../../server/src/services/public-donor-research";

describe("public donor research normalization", () => {
  afterEach(() => vi.unstubAllGlobals());
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

  it("labels WealthEngine values as vendor estimates instead of disclosed assets", () => {
    const results = normalizeWealthEnginePayload({
      identity: { first_name: "Jamie", last_name: "Donor", we_id: "we-123" },
      locations: [{ address: { city: "Chicago", state: { text: "IL" } } }],
      wealth: { networth: { text: "$5M–$10M" } },
      giving: { gift_capacity: { text: "$100K–$250K" } },
    }, { mode: "production", lookupMethod: "address" });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      provider: "wealthengine",
      sourceRecordId: "we-123",
      signalType: "WEALTH_SCREENING",
      disclosedAmount: null,
      providerMode: "production",
      synthetic: false,
      suggestedMatchConfidence: "LOW",
    });
    expect(results[0].summary).toContain("licensed vendor estimates");
    expect(results[0].summary).toContain("not verified assets");
    expect(results[0].facts).toContainEqual({ label: "Estimated gift capacity", value: "$100K–$250K" });
  });

  it("marks WealthEngine sandbox responses as synthetic", () => {
    const results = normalizeWealthEnginePayload({
      identity: { first_name: "Sandbox", last_name: "Person" },
      wealth: { networth: { text: "$1M–$5M" } },
    }, { mode: "sandbox", lookupMethod: "email" });

    expect(results[0].synthetic).toBe(true);
    expect(results[0].summary).toContain("synthetic sandbox data");
    expect(results[0].facts).toContainEqual({ label: "Screening mode", value: "Sandbox — synthetic sample" });
  });

  it("uses the server-side name and address route for a complete individual profile", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ identity: { first_name: "Jamie", last_name: "Donor", we_id: "we-123" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await lookupWealthEnginePerson({
      firstName: "Jamie",
      lastName: "Donor",
      email: "jamie@example.org",
      addressLine1: "100 Main St",
      city: "Chicago",
      state: "IL",
      zip: "60601",
    }, "secret-test-key", {
      configured: true,
      baseUrl: "https://api.wealthengine.com",
      mode: "production",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.wealthengine.com/v1/profile/find_one/by_address/basic",
      expect.objectContaining({
        method: "POST",
        redirect: "error",
        headers: expect.objectContaining({ Authorization: "APIKey secret-test-key" }),
        body: JSON.stringify({
          first_name: "Jamie",
          last_name: "Donor",
          address_line1: "100 Main St",
          city: "Chicago",
          state: "IL",
          zip: "60601",
        }),
      }),
    );
  });

  it("falls back to the email route without sending browser-supplied profile fields", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ identity: { first_name: "Jamie", last_name: "Donor" } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await lookupWealthEnginePerson({
      firstName: "Jamie",
      lastName: "Donor",
      email: "jamie@example.org",
    }, "secret-test-key", {
      configured: true,
      baseUrl: "https://api-sandbox.wealthengine.com",
      mode: "sandbox",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api-sandbox.wealthengine.com/v1/profile/find_one/by_email/basic",
      expect.objectContaining({ body: JSON.stringify({ email: "jamie@example.org" }) }),
    );
  });
});
