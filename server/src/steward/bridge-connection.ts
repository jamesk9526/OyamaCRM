/** Parses user-supplied desktop exports. Import is not authorization: callers must require admin access. */
export function parseDesktopBridgeConnection(input: unknown) {
  if (typeof input !== "string" || input.length > 64000 || !input.trim()) throw new Error("Paste a desktop connection key or URL.");
  let raw = input.trim();
  if (/^https?:\/\//i.test(raw)) {
    const url = new URL(raw);
    raw = url.searchParams.get("bridgePair") || new URLSearchParams(url.hash.slice(1)).get("bridgePair") || "";
  }
  let data: Record<string, unknown>;
  try { data = JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw.split(".")[0], "base64url").toString("utf8")); }
  catch { throw new Error("The desktop connection key is invalid. Copy it again from Oyama Bridge."); }
  const payload = data.payload && typeof data.payload === "object" ? data.payload as Record<string, unknown> : data;
  if (payload.expiresAt && (!Number.isFinite(new Date(String(payload.expiresAt)).getTime()) || new Date(String(payload.expiresAt)).getTime() < Date.now())) throw new Error("The connection key expired. Generate a new desktop key.");
  const endpoint = new URL(String(payload.endpoint || ""));
  if (!["http:", "https:"].includes(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error("Use a valid bridge HTTP(S) endpoint without embedded credentials.");
  const apiKey = String(payload.apiKey || "").replace(/^Bearer\s+/i, "").trim();
  const model = String(payload.model || "").trim();
  const thinkingModel = String(payload.thinkingModel || model).trim();
  if (apiKey.length < 12 || apiKey.length > 500 || !model || model.length > 120 || thinkingModel.length > 120) throw new Error("The connection key is missing its API key or model.");
  return { endpointUrl: endpoint.toString().replace(/\/+$/, ""), apiKey, model, thinkingModel };
}
