import { describe, expect, it } from "vitest";
import { resolveRemoteScore } from "@/server/src/services/trivia-score-control";

describe("phone scoring", () => {
  it("applies one-point increments and decrements", () => {
    expect(resolveRemoteScore(10, { delta: 1 }, false)).toEqual({ ok: true, nextScore: 11, appliedDelta: 1 });
    expect(resolveRemoteScore(10, { delta: -1 }, false)).toEqual({ ok: true, nextScore: 9, appliedDelta: -1 });
  });
  it("sets a total from the latest server score without the adjustment limit", () => {
    expect(resolveRemoteScore(30, { total: 500 }, false)).toEqual({ ok: true, nextScore: 500, appliedDelta: 470 });
    expect(resolveRemoteScore(500, { total: 7 }, false)).toEqual({ ok: true, nextScore: 7, appliedDelta: -493 });
    expect(resolveRemoteScore(7, { total: 0 }, false)).toEqual({ ok: true, nextScore: 0, appliedDelta: -7 });
  });
  it("rejects invalid totals and database integer overflow", () => {
    for (const total of [null, "", "20", -1, 1.5, Infinity, NaN, 2_147_483_648]) {
      expect(resolveRemoteScore(10, { total }, false).ok).toBe(false);
    }
    expect(resolveRemoteScore(2_147_483_647, { delta: 1 }, false).ok).toBe(false);
  });
  it("honors the negative score rule and rejects a no-op", () => {
    expect(resolveRemoteScore(0, { delta: -1 }, false).ok).toBe(false);
    expect(resolveRemoteScore(0, { delta: -1 }, true)).toMatchObject({ ok: true, nextScore: -1 });
    expect(resolveRemoteScore(10, { total: 10 }, false).ok).toBe(false);
  });
});
