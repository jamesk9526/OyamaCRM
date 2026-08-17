import { describe, expect, it } from "vitest";
import {
  FEC_PROSPECT_ENRICHMENT_ENABLED,
  isDonorProfileProviderOperational,
  OYAMA_DONOR_PROFILE_POLICY,
  resolveDonorProfileIdentity,
} from "../../server/src/services/oyama-donor-profile";

describe("OYAMADonorPROFILE core", () => {
  it("requires review for ambiguous identity matches", () => {
    const result = resolveDonorProfileIdentity(
      { firstName: "John", lastName: "Smith", city: "Springfield", state: "MO" },
      { firstName: "John", lastName: "Smith", city: "Springfield", state: "MO" },
    );
    expect(result.score).toBe(38);
    expect(result.band).toBe("UNVERIFIED");
    expect(result.mergeEligible).toBe(false);
    expect(result.reviewRequired).toBe(true);
  });

  it("explains high-confidence matches with component signals", () => {
    const result = resolveDonorProfileIdentity(
      { firstName: "John", middleName: "Robert", lastName: "Smith", addressLine1: "123 Main St.", city: "Springfield", state: "MO", zip: "65806", employer: "Smith Industries" },
      { firstName: "John", middleName: "R", lastName: "Smith", addressLine1: "123 Main Street", city: "Springfield", state: "MO", zip: "65806", employer: "Smith Industries" },
    );
    expect(result.score).toBeGreaterThanOrEqual(70);
    expect(result.mergeEligible).toBe(true);
    expect(result.signals).toContainEqual({ key: "zip", label: "ZIP", points: 15 });
    expect(result.signals).toContainEqual({ key: "employer", label: "Employer", points: 15 });
  });

  it("keeps prohibited data and FEC prospect enrichment disabled by policy", () => {
    expect(FEC_PROSPECT_ENRICHMENT_ENABLED).toBe(false);
    expect(OYAMA_DONOR_PROFILE_POLICY.prohibitedSensitiveData).toContain("credit scores");
    expect(OYAMA_DONOR_PROFILE_POLICY.prohibitedEligibilityUses).toContain("employment");
  });

  it("does not activate a provider until source terms and automation are approved", () => {
    const base = {
      id: "example", name: "Example", sourceType: "public_registry", capabilities: ["IDENTITY" as const],
      enabled: true, allowedUse: "Nonprofit prospect research", redistributionAllowed: false, attributionRequired: true,
    };
    expect(isDonorProfileProviderOperational({ ...base, automationAllowed: false, termsReviewedAt: "2026-08-17" })).toBe(false);
    expect(isDonorProfileProviderOperational({ ...base, automationAllowed: true, termsReviewedAt: null })).toBe(false);
    expect(isDonorProfileProviderOperational({ ...base, automationAllowed: true, termsReviewedAt: "2026-08-17" })).toBe(true);
  });
});

