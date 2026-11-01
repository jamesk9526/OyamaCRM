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
 const localTargets=new Set();
 for(const route of ['index.html','docs.html','hosting.html','screenshots.html']){
  await page.goto(`${base}/${route}`,{waitUntil:'networkidle'});
  assert.equal(await page.locator('h1').count(),1);
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:1000});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${route} overflow ${width}`);
  }
  const links=await page.locator('a[href]').evaluateAll(items=>items.map(item=>item.href));
  for(const url of links)if(url.startsWith(base))localTargets.add(url);
  // Resolve lazy images before capturing the entire documentation page.
  await page.locator('img').evaluateAll(items=>items.forEach(img=>img.loading='eager'));
  await page.evaluate(()=>Promise.all([...document.images].map(img=>img.decode().catch(()=>{}))));
  await page.screenshot({path:`${evidence}/${route.replace('.html','')}-desktop.png`,fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:900});
  await page.screenshot({path:`${evidence}/${route.replace('.html','')}-mobile.png`,fullPage:true,animations:'disabled'});
 }
 await page.getByRole('button',{name:'Mobile',exact:true}).click();
 assert.equal(await page.locator('.gallery-card:visible').count(),3);
 assert.equal(await page.locator('#gallery-count').textContent(),'3 screenshots');
 await page.locator('.gallery-card:visible .image-button').first().click();
 assert.ok((await page.locator('dialog img').getAttribute('src')).endsWith('dashboard-mobile.png'));
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Desktop',exact:true}).click();
 assert.equal(await page.locator('.gallery-card:visible').count(),6);
 await page.getByRole('button',{name:'All screens',exact:true}).click();
 assert.equal(await page.locator('.gallery-card:visible').count(),9);
 // Check every local link, including fragments and download assets.
 for(const target of localTargets){
  const url=new URL(target);
  if(url.hash){
   await page.goto(target,{waitUntil:'domcontentloaded'});
   assert.ok(await page.evaluate(id=>!!document.getElementById(id),decodeURIComponent(url.hash.slice(1))),`missing anchor ${target}`);
  }else{
   const response=await page.request.get(target);
   assert.equal(response.ok(),true,`broken local link ${target}`);
  }
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
 await writeFile(`${evidence}/checks.json`,JSON.stringify({errors,failed,github,localLinksChecked:localTargets.size,checks:['screenshot tabs','dialog opens and Escape closes','mobile navigation','four pages at four responsive widths','nine screenshot downloads','gallery desktop/mobile filters','all local links and anchors','no failed asset requests','repository links']},null,2));
 console.log('Static v2 website checks passed');
}finally {await browser.close();}
