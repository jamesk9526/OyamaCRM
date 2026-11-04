/** Synthetic donor profile gift-entry acceptance. All API requests are intercepted; no donation is persisted. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installDonorWorkspaceFixtures } from './fixtures/donor-daily-workspace.mjs';

const web = process.env.CRM_AUDIT_WEB || 'http://localhost:3220';
const evidence = 'docs/status/audit-artifacts/2026-11-04-crm-completeness';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Chicago' });
const errors = [], writes = [], reads = { campaigns: 0, funds: 0 };
async function assertDialogViewport(dialog) {
  const bounds = await dialog.locator('.oyama-modal-surface').boundingBox();
  const viewport = page.viewportSize();
  assert.ok(bounds && bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1, `Dialog surface remains inside viewport: ${JSON.stringify(bounds)}`);
  const close = await dialog.getByRole('button', { name: 'Close modal', exact: true }).boundingBox();
  assert.ok(close && close.y >= 0 && close.y + close.height <= viewport.height, 'Dialog close control stays visible');
}
let campaignFails = true;
let campaignFailureStatus = 500;
let fundFails = false;
page.on('pageerror', error => errors.push(error.message));
await page.route('**/api/**', route => route.fulfill({ json: { items: [], unreadCount: 0 } }));
await installDonorWorkspaceFixtures(page);
await page.route('**/api/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  const json = (body, status = 200) => route.fulfill({ status, json: body });
  if (path === '/api/auth/refresh') return json({ data: { accessToken: 'synthetic-session' } });
  if (path === '/api/auth/me') return json({ data: { id: 'synthetic-admin', organizationId: 'synthetic-org', firstName: 'Taylor', lastName: 'Sample', role: 'admin', permissions: [] } });
  if (path === '/api/campaigns') { reads.campaigns++; return campaignFails ? json({ error: { message: 'Synthetic campaigns unavailable' } }, campaignFailureStatus) : json([{ id: 'synthetic-appeal', name: 'Synthetic appeal', active: true }]); }
  if (path === '/api/designations') { reads.funds++; return fundFails ? json({ error: { message: 'Synthetic funds unavailable' } }, 500) : json([{ id: 'synthetic-fund', name: 'Synthetic fund' }]); }
  if (path === '/api/donations' && request.method() === 'POST') { writes.push(request.postDataJSON()); return json({ error: { message: 'Synthetic donation save failed' } }, 500); }
  if (request.method() !== 'GET') return json({ error: { message: 'Unexpected mutation blocked' } }, 405);
  return route.fallback();
});
await page.clock.install({ time: new Date('2026-07-01T00:30:00Z') });
try {
  await page.goto(`${web}/constituents/qa-person`);
  await page.getByRole('button', { name: 'Record Gift', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Record Gift', exact: true });
  await assertDialogViewport(dialog);
  await dialog.getByText(/Campaigns are unavailable: Synthetic campaigns unavailable/).waitFor();
  const amount = dialog.getByLabel('Amount', { exact: false });
  await amount.fill('125.50');
  await dialog.getByLabel('Notes', { exact: true }).fill('Synthetic gift note retained during lookup retry');
  await dialog.getByLabel('Fund', { exact: true }).selectOption('synthetic-fund');
  assert.equal(await dialog.getByLabel('Gift Date', { exact: false }).inputValue(), '2026-06-30', 'Gift date follows staff local date near UTC midnight');
  const save = dialog.getByRole('button', { name: 'Record Gift', exact: true });
  assert.equal(await save.isDisabled(), true);
  await dialog.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await dialog.getByText('Load the campaign and fund lists or explicitly review each unavailable selection before recording this gift.', { exact: true }).waitFor();
  assert.equal(writes.length, 0, 'Keyboard/programmatic submission cannot bypass lookup readiness');
  await page.screenshot({ path: `${evidence}/quick-gift-lookup-failure.png`, fullPage: true });
  campaignFails = false;
  await dialog.getByRole('button', { name: 'Retry campaigns', exact: true }).click();
  await dialog.getByLabel('Campaign', { exact: true }).selectOption('synthetic-appeal');
  assert.equal(await amount.inputValue(), '125.50');
  assert.equal(await dialog.getByLabel('Fund', { exact: true }).inputValue(), 'synthetic-fund');
  assert.equal(await dialog.getByLabel('Notes', { exact: true }).inputValue(), 'Synthetic gift note retained during lookup retry');
  assert.equal(reads.funds, 1, 'Retry only fetches the failed lookup');
  await amount.fill('1e309');
  await dialog.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  await dialog.getByText('Please enter a valid amount.', { exact: true }).waitFor();
  assert.equal(writes.length, 0, 'Non-finite amount is rejected before POST');
  await amount.fill('125.50');
  await save.click();
  await dialog.getByText('Synthetic donation save failed', { exact: true }).waitFor();
  assert.equal(await amount.inputValue(), '125.50');
  assert.equal(writes.length, 1);
  assert.equal(writes[0].campaignId, 'synthetic-appeal');
  assert.equal(writes[0].designationId, 'synthetic-fund');
  assert.equal(writes[0].amount, 125.5);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  campaignFails = true; campaignFailureStatus = 403;
  await page.getByRole('button', { name: 'Record Gift', exact: true }).first().click();
  await dialog.getByText(/Campaigns are unavailable: Synthetic campaigns unavailable/).waitFor();
  await dialog.getByLabel('Amount', { exact: false }).fill('75');
  await dialog.getByLabel('Fund', { exact: true }).selectOption('synthetic-fund');
  assert.equal(await save.isDisabled(), true, 'Campaign permission denial never automatically permits an unassigned gift');
  await dialog.getByRole('button', { name: 'Continue without campaign selection', exact: true }).click();
  await dialog.getByText('Reviewed choice: this gift will have no campaign selection.', { exact: true }).waitFor();
  await save.click();
  await dialog.getByText('Synthetic donation save failed', { exact: true }).waitFor();
  assert.equal(writes.length, 2);
  assert.equal(Object.hasOwn(writes[1], 'campaignId'), false, 'Deliberate fallback omits campaign attribution');
  assert.equal(writes[1].designationId, 'synthetic-fund', 'Available fund attribution is preserved');
  await dialog.getByRole('button', { name: 'Retry campaigns', exact: true }).click();
  await dialog.getByRole('button', { name: 'Continue without campaign selection', exact: true }).waitFor();
  assert.equal(await save.isDisabled(), true, 'Retry withdraws the previous fallback acknowledgment');
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  fundFails = true;
  await page.getByRole('button', { name: 'Record Gift', exact: true }).first().click();
  await dialog.getByText(/Funds are unavailable: Synthetic funds unavailable/).waitFor();
  await dialog.getByLabel('Amount', { exact: false }).fill('50');
  await dialog.getByRole('button', { name: 'Continue without campaign selection', exact: true }).click();
  assert.equal(await save.isDisabled(), true, 'A second unavailable lookup needs its own review');
  await dialog.getByRole('button', { name: 'Continue without fund selection', exact: true }).click();
  await save.click();
  await dialog.getByText('Synthetic donation save failed', { exact: true }).waitFor();
  assert.equal(writes.length, 3);
  assert.equal(Object.hasOwn(writes[2], 'campaignId'), false);
  assert.equal(Object.hasOwn(writes[2], 'designationId'), false);
  await page.setViewportSize({ width: 390, height: 900 });
  await assertDialogViewport(dialog);
  await dialog.getByRole('button', { name: 'Close modal', exact: true }).focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true, 'Backward tab remains in the dialog');
  await page.keyboard.press('Tab');
  assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true, 'Forward tab remains in the dialog');
  await page.screenshot({ path: `${evidence}/quick-gift-phone.png`, fullPage: true });
  await dialog.locator('form').evaluate(form => {
    for (let element = form.parentElement; element; element = element.parentElement) {
      if (getComputedStyle(element).overflowY === 'auto') element.scrollTop = 0;
    }
  });
  await page.screenshot({ path: `${evidence}/quick-gift-phone-warnings.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
  assert.deepEqual(errors, []);
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await page.getByRole('button', { name: 'Record Gift', exact: true }).first().evaluate(element => element === document.activeElement), true, 'Escape restores the opening control focus');
  const checks = ['Failed lookup blocks silent unassigned gifts including submit-handler bypass', 'Independent retry preserves entered gift, selected fund and notes', 'Non-finite amount rejected before POST', 'Local gift date at UTC midnight', 'Ready request includes reviewed campaign/fund; failed save retains values', 'Denied campaign lookup requires explicit reviewed fallback, preserves selected fund, and retry withdraws acknowledgment', 'Each unavailable lookup requires separate review before omitting both selections', 'Desktop/phone dialog and close control remain within viewport; focus trap and Escape restoration work'];
  await writeFile(`${evidence}/quick-gift-browser-checks.json`, JSON.stringify({ synthetic: true, checks, errors, writes, reads }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${evidence}/quick-gift-failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); }
