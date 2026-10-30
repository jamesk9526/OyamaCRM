import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const browser = await chromium.launch({headless:true});
const page = await browser.newPage();
let saved;
await page.route('**/api/**', async route => {
 const path = new URL(route.request().url()).pathname;
 if(path === '/api/auth/refresh') return route.fulfill({json:{data:{accessToken:'synthetic-fixture'}}});
 if(path === '/api/auth/me') return route.fulfill({json:{data:{id:'qa-admin',organizationId:'qa-org',firstName:'QA',lastName:'Admin',role:'admin',email:'qa@example.invalid'}}});
 if(path === '/api/setup/status') return route.fulfill({json:{setupComplete:true}});
 if(path === '/api/notifications/email-settings') {
  if(route.request().method() === 'PUT') { saved=route.request().postDataJSON(); return route.fulfill({json:{saved:true}}); }
  return route.fulfill({json:{enabled:false,subjectTemplate:'[OyamaCRM] {title}',minimumSeverity:'ALL',deliveries:[],...saved}});
 }
 return route.fulfill({json:{items:[],unreadCount:0}});
});
try {
 await page.goto('http://localhost:3000/settings/notification-email');
 await page.getByRole('heading',{name:'Notification email',exact:true}).waitFor({timeout:60000});
 await page.getByLabel('Email my notifications').check();
 await page.getByLabel('Email subject template').fill('[My CRM] {title}');
 await page.getByRole('button',{name:'Save email preferences'}).click();
 await page.getByRole('status').filter({hasText:'Preferences saved'}).waitFor();
 assert.equal(saved.enabled,true); assert.equal(saved.subjectTemplate,'[My CRM] {title}');
 await mkdir('docs/status/audit-artifacts/2026-10-30-notification-email',{recursive:true});
 for (const width of [1440,390]) {
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
  await page.screenshot({path:`docs/status/audit-artifacts/2026-10-30-notification-email/settings-${width}.png`,fullPage:true});
 }
 console.log('Settings enrollment, subject, confirmation, desktop/mobile overflow passed (mock API only).');
} finally { await browser.close(); }

