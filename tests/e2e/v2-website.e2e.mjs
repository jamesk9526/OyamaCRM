import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const base=process.env.WEBSITE_QA_URL||'http://127.0.0.1:8082';
const evidence='docs/status/audit-artifacts/2026-11-01-v2-website';
await mkdir(evidence,{recursive:true});
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1050}});
const errors=[],failed=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('response',response=>{if(response.status()>=400)failed.push(response.url());});
try {
 await page.goto(base,{waitUntil:'networkidle'});
 await page.screenshot({path:`${evidence}/website-desktop.png`,fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'02 Spreadsheet tables'}).click();
 assert.ok((await page.locator('#product-shot').getAttribute('src')).endsWith('tables.png'));
 await page.locator('.screen-preview').click();
 await page.getByRole('dialog').waitFor();
 await page.keyboard.press('Escape');
 assert.equal(await page.getByRole('dialog').isVisible(),false);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:1050});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`overflow ${width}`);
 }
 await page.setViewportSize({width:390,height:900});
 await page.evaluate(()=>scrollTo(0,0));
 await page.getByRole('button',{name:'Menu'}).click();
 assert.equal(await page.getByRole('button',{name:'Menu'}).getAttribute('aria-expanded'),'true');
 await page.keyboard.press('Escape');
 assert.equal(await page.getByRole('button',{name:'Menu'}).getAttribute('aria-expanded'),'false');
 await page.screenshot({path:`${evidence}/website-mobile.png`,fullPage:true,animations:'disabled'});
 const github=await page.locator('a[href^="https://github.com/"]').evaluateAll(links=>links.map(link=>link.href));
 assert.ok(github.length>=6&&github.every(url=>url.startsWith('https://github.com/jamesk9526/OyamaCRM')));
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 await writeFile(`${evidence}/checks.json`,JSON.stringify({errors,failed,github,checks:['screenshot tabs','dialog opens and Escape closes','mobile navigation','four responsive widths','no failed asset requests','repository links']},null,2));
 console.log('Static v2 website checks passed');
}finally {await browser.close();}
