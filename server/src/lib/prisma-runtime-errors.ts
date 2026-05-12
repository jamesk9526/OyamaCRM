/** Helpers for detecting Prisma runtime errors caused by DB/schema drift. */

/**
 * Returns true when a Prisma/runtime error suggests pending migrations or missing DB columns.
 */
export function isSchemaDriftError(error: unknown): boolean {
  const message = getErrorMessage(error);
  if (!message) return false;

  return (
    /\bP2022\b/i.test(message)
    || /The column .* does not exist/i.test(message)
    || /Unknown column/i.test(message)
    || /does not exist in the current database/i.test(message)
  );
}

/**
 * Builds one safe, operator-actionable API message when runtime schema drift is detected.
 */
export function migrationRequiredMessage(context: string): string {
  return `${context} is temporarily unavailable because database migrations are pending. Run pnpm db:migrate and pnpm db:generate, then restart the API.`;
}

/** Reads an error message string from unknown errors. */
function getErrorMessage(error: unknown): string {
  if (!error) return "";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "";
}
