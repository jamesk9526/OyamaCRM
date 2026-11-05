// Synthetic browser fixtures for connection screens; never connects a real ChatGPT or CRM account.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
const base = process.env.CHATGPT_UI_WEB || 'http://localhost:3218';
const evidence = 'docs/status/audit-artifacts/2026-11-04-chatgpt-connection';
await fs.mkdir(evidence, { recursive: true });
let debugPage;
const browser = await chromium.launch({ headless: true, args: ['--no-proxy-server'] });
const errors = [], checks = [], consents = [];
const user = { id: 'synthetic-staff', organizationId: 'synthetic-org', email: 'staff@example.invalid', firstName: 'Taylor', lastName: 'Sample', role: 'admin', permissions: [] };
const scopes = ['letters.read', 'letters.write', 'reports.read'];
const params = new URLSearchParams({ response_type: 'code', client_id: 'oyama-chatgpt', redirect_uri: 'https://chatgpt.com/connector_platform/oauth/callback', resource: 'https://nonprofit.example.invalid/api/chatgpt/mcp', scope: scopes.join(' '), state: 'fixture-state', code_challenge: 'a'.repeat(43), code_challenge_method: 'S256' });
let signedIn = true, connected = true, failure = false;
let policy = { enabled: true, allowLetterRead: true, allowLetterDrafts: false, allowReports: true, defaultDateBasis: 'calendar', allowDateBasisOverride: false, maxReportRows: 100 }, policyRevision = 0;
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['clipboard-read', 'clipboard-write'] });
  await context.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname, method = req.method();
    const json = (body, status = 200) => route.fulfill({ status, json: body });
    if (path === '/api/auth/refresh') return signedIn ? json({ data: { accessToken: 'synthetic-session' } }) : json({ error: { message: 'Sign in' } }, 401);
    if (path === '/api/auth/me') return json({ data: user });
    if (path === '/api/auth/login') { signedIn = true; return json({ data: { accessToken: 'synthetic-session', user } }); }
    if (path === '/api/setup/status') return json({ data: { setupCompleted: true } });
    if (path === '/api/chatgpt/settings' && method === 'PUT') { const body = req.postDataJSON(); assert.equal(body.revision, policyRevision); policy = body.policy; policyRevision++; return json({ policy, revision: policyRevision }); }
    if (path === '/api/chatgpt/connections') return json({ enabled: policy.enabled, installationEnabled: true, policy, policyRevision, canManagePolicy: true, mcpUrl: `${base}/api/chatgpt/mcp`, clientId: 'oyama-chatgpt', redirectUris: [params.get('redirect_uri')], scopes, connections: connected ? [{ id: 'synthetic-connection', scopes: scopes.join(' '), createdAt: '2026-11-04T12:00:00Z', lastUsedAt: null }] : [] });
    if (path === '/api/chatgpt/connections/synthetic-connection' && method === 'DELETE') { connected = false; return route.fulfill({ status: 204 }); }
    if (path === '/api/chatgpt/oauth/consent') { consents.push(req.postDataJSON()); return failure ? json({ error: { message: 'Synthetic permission change. Reconnect with reporting access.' } }, 403) : json({ redirectUrl: `${base}/connect/chatgpt?fixture_complete=1` }); }
    if (path === '/api/settings/workspaces') return json({});
    if (path === '/api/settings') return json({});
    if (path === '/api/payments/health') return json({ stripeReady: false, paypalReady: false, activeProvider: null, currency: 'USD', issues: [] });
    if (path === '/api/site-embeds/config' || path === '/api/steward-ai/config') return json({ error: { message: 'Unconfigured fixture integration' } }, 503);
    if (path === '/api/quickbooks/status') return json({ configured: false, enabled: false, connected: false });
    if (path === '/api/notifications') return json({ items: [], notifications: [], unreadCount: 0 });
    return json([]);
  });
  const page = await context.newPage(); debugPage = page; page.on('pageerror', e => errors.push(e.stack || e.message));
  const shot = name => page.screenshot({ path: `${evidence}/${name}.png`, fullPage: true });
  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
  await page.goto(`${base}/connect/chatgpt?${params}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Allow connection', exact: true }).waitFor({ timeout: 120000 });
  assert.match(await page.locator('main').innerText(), /staff@example.invalid/);
  await noOverflow(); await shot('consent-desktop');
  failure = true; await page.getByRole('button', { name: 'Allow connection', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Synthetic permission change' }).waitFor();
  assert.equal(consents[0].approved, true); assert.equal(consents[0].state, 'fixture-state');
  checks.push('Explicit consent shows current CRM identity and permissions; server errors stay actionable.');
  await page.setViewportSize({ width: 390, height: 844 }); await noOverflow(); await shot('consent-phone');
  failure = false; await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.waitForURL('**/connect/chatgpt?fixture_complete=1'); assert.equal(consents.at(-1).approved, false);
  checks.push('Mobile consent wraps without horizontal overflow; cancel returns to the validated callback.');
  signedIn = false; await page.goto(`${base}/connect/chatgpt?${params}`);
  await page.getByRole('link', { name: 'Sign in to OyamaCRM', exact: true }).click();
  await page.getByLabel('Email address', { exact: true }).fill('staff@example.invalid');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-password');
  await page.getByRole('button', { name: /Sign in/i, exact: false }).click();
  await page.getByRole('button', { name: 'Allow connection', exact: true }).waitFor();
  assert.equal(new URL(page.url()).pathname, '/connect/chatgpt');
  assert.equal(await page.evaluate(() => sessionStorage.getItem('oyama-chatgpt-return')), null);
  checks.push('Existing CRM sign-in returns to the pending connection and clears the local return path.');
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(`${base}/settings/integrations`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'ChatGPT · Letters and reporting' }).waitFor();
  await page.getByRole('button', { name: 'Disconnect', exact: true }).waitFor();
  assert.equal(await page.getByLabel('This installation’s MCP URL', { exact: true }).inputValue(), `${base}/api/chatgpt/mcp`);
  await page.getByRole('button', { name: 'Copy MCP URL', exact: true }).click();
  await page.getByRole('button', { name: 'Copied', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), `${base}/api/chatgpt/mcp`);
  await page.getByText('Server setup · administrator', { exact: true }).click();
  assert.ok((await page.locator('details').filter({ hasText: 'Server setup · administrator' }).innerText()).includes('CHATGPT_PUBLIC_URL=' + base));
  await page.getByText('Server setup · administrator', { exact: true }).click();
  checks.push('MCP URL is generated from the installation domain, copies exactly, and the administrator guide uses that origin.');
  await page.getByRole('combobox', { name: /Reporting calendar/ }).selectOption('fiscal');
  await page.getByRole('checkbox', { name: /^Create letter drafts/ }).check();
  await page.getByLabel('Maximum report rows', { exact: false }).fill('25');
  await page.getByRole('button', { name: 'Save MCP controls', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'MCP controls saved' }).waitFor();
  assert.equal(policy.defaultDateBasis, 'fiscal'); assert.equal(policy.allowLetterDrafts, true); assert.equal(policy.maxReportRows, 25);
  await noOverflow(); await page.getByRole('heading', { name: 'ChatGPT · Letters and reporting' }).scrollIntoViewIfNeeded(); await shot('settings-desktop');
  checks.push('Organization controls save fiscal calendar, draft access and report limits with an optimistic revision.');
  await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await page.getByText('No active ChatGPT connections for your account.', { exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 844 }); await noOverflow();
  await page.getByRole('heading', { name: 'Organization MCP controls' }).scrollIntoViewIfNeeded(); await shot('settings-phone');
  await page.getByRole('combobox', { name: /Reporting calendar/ }).scrollIntoViewIfNeeded(); await shot('settings-phone-calendar');
  checks.push('Settings shows this installation’s endpoint and active sessions; disconnect refreshes the session list.');
  assert.deepEqual(errors, []);
  await fs.writeFile(`${evidence}/browser-checks.json`, JSON.stringify({ synthetic: true, checks, errors }, null, 2));
  console.log(JSON.stringify({ checks, errors }));
} catch (error) { if (debugPage) { await debugPage.screenshot({ path: `${evidence}/failure.png`, fullPage: true }); await fs.writeFile(`${evidence}/failure.txt`, debugPage.url() + '\n' + await debugPage.locator('body').innerText() + '\n' + JSON.stringify(errors)); } throw error; } finally { await browser.close(); }
