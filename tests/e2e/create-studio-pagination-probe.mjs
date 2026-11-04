/** Isolated synthetic pagination feasibility test. No CRM or provider requests. */
import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import designModule from '../../server/src/oyama-create/studio/design.ts';
import layoutModule from '../../server/src/oyama-create/studio/layout.ts';
const {defaultDesign}=designModule, {paginationMetrics,studioContentCss,flowPageCount}=layoutModule;
const design=defaultDesign(),metrics=paginationMetrics(design),evidence='docs/status/audit-artifacts/2026-11-03-create-studio';
await mkdir(evidence,{recursive:true});
const font=await readFile('public/fonts/noto-serif-latin.woff2');
const browser=await chromium.launch({headless:true});const results=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',error=>errors.push(error.message));
 for(const count of [1,2,5,20]){
  const content=Array.from({length:count},(_,index)=>`${index?'<div data-letter-page-break="true"></div>':''}<h2>Page ${index+1}</h2><p>${'Synthetic editable appeal paragraph. '.repeat(15)}</p>`).join('');
  await page.setContent(`<style>@font-face{font-family:'Noto Serif';src:url(data:font/woff2;base64,${font.toString('base64')})}body{margin:30px;background:#edf4fc}.rail{overflow:auto;width:1300px;padding:30px;background:white}.flow{width:${metrics.bodyWidth}px;height:${metrics.bodyHeight}px;column-width:${metrics.bodyWidth}px;column-gap:${metrics.columnGap}px;column-fill:auto;outline:none}${studioContentCss(design,'.flow')}</style><div class="rail"><div class="flow" contenteditable="true" role="textbox" aria-label="Synthetic paginated content">${content}</div></div>`);
  await page.evaluate(()=>document.fonts.ready);const measured=await page.locator('.flow').evaluate(element=>({width:element.scrollWidth,client:element.clientWidth,heights:[...element.querySelectorAll('p')].map(el=>el.getBoundingClientRect().height)}));
  assert.equal(flowPageCount(measured.width,metrics.bodyWidth,metrics.columnGap),count,JSON.stringify(measured));
  await page.getByRole('textbox').focus();await page.keyboard.press('Control+End');await page.keyboard.type(' Synthetic cross-page edit.');assert.ok((await page.getByRole('textbox').innerText()).endsWith('Synthetic cross-page edit.'));
  results.push({pages:count,actual:flowPageCount(measured.width,metrics.bodyWidth,metrics.columnGap),crossPageTyping:true});
  if(count===2)await page.screenshot({path:`${evidence}/pagination-engine-probe.png`});
 }
 assert.deepEqual(errors,[]);await writeFile(`${evidence}/pagination-probe.json`,JSON.stringify({fixture:'Synthetic browser fragmentation probe; not the complete Studio editor acceptance',results,errors},null,2));console.log(JSON.stringify({results,errors}));
}finally{await browser.close();}
