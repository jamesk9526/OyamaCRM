import { describe, expect, it } from "vitest";
import {
  clearResetVerificationCode,
  createResetVerificationCode,
  verifyResetVerificationCode,
} from "@/server/src/lib/reset-verification";

describe("reset verification helper", () => {
  it("creates a 10-digit numeric code and verifies it for the same user", () => {
    const entry = createResetVerificationCode("user-a");

    expect(entry.code).toMatch(/^\d{10}$/);
    expect(verifyResetVerificationCode("user-a", entry.code)).toBe(true);
  });

  it("rejects codes for a different user", () => {
    const entry = createResetVerificationCode("user-b");

    expect(verifyResetVerificationCode("user-c", entry.code)).toBe(false);
    clearResetVerificationCode("user-b");
  });

  it("clears codes after the flow is cancelled or completed", () => {
    const entry = createResetVerificationCode("user-d");

    expect(verifyResetVerificationCode("user-d", entry.code)).toBe(true);
    clearResetVerificationCode("user-d");
    expect(verifyResetVerificationCode("user-d", entry.code)).toBe(false);
  });
});
