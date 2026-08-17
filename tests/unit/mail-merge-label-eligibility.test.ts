import { describe, expect, it } from "vitest";
import {
  getLabelEligibility,
  unavailableLabelReasonSummary,
} from "../../app/components/letters/mail-merge-label-eligibility";

const completeAddress = { addressLine1: "10 Main St", city: "Tyler", state: "TX", zip: "75701" };

describe("mail merge label eligibility", () => {
  it("keeps mail suppressions excluded by default", () => {
    expect(getLabelEligibility({ ...completeAddress, doNotMail: true })).toMatchObject({ ready: false, kind: "do-not-mail" });
    expect(getLabelEligibility({ ...completeAddress, doNotContact: true })).toMatchObject({ ready: false, kind: "do-not-contact" });
  });

  it("allows an explicit label-only suppression override", () => {
    expect(getLabelEligibility({ ...completeAddress, doNotMail: true }, true)).toEqual({
      ready: true,
      kind: "suppression-overridden",
      reason: "Mail suppression overridden for this label PDF",
    });
  });

  it("does not override a missing street address", () => {
    expect(getLabelEligibility({ doNotMail: true }, true)).toMatchObject({ ready: false, kind: "missing-street" });
  });

  it("updates unavailable reasons when suppressions are overridden", () => {
    const rows = [{ ...completeAddress, doNotMail: true }, { doNotContact: true }];
    expect(unavailableLabelReasonSummary(rows)).toContain("Do Not Mail");
    expect(unavailableLabelReasonSummary(rows, true)).toBe("1 no street address");
  });
});
