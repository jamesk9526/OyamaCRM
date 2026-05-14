/**
 * Shared engagement orchestration helpers used by Steward Paths and other
 * donor-engagement surfaces.
 *
 * This module is the first slice of the shared service contract described in
 * `docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md` (Phase 3). It contains
 * pure, framework-free helpers that any caller — server engine, web UI,
 * worker — can import.
 *
 * The server's existing `steward-paths-sequence-engine.ts` keeps its current
 * private copies of these helpers for now. Cutover to the shared helpers will
 * happen in a later Phase-3 pass once parity is verified by tests.
 */

/** Allowed delay units across the engagement system. */
export type EngagementDelayUnit = "minutes" | "hours" | "days" | "weeks" | "months";

/** Configuration shape for a delay step. */
export interface EngagementDelayConfig {
  amount: number;
  unit: EngagementDelayUnit;
}

/**
 * Adds a positive duration to a date and returns a new Date.
 *
 * Behavior:
 * - Negative or non-finite amounts are clamped to 0.
 * - Unknown units default to days for safety.
 * - Months use calendar arithmetic (setMonth) so end-of-month rollover
 *   matches platform JS semantics consistently across callers.
 */
export function addEngagementDuration(date: Date, amount: number, unit: EngagementDelayUnit): Date {
  const next = new Date(date.getTime());
  const safeAmount = Number.isFinite(amount) && amount > 0 ? Math.floor(amount) : 0;
  switch (unit) {
    case "minutes":
      next.setMinutes(next.getMinutes() + safeAmount);
      return next;
    case "hours":
      next.setHours(next.getHours() + safeAmount);
      return next;
    case "weeks":
      next.setDate(next.getDate() + safeAmount * 7);
      return next;
    case "months":
      next.setMonth(next.getMonth() + safeAmount);
      return next;
    case "days":
    default:
      next.setDate(next.getDate() + safeAmount);
      return next;
  }
}

/**
 * Computes the scheduled-for date for a delay step, applying safe defaults.
 *
 * - `amount` is clamped to a minimum of 1 to avoid an immediately-due step.
 * - `unit` defaults to "days" when not provided.
 */
export function computeDelayScheduledFor(
  now: Date,
  config: { amount?: number; unit?: EngagementDelayUnit },
): Date {
  const amount = Math.max(1, Math.floor(config.amount ?? 1));
  const unit: EngagementDelayUnit = config.unit ?? "days";
  return addEngagementDuration(now, amount, unit);
}

/** Communication preference flags considered when deciding whether to contact a donor. */
export interface ConstituentCommunicationPreferences {
  doNotEmail?: boolean | null;
  emailOptOut?: boolean | null;
  doNotMail?: boolean | null;
  doNotCall?: boolean | null;
  doNotContact?: boolean | null;
}

/** Channels checked by `canContactConstituent`. */
export type CommunicationChannel = "email" | "letter" | "mail" | "phone";

/**
 * Returns true when the donor's communication preferences allow contact on
 * the given channel.
 *
 * Rules:
 * - `doNotContact` blocks every channel.
 * - `doNotEmail` or `emailOptOut` blocks email.
 * - `doNotMail` blocks letter/mail (physical).
 * - `doNotCall` blocks phone.
 *
 * Defaults to allowed when a preference field is missing, matching the
 * existing campaign send behavior.
 */
export function canContactConstituent(
  prefs: ConstituentCommunicationPreferences | null | undefined,
  channel: CommunicationChannel,
): boolean {
  if (!prefs) return true;
  if (prefs.doNotContact) return false;
  if (channel === "email") {
    if (prefs.doNotEmail || prefs.emailOptOut) return false;
    return true;
  }
  if (channel === "letter" || channel === "mail") {
    if (prefs.doNotMail) return false;
    return true;
  }
  if (channel === "phone") {
    if (prefs.doNotCall) return false;
    return true;
  }
  return true;
}

/** Supported branch comparison operators for if/else logic on numeric/string fields. */
export type BranchOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "between" | "in" | "not_in";

/** A single branch comparison rule. */
export interface BranchRule {
  operator: BranchOperator;
  value: number | string | Array<number | string>;
  valueTo?: number | string;
}

/**
 * Evaluates a branch rule against an input value.
 *
 * - String comparisons are case-insensitive.
 * - `in` / `not_in` require an array `value`; non-arrays evaluate to false.
 * - Numeric operators on non-numeric input return false.
 */
export function evaluateBranchRule(input: number | string | null | undefined, rule: BranchRule): boolean {
  if (rule.operator === "in" || rule.operator === "not_in") {
    if (!Array.isArray(rule.value)) return false;
    const list = rule.value.map((v) => (typeof v === "string" ? v.toLowerCase() : v));
    const target = typeof input === "string" ? input.toLowerCase() : input;
    const hit = target == null ? false : list.includes(target);
    return rule.operator === "in" ? hit : !hit;
  }

  if (rule.operator === "eq" || rule.operator === "neq") {
    const a = typeof input === "string" ? input.toLowerCase() : input;
    const b = typeof rule.value === "string" ? rule.value.toLowerCase() : rule.value;
    const equal = a === b;
    return rule.operator === "eq" ? equal : !equal;
  }

  if (rule.operator === "between") {
    const min = typeof rule.value === "number" ? rule.value : Number(rule.value);
    const max = typeof rule.valueTo === "number" ? rule.valueTo : Number(rule.valueTo);
    if (typeof input !== "number" || !Number.isFinite(min) || !Number.isFinite(max)) return false;
    return input >= Math.min(min, max) && input <= Math.max(min, max);
  }

  // Remaining operators are numeric.
  if (typeof input !== "number" || typeof rule.value !== "number") return false;
  switch (rule.operator) {
    case "gt":
      return input > rule.value;
    case "gte":
      return input >= rule.value;
    case "lt":
      return input < rule.value;
    case "lte":
      return input <= rule.value;
    default:
      return false;
  }
}
