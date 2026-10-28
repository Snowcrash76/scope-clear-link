import { build } from 'esbuild';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const job = { jobId: 'one', jobName: 'Synthetic carpentry job', clientName: 'Test client', status: 'in_progress',
  quotedExGst: 1000, invoicedExGst: 600, approvedVariationsExGst: 200, confirmedCostsExGst: 750,
  draftCostsExGst: 500, costsByCategory: { Materials: 750, Subcontractor: 0, 'Plant/Equipment': 0, Labour: 0, Other: 0 } };
const jobs = [job, { ...job, jobId: 'two', jobName: 'Synthetic kitchen job', invoicedExGst: 1000, confirmedCostsExGst: 500 },
  { ...job, jobId: 'three', jobName: 'Job without accepted quote', quotedExGst: null, invoicedExGst: 0, confirmedCostsExGst: 200 }];
await mkdir('generated-artifacts', { recursive: true });
await build({ entryPoints: ['tests/profitability.fixture.tsx'], bundle: true, platform: 'browser', format: 'esm',
  jsx: 'automatic', alias: { '@': resolve('src') }, loader: { '.sql': 'text' },
  define: { 'process.env.NODE_ENV': '"development"' }, outfile: 'generated-artifacts/profitability.js',
  plugins: [{ name: 'synthetic-profit-data', setup(b) {
    b.onLoad({ filter: /components\/AppShell\.tsx$/ }, () => ({
      contents: 'export function AppShell({children}) { return <div className="min-w-0 bg-background">{children}</div> }', loader: 'tsx',
    }));
    b.onLoad({ filter: /hooks\/useJobCosts\.ts$/ }, () => ({
      contents: `export { aud, profitability } from '../../shared/jobCosting';
        const data = ${JSON.stringify(jobs)};
        export function useJobProfitability() {
          const scenario = new URLSearchParams(location.search).get('scenario');
          return {data: scenario === 'unknown' ? [data[2]] : scenario === 'zero' ? [{...data[0], quotedExGst:0}] : data,
            isLoading:false,isError:false,refetch:async()=>{}};
        }`, loader: 'ts', resolveDir: resolve('src/hooks'),
    }));
  } }],
});
await writeFile('generated-artifacts/profitability.html', '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"><title>Isolated profitability test</title></head><body><div id="root"></div><script type="module" src="/generated-artifacts/profitability.js"></script></body></html>');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
const base = process.env.MOBILE_TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
try {
  for (const width of [320, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/generated-artifacts/profitability.html`);
    await page.getByTestId('summary-profit').waitFor();
    assert.match(await page.getByTestId('summary-profit').innerText(), /750\.00/);
    assert.match(await page.getByTestId('summary-margin').innerText(), /37\.5%/);
    await page.getByRole('button', { name: 'invoiced', exact: true }).click();
    assert.match(await page.getByTestId('summary-profit').innerText(), /150\.00/);
    assert.match(await page.getByTestId('summary-margin').innerText(), /9\.4%/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    for (const scenario of ['unknown', 'zero']) {
      await page.goto(`${base}/generated-artifacts/profitability.html?scenario=${scenario}`);
      await page.getByTestId('summary-margin').waitFor();
      const margin = await page.getByTestId('summary-margin').innerText();
      assert.doesNotMatch(margin, /NaN|Infinity|0\.0%/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    assert.deepEqual(errors, []);
    console.log(`PASS profitability calculations and layout at ${width}px`);
    await page.close();
  }
} finally { await browser.close(); }
