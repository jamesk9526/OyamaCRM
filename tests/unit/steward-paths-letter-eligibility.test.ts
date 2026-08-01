import { describe, expect, it } from "vitest";
import { getPathLetterEligibilityError, resolvePathExecutionActor } from "@/server/src/services/steward-paths-sequence-engine";

const eligibleRecipient = {
  doNotContact: false,
  doNotMail: false,
  addressLine1: "100 Main Street",
  city: "Springfield",
  state: "IL",
  zip: "62701",
};

describe("Steward Paths letter eligibility", () => {
  it("allows a contactable recipient with a complete mailing address", () => {
    expect(getPathLetterEligibilityError(eligibleRecipient)).toBeNull();
  });

  it("blocks postal outreach for recipient communication preferences", () => {
    expect(getPathLetterEligibilityError({ ...eligibleRecipient, doNotMail: true }))
      .toContain("communication preferences");
    expect(getPathLetterEligibilityError({ ...eligibleRecipient, doNotContact: true }))
      .toContain("communication preferences");
  });

  it("requires a recipient and complete postal address", () => {
    expect(getPathLetterEligibilityError(null)).toContain("requires a constituent");
    expect(getPathLetterEligibilityError({ ...eligibleRecipient, zip: null }))
      .toContain("complete mailing address");
  });

  it("uses the path creator when a background worker has no explicit actor or owner", () => {
    expect(resolvePathExecutionActor(undefined, null, null, "path-creator-id")).toBe("path-creator-id");
    expect(resolvePathExecutionActor("request-user", "enrollment-owner", "path-owner", "path-creator"))
      .toBe("request-user");
  });
});