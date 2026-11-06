/** Standalone Letters and Email remain available while Create is being validated. */
export function shouldRedirectToCreate(pathname: string, legacy: string | null): boolean {
  if (legacy === "1" || pathname === "/communications") return false;
  return /^\/(communications|campaigns)(\/|$)/.test(pathname);
}
