// Actual overview component with synthetic data; never edits a customer quote.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { baselineAssets } from './baselineSources.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MOBILE_TEST_BASE_URL;
const parent = await readFile('src/pages/ProjectManage.tsx', 'utf8');
assert.match(parent, /quoteTotal=\{activeQuote\?\.total \?\? null\}/);
assert.doesNotMatch(parent, /quoteSubtotal=/);
await mkdir('generated-artifacts', { recursive: true });
const assets = await baselineAssets();
await build({
  stdin: { resolveDir: process.cwd(), loader: 'tsx', contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {MemoryRouter} from 'react-router-dom';
    import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
    import {TooltipProvider} from '@/components/ui/tooltip';
    import {ProjectOverview} from '@/components/project-manage/ProjectOverview';
    const state=new URLSearchParams(location.search).get('state');
    const props={quoteTotal:33660,quoteLoading:false,quoteError:false,quoteExists:true,quoteWaitingOnClient:false};
    if(state==='zero')props.quoteTotal=0;
    if(state==='no-gst')props.quoteTotal=500;
    if(state==='loading')props.quoteLoading=true;
    if(state==='error')props.quoteError=true;
    if(state==='none'){props.quoteExists=false;props.quoteTotal=null;}
    const project={id:'fixture-job',name:'Synthetic job',status:'in_progress',scopeItems:[{category:'included',cost:27100}],changeRequests:[],stages:[]};
    createRoot(document.getElementById('root')).render(
      <MemoryRouter><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><TooltipProvider>
        <ProjectOverview project={project} documents={[]} overdueInvoiceCount={0} onChangeTab={()=>{}} {...props}/>
      </TooltipProvider></QueryClientProvider></MemoryRouter>);
  ` },
  bundle: true, format: 'esm', jsx: 'automatic', alias: { '@': resolve('src') },
  outfile: 'generated-artifacts/job-overview-quote.js', define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'error',
  plugins: [{ name: 'isolated-data', setup(b) {
    b.onLoad({ filter: /(integrations\/supabase\/client\.ts|hooks\/useAuth\.tsx)$/ }, async () => ({
      contents: await readFile('tests/redesign.services.tsx', 'utf8'), loader: 'tsx', resolveDir: process.cwd(),
    }));
  } }],
});
await writeFile('generated-artifacts/job-overview-quote.html', `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${assets.css}"><div id="root"></div><script type="module" src="/generated-artifacts/job-overview-quote.js"></script>`);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, headless: true });
try {
  for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', route => route.fulfill({ json: route.request().url().includes('/employee/session') ? { employee: null, canManageTeam: false } : [] }));
    for (const [state, expected] of [['saved', '$33,660.00'], ['zero', '$0.00'], ['no-gst', '$500.00'], ['loading', 'Loading…'], ['error', 'Unavailable'], ['none', 'No quote']]) {
      await page.goto(`${base}/generated-artifacts/job-overview-quote.html?state=${state}`);
      const card = page.locator('section[aria-label="Job overview"] button:not([aria-label])').filter({ hasText: 'Quote total' });
      await card.waitFor();
      const text = await card.textContent();
      assert.ok(text.includes(expected), `${state}: ${text}`);
      if (['saved', 'zero', 'no-gst'].includes(state)) assert.ok(text.includes('Saved quote · inc GST'));
      assert.doesNotMatch(text, /\$30,600\.00|\$27,100\.00/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      if (state === 'saved') await page.screenshot({ path: `generated-artifacts/job-overview-quote-${width}.png`, fullPage: true });
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
} finally { await browser.close(); }
console.log('Job overview: saved GST-inclusive total, unchanged agreed price, zero/zero-GST/loading/error/no-quote states passed at 375/1280.');
