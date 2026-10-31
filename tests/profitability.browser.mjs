import { build } from 'esbuild';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const job = { jobId: 'one', jobName: 'Synthetic carpentry job', clientName: 'Test client', status: 'in_progress',
  quotedExGst: 1000, quoteStatus: 'draft', quoteIsEstimate: true, invoicedExGst: 600, approvedVariationsExGst: 200, confirmedCostsExGst: 750,
  confirmedCostsIncGst: 825, draftCostsExGst: 500, draftCostsIncGst: 550,
  costsByCategory: { Materials: 750, Subcontractor: 0, 'Plant/Equipment': 0, Labour: 0, Other: 0 } };
const jobs = [job, { ...job, jobId: 'two', jobName: 'Synthetic kitchen job', invoicedExGst: 1000, confirmedCostsExGst: 500, confirmedCostsIncGst: 550 },
  { ...job, jobId: 'three', jobName: 'Job without accepted quote', quotedExGst: null, invoicedExGst: 0, confirmedCostsExGst: 200, confirmedCostsIncGst: 220 }];
await mkdir('generated-artifacts', { recursive: true });
await build({ entryPoints: ['tests/profitability.fixture.tsx'], bundle: true, platform: 'browser', format: 'esm',
  jsx: 'automatic', alias: { '@': resolve('src') }, loader: { '.sql': 'text' },
  define: { 'process.env.NODE_ENV': '"development"' }, outfile: 'generated-artifacts/profitability.js',
  plugins: [{ name: 'synthetic-profit-data', setup(b) {
    b.onLoad({ filter: /components\/AppShell\.tsx$/ }, () => ({
      contents: 'export function AppShell({children}) { return <div className="min-w-0 bg-background">{children}</div> }', loader: 'tsx',
    }));
    b.onLoad({ filter: /hooks\/useJobCosts\.ts$/ }, () => ({
      contents: `export { aud, money, profitability } from '../../shared/jobCosting';
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
    const profit = page.locator('[data-testid="job-profit-one"]:visible');
    const margin = page.locator('[data-testid="job-margin-one"]:visible');
    await profit.waitFor();
    assert.match(await profit.innerText(), /175\.00/);
    assert.match(await margin.innerText(), /17\.5%/);
    assert.match(await page.locator('[data-testid="job-costs-one"]:visible').innerText(), /825\.00/);
    assert.match(await page.locator('body').innerText(), /Costs so far \(inc GST\)/);
    assert.match(await page.locator('body').innerText(), /Quote value \(ex GST\)/);
    assert.equal(await page.getByText('Portfolio totals', { exact: true }).count(), 0);
    assert.equal(await page.getByTestId('summary-profit').count(), 0);
    assert.match(await page.locator('body').innerText(), /Estimated profit/i);
    assert.match(await page.locator('body').innerText(), /draft.*cost|cost.*draft/i);
    await page.getByRole('button', { name: 'invoiced', exact: true }).click();
    assert.match(await profit.innerText(), /-\$225\.00/);
    assert.match(await margin.innerText(), /-37\.5%/);
    assert.match(await page.locator('[data-testid="job-costs-one"]:visible').innerText(), /825\.00/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    for (const scenario of ['unknown', 'zero']) {
      await page.goto(`${base}/generated-artifacts/profitability.html?scenario=${scenario}`);
      const id = scenario === 'unknown' ? 'three' : 'one';
      const region = page.locator(`[data-testid="profitability-card-${id}"]:visible,[data-testid="profitability-row-${id}"]:visible`);
      await region.waitFor();
      assert.doesNotMatch(await region.innerText(), /NaN|Infinity/);
      if (scenario === 'unknown') {
        assert.match(await region.innerText(), /add a quote/i);
        assert.equal(await region.locator('a[href="/manage/three?tab=quote"]').count() > 0, true);
      }
      if (scenario === 'zero') {
        assert.match(await region.innerText(), /\$0 revenue/);
        assert.match(await page.locator('[data-testid="job-profit-one"]:visible').innerText(), /-\$825\.00/);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    assert.deepEqual(errors, []);
    console.log(`PASS profitability calculations and layout at ${width}px`);
    await page.close();
  }
} finally { await browser.close(); }
