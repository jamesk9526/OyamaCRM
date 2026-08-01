import { describe, expect, it } from "vitest";
import { getPathEmailEligibilityError } from "@/server/src/services/steward-paths-sequence-engine";

const eligibleRecipient = {
  email: "donor@example.org",
  doNotContact: false,
  doNotEmail: false,
  emailOptOut: false,
};

describe("Steward Paths email eligibility", () => {
  it("allows a recipient with an email address and no communication restrictions", () => {
    expect(getPathEmailEligibilityError(eligibleRecipient)).toBeNull();
  });

  it("blocks a missing recipient address and every email suppression flag", () => {
    expect(getPathEmailEligibilityError(null)).toContain("requires a constituent");
    expect(getPathEmailEligibilityError({ ...eligibleRecipient, email: null })).toContain("email address");
    expect(getPathEmailEligibilityError({ ...eligibleRecipient, doNotContact: true })).toContain("communication preferences");
    expect(getPathEmailEligibilityError({ ...eligibleRecipient, doNotEmail: true })).toContain("communication preferences");
    expect(getPathEmailEligibilityError({ ...eligibleRecipient, emailOptOut: true })).toContain("communication preferences");
  });
});