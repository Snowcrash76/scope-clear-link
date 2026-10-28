// Run with the dev workflow running:
// PLAYWRIGHT_MODULE=/path/to/playwright node tests/mobileLayout.browser.mjs
// All synthetic service stubs below exist only in the ignored fixture bundle.
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
await mkdir('generated-artifacts', { recursive: true });
const extraction = {
  supplier: 'Synthetic hardware supplier with a long store name',
  abn: '12345678901', date: '2026-10-28', reference_number: 'RECEIPT-TEST-000123',
  subtotal_ex_gst: 100, gst: 10, total_inc_gst: 110, currency: 'AUD',
  confidence: 'high', suggested_category: 'Materials', warnings: [],
  line_items: [{ description: 'Timber-' + 'LongMaterialDescription'.repeat(8), quantity: 2, unit_price: 50, amount: 100 }],
};
await build({
  entryPoints: ['tests/mobileReceipt.fixture.tsx'], bundle: true, platform: 'browser',
  format: 'esm', jsx: 'automatic', alias: { '@': resolve('src') }, loader: { '.sql': 'text' },
  define: { 'process.env.NODE_ENV': '"development"' },
  outfile: 'generated-artifacts/mobile-receipt.js', logLevel: 'error',
  plugins: [{
    name: 'synthetic-receipt-services',
    setup(b) {
      b.onLoad({ filter: /integrations\/supabase\/client\.ts$/ }, () => ({
        contents: 'export const supabase = {};', loader: 'ts',
      }));
      b.onLoad({ filter: /hooks\/useJobCosts\.ts$/ }, async ({ path }) => {
        let contents = await readFile(path, 'utf8');
        for (const name of ['useJobCosts', 'uploadCostReceipt', 'getCostReceiptUrl', 'extractCostReceipt', 'findCostDuplicates']) {
          contents = contents.replace(new RegExp(`export (async )?function ${name}\\(`), (_, async = '') => `${async}function unused_${name}(`);
        }
        contents = contents.replace('export { prepareReceiptForScan, validateReceiptFile }', 'export { validateReceiptFile }');
        contents += `
          import { useState as useFixtureState } from 'react';
          export function useJobCosts() {
            const [costs, setCosts] = useFixtureState([]);
            return { costs, quoteLineItems: [{
            id: '00000000-0000-4000-8000-000000000002', source: 'scope', title: '${'LongQuoteItem'.repeat(20)}', quote_number: 'QT-TEST'
          }], scopeLinkSetupRequired: false, loading: false, error: null,
          refetch: async () => {}, saveCost: async (input, id) => {
            const record = {...input, id: id || 'synthetic-cost', created_at: '2026-10-28T00:00:00Z',
              updated_at: '2026-10-28T00:00:00Z', created_by: 'synthetic-test-user'};
            setCosts(current => [...current.filter(row => row.id !== record.id), record]);
          }, deleteCost: async () => {},
          saving: false, deleting: false }; }
          export async function uploadCostReceipt() { return 'synthetic/receipt.jpg'; }
          export async function prepareReceiptForScan() { return {}; }
          export async function extractCostReceipt() { return { extraction: ${JSON.stringify(extraction)} }; }
          export async function findCostDuplicates() { return []; }
          export async function getCostReceiptUrl() { return ''; }
        `;
        return { contents, loader: 'ts', resolveDir: resolve('src/hooks') };
      });
    },
  }],
});
await writeFile('generated-artifacts/mobile-receipt.html', `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/src/index.css">
<title>Isolated receipt layout test</title></head><body><div id="root"></div>
<script type="module" src="/generated-artifacts/mobile-receipt.js"></script></body></html>`);

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
const base = process.env.MOBILE_TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const results = [];
try {
  for (const width of [320, 360, 390, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    async function check(label) {
      await page.waitForTimeout(300);
      const bounds = await page.evaluate(() => {
        const dialog = document.querySelector('[data-testid="dialog-job-cost"]');
        return {
          viewport: innerWidth, page: document.documentElement.scrollWidth,
          dialog: dialog ? { left: dialog.getBoundingClientRect().left, right: dialog.getBoundingClientRect().right,
            width: dialog.clientWidth, scroll: dialog.scrollWidth } : null,
        };
      });
      assert.ok(bounds.page <= width + 1, `${width}px ${label}: page overflow ${JSON.stringify(bounds)}`);
      if (bounds.dialog) {
        assert.ok(bounds.dialog.left >= 0 && bounds.dialog.right <= width + 1, `${width}px ${label}: dialog outside viewport`);
        assert.ok(bounds.dialog.scroll <= bounds.dialog.width + 1, `${width}px ${label}: form content overflow ${JSON.stringify(bounds)}`);
      }
      results.push({ width, state: label, ...bounds });
    }
    await page.goto(`${base}/generated-artifacts/mobile-receipt.html`);
    await page.getByTestId('button-add-job-cost').click();
    await check('empty cost form');
    // Create an actual high-resolution portrait image and a deliberately long camera filename.
    const data = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 3024; canvas.height = 4032;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'black'; ctx.font = '80px sans-serif'; ctx.fillText('SYNTHETIC RECEIPT', 100, 200);
      return canvas.toDataURL('image/jpeg').split(',')[1];
    });
    await page.getByTestId('input-receipt-camera').setInputFiles({
      name: `IMG_${'CameraReceiptFilename'.repeat(8)}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.from(data, 'base64'),
    });
    await check('camera photo selected');
    await page.getByTestId('button-scan-receipt').click();
    await page.getByLabel('Receipt scan review').waitFor();
    await check('scanned editable review');
    await page.getByRole('button', { name: 'Add row', exact: true }).click({ timeout: 5000 }).catch(async error => {
      console.error(await page.locator('body').innerText(), errors); throw error;
    });
    await check('review with added line item');
    await page.locator('#cost-quote-link').click();
    await check('quote dropdown');
    await page.getByRole('option').last().click();
    await check('long linked quote item selected');
    await page.getByTestId('receipt-line-remove-1').click();
    await page.getByTestId('receipt-line-description-0').fill('Edited timber receipt item');
    await page.getByTestId('receipt-line-unit-price-0').fill('45');
    await page.getByTestId('receipt-line-amount-0').fill('90');
    assert.equal(await page.locator('#cost-inc').inputValue(), '110.00');
    await page.getByTestId('checkbox-receipt-reviewed').check();
    await page.getByRole('button', { name: 'Add cost', exact: true }).click();
    await page.getByTestId('receipt-items-summary').waitFor();
    assert.match(await page.getByTestId('receipt-summary-total').innerText(), /110\.00/);
    assert.match(await page.getByTestId('receipt-summary-amount-0').innerText(), /90\.00/);
    assert.equal(await page.getByTestId('receipt-summary-description-0').innerText(), 'Edited timber receipt item');
    await check('saved itemised receipt and total');
    await page.getByTestId('button-edit-cost-synthetic-cost').click();
    assert.equal(await page.getByTestId('receipt-line-unit-price-0').inputValue(), '45');
    assert.equal(await page.getByTestId('receipt-line-amount-0').inputValue(), '90');
    await check('reopened receipt retains edited items');
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByTestId('button-view-line-items-synthetic-cost').click();
    await page.getByTestId('receipt-items-summary').last().waitFor();
    await check('saved receipt details modal');
    assert.deepEqual(errors, [], `${width}px browser errors`);
    if (width === 360) {
      await page.screenshot({ path: 'generated-artifacts/receipt-review-360.jpg' });
    }
    await page.close();
  }
  // Public routes are checked separately from the synthetic signed-in receipt component.
  for (const route of ['/', '/login', '/signup', '/forgot-password', '/reset-password', '/demo', '/not-a-route']) {
    const page = await browser.newPage({ viewport: { width: 320, height: 850 } });
    await page.goto(`${base}${route}`); await page.waitForTimeout(500);
    const actual = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(actual <= 321, `${route}: public page overflow ${actual}px`);
    results.push({ route, width: 320, page: actual }); await page.close();
  }
  await writeFile('generated-artifacts/mobile-layout-results.json', JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); }
