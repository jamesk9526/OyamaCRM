import { CreateError } from "../oyama-create/domain.js";

type VerifiedClient = { clientId: string; redirects: string[] };
const cache = new Map<string, { until: number; value: VerifiedClient }>();
export function isChatGptClientId(value: unknown): value is string {
  return typeof value === "string" && /^https:\/\/chatgpt\.com\/oauth\/(?:[A-Za-z0-9_-]{1,160}\/)?client\.json$/.test(value);
}
/** Fetch only fixed OpenAI-hosted metadata URLs. No redirects, credentials or arbitrary URLs. */
export async function verifyChatGptClient(clientId: string): Promise<VerifiedClient> {
  if (!isChatGptClientId(clientId)) throw new CreateError(400, "Choose ChatGPT client metadata (CIMD), or use the configured manual client ID.");
  const hit = cache.get(clientId); if (hit && hit.until > Date.now()) return hit.value;
  let response: globalThis.Response;
  try { response = await fetch(clientId, { redirect: "error", credentials: "omit", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) }); }
  catch { throw new CreateError(503, "ChatGPT client metadata could not be verified. Retry the connection shortly."); }
  if (!response.ok || !response.body) throw new CreateError(503, "ChatGPT client metadata is unavailable. Retry the connection shortly.");
  const reader = response.body.getReader(); let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > 32768) { await reader.cancel(); throw new Error("Too large"); } chunks.push(chunk.value); }
    const doc = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const methods = Array.isArray(doc.token_endpoint_auth_methods_supported) ? doc.token_endpoint_auth_methods_supported : [doc.token_endpoint_auth_method];
    if (doc.client_id !== clientId || !methods.includes("none") || !Array.isArray(doc.redirect_uris) || !doc.redirect_uris.length || doc.redirect_uris.length > 20) throw new Error("Invalid client");
    const redirects: string[] = doc.redirect_uris.map((value: unknown) => {
      if (typeof value !== "string" || value.length > 2048) throw new Error("Invalid callback");
      const url = new URL(value);
      if (url.origin !== "https://chatgpt.com" || url.username || url.password || url.hash || url.search || !(/^\/connector\/oauth\/[A-Za-z0-9_-]{1,160}$/.test(url.pathname) || ["/connector_platform_oauth_redirect", "/connector_platform/oauth/callback", "/connector_platform/oauth/redirect"].includes(url.pathname))) throw new Error("Invalid callback");
      return value;
    });
    const value = { clientId, redirects }; if (cache.size >= 64) cache.delete(cache.keys().next().value!);
    cache.set(clientId, { until: Date.now() + 300000, value }); return value;
  } catch { throw new CreateError(400, "ChatGPT's client metadata or callback is invalid. No callback was allowed."); }
  finally { reader.releaseLock(); }
}
