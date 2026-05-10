/**
 * Screenshot capture script for README_SCREENSHOTS
 * Logs in and captures all major module pages.
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'README_SCREENSHOTS');

if (!existsSync(outDir)) {
  await mkdir(outDir, { recursive: true });
}

const BASE = 'http://localhost:3001';

const pages = [
  { file: '01-login.png',                  url: '/login',                   label: 'Login Page' },
  { file: '02-donor-dashboard.png',         url: '/',                        label: 'DonorCRM Dashboard',      auth: true },
  { file: '03-constituents.png',            url: '/constituents',            label: 'Constituents',            auth: true },
  { file: '04-donations.png',               url: '/donations',               label: 'Donations',               auth: true },
  { file: '05-campaigns.png',               url: '/campaigns',               label: 'Campaigns',               auth: true },
  { file: '06-tasks.png',                   url: '/tasks',                   label: 'Tasks',                   auth: true },
  { file: '07-reports.png',                 url: '/reports',                 label: 'Reports',                 auth: true },
  { file: '08-communications.png',          url: '/communications',          label: 'Communications',          auth: true },
  { file: '09-events.png',                  url: '/events',                  label: 'Events',                  auth: true },
  { file: '10-data-import.png',             url: '/data-tools/import',       label: 'Data Import',             auth: true },
  { file: '11-compassion-dashboard.png',    url: '/compassion/dashboard',    label: 'Compassion Dashboard',    auth: true },
  { file: '12-compassion-clients.png',      url: '/compassion/clients',      label: 'Compassion Clients',      auth: true },
  { file: '13-compassion-cases.png',        url: '/compassion/cases',        label: 'Compassion Cases',        auth: true },
  { file: '14-webmaster.png',               url: '/webmaster',               label: 'OyamaWebMaster',          auth: true },
  { file: '15-webmaster-builder.png',       url: '/webmaster/builder',       label: 'WebMaster Builder',       auth: true },
  { file: '16-watchdog.png',                url: '/watchdog',                label: 'OyamaWatchdog',           auth: true },
  { file: '17-settings.png',                url: '/settings',                label: 'Settings',                auth: true },
  { file: '18-system-status.png',           url: '/settings/system-status',  label: 'System Status',           auth: true },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // Login
  console.log('Logging in...');
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"], input[name="email"], input[placeholder*="organization"]', 'admin@hopefoundation.org');
  await page.fill('input[type="password"]', 'admin123!');
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 10000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
  console.log('Logged in.');

  for (const pg of pages) {
    console.log(`Capturing: ${pg.label} → ${pg.file}`);
    await page.goto(`${BASE}${pg.url}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);
    const filePath = path.join(outDir, pg.file);
    await page.screenshot({ path: filePath, fullPage: false });
    console.log(`  ✓ Saved ${pg.file}`);
  }

  await browser.close();
  console.log('\nAll screenshots saved to README_SCREENSHOTS/');
}

run().catch((err) => {
  console.error('Screenshot script failed:', err);
  process.exit(1);
});
