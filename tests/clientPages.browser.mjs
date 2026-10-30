// Actual client pages, isolated synthetic services only; no production auth bypass.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MOBILE_TEST_BASE_URL;
if (!base) throw new Error('Set MOBILE_TEST_BASE_URL to the development preview');
await mkdir('generated-artifacts', { recursive: true });
await build({
  entryPoints: ['tests/redesign.fixture.tsx'], bundle: true, format: 'esm',
  jsx: 'automatic', alias: { '@': resolve('src') }, loader: { '.sql': 'text' },
  define: { 'process.env.NODE_ENV': '"development"' },
  outfile: 'generated-artifacts/client-pages.js', logLevel: 'error',
  plugins: [{
    name: 'isolated-client-fixture', setup(b) {
      b.onLoad({ filter: /(integrations\/supabase\/client\.ts|hooks\/useAuth\.tsx)$/ }, async () => {
        let contents = await readFile('tests/redesign.services.tsx', 'utf8');
        contents = contents.replace('valid_until:null', "valid_until:'2099-12-31'");
        contents = contents.replace("business_address:'Test address'", "business_address:'Test address',phone:'0400000000'");
        contents = contents.replace('quote_line_items:[]', `quote_line_items:[
          {id:'fixture-item-one',quote_id:qid,title:'Preparation',description:'Prepare the existing surface safely',category:'included',cost:10000,quantity:1,unit_price:10000,sort_order:0,is_variation:false},
          {id:'fixture-item-two',quote_id:qid,title:'Install replacement timber',description:'Long description '+ 'material '.repeat(30),category:'included',cost:17100,quantity:1,unit_price:17100,sort_order:1,is_variation:false}
        ]`);
        return { contents, loader: 'tsx', resolveDir: process.cwd() };
      });
    },
  }],
});
await writeFile('generated-artifacts/client-pages.html',
  '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"><div id="root"></div><script type="module" src="/generated-artifacts/client-pages.js"></script>');
const projectId = '20000000-0000-4000-8000-000000000001';
const routes = [`/project/${projectId}?access=synthetic-test-only`, '/quote/fixture-token'];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
try {
  for (const width of [320, 375, 768]) {
    for (const path of routes) {
      const page = await browser.newPage({ viewport: { width, height: 812 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/**', route => route.fulfill({ json: { success: true } }));
      await page.goto(`${base}/generated-artifacts/client-pages.html?view=${encodeURIComponent(path)}`);
      await page.getByText('Synthetic North Fitzroy job').first().waitFor();
      await page.waitForTimeout(200);
      assert.deepEqual(errors, [], `Runtime errors: ${path}`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${path} overflows at ${width}px`);
      assert.match(await page.locator('body').innerText(), /27,100/);
      assert.match(await page.locator('body').innerText(), /GST/);
      await page.screenshot({ path: `generated-artifacts/client-${path.startsWith('/quote') ? 'quote' : 'project'}-${width}.png`, fullPage: true });
      console.log(`PASS ${path} at ${width}px with actual client components`);
      await page.close();
    }
  }
  for (const path of ['/quote/invalid-synthetic-token', '/project/invalid-synthetic-id?access=invalid']) {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    await page.route('**/api/**', route => route.fulfill({ json: { success: true } }));
    await page.goto(`${base}/generated-artifacts/client-pages.html?view=${encodeURIComponent(path)}`);
    await page.getByText(/unavailable|not found|invalid|expired/i).first().waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    console.log(`PASS invalid-link error page: ${path}`);
    await page.close();
  }
  for (const path of routes) {
    for (const decision of ['accept', 'decline']) {
      const page = await browser.newPage({ viewport: { width: 375, height: 812 }, acceptDownloads: true });
      await page.route('**/api/**', route => route.fulfill({ json: { success: true } }));
      await page.goto(`${base}/generated-artifacts/client-pages.html?view=${encodeURIComponent(path)}`);
      await page.getByText('Synthetic North Fitzroy job').first().waitFor();
      const action = page.getByRole('button', {
        name: decision === 'accept' ? /^Accept( Quote)?$/i : /^Decline( Quote)?$/i,
      }).first();
      const box = await action.boundingBox();
      assert.ok(box && box.y < 812 && box.height >= 44, 'Response action is above the fold with a 44px target');
      await action.click();
      const confirm = page.getByTestId(path.startsWith('/quote') ? 'button-confirm-response' : 'button-confirm-approval');
      await confirm.click();
      const panel = page.getByTestId(path.startsWith('/quote') ? 'persistent-quote-decision' : 'persistent-project-quote-decision');
      await panel.waitFor();
      assert.match(await panel.innerText(), decision === 'accept' ? /accepted/i : /declined/i);
      const downloadPromise = page.waitForEvent('download');
      await panel.getByRole('button', { name: 'Download PDF' }).click();
      assert.match((await downloadPromise).suggestedFilename(), /\.pdf$/i);
      await page.getByRole('button', { name: 'Request a change', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'Send change request' }).click();
      await dialog.getByRole('alert').filter({ hasText: /Describe/ }).waitFor();
      await dialog.getByLabel('What would you like changed?').fill('Synthetic request: please discuss a different finish.');
      await dialog.getByRole('button', { name: 'Send change request' }).click();
      await dialog.waitFor({ state: 'hidden' });
      const calls = await page.evaluate(() => window.__fixtureMutationCalls ?? []);
      assert.ok(calls.some(call => call.table === 'change_requests' && call.action === 'insert' && call.value.type === 'client_request'));
      await panel.waitFor(); // A request must not erase or alter the recorded decision.
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      console.log(`PASS ${path}: ${decision}, persistent decision/PDF, same-page change request`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
