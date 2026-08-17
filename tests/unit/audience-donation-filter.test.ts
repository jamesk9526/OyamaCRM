import { describe, expect, it } from "vitest";
import { matchesDonationCount, previousCalendarYear } from "../../app/components/contacts-manager/audience-donation-filter";

describe("audience donation filtering", () => {
  it("matches donors who gave exactly once", () => {
    expect(matchesDonationCount(1, "EXACTLY", 1)).toBe(true);
    expect(matchesDonationCount(0, "EXACTLY", 1)).toBe(false);
    expect(matchesDonationCount(2, "EXACTLY", 1)).toBe(false);
  });

  it("supports at-least and at-most advanced count comparisons", () => {
    expect(matchesDonationCount(3, "AT_LEAST", 2)).toBe(true);
    expect(matchesDonationCount(3, "AT_MOST", 2)).toBe(false);
  });

  it("derives the previous calendar year", () => {
    expect(previousCalendarYear(new Date("2026-08-17T12:00:00Z"))).toBe(2025);
  });
});
