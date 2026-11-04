/** Synthetic staff/admin payment ledger acceptance; no real payments or CRM writes. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const web = process.env.CRM_AUDIT_WEB || 'http://localhost:3220';
const evidence = 'docs/status/audit-artifacts/2026-11-04-crm-completeness';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const checks = [], errors = [];
let admin = false, healthFail = true, ledgerFail = false, healthRequests = 0;
const donations = Array.from({ length: 125 }, (_, index) => ({ id: `gift-${index}`, date: '2026-06-01T00:00:00.000Z', amount: '25.00', paymentMethod: 'CHECK', status: 'COMPLETED', taxDeductible: true, isRecurring: false, receiptNumber: `TEST-${index + 1}`, constituent: { id: `person-${index}`, firstName: 'Synthetic', lastName: `Supporter ${String(index + 1).padStart(3, '0')}`, email: `person${index}@example.invalid` } }));
await context.route('**/api/**', async route => {
  const request = route.request(), url = new URL(request.url()), path = url.pathname;
  const json = (body, status = 200) => route.fulfill({ status, json: body });
  if (path === '/api/auth/refresh') return json({ data: { accessToken: 'synthetic-session' } });
  if (path === '/api/auth/me') return json({ data: { id: 'synthetic-staff', organizationId: 'synthetic-org', role: admin ? 'admin' : 'staff', firstName: 'Taylor', lastName: 'Sample', email: 'staff@example.invalid', permissions: ['view:donations', 'view:constituents'] } });
  if (path === '/api/payments/health') { healthRequests++; return healthFail ? json({ error: { message: 'Synthetic gateway status unavailable' } }, admin ? 500 : 403) : json({ stripeReady: true, paypalReady: false, activeProvider: 'stripe', currency: 'USD', issues: [] }); }
  if (path === '/api/donations') {
    if (ledgerFail) return json({ error: { message: 'Synthetic ledger unavailable' } }, 500);
    const search = url.searchParams.get('search')?.toLowerCase(), page = Number(url.searchParams.get('page') || '1'), limit = Number(url.searchParams.get('limit') || '25');
    const filtered = search ? donations.filter(row => `${row.constituent.firstName} ${row.constituent.lastName} ${row.constituent.email}`.toLowerCase().includes(search)) : donations;
    return json({ items: filtered.slice((page - 1) * limit, page * limit), total: filtered.length, page, limit });
  }
  if (path === '/api/settings') return json({ orgName: 'Synthetic CRM', currency: 'USD', fiscalYearStart: 1 });
  return json([]);
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(`${web}/payments`);
  if (process.env.CRM_AUDIT_BEFORE === '1') {
    await page.getByText('Synthetic gateway status unavailable', { exact: true }).waitFor();
    await page.screenshot({ path: `${evidence}/payments-before-staff.png`, fullPage: true });
  } else {
    await page.getByText('Synthetic Supporter 001', { exact: true }).waitFor();
    assert.equal(healthRequests, 0, 'Staff must not request admin-only gateway details');
    await page.getByText('1–25 of 125 records', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByText('Synthetic Supporter 026', { exact: true }).waitFor();
    await page.screenshot({ path: `${evidence}/payments-staff-desktop.png`, fullPage: true });
    checks.push('Staff ledger loads independently of administrator gateway permissions and exposes all 125 records');
    const search = page.getByRole('searchbox', { name: 'Search payment donors' });
    await search.fill('Supporter 125');
    await page.getByText('Synthetic Supporter 125', { exact: true }).waitFor();
    await page.getByRole('searchbox', { name: /Filter the current page/ }).fill('TEST-125');
    assert.equal(await page.getByText('Synthetic Supporter 125', { exact: true }).count(), 1);
    checks.push('Server search reaches records beyond the old first100 limit; page-specific receipt filter remains available');
    ledgerFail = true;
    await search.fill('unavailable');
    await page.getByRole('alert').filter({ hasText: 'Synthetic ledger unavailable' }).waitFor();
    ledgerFail = false;
    await page.getByRole('button', { name: 'Retry payment ledger' }).click();
    await page.getByText('No payment rows found for this filter.', { exact: true }).waitFor();
    checks.push('Ledger failure and retry remain independent of gateway status');
    admin = true;
    await page.reload();
    await page.getByText('Gateway configuration status unavailable.', { exact: false }).waitFor();
    await page.getByText('Synthetic Supporter 001', { exact: true }).waitFor();
    assert.equal(await page.getByText('Stripe: Not Ready', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Active: None', { exact: true }).count(), 0);
    healthFail = false;
    await page.getByRole('button', { name: 'Retry gateway status' }).click();
    await page.getByText('Stripe: Ready', { exact: true }).waitFor();
    checks.push('Unavailable gateway health never reports false readiness and can recover independently');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${evidence}/payments-phone.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
    checks.push('Phone payment table scrolls inside the viewport');
    assert.deepEqual(errors, []);
    await writeFile(`${evidence}/payments-browser-checks.json`, JSON.stringify({ synthetic: true, checks, errors }, null, 2));
    console.log(JSON.stringify({ checks, errors }, null, 2));
  }
} catch (error) { await page.screenshot({ path: `${evidence}/payments-failure.png`, fullPage: true }).catch(() => {}); throw error; }
finally { await browser.close(); }
