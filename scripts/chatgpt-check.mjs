/** Public deployment smoke check. No passwords, API keys or CRM tokens are used. */
import { pathToFileURL } from 'node:url';
export async function checkChatGptConnection(origin) {
  const base = new URL(origin);
  if (base.pathname !== '/' || base.search || base.hash || base.username || base.password || !['https:', 'http:'].includes(base.protocol) || (base.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(base.hostname))) throw new Error('Use the installation’s HTTPS origin, or localhost for a local check.');
  const fetchJson = async path => { const response = await fetch(`${base.origin}${path}`, { redirect: 'error', signal: AbortSignal.timeout(10000) }); if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`); return response.json(); };
  const [authorization, resource] = await Promise.all([fetchJson('/.well-known/oauth-authorization-server'), fetchJson('/.well-known/oauth-protected-resource/api/chatgpt/mcp')]);
  const mcpUrl = `${base.origin}/api/chatgpt/mcp`;
  if (authorization.issuer !== base.origin || resource.resource !== mcpUrl || !resource.authorization_servers?.includes(base.origin)) throw new Error('Discovery issuer/resource does not match this installation.');
  if (!authorization.code_challenge_methods_supported?.includes('S256') || !authorization.token_endpoint_auth_methods_supported?.includes('none')) throw new Error('PKCE public-client authentication is not advertised.');
  for (const [key, suffix] of [['authorization_endpoint', '/oauth/authorize'], ['token_endpoint', '/oauth/token'], ['revocation_endpoint', '/oauth/revoke']]) if (authorization[key] !== `${base.origin}/api/chatgpt${suffix}`) throw new Error(`Incorrect ${key}.`);
  const response = await fetch(mcpUrl, { method: 'POST', redirect: 'error', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'oyama-deployment-check', version: '1' } } }), signal: AbortSignal.timeout(10000) });
  if (response.status !== 401 || !response.headers.get('www-authenticate')?.includes(`${base.origin}/api/chatgpt/resource-metadata`)) throw new Error(`Expected OAuth challenge; received HTTP ${response.status}. Check CHATGPT_ENABLED, callbacks and public proxy routing.`);
  return { passed: true, mcpUrl, checks: ['Public discovery matches this installation', 'OAuth endpoints and S256 PKCE advertised', 'MCP requires authentication and advertises discovery'], next: 'Complete account linking and run the acceptance prompts in ChatGPT. This probe does not test an authenticated user or database writes.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { console.log(JSON.stringify(await checkChatGptConnection(process.argv[2]), null, 2)); }
  catch (error) { console.error(error instanceof Error ? error.message : 'Connection check failed.'); process.exitCode = 1; }
}
