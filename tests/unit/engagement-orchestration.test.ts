/**
 * Unit tests for shared engagement orchestration helpers.
 *
 * Covers delay math, communication-preference checks, and branch rule
 * evaluation that the Steward Paths sequence engine and other surfaces will
 * eventually share.
 */
import { describe, expect, it } from "vitest";

import {
  addEngagementDuration,
  canContactConstituent,
  computeDelayScheduledFor,
  evaluateBranchRule,
} from "@/app/lib/engagement-orchestration";

describe("addEngagementDuration", () => {
  const base = new Date("2026-05-13T12:00:00.000Z");

  it("adds minutes/hours/days/weeks/months", () => {
    expect(addEngagementDuration(base, 30, "minutes").getTime()).toBe(base.getTime() + 30 * 60_000);
    expect(addEngagementDuration(base, 2, "hours").getTime()).toBe(base.getTime() + 2 * 60 * 60_000);
    expect(addEngagementDuration(base, 3, "days").getTime()).toBe(base.getTime() + 3 * 24 * 60 * 60_000);
    expect(addEngagementDuration(base, 2, "weeks").getTime()).toBe(base.getTime() + 14 * 24 * 60 * 60_000);
    // Month rollover uses calendar arithmetic; just assert month moved forward.
    const next = addEngagementDuration(base, 1, "months");
    expect(next.getUTCMonth()).toBe((base.getUTCMonth() + 1) % 12);
  });

  it("treats zero, negative, and non-finite amounts as no-op", () => {
    expect(addEngagementDuration(base, 0, "days").getTime()).toBe(base.getTime());
    expect(addEngagementDuration(base, -5, "days").getTime()).toBe(base.getTime());
    expect(addEngagementDuration(base, NaN, "days").getTime()).toBe(base.getTime());
    expect(addEngagementDuration(base, Infinity, "days").getTime()).toBe(base.getTime());
  });

  it("does not mutate the input date", () => {
    const original = base.getTime();
    addEngagementDuration(base, 7, "days");
    expect(base.getTime()).toBe(original);
  });
});

describe("computeDelayScheduledFor", () => {
  const now = new Date("2026-05-13T12:00:00.000Z");

  it("clamps amount to a minimum of 1 to avoid immediately-due steps", () => {
    expect(computeDelayScheduledFor(now, { amount: 0, unit: "days" }).getTime())
      .toBe(now.getTime() + 24 * 60 * 60_000);
    expect(computeDelayScheduledFor(now, { amount: -3, unit: "days" }).getTime())
      .toBe(now.getTime() + 24 * 60 * 60_000);
  });

  it("defaults missing unit to days", () => {
    expect(computeDelayScheduledFor(now, { amount: 2 }).getTime())
      .toBe(now.getTime() + 2 * 24 * 60 * 60_000);
  });

  it("defaults missing amount to 1", () => {
    expect(computeDelayScheduledFor(now, { unit: "hours" }).getTime())
      .toBe(now.getTime() + 60 * 60_000);
  });
});

describe("canContactConstituent", () => {
  it("allows contact when prefs are missing", () => {
    expect(canContactConstituent(null, "email")).toBe(true);
    expect(canContactConstituent(undefined, "letter")).toBe(true);
    expect(canContactConstituent({}, "phone")).toBe(true);
  });

  it("doNotContact blocks every channel", () => {
    const prefs = { doNotContact: true };
    expect(canContactConstituent(prefs, "email")).toBe(false);
    expect(canContactConstituent(prefs, "letter")).toBe(false);
    expect(canContactConstituent(prefs, "mail")).toBe(false);
    expect(canContactConstituent(prefs, "phone")).toBe(false);
  });

  it("doNotEmail and emailOptOut block email but not other channels", () => {
    expect(canContactConstituent({ doNotEmail: true }, "email")).toBe(false);
    expect(canContactConstituent({ doNotEmail: true }, "letter")).toBe(true);
    expect(canContactConstituent({ emailOptOut: true }, "email")).toBe(false);
    expect(canContactConstituent({ emailOptOut: true }, "phone")).toBe(true);
  });

  it("doNotMail blocks letter and mail channels only", () => {
    expect(canContactConstituent({ doNotMail: true }, "letter")).toBe(false);
    expect(canContactConstituent({ doNotMail: true }, "mail")).toBe(false);
    expect(canContactConstituent({ doNotMail: true }, "email")).toBe(true);
    expect(canContactConstituent({ doNotMail: true }, "phone")).toBe(true);
  });

  it("doNotCall blocks phone only", () => {
    expect(canContactConstituent({ doNotCall: true }, "phone")).toBe(false);
    expect(canContactConstituent({ doNotCall: true }, "email")).toBe(true);
  });
});

describe("evaluateBranchRule", () => {
  it("evaluates equality on strings case-insensitively", () => {
    expect(evaluateBranchRule("Major", { operator: "eq", value: "major" })).toBe(true);
    expect(evaluateBranchRule("Major", { operator: "neq", value: "minor" })).toBe(true);
  });

  it("evaluates equality on numbers", () => {
    expect(evaluateBranchRule(100, { operator: "eq", value: 100 })).toBe(true);
    expect(evaluateBranchRule(100, { operator: "neq", value: 50 })).toBe(true);
  });

  it("evaluates numeric comparison operators", () => {
    expect(evaluateBranchRule(500, { operator: "gt", value: 100 })).toBe(true);
    expect(evaluateBranchRule(100, { operator: "gte", value: 100 })).toBe(true);
    expect(evaluateBranchRule(50, { operator: "lt", value: 100 })).toBe(true);
    expect(evaluateBranchRule(100, { operator: "lte", value: 100 })).toBe(true);
    expect(evaluateBranchRule("not-a-number", { operator: "gt", value: 5 })).toBe(false);
  });

  it("evaluates in/not_in with array value", () => {
    expect(evaluateBranchRule("VIP", { operator: "in", value: ["vip", "board"] })).toBe(true);
    expect(evaluateBranchRule("Other", { operator: "not_in", value: ["vip", "board"] })).toBe(true);
    expect(evaluateBranchRule(2, { operator: "in", value: [1, 2, 3] })).toBe(true);
  });

  it("returns false when in/not_in value is not an array", () => {
    // @ts-expect-error intentionally invalid input to verify safety
    expect(evaluateBranchRule("VIP", { operator: "in", value: "vip" })).toBe(false);
  });

  it("returns false for null/undefined input on lookup operators", () => {
    expect(evaluateBranchRule(null, { operator: "in", value: ["a"] })).toBe(false);
    expect(evaluateBranchRule(undefined, { operator: "eq", value: "a" })).toBe(false);
  });
});
