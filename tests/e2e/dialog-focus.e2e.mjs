import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('tsx'))('esbuild');

// Real shared modal and form state, with only Next's route context substituted.
const bundle = await build({
  stdin: { contents: `
    import React, {useState} from 'react';
    import {createRoot} from 'react-dom/client';
    import Modal from './app/components/ui/WorkspaceSetupModal';
    function Fixture() {
      const [open,setOpen]=useState(false);
      const [value,setValue]=useState('');
      return <><button id="launch" onClick={()=>setOpen(true)}>Open form</button>
        {open && <Modal title="Edit event" subtitle="Focus regression" onClose={()=>setOpen(false)}>
          <input aria-label="First field" />
          <input aria-label="Second field" value={value} onChange={e=>setValue(e.target.value)} />
          <button id="last">Save</button>
        </Modal>}</>;
    }
    createRoot(document.getElementById('root')).render(<Fixture/>);
  `, resolveDir: process.cwd(), loader: 'tsx' },
  bundle: true, write: false, format: 'iife', jsx: 'automatic',
  alias: { '@': process.cwd() },
  plugins: [{name:'fixture-navigation',setup(build){
    build.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'fixture'}));
    build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const usePathname=()=>"/events";',loader:'js'}));
  }}],
});
const browser = await chromium.launch({headless:true});
try {
  for (const width of [390,768,1440]) {
    const page = await browser.newPage({viewport:{width,height:900}});
    await page.setContent('<div id="root"></div>');
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    await page.locator('#launch').click();
    await page.getByRole('dialog').waitFor();
    const second = page.getByLabel('Second field');
    await second.click();
    await second.pressSequentially('Trivia captain', {delay:20});
    assert.equal(await second.inputValue(),'Trivia captain');
    assert.equal(await second.evaluate(el=>el===document.activeElement),true,'Typing must retain focus after parent rerenders');
    await page.locator('#last').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.getByRole('button',{name:'Close modal',exact:true}).evaluate(el=>el===document.activeElement),true,'Tab wraps inside dialog');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.locator('#last').evaluate(el=>el===document.activeElement),true,'Reverse Tab wraps inside dialog');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(),0);
    assert.equal(await page.locator('#launch').evaluate(el=>el===document.activeElement),true,'Close restores focus');
    assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
    await page.close();
    console.log(`Dialog behavior passed at ${width}px`);
  }
} finally { await browser.close(); }
