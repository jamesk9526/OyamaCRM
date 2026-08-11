/**
 * Converts a configured API URL into the public origin/base used before route paths.
 * Deployment values commonly end in `/api`; route builders append `/api/...` themselves.
 */
export function normalizePublicApiRootUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    parsed.search = "";
    parsed.hash = "";
    parsed.pathname = parsed.pathname.replace(/(?:\/api)+\/?$/i, "").replace(/\/+$/, "");
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return raw
      .replace(/[?#].*$/, "")
      .replace(/(?:\/api)+\/?$/i, "")
      .replace(/\/+$/, "");
  }
}
