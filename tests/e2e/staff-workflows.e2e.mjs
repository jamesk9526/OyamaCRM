import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { installDonorWorkspaceFixtures } from './fixtures/donor-daily-workspace.mjs';
const base = process.env.QA_BASE_URL || 'http://127.0.0.1:43652';
const evidence = 'docs/status/audit-artifacts/2026-10-30-staff-workflows';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1050 } });
const page = await context.newPage();
const errors = [], actions = [], checks = [];
const diagnostics = [];
const cdp = await context.newCDPSession(page); await cdp.send('Runtime.enable');
cdp.on('Runtime.exceptionThrown', event => diagnostics.push(event.exceptionDetails));
let notices = [{ id: 'notice-1', title: 'Welcome follow-up overdue', message: 'Review the welcome email draft.', href: '/tasks?taskId=qa-task', createdAt: '2026-10-01T00:00:00Z', status: 'unread', module: 'donor', priority: 'high', type: 'task-overdue' }];
await context.route('**/api/**', async route => {
 const req = route.request(), path = new URL(req.url()).pathname;
 if (path === '/api/auth/refresh') return route.fulfill({ json: { data: { accessToken: 'synthetic-test-token' } } });
 if (path === '/api/auth/me') return route.fulfill({ json: { data: { id: 'qa-staff', role: 'admin', firstName: 'Taylor', lastName: 'QA', organizationId: 'qa-org' } } });
 if (path === '/api/notifications/sse') return route.fulfill({ contentType: 'text/event-stream', body: '' });
 if (path === '/api/notifications') return route.fulfill({ json: { items: notices, unreadCount: notices.length, total: notices.length } });
 if (path.startsWith('/api/notifications/') && req.method() === 'PATCH') { actions.push({ path, body: req.postDataJSON() }); notices = []; return route.fulfill({ json: {} }); }
 if (req.method() !== 'GET') return route.fulfill({ status: 405, json: { error: { message: 'Live writes blocked by synthetic test' } } });
 return route.fulfill({ json: { items: [], unreadCount: 0 } });
});
await installDonorWorkspaceFixtures(page);
await page.route('**/api/reports/summary*', route => route.fulfill({ json: { totalConstituents: 12, activeDonors: 3, ytdAmount: 250, ytdCount: 1, monthAmount: 250, monthCount: 1, overdueTasks: 1, newDonorsThisMonth: 1, period: { basis: 'calendar', year: 2026, label: '2026 YTD', from: '2026-01-01T00:00:00.000Z', through: '2026-10-30T12:00:00.000Z', monthFrom: '2026-10-01T00:00:00.000Z', monthThrough: '2026-10-30T12:00:00.000Z' } } }));
await page.route('**/api/reports/new-donors*', route => { const url = new URL(route.request().url()); return route.fulfill({ json: { items: [{ id: 'qa-new', firstName: url.searchParams.get('month') === 'previous' ? 'Previous' : 'Current', lastName: 'Donor', firstGiftDate: '2026-10-01T00:00:00Z' }], total: 1, totalPages: 1 } }); });
page.on('pageerror', error => errors.push(error.stack || error.message));
try {
 await mkdir(evidence, { recursive: true });
 await page.goto(base, { waitUntil: 'networkidle' });
 await page.getByRole('heading', { name: 'New donors', exact: true }).waitFor();
 await page.getByRole('link', { name: 'Current Donor', exact: true }).waitFor();
 const month = page.getByRole('link').filter({ has: page.getByText('Giving this month', { exact: true }) });
 const monthHref = new URL(await month.getAttribute('href'), base);
 assert.equal(monthHref.searchParams.get('from'), '2026-10-01'); assert.equal(monthHref.searchParams.has('allYears'), false);
 const active = page.getByRole('link').filter({ has: page.getByText('Active donors', { exact: true }) });
 assert.equal(new URL(await active.getAttribute('href'), base).searchParams.get('givingThrough'), '2026-10-30T12:00:00.000Z');
 await page.getByRole('button', { name: 'Previous month', exact: true }).click();
 await page.getByRole('link', { name: 'Previous Donor', exact: true }).waitFor();
 checks.push('New donors switch between current/previous month and link to profiles; monthly and active-donor metrics carry matching record filters.');
 await page.getByRole('button', { name: 'Snooze 1 week', exact: true }).click();
 await page.getByText('No active reminders.', { exact: true }).waitFor();
 assert.equal(actions.at(-1).path, '/api/notifications/notice-1/snooze');
 const delta = new Date(actions.at(-1).body.until).getTime() - Date.now();
 assert.ok(delta > 6.99 * 86400000 && delta <= 7 * 86400000);
 checks.push('One-week snooze persists through the shared notification endpoint and removes the active alert without completing a task.');
 for (const width of [1440, 768, 390]) { await page.setViewportSize({ width, height: 1050 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await page.screenshot({ path: `${evidence}/dashboard-${width}.png`, fullPage: true }); }
 const guests = Array.from({ length: 30 }, (_, i) => ({ id: `guest-${i}`, firstName: 'Guest', lastName: String(i), checkedIn: false, paymentStatus: 'PAID', tableId: 'team-1' }));
 await page.route('**/api/events**', route => {
   const path = new URL(route.request().url()).pathname;
   if (path === '/api/events') return route.fulfill({ json: [{ id: 'qa-event', name: 'QA check-in', active: true }] });
   if (path.endsWith('/tables')) return route.fulfill({ json: [{ id: 'team-1', name: 'Team One', capacity: 30, guests }] });
   if (path.endsWith('/checkin/search')) return route.fulfill({ json: guests });
   if (path.includes('/checkin/guest/')) { const id = path.split('/').at(-1); const guest = guests.find(x => x.id === id); if (guest) guest.checkedIn = true; return route.fulfill({ json: { id: 'record', status: 'CHECKED_IN' } }); }
   if (path.endsWith('live-counts')) return route.fulfill({ json: { expected: 30, checkedIn: guests.filter(x => x.checkedIn).length, walkIns: 0, replacements: 0, openExceptions: 0, attendanceRate: 0 } });
   return route.fulfill({ json: [] });
 });
 await page.route('**/api/steward-paths/**', route => {
   const path = new URL(route.request().url()).pathname;
   if (path.endsWith('/templates')) return route.fulfill({ json: [] });
   if (path.endsWith('/enrollments')) return route.fulfill({ json: [{ id: 'qa-enrollment', status: 'COMPLETED', startedAt: '2026-10-01T00:00:00Z', path: { id: 'qa-path', name: 'Donor welcome', status: 'ACTIVE' }, currentStep: null, nextStepDueAt: null }] });
   if (path.endsWith('/timeline')) return route.fulfill({ json: [{ id: 'qa-complete', eventType: 'STEP_COMPLETED', message: 'Welcome call completed', createdAt: '2026-10-02T00:00:00Z', step: { name: 'Welcome call' } }] });
   return route.fulfill({ json: [] });
 });
 await page.route('**/api/letters/constituents/qa-person/generated', route => route.fulfill({ json: [{ id: 'qa-mailed', category: 'GENERAL', status: 'MAILED', generatedAt: '2026-10-01T12:00:00Z', printedAt: '2026-10-02T12:00:00Z', mailedAt: '2026-10-03T12:00:00Z', template: { id: 'qa-template', name: 'Prospect introduction' } }] }));
 await page.goto(`${base}/constituents/qa-person`, { waitUntil: 'networkidle' });
 await page.getByText('Completed steps and workflow history', { exact: true }).click();
 await page.getByText('Welcome call completed', { exact: true }).waitFor();
 await page.getByText('Prospect introduction', { exact: true }).waitFor();
 await page.getByText('Mailed:', { exact: true }).waitFor();
 checks.push('Contact history displays recorded generation, print and mailing dates separately.');
 checks.push('Completed donor enrollment remains visible and loads its recorded completed-step timeline on demand.');
 await page.setViewportSize({ width: 1440, height: 900 });
 await page.goto(`${base}/events/qa-event/check-in`, { waitUntil: 'networkidle' });
 await page.getByRole('tab', { name: 'Tables', exact: true }).click();
 const row = page.locator('article').filter({ hasText: 'Team One' });
 for (const number of [20, 21]) {
   const guestCard = row.locator('article').filter({ has: page.getByText(`Guest ${number}`, { exact: true }) });
   const anchor = guestCard.getByText(`Guest ${number}`, { exact: true });
   const check = guestCard.getByRole('button', { name: 'Check in', exact: true });
   await check.scrollIntoViewIfNeeded();
   const beforeTop = (await anchor.boundingBox()).y;
   const scrollState = () => page.evaluate(() => [window.scrollY, ...Array.from(document.querySelectorAll('*')).filter(element => element.scrollTop > 0).map(element => element.scrollTop)]);
   const before = await scrollState();
   await check.click();
   await page.getByText('Guest checked in.', { exact: true }).waitFor();
   assert.ok(Math.abs((await anchor.boundingBox()).y - beforeTop) < 3);
   assert.deepEqual(await scrollState(), before);
   await page.waitForTimeout(4700);
   assert.ok(Math.abs((await anchor.boundingBox()).y - beforeTop) < 3);
   assert.deepEqual(await scrollState(), before);
 }
 checks.push('Sequential team guest check-ins preserve row position and every scrolled ancestor when feedback appears and expires.');
 assert.deepEqual(errors, []);
 await writeFile(`${evidence}/browser-checks.json`, JSON.stringify({ checks, pageErrors: errors }, null, 2));
 console.log(JSON.stringify({ checks, pageErrors: errors }, null, 2));
} catch (error) {
 await page.screenshot({ path: `${evidence}/failure.png`, fullPage: true });
 await writeFile(`${evidence}/failure.txt`, JSON.stringify({ error: String(error), pageErrors: errors, diagnostics, url: page.url(), text: await page.locator('body').innerText() }, null, 2));
 throw error;
} finally { await browser.close(); }

