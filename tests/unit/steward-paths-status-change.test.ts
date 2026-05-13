/**
 * Unit tests for the new Phase 5 STATUS_CHANGE step config helper.
 *
 * `buildStatusChangeUpdate` is the pure validator that turns the configJson
 * `targetField`/`value` pair into a Prisma update payload. It is the only
 * surface of the STATUS_CHANGE step that does not require a database, so we
 * cover its allow-list, type checks, and error messages here.
 *
 * Branch evaluation is exercised by `engagement-orchestration.test.ts`; the
 * server engine uses an in-file mirror of the same `evaluateBranchRule`.
 */
import { describe, expect, it } from "vitest";

import { buildStatusChangeUpdate } from "@/server/src/services/steward-paths-sequence-engine";

describe("buildStatusChangeUpdate (STATUS_CHANGE step)", () => {
  it("rejects targetField values outside the allow-list", () => {
    expect(() => buildStatusChangeUpdate("firstName", "Jane")).toThrowError(/not allowed/);
    expect(() => buildStatusChangeUpdate("totalLifetimeGiving", 1000)).toThrowError(/not allowed/);
    expect(() => buildStatusChangeUpdate("", "x")).toThrowError(/not allowed/);
  });

  describe("donorStatus", () => {
    it("accepts valid enum values", () => {
      expect(buildStatusChangeUpdate("donorStatus", "ACTIVE")).toEqual({ donorStatus: "ACTIVE" });
      expect(buildStatusChangeUpdate("donorStatus", "MAJOR_DONOR")).toEqual({ donorStatus: "MAJOR_DONOR" });
      expect(buildStatusChangeUpdate("donorStatus", "LAPSED")).toEqual({ donorStatus: "LAPSED" });
    });

    it("rejects invalid values", () => {
      expect(() => buildStatusChangeUpdate("donorStatus", "active")).toThrowError(/donorStatus/);
      expect(() => buildStatusChangeUpdate("donorStatus", 1)).toThrowError(/donorStatus/);
      expect(() => buildStatusChangeUpdate("donorStatus", null)).toThrowError(/donorStatus/);
      expect(() => buildStatusChangeUpdate("donorStatus", "WHATEVER")).toThrowError(/donorStatus/);
    });
  });

  describe("engagementScore", () => {
    it("accepts numbers in 0-100 range and rounds them", () => {
      expect(buildStatusChangeUpdate("engagementScore", 0)).toEqual({ engagementScore: 0 });
      expect(buildStatusChangeUpdate("engagementScore", 100)).toEqual({ engagementScore: 100 });
      expect(buildStatusChangeUpdate("engagementScore", 42.6)).toEqual({ engagementScore: 43 });
    });

    it("accepts numeric strings", () => {
      expect(buildStatusChangeUpdate("engagementScore", "50")).toEqual({ engagementScore: 50 });
    });

    it("rejects out-of-range, NaN, or non-numeric values", () => {
      expect(() => buildStatusChangeUpdate("engagementScore", -1)).toThrowError(/0-100/);
      expect(() => buildStatusChangeUpdate("engagementScore", 101)).toThrowError(/0-100/);
      expect(() => buildStatusChangeUpdate("engagementScore", "abc")).toThrowError(/0-100/);
      expect(() => buildStatusChangeUpdate("engagementScore", null)).toThrowError(/0-100/);
    });
  });

  describe("communication preference flags", () => {
    it.each(["doNotEmail", "emailOptOut", "doNotMail", "doNotCall", "doNotContact"])(
      "%s accepts boolean values",
      (field) => {
        expect(buildStatusChangeUpdate(field, true)).toEqual({ [field]: true });
        expect(buildStatusChangeUpdate(field, false)).toEqual({ [field]: false });
      },
    );

    it.each(["doNotEmail", "emailOptOut", "doNotMail", "doNotCall", "doNotContact"])(
      "%s rejects non-boolean values",
      (field) => {
        expect(() => buildStatusChangeUpdate(field, "true")).toThrowError(/boolean/);
        expect(() => buildStatusChangeUpdate(field, 1)).toThrowError(/boolean/);
        expect(() => buildStatusChangeUpdate(field, null)).toThrowError(/boolean/);
      },
    );
  });
});
