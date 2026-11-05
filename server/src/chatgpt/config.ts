import { createHash, randomBytes } from "node:crypto";
import { AI_SCOPES, AI_READ_SCOPE, AI_WRITE_SCOPE, LEGACY_SCOPES } from "../ai-access/catalog.js";

/** Keep discovery compact: clients may request every advertised scope during sign-in.
 * Existing granular grants remain accepted without advertising the full policy catalog.
 */
export const DISCOVERY_SCOPES: readonly string[] = [...LEGACY_SCOPES, AI_READ_SCOPE, AI_WRITE_SCOPE];
export const SCOPES: readonly string[] = [...new Set([...DISCOVERY_SCOPES, ...AI_SCOPES])];
export function connectionConfig() {
  const raw = process.env.CHATGPT_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_ORIGIN || "";
  const issues: string[] = []; let url = new URL("http://localhost:3000"), originConfigured = false;
  if (raw) try {
    const candidate = new URL(raw);
    if (candidate.pathname !== "/" || candidate.search || candidate.hash || candidate.username || candidate.password || (candidate.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && candidate.protocol === "http:" && ["localhost", "127.0.0.1"].includes(candidate.hostname)))) throw new Error();
    url = candidate; originConfigured = true;
  } catch { issues.push("The environment public URL is invalid; use automatic setup from the public installation domain."); }
  const redirects: string[] = [];
  for (const value of (process.env.CHATGPT_REDIRECT_URIS || "").split(",").map(s => s.trim()).filter(Boolean)) {
    try { const u = new URL(value); if (value.length > 2048 || u.protocol !== "https:" || u.hash || u.username || u.password) throw new Error(); redirects.push(value); }
    catch { issues.push("A manual callback in the environment is invalid. It was rejected; automatic CIMD setup does not use it."); }
  }
  return { enabled: process.env.CHATGPT_ENABLED === "true" && originConfigured, originConfigured, issues, source: "environment" as "environment" | "settings" | "unconfigured", origin: url.origin, resource: `${url.origin}/api/chatgpt/mcp`, clientId: process.env.CHATGPT_CLIENT_ID || "oyama-chatgpt", redirects };
}
export type ConnectionConfig = ReturnType<typeof connectionConfig>;
export const opaqueToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function authorizationInput(raw: Record<string, unknown>, config = connectionConfig(), verifiedClient?: { clientId: string; redirects: string[] }) {
  const value = (key: string) => typeof raw[key] === "string" ? raw[key] as string : "";
  if (value("scope").length > 6000) throw new Error("Use the CRM read and write scopes to authorize an access profile.");
  const scopes = (value("scope") || "letters.read reports.read").split(/\s+/).filter(Boolean);
  const client = verifiedClient || { clientId: config.clientId, redirects: config.redirects };
  if (!config.enabled || value("client_id") !== client.clientId || !client.redirects.includes(value("redirect_uri")) || value("response_type") !== "code" || value("resource") !== config.resource || value("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(value("code_challenge")) || !scopes.length || scopes.some(s => !(SCOPES as readonly string[]).includes(s)) || value("state").length > 2048) throw new Error("Invalid connection request. Check the client, exact callback URL, scopes, resource and PKCE settings.");
  return { clientId: client.clientId, redirectUri: value("redirect_uri"), resource: config.resource, challenge: value("code_challenge"), scopes: [...new Set(scopes)].join(" "), state: value("state") };
}
