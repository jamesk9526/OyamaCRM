/**
 * Captures a curated 15-screen OyamaCRM product gallery for the static demo site.
 * Writes directly into easy_prep_tools/Static_site_demo_website/assets/screenshots.
 */
import { chromium } from 'playwright';
import { mkdir, rm } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'easy_prep_tools', 'Static_site_demo_website', 'assets', 'screenshots');
const BASE = 'http://localhost:3000';
const VIEWPORT = { width: 1440, height: 900 };

const pages = [
  { file: '01-login.png', url: '/login', label: 'Login' },
  { file: '02-donor-dashboard.png', url: '/', label: 'Donor Dashboard' },
  {
    file: '03-dashboard-ai-open.png',
    url: '/',
    label: 'Dashboard with Steward AI',
    allowStewardOpen: true,
    action: async (page) => {
      const btn = page.locator('button[title="Open Steward AI Assistant"], button:has-text("AI Assistant"), button:has-text("Steward")').first();
      if (await btn.count()) {
        await btn.click();
        await page.waitForTimeout(1200);
      }
    }
  },
  { file: '04-constituents-list.png', url: '/constituents', label: 'Constituents List' },
  {
    file: '05-constituent-detail.png',
    url: '/constituents',
    label: 'Constituent Profile',
    action: async (page) => {
      const link = page.locator('a[href^="/constituents/"]').first();
      if (await link.count()) {
        await link.click();
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(1200);
      }
    }
  },
  { file: '06-donations.png', url: '/donations', label: 'Donations Ledger' },
  { file: '07-donation-add-form.png', url: '/donations/new', label: 'Add Donation Form' },
  { file: '08-campaigns.png', url: '/campaigns', label: 'Campaigns' },
  { file: '09-grants-pipeline.png', url: '/grants', label: 'Grants Pipeline' },
  { file: '10-tasks.png', url: '/tasks', label: 'Tasks' },
  { file: '11-communications.png', url: '/communications', label: 'Communications' },
  { file: '12-reports.png', url: '/reports', label: 'Reports' },
  { file: '13-compassion-dashboard.png', url: '/compassion/dashboard', label: 'Compassion Dashboard' },
  { file: '14-compassion-clients.png', url: '/compassion/clients', label: 'Compassion Clients' },
  { file: '15-watchdog.png', url: '/watchdog', label: 'Watchdog' }
];

async function prepareOutputDir() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
}

async function capture(page, file) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(outDir, file), fullPage: false });
}

async function waitForAuthenticatedApp(page) {
  await page.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 20000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1800);
}

async function signIn(page) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.fill('input[type="email"]', 'admin@hopefoundation.org');
  await page.fill('input[type="password"]', 'admin123!');
  await page.click('button[type="submit"]');
  await waitForAuthenticatedApp(page);
}

function currentPath(page) {
  return new URL(page.url()).pathname;
}

function pathMatches(page, route) {
  const pathname = currentPath(page);
  return pathname === route || pathname.startsWith(`${route}/`);
}

async function assertNotLogin(page, label) {
  const pathname = currentPath(page);
  const loginForm = page.locator('input[type="email"], input[type="password"]');
  if (pathname.startsWith('/login') && await loginForm.count()) {
    throw new Error(`${label} is still on /login`);
  }
}

async function closeStewardIfOpen(page) {
  const closeButton = page.locator('button[title="Close Steward"], button:has-text("Close Steward")').first();
  if (await closeButton.count()) {
    await closeButton.click();
    await page.waitForTimeout(500);
    return;
  }

  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(200);
}

async function tryClientNavigation(page, route) {
  const link = page.locator(`a[href="${route}"]`).first();
  if (!await link.count()) return false;

  try {
    await link.click();
    await page.waitForTimeout(1800);
    return pathMatches(page, route);
  } catch {
    return false;
  }
}

async function goToAuthedRoute(page, route) {
  await closeStewardIfOpen(page);

  if (pathMatches(page, route)) {
    await page.waitForTimeout(1000);
    await assertNotLogin(page, route);
    return;
  }

  const usedClientNav = await tryClientNavigation(page, route);
  if (!usedClientNav) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2800);
  }

  await assertNotLogin(page, route);
}

async function run() {
  await prepareOutputDir();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();

  console.log('Capturing login screen...');
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  await capture(page, '01-login.png');

  console.log('Logging in for authenticated screenshots...');
  await signIn(page);

  for (const item of pages.slice(1)) {
    console.log(`Capturing ${item.label} -> ${item.file}`);
    await goToAuthedRoute(page, item.url);
    if (item.action) {
      await item.action(page);
    }
    if (!item.allowStewardOpen) {
      await closeStewardIfOpen(page);
    }
    await capture(page, item.file);
  }

  await browser.close();
  console.log(`Done. Saved ${pages.length} screenshots to ${outDir}`);
}

run().catch((error) => {
  console.error('Static demo screenshot capture failed:', error);
  process.exit(1);
});
