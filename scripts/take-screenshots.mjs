/**
 * Screenshot capture script for README_SCREENSHOTS.
 * Uses one browser context and one page so the app keeps its in-memory access token.
 * This is intentionally simpler than storageState-based fan-out because the app restores
 * auth into JS memory after login, and fresh contexts can race that bootstrap.
 */
import { chromium } from 'playwright';
import { mkdir, rm } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'README_SCREENSHOTS');
const BASE = 'http://localhost:3000';
const VIEWPORT = { width: 1440, height: 900 };

/** Ensures the screenshot output directory exists and is empty. */
async function prepareOutputDir() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
}

/** Waits until the app is no longer on the login page. */
async function waitForAuthenticatedApp(page) {
  await page.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 20000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1800);
}

/** Logs in through the real UI and keeps the page/session alive for the full run. */
async function signIn(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.fill('input[type="email"]', 'admin@hopefoundation.org');
  await page.fill('input[type="password"]', 'admin123!');
  await page.click('button[type="submit"]');
  await waitForAuthenticatedApp(page);
}

/** Returns the current pathname from the Playwright page URL. */
function currentPath(page) {
  return new URL(page.url()).pathname;
}

/** Returns true when the current page URL matches the requested route. */
function pathMatches(page, route) {
  const pathname = currentPath(page);
  return pathname === route || pathname.startsWith(`${route}/`);
}

/** Fails fast if the page is still the login screen. */
async function assertNotLogin(page, label) {
  const pathname = currentPath(page);
  const loginForm = page.locator('input[type="email"], input[type="password"]');
  if (pathname.startsWith('/login') && await loginForm.count()) {
    throw new Error(`${label} is still on /login`);
  }
}

/** Closes the Steward AI panel when it is open so it does not cover page content. */
async function closeStewardIfOpen(page) {
  const closeButton = page.locator('button[title="Close Steward"], button:has-text("Close Steward")').first();
  if (await closeButton.count()) {
    await closeButton.click();
    await page.waitForTimeout(600);
    return;
  }

  // The panel also supports Escape-to-close, so use it as a safe fallback.
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(250);
}

/** Uses a visible in-app link when available so we keep the SPA auth state alive. */
async function tryClientNavigation(page, route) {
  const link = page.locator(`a[href="${route}"]`).first();
  if (!await link.count()) {
    return false;
  }

  try {
    await link.click();
    await page.waitForTimeout(1800);
    return pathMatches(page, route);
  } catch {
    return false;
  }
}

/** Navigates to a route, preferring in-app client navigation over full reloads. */
async function goToAuthedRoute(page, route) {
  await closeStewardIfOpen(page);

  if (pathMatches(page, route)) {
    await page.waitForTimeout(1200);
    await assertNotLogin(page, route);
    return;
  }

  const usedClientNav = await tryClientNavigation(page, route);
  if (!usedClientNav) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 36500 });
    await page.waitForTimeout(2800);
  }

  await assertNotLogin(page, route);
}

/** Saves a screenshot after a small settle delay. */
async function capture(page, file) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outDir, file), fullPage: false });
}

const pages = [
  // ── DonorCRM Core ──────────────────────────────────────────────────────────
  { file: '02-donor-dashboard.png',        url: '/',                      label: 'DonorCRM Dashboard — Revenue & Retention' },
  { file: '03-dashboard-scroll.png',       url: '/',                      label: 'Dashboard — lower widgets', action: async (page) => {
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(400);
  }},
  { file: '04-constituents-list.png',      url: '/constituents',          label: 'Constituents — list' },
  { file: '05-constituent-detail.png',     url: '/constituents',          label: 'Constituent — profile', action: async (page) => {
    const link = page.locator('a[href^="/constituents/"]').first();
    if (await link.count()) {
      await link.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1400);
    }
  }},
  { file: '06-donations.png',              url: '/donations',             label: 'Donations Ledger' },
  { file: '07-campaigns.png',              url: '/campaigns',             label: 'Campaigns workspace' },
  { file: '08-grants.png',                 url: '/grants',                label: 'Grants — Pipeline board' },
  { file: '09-tasks.png',                  url: '/tasks',                 label: 'Tasks & Stewardship' },
  { file: '10-communications.png',         url: '/communications',        label: 'Communications workspace' },
  { file: '11-letters.png',                url: '/letters-printables',    label: 'Letters & Printables' },
  { file: '12-steward-paths.png',          url: '/steward-paths',         label: 'Steward Paths — AI-guided outreach' },
  { file: '13-steward-signals.png',        url: '/steward-signals',       label: 'Steward Signals — donor intelligence' },
  // ── Reports (major new feature) ───────────────────────────────────────────
  { file: '14-reports-library.png',        url: '/reports/donor-crm',     label: 'Reports — Template library' },
  { file: '15-reports-manager.png',        url: '/reports/manager',       label: 'Reports Manager' },
  // ── Data & Settings ────────────────────────────────────────────────────────
  { file: '16-data-import.png',            url: '/data-tools/import',     label: 'Data Import wizard' },
  { file: '17-settings.png',               url: '/settings',              label: 'Settings & Administration' },
  // ── Compassion CRM ─────────────────────────────────────────────────────────
  { file: '18-compassion-dashboard.png',   url: '/compassion',            label: 'Compassion CRM dashboard' },
  { file: '19-compassion-clients.png',     url: '/compassion/clients',    label: 'Compassion CRM — Clients list' },
  // ── Events & Watchdog ──────────────────────────────────────────────────────
  { file: '20-events.png',                 url: '/events/workspace',      label: 'Events CRM workspace' },
];

async function run() {
  await prepareOutputDir();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  // Capture the login screen separately before the authenticated run.
  console.log('Capturing: Login Page → 01-login.png');
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await capture(page, '01-login.png');

  // Authenticate once and keep the same page alive for the whole run.
  console.log('\nLogging in once and reusing the same page for all screenshots...');
  await signIn(page);
  console.log('  ✓ Logged in.\n');

  for (const item of pages) {
    console.log(`Capturing: ${item.label} → ${item.file}`);
    try {
      await goToAuthedRoute(page, item.url);
      if (item.action) {
        await item.action(page);
      }
      if (!item.allowStewardOpen) {
        await closeStewardIfOpen(page);
      }
      await capture(page, item.file);
      console.log(`  ✓ Saved ${item.file}`);
    } catch (error) {
      console.error(`  ✗ Failed ${item.file}: ${error.message}`);
    }
  }

  await browser.close();
  console.log('\nDone — all screenshots saved to README_SCREENSHOTS/');
}

run().catch((error) => {
  console.error('Screenshot script failed:', error);
  process.exit(1);
});
