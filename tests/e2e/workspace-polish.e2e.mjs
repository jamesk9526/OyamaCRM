import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
import { installDonorWorkspaceFixtures } from './fixtures/donor-daily-workspace.mjs';
const phase=process.argv[2]||'after';
const dir='docs/status/audit-artifacts/2026-11-05-workspace-polish';
await mkdir(dir,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
try {for(const width of [1440,390]) {
 const page=await browser.newPage({viewport:{width,height:1000},isMobile:width<600,hasTouch:width<600});
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});
 await page.addInitScript(()=>localStorage.setItem('oyama:release:2.0:qa-org:qa-admin','seen'));
 await page.route('**/api/**',route=>route.fulfill({status:503,json:{error:{message:'Unconfigured synthetic fixture'}}}));
 await page.route('**/api/reports/new-donors**',route=>route.fulfill({json:{items:[],total:0,totalPages:0}}));
 await page.route('**/api/notifications**',route=>route.fulfill({json:{items:[],unreadCount:0}}));
 await installDonorWorkspaceFixtures(page);
 await page.route('**/api/auth/refresh',route=>route.fulfill({json:{data:{accessToken:'synthetic-qa'}}}));
 await page.route('**/api/auth/me',route=>route.fulfill({json:{data:{id:'qa-admin',organizationId:'qa-org',firstName:'QA',lastName:'Admin',role:'admin',email:'qa@example.invalid'}}}));
 await page.route('**/api/setup/status',route=>route.fulfill({json:{setupComplete:true}}));
 await page.goto('http://localhost:3000/',{waitUntil:'networkidle'});
 await page.getByRole('region',{name:'Performance summary'}).waitFor();
 await page.screenshot({path:`${dir}/${phase}-${width}.png`,fullPage:true});
 if(phase==='after') {
 const card=page.locator('.crm-metric-card').first();
 const link=card.locator('..');
 await card.hover();
 await page.waitForTimeout(300);
 assert.equal(await card.evaluate(el=>getComputedStyle(el).transform),width<600?'none':'matrix(1, 0, 0, 1, 0, -2)');
 await page.screenshot({path:dir+'/hover-'+width+'.png'});
 await link.focus();
 assert.notEqual(await link.evaluate(el=>getComputedStyle(el).outlineStyle),'none');
 await page.getByRole('button',{name:'Supporter relationships',exact:true}).click();
 assert.equal(await page.getByRole('button',{name:'Supporter relationships',exact:true}).getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'Fundraising overview',exact:true}).click();
 await page.getByRole('button',{name:'Refresh',exact:true}).click();
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent==='Refresh'&&!button.disabled));
 await page.locator('.crm-metric-card').first().getByText('$250.00',{exact:true}).waitFor();
 await page.evaluate(()=>document.querySelectorAll('[data-crm-scroll-root]').forEach(el=>{el.scrollLeft=0;el.scrollTop=0;}));
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await card.evaluate(el=>getComputedStyle(el).animationName),'none');
 assert.equal(await card.evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
 assert.equal(await card.evaluate(el=>getComputedStyle(el).transform),'none');
 await page.emulateMedia({media:'print',reducedMotion:'no-preference'});
 assert.equal(await card.evaluate(el=>getComputedStyle(el).transform),'none');
 await page.emulateMedia({media:'screen',reducedMotion:'reduce'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:`${dir}/reduced-motion-${width}.png`});
 assert.deepEqual(errors,[]);
 }
 results.push({width,phase,errors});await page.close();
}
await writeFile(`${dir}/${phase}-checks.json`,JSON.stringify({fixtures:'Synthetic browser API responses, no writes',results},null,2));
console.log(JSON.stringify(results));
}finally{await browser.close();}
