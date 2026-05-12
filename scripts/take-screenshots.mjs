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
const BASE = 'http://localhost:3650';
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
  { file: '02-donor-dashboard.png', url: '/', label: 'DonorCRM Dashboard' },
  { file: '03-dashboard-ai-open.png', url: '/', label: 'Dashboard — AI Assistant open', allowStewardOpen: true, action: async (page) => {
    const btn = page.locator('button[title="Open Steward AI Assistant"], button:has-text("AI Assistant"), button:has-text("Steward")').first();
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(1200);
    }
  }},
  { file: '04-constituents-list.png', url: '/constituents', label: 'Constituents — list' },
  { file: '05-constituents-search.png', url: '/constituents', label: 'Constituents — search', action: async (page) => {
    const box = page.locator('input[placeholder*="Search name"], input[placeholder*="search"]');
    if (await box.count()) {
      await box.first().fill('Robert');
      await page.waitForTimeout(1000);
    }
  }},
  { file: '06-constituent-detail.png', url: '/constituents', label: 'Constituent — profile', action: async (page) => {
    const link = page.locator('a[href^="/constituents/"]').first();
    if (await link.count()) {
      await link.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1200);
    }
  }},
  { file: '07-donations.png', url: '/donations', label: 'Donations Ledger' },
  { file: '08-donation-add-form.png', url: '/donations/new', label: 'Donations — Add Gift form' },
  { file: '09-campaigns.png', url: '/campaigns', label: 'Campaigns' },
  { file: '10-grants-pipeline.png', url: '/grants', label: 'Grants — Pipeline board' },
  { file: '11-grants-funders.png', url: '/grants', label: 'Grants — Funders tab', action: async (page) => {
    const tab = page.locator('button:has-text("Funders")').first();
    if (await tab.count()) {
      await tab.click();
      await page.waitForTimeout(900);
    }
  }},
  { file: '12-tasks.png', url: '/tasks', label: 'Tasks & Stewardship' },
  { file: '13-meetings.png', url: '/meetings', label: 'Meetings' },
  { file: '14-communications.png', url: '/communications', label: 'Communications' },
  { file: '15-communications-compose.png', url: '/communications', label: 'Communications — Compose', action: async (page) => {
    const btn = page.locator('button:has-text("Compose"), button:has-text("New Campaign"), a:has-text("Communication Home")').first();
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(1000);
    }
  }},
  { file: '16-steward-signals.png', url: '/steward-signals', label: 'Steward Signals AI' },
  { file: '17-volunteers.png', url: '/volunteers', label: 'Volunteers' },
  { file: '18-reports.png', url: '/reports', label: 'Reports & Analytics' },
  { file: '19-data-import.png', url: '/data-tools/import', label: 'Data Import Wizard' },
  { file: '20-events.png', url: '/events', label: 'Events Dashboard' },
  { file: '21-compassion-clients.png', url: '/compassion/clients', label: 'Compassion — Clients list' },
  { file: '22-compassion-search.png', url: '/compassion/clients', label: 'Compassion — Client search', action: async (page) => {
    const box = page.locator('input[placeholder*="Search"], input[placeholder*="search"]');
    if (await box.count()) {
      await box.first().fill('Maria');
      await page.waitForTimeout(1000);
    }
  }},
  { file: '23-add-client-form.png', url: '/compassion/clients', label: 'Compassion — Add Client form', action: async (page) => {
    const btn = page.locator('button:has-text("Add Client"), button:has-text("New Client"), button:has-text("Add")').first();
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(1000);
    }
  }},
  { file: '24-compassion-client-profile.png', url: '/compassion/clients', label: 'Compassion — Client profile', action: async (page) => {
    const closeModal = page.locator('button:has-text("Cancel"), button:has-text("×")').first();
    if (await closeModal.count()) {
      await closeModal.click();
      await page.waitForTimeout(700);
    }

    const link = page.locator('a[href*="/compassion/clients/"], table tbody tr').first();
    if (await link.count()) {
      await link.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(1200);
    }
  }},
  { file: '25-watchdog.png', url: '/watchdog', label: 'Watchdog Security Feed' },
  { file: '26-webmaster.png', url: '/webmaster', label: 'WebMaster Dashboard' },
  { file: '27-settings.png', url: '/settings', label: 'Settings & Administration' },
  { file: '28-settings-users.png', url: '/settings', label: 'Settings — User Management', action: async (page) => {
    const tab = page.locator('button:has-text("Users"), a:has-text("Users"), [role="tab"]:has-text("Users")').first();
    if (await tab.count()) {
      await tab.click();
      await page.waitForTimeout(900);
    }
  }},
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
