import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({headless:true});
try {
 const loginPage = await browser.newPage();
 let attempts = 0;
 await loginPage.route('**/api/**', async route => {
  const path = new URL(route.request().url()).pathname;
  if(path === '/api/setup/status') return route.fulfill({json:{data:{setupCompleted:true}}});
  if(path === '/api/auth/login') { attempts++; return route.fulfill({json:{data:{mfaRequired:true,mfaTicket:'fixture-ticket',destinationHint:'q***@example.invalid'}}}); }
  if(path === '/api/auth/mfa/verify') return route.fulfill({status:400,json:{error:{message:'Invalid verification code'}}});
  return route.fulfill({status:401,json:{error:{message:'Not signed in'}}});
 });
 await loginPage.goto('http://localhost:3000/login');
 await loginPage.waitForTimeout(1500);
 await loginPage.getByLabel('Email address').fill('qa@example.invalid');
 await loginPage.getByLabel('Password',{exact:true}).fill('fixture-only-password');
 await loginPage.getByRole('button',{name:'Sign in',exact:true}).click();
 await loginPage.getByLabel('Verification code').fill('123456');
 await loginPage.getByRole('button',{name:'Verify and sign in'}).click();
 await loginPage.getByRole('alert').filter({hasText:'Invalid verification code'}).waitFor();
 assert.equal(attempts,1);
 for(const width of [1440,390]) {
  await loginPage.setViewportSize({width,height:1000});
  assert.equal(await loginPage.evaluate(()=>document.documentElement.scrollWidth > innerWidth),false);
  await loginPage.screenshot({path:`docs/status/audit-artifacts/2026-10-30-notification-email/signin-mfa-${width}.png`,fullPage:true});
 }
 console.log('Sign-in MFA failure is visible and responsive.');

} finally { await browser.close(); }
