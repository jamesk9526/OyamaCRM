import { createHash, randomBytes } from "node:crypto";

export const SCOPES = ["letters.read", "letters.write", "reports.read"] as const;
export function connectionConfig() {
  const raw = process.env.CHATGPT_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_ORIGIN || "";
  const url = new URL(raw || "http://localhost:3000");
  if (raw && (url.pathname !== "/" || url.search || url.hash || url.username || url.password ||
      (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))))) throw new Error("CHATGPT_PUBLIC_URL must be a public HTTPS origin.");
  const redirects = (process.env.CHATGPT_REDIRECT_URIS || "").split(",").map(s => s.trim()).filter(Boolean);
  for (const value of redirects) { const u = new URL(value); if (u.protocol !== "https:" || u.hash || u.username || u.password) throw new Error("ChatGPT redirect URIs must be exact HTTPS URLs."); }
  return { enabled: process.env.CHATGPT_ENABLED === "true" && !!raw && redirects.length > 0, origin: url.origin, resource: `${url.origin}/api/chatgpt/mcp`, clientId: process.env.CHATGPT_CLIENT_ID || "oyama-chatgpt", redirects };
}
export const opaqueToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function authorizationInput(raw: Record<string, unknown>) {
  const config = connectionConfig();
  const value = (key: string) => typeof raw[key] === "string" ? raw[key] as string : "";
  const scopes = value("scope").split(" ").filter(Boolean);
  if (!config.enabled || value("client_id") !== config.clientId || !config.redirects.includes(value("redirect_uri")) || value("response_type") !== "code" || value("resource") !== config.resource || value("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(value("code_challenge")) || !scopes.length || scopes.some(s => !(SCOPES as readonly string[]).includes(s)) || value("state").length > 2048) throw new Error("Invalid connection request. Check the client, exact callback URL, scopes, resource and PKCE settings.");
  return { clientId: config.clientId, redirectUri: value("redirect_uri"), resource: config.resource, challenge: value("code_challenge"), scopes: [...new Set(scopes)].join(" "), state: value("state") };
}
