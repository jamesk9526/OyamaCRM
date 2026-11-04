/** Synthetic settings/events browser acceptance. No live CRM or provider writes. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const web = process.env.CRM_AUDIT_WEB || 'http://localhost:3220';
const evidence = 'docs/status/audit-artifacts/2026-11-04-crm-completeness';
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [], checks = [], writes = [];
let settings = { defaultDuration: 90, autoTimeline: true, autoFollowUp: false, followUpDays: 2, followUpMessage: 'Synthetic follow-up note', canManage: true };
let failSettingsSave = false, failSettingsLoad = false, failEvents = false, failSummary = true, failMeetingComplete = true;
let meetingCompleted = false;
const user = { id: 'synthetic-staff', organizationId: 'synthetic-org', firstName: 'Taylor', lastName: 'Sample', role: 'admin', email: 'staff@example.invalid', permissions: ['view:meetings', 'edit:meetings', 'view:settings', 'edit:settings', 'view:events', 'edit:events', 'view:constituents'] };
const event = (id, name, type, startDate, active) => ({ id, name, type, startDate, active, location: 'Synthetic venue', description: 'Acceptance fixture only', _count: { attendances: 4 } });
const events = [event('future', 'Synthetic spring gathering', 'GALA', '2099-01-01T12:00:00Z', true), event('past', 'Synthetic past workshop', 'WORKSHOP', '2020-01-01T12:00:00Z', false)];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await context.route('**/api/**', async route => {
  const request = route.request(), path = new URL(request.url()).pathname;
  const json = (body, status = 200) => route.fulfill({ status, json: body });
  if (path === '/api/auth/refresh') return json({ data: { accessToken: 'synthetic-session' } });
  if (path === '/api/auth/me') return json({ data: user });
  if (path === '/api/meetings/settings') {
    if (request.method() === 'GET' && failSettingsLoad) return json({ error: { message: 'Synthetic defaults unavailable' } }, 500);
    if (request.method() === 'PUT') {
      if (failSettingsSave) return json({ error: { code: 'TEST_SAVE_FAILED', message: 'Synthetic save failed' } }, 500);
      writes.push({ path, body: request.postDataJSON() }); settings = { ...settings, ...request.postDataJSON() };
    }
    return json(settings);
  }
  if (path === '/api/meetings' && request.method() === 'POST') { writes.push({ path, body: request.postDataJSON() }); return json({ id: 'synthetic-meeting' }, 201); }
  if (path === '/api/meetings') return json({ items: [{ id: 'synthetic-existing', title: 'Synthetic follow-up visit', type: 'DONOR_VISIT', status: meetingCompleted ? 'COMPLETED' : 'SCHEDULED', startTime: '2099-01-02T10:00:00Z', locationType: 'IN_PERSON', followUpNeeded: false }], total: 1 });
  if (path === '/api/meetings/synthetic-existing/complete') {
    if (failMeetingComplete) return json({ error: { message: 'Synthetic completion failed' } }, 500);
    meetingCompleted = true; return json({ id: 'synthetic-existing', status: 'COMPLETED' });
  }
  if (path === '/api/events') return failEvents ? json({ error: { message: 'Synthetic event list unavailable' } }, 500) : json(events);
  if (path === '/api/events/dashboard-summary') return failSummary ? json({ error: { message: 'Synthetic totals unavailable' } }, 500) : json({ totalEvents: 2, activeEvents: 1, registeredGuests: 8, checkedInGuests: 3, totalRevenue: 100, volunteerHours: 12 });
  if (path === '/api/notifications' || path === '/api/notifications/unread-count') return json({ items: [], unreadCount: 0 });
  if (path === '/api/settings') return json({ orgName: 'Synthetic CRM', currency: 'USD', fiscalYearStart: 1, timezone: 'America/Chicago' });
  return json([]);
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
try {
  await page.goto(`${web}/settings/meetings`);
  await page.getByLabel('Default Meeting Duration').selectOption('45');
  failSettingsSave = true;
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page.getByText('Synthetic save failed', { exact: true }).waitFor();
  assert.equal(await page.getByText('Meeting defaults saved.', { exact: false }).count(), 0);
  failSettingsSave = false;
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await page.getByText('Meeting defaults saved.', { exact: false }).waitFor();
  await page.reload();
  await page.waitForFunction(() => {
    const duration = document.querySelector('#meeting-default-duration');
    return duration?.value === '45' && !duration.matches(':disabled');
  });
  assert.equal(await page.getByLabel('Default Meeting Duration').inputValue(), '45');
  await page.screenshot({ path: `${evidence}/meeting-settings-desktop.png`, fullPage: true });
  checks.push('Meeting defaults persist through reload; failed saves never report success');

  await page.goto(`${web}/meetings`);
  await page.getByRole('button', { name: /Schedule Meeting/ }).first().click();
  const planner = page.getByRole('dialog');
  const plannerBounds = await planner.locator('.oyama-modal-surface').boundingBox();
  assert.ok(plannerBounds && plannerBounds.y >= 0 && plannerBounds.y + plannerBounds.height <= 1001, 'Meeting planner remains in the desktop viewport');
  await page.setViewportSize({ width: 390, height: 900 });
  const phonePlannerBounds = await planner.locator('.oyama-modal-surface').boundingBox();
  assert.ok(phonePlannerBounds && phonePlannerBounds.y >= 0 && phonePlannerBounds.y + phonePlannerBounds.height <= 901 && phonePlannerBounds.width <= 390, 'Meeting planner remains in the phone viewport');
  await page.screenshot({ path: `${evidence}/meeting-planner-phone.png`, fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('Meeting Title').fill('Synthetic duration check');
  await page.getByLabel('Date', { exact: false }).first().fill('2099-01-02');
  await page.getByLabel('Start Time', { exact: true }).fill('10:00');
  await page.waitForFunction(() => document.querySelector('#meeting-end-time')?.value === '10:45');
  await page.getByRole('button', { name: 'Schedule Meeting', exact: true }).last().click();
  await page.waitForTimeout(300);
  const submissions = writes.filter(write => write.path === '/api/meetings');
  assert.equal(submissions.length, 1);
  assert.equal(new Date(submissions[0].body.endTime) - new Date(submissions[0].body.startTime), 45 * 60_000);
  checks.push('Meeting planner applies persisted duration and dispatches one create request');
  await page.getByRole('button', { name: 'Mark Complete', exact: true }).click();
  const outcome = page.getByPlaceholder('Optional: describe the outcome…');
  await outcome.fill('Synthetic completion outcome');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByText('Synthetic completion failed', { exact: true }).waitFor();
  assert.equal(await outcome.inputValue(), 'Synthetic completion outcome');
  failMeetingComplete = false;
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.locator('span').filter({ hasText: /^Completed$/ }).waitFor();
  checks.push('Meeting completion failure retains outcome and retry succeeds');

  await page.goto(`${web}/events/workspace`);
  await page.getByText('Synthetic spring gathering', { exact: true }).last().waitFor();
  await page.getByText('Event totals are unavailable.', { exact: false }).waitFor();
  assert.ok(await page.getByText('Unavailable', { exact: true }).count() >= 1);
  await page.getByLabel('Search events', { exact: true }).fill('workshop');
  assert.equal(await page.getByRole('button').filter({ hasText: 'Synthetic spring gathering' }).count(), 0);
  await page.getByRole('button').filter({ hasText: 'Synthetic past workshop' }).waitFor();
  failSummary = false;
  await page.getByRole('button', { name: 'Retry event totals', exact: true }).click();
  await page.getByText('$100', { exact: true }).waitFor();
  await page.screenshot({ path: `${evidence}/events-filter-desktop.png`, fullPage: true });
  checks.push('Events survive summary failure, show unavailable metrics, filter and recover totals');

  failEvents = true;
  await page.reload();
  await page.getByText('Synthetic event list unavailable', { exact: true }).waitFor();
  assert.equal(await page.getByText('No events yet', { exact: true }).count(), 0);
  failEvents = false;
  await page.getByRole('button', { name: 'Retry event loading', exact: true }).click();
  await page.getByRole('button').filter({ hasText: 'Synthetic spring gathering' }).waitFor();
  checks.push('Event-list failures have retry and never become a false empty registry');
  await page.setViewportSize({ width: 390, height: 900 });
  await page.screenshot({ path: `${evidence}/events-filter-phone.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
  await page.goto(`${web}/events`);
  await page.getByRole('link', { name: 'Open Synthetic spring gathering', exact: true }).waitFor();
  await page.getByLabel('Search events', { exact: true }).fill('workshop');
  await page.getByRole('link', { name: 'Open Synthetic past workshop', exact: true }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Open Synthetic spring gathering', exact: true }).count(), 0);
  await page.screenshot({ path: `${evidence}/events-registry-phone.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
  checks.push('Canonical Events registry search and navigation remain functional on phone');
  await page.goto(`${web}/settings/meetings`);
  await page.waitForFunction(() => !document.querySelector('#meeting-default-duration')?.matches(':disabled'));
  await page.screenshot({ path: `${evidence}/meeting-settings-phone.png`, fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
  settings.canManage = false;
  await page.reload();
  await page.getByText('Organization settings permission is required to change these defaults.', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Save Changes', exact: true }).isDisabled(), true);
  assert.equal(await page.getByLabel('Default Meeting Duration').isDisabled(), true);
  failSettingsLoad = true;
  await page.reload();
  await page.getByText('Synthetic defaults unavailable', { exact: true }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Save Changes', exact: true }).isDisabled(), true);
  failSettingsLoad = false;
  settings.canManage = true;
  await page.getByRole('button', { name: 'Retry loading defaults', exact: true }).click();
  await page.waitForFunction(() => !document.querySelector('#meeting-default-duration')?.matches(':disabled'));
  checks.push('Meeting settings fit phone; read-only and failed-load states prevent writes and retry recovers');
  assert.deepEqual(errors, []);
  await writeFile(`${evidence}/frontend-browser-checks.json`, JSON.stringify({ synthetic: true, checks, errors, writes }, null, 2));
  console.log(JSON.stringify({ checks, errors }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${evidence}/frontend-failure.png`, fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); }
