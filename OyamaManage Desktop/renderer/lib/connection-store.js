const STORAGE_KEY = "oyamaManageDesktop.connection.v1";

export function normalizeBaseUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate).origin;
  } catch {
    return "";
  }
}

export function loadSavedConnection() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const baseUrl = normalizeBaseUrl(parsed.baseUrl);
    if (!baseUrl) return null;
    return {
      baseUrl,
      appName: typeof parsed.appName === "string" ? parsed.appName : "",
      version: typeof parsed.version === "string" ? parsed.version : "",
      environment: typeof parsed.environment === "string" ? parsed.environment : "",
      status: typeof parsed.status === "string" ? parsed.status : "",
    };
  } catch {
    return null;
  }
}

export function saveConnection(connection) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(connection));
  } catch {
    // Ignore storage failures in restricted environments.
  }
}
