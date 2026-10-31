// Updated to exercise the user's confirmed top navigation, not the removed hamburger.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
await mkdir('generated-artifacts',{recursive:true});
await build({entryPoints:['tests/jobSections.fixture.tsx'],bundle:true,format:'esm',jsx:'automatic',alias:{'@':resolve('src')},
 define:{'process.env.NODE_ENV':'"development"'},outfile:'generated-artifacts/job-sections.js',logLevel:'error'});
await writeFile('generated-artifacts/job-sections.html','<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"><div id="root"></div><script type="module" src="/generated-artifacts/job-sections.js"></script>');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH});
const base=process.env.MOBILE_TEST_BASE_URL||`https://${process.env.REPLIT_DEV_DOMAIN}`;
try{
 for(const width of [320,375,768,1280,1440]){
  const page=await browser.newPage({viewport:{width,height:800}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`${base}/generated-artifacts/job-sections.html`);
  const nav=page.getByRole('navigation',{name:'Job sections',exact:true});
  await nav.waitFor();
  assert.equal(await nav.locator('[data-section-item]').count(),9);
  assert.equal(await page.getByRole('button',{name:'All sections',exact:true}).count(),0);
  assert.equal(await page.getByRole('button',{name:/^Job sections,/}).count(),0);
  for(const [key,label] of [['invoices','Invoices'],['costs','Costs'],['changes','Variations'],['stages','Stages'],['documents','Documents'],['staff','Team'],['activity','Activity'],['overview','Overview'],['quote','Quote']]){
   const button=page.getByTestId(`job-section-${key}`);
   await button.click();
   await page.getByRole('region',{name:label,exact:true}).waitFor();
   assert.equal(await button.getAttribute('aria-current'),'page');
   assert.equal(await page.getByRole('region').count(),1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await page.getByTestId('job-section-quote').focus();
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.getByTestId('job-section-changes').evaluate(el=>el===document.activeElement),true);
  await page.keyboard.press('Enter');
  await page.getByRole('region',{name:'Variations',exact:true}).waitFor();
  assert.deepEqual(errors,[]);
  await page.screenshot({path:`generated-artifacts/job-sections-top-${width}.png`});
  console.log(`PASS all nine top job sections and keyboard navigation at ${width}px`);
  await page.close();
 }
}finally{await browser.close();}
