const dateFields = [
  "loiDeadline", "loiSubmittedAt", "applicationDeadline", "submittedAt",
  "awardedAt", "rejectedAt", "grantPeriodStart", "grantPeriodEnd",
  "reportingDeadline", "reportingSubmittedAt",
] as const;

/** Validate grant draft fields before Prisma writes so invalid input remains actionable. */
export function invalidGrantFields(input: Record<string, unknown>): string | null {
  if ("title" in input && (typeof input.title !== "string" || !input.title.trim())) return "Enter a grant title.";
  for (const field of ["amountRequested", "amountAwarded"]) {
    const value = input[field];
    if (value === undefined || value === null || value === "") continue;
    if (!["string", "number"].includes(typeof value) || typeof value === "string" && !value.trim()) return "Enter a valid grant amount.";
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0 || amount >= 10_000_000_000) return "Grant amounts must be between zero and 9,999,999,999.99.";
  }
  for (const field of dateFields) {
    const value = input[field];
    if (value === undefined || value === null || value === "") continue;
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value) || !Number.isFinite(new Date(value).getTime())) return `Enter a valid ${field}.`;
    const day = value.slice(0, 10);
    if (new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) return `Enter a valid ${field}.`;
  }
  if ("requiresLOI" in input && typeof input.requiresLOI !== "boolean") return "Choose whether a letter of intent is required.";
  if (input.assigneeId !== undefined && input.assigneeId !== null && typeof input.assigneeId !== "string") return "Choose an organization staff member as assignee.";
  return null;
}
