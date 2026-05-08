/**
 * Reset verification helper for destructive CRM reset actions.
 * Stores one active 10-digit code per user in memory with a short expiration.
 */
import { randomInt } from "node:crypto";

interface ResetVerificationEntry {
  /** The one-time code displayed in the Settings danger zone. */
  code: string;
  /** Absolute expiration time for the generated code. */
  expiresAt: Date;
}

const RESET_CODE_TTL_MS = 10 * 60 * 1000;
const verificationCodes = new Map<string, ResetVerificationEntry>();

/**
 * Generates and stores a new verification code for the requesting user.
 * A new code replaces any previous code so only the latest challenge is valid.
 */
export function createResetVerificationCode(userId: string): ResetVerificationEntry {
  const code = Array.from({ length: 10 }, () => randomInt(0, 10)).join("");
  const entry = {
    code,
    expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS),
  };

  verificationCodes.set(userId, entry);
  return entry;
}

/**
 * Checks whether the supplied verification code matches the latest live code.
 * Expired codes are discarded eagerly so the caller can request a fresh code.
 */
export function verifyResetVerificationCode(userId: string, code: string): boolean {
  const entry = verificationCodes.get(userId);
  if (!entry) {
    return false;
  }

  if (entry.expiresAt.getTime() <= Date.now()) {
    verificationCodes.delete(userId);
    return false;
  }

  return entry.code === code;
}

/**
 * Clears the current verification code after a completed or abandoned reset flow.
 */
export function clearResetVerificationCode(userId: string): void {
  verificationCodes.delete(userId);
}
