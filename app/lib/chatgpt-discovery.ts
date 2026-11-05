export type ChatGptDiscoveryCheck = { name: string; ok: boolean; detail: string };
/** Public, same-origin probes: no CRM bearer tokens/cookies or financial data are sent. */
export async function checkChatGptDiscovery(origin: string): Promise<ChatGptDiscoveryCheck[]> {
  if (origin !== window.location.origin) throw new Error("Run the connection check from this installation's own domain.");
  const results: ChatGptDiscoveryCheck[] = [];
  async function metadata(path: string) {
    const response = await fetch(path, { credentials: "omit", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000), headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`HTTP ${response.status} at ${path}. Check that your web proxy forwards this public path to the API.`);
    const text = await response.text(); if (text.length > 32768) throw new Error(`Unexpected response at ${path}.`);
    try { return JSON.parse(text) as Record<string, unknown>; } catch { throw new Error(`The public path ${path} returned a web page instead of OAuth metadata. Check proxy routing.`); }
  }
  const responses = await Promise.allSettled([metadata("/.well-known/oauth-authorization-server"), metadata("/.well-known/oauth-protected-resource/api/chatgpt/mcp")]);
  const auth = responses[0], resource = responses[1];
  if (auth.status === "fulfilled") {
    const d = auth.value;
    const valid = d.issuer === origin && d.authorization_endpoint === `${origin}/api/chatgpt/oauth/authorize` && d.token_endpoint === `${origin}/api/chatgpt/oauth/token`;
    results.push({ name: "OAuth discovery", ok: valid, detail: valid ? "Public authorization and token endpoints match this domain." : "The OAuth domain or endpoints do not match this installation." });
    const automatic = d.client_id_metadata_document_supported === true && Array.isArray(d.token_endpoint_auth_methods_supported) && d.token_endpoint_auth_methods_supported.includes("none") && Array.isArray(d.code_challenge_methods_supported) && d.code_challenge_methods_supported.includes("S256");
    results.push({ name: "Automatic ChatGPT client and PKCE", ok: automatic, detail: automatic ? "ChatGPT can identify its client and callback automatically using CIMD and S256." : "Deploy the automatic-setup API before using automatic client identification." });
  } else results.push({ name: "OAuth discovery", ok: false, detail: auth.reason instanceof Error ? auth.reason.message : "OAuth metadata is unavailable." });
  if (resource.status === "fulfilled") {
    const d = resource.value, valid = d.resource === `${origin}/api/chatgpt/mcp` && Array.isArray(d.authorization_servers) && d.authorization_servers.includes(origin);
    results.push({ name: "Tool-server discovery", ok: valid, detail: valid ? "The MCP resource matches this installation." : "MCP resource metadata does not match this domain." });
  } else results.push({ name: "Tool-server discovery", ok: false, detail: resource.reason instanceof Error ? resource.reason.message : "Resource metadata is unavailable." });
  try {
    const response = await fetch("/api/chatgpt/mcp", { method: "POST", credentials: "omit", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000), headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "oyamacrm-setup-check", version: "1" } } }) });
    const ok = response.status === 401 && !!response.headers.get("www-authenticate")?.includes(`${origin}/api/chatgpt/resource-metadata`);
    results.push({ name: "Protected MCP endpoint", ok, detail: ok ? "The endpoint is reachable and requires sign-in before any CRM access." : `HTTP ${response.status}. ${response.status === 503 ? "Enable ChatGPT first and check for a server-operator lock." : "Check the public MCP route and OAuth challenge."}` });
  } catch (e) { results.push({ name: "Protected MCP endpoint", ok: false, detail: e instanceof Error ? e.message : "The endpoint could not be reached." }); }
  return results;
}
