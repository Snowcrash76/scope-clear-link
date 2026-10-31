// Run with the dev workflow active. Optional PLAYWRIGHT_MODULE and
// CHROMIUM_EXECUTABLE_PATH select an existing browser installation.
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
await mkdir('generated-artifacts', { recursive: true });
await build({
  entryPoints: ['tests/projectPhone.fixture.tsx'], bundle: true, format: 'esm',
  jsx: 'automatic', alias: { '@': resolve('src') },
  define: { 'process.env.NODE_ENV': '"development"' },
  outfile: 'generated-artifacts/project-phone.js',
  plugins: [{
    name: 'isolated-phone-services',
    setup(builder) {
      builder.onLoad({ filter: /integrations\/supabase\/client\.ts$/ }, () => ({
        contents: 'export const supabase = {};', loader: 'ts',
      }));
      builder.onLoad({ filter: /hooks\/useLineItemHistory\.ts$/ }, () => ({
        contents: `export const useLineItemHistory = () => ({history: [], loading: false, refetch: async () => {}});
          export const formatHistoryEntry = () => '';`, loader: 'ts',
      }));
    },
  }],
});
await writeFile('generated-artifacts/project-phone.html', `<!doctype html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/src/index.css"><title>Project phone component check</title>
</head><body><div id="root"></div><script type="module" src="/generated-artifacts/project-phone.js"></script></body></html>`);
const browser = await chromium.launch({
  headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
});
const base = process.env.MOBILE_TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const results = [];
try {
  for (const [width, height] of [[320, 740], [360, 740], [390, 740], [768, 740], [1280, 740], [320, 480]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    async function check(state) {
      await page.waitForTimeout(250);
      const bounds = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        const rect = dialog?.getBoundingClientRect();
        return {
          page: document.documentElement.scrollWidth,
          dialog: dialog && { left: rect.left, right: rect.right, top: rect.top,
            bottom: rect.bottom, width: dialog.clientWidth, scroll: dialog.scrollWidth },
          overflowingDialogContent: dialog && [...dialog.querySelectorAll('div')].filter(
            element => element.scrollWidth > element.clientWidth + 1 &&
              getComputedStyle(element).overflowX !== 'auto',
          ).map(element => element.className),
        };
      });
      assert.ok(bounds.page <= width + 1, `${width} ${state}: page overflow ${JSON.stringify(bounds)}`);
      if (bounds.dialog) {
        const d = bounds.dialog;
        assert.ok(d.left >= 0 && d.right <= width + 1, `${state}: dialog outside width`);
        assert.ok(d.top >= 0 && d.bottom <= height + 1, `${state}: dialog outside height`);
        assert.ok(d.scroll <= d.width + 1, `${state}: dialog content overflow ${JSON.stringify(d)}`);
        assert.deepEqual(bounds.overflowingDialogContent, [], `${state}: inner dialog overflow`);
      }
      results.push({ width, state, ...bounds });
    }
    await page.goto(`${base}/generated-artifacts/project-phone.html`);
    await page.getByTestId('job-section-quote').waitFor();
    await check('quote read');
    // Keyboard navigation must expose even the last item without widening the page.
    await page.getByTestId('job-section-documents').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => {
      const button = document.querySelector('[data-testid="job-section-activity"]');
      const b = button.getBoundingClientRect();
      const n = button.closest('nav').getBoundingClientRect();
      return b.left >= n.left - 1 && b.right <= n.right + 1;
    });
    const selectedVisible = await page.getByTestId('job-section-activity').evaluate(button => {
      const b = button.getBoundingClientRect();
      const n = button.closest('nav').getBoundingClientRect();
      return b.left >= n.left - 1 && b.right <= n.right + 1;
    });
    assert.ok(selectedVisible, 'Selected final section must be fully visible');
    await check('last section selected');
    await page.getByTestId('job-section-quote').click();
    await page.getByRole('button', { name: 'Edit Quote', exact: true }).click();
    await page.getByTestId('button-add-line-item').click();
    await check('quote add item');
    await page.getByTestId('input-new-item-title').fill('New phone line item');
    await page.getByTestId('input-new-item-cost').fill('42.50');
    await page.getByTestId('button-confirm-add-item').click();
    await page.getByTestId('button-edit-item-phone-item').click();
    await page.getByTestId('input-edit-item-title-phone-item').fill('Updated phone line item');
    await check('quote edit item');
    await page.getByTestId('button-save-item-phone-item').click();
    await page.getByText('Updated phone line item', { exact: true }).waitFor();
    await page.getByTestId('job-section-invoices').click();
    await check('invoice list');
    await page.getByTestId('button-edit-invoice-reference-phone-invoice').click();
    await check('invoice reference edit');
    await page.getByTestId('button-cancel-invoice-reference-phone-invoice').click();
    await page.getByRole('button', { name: /^View invoice/ }).click();
    await check('invoice view');
    await page.getByRole('button', { name: 'Download PDF', exact: true }).waitFor();
    if (width === 320 && height === 740) {
      await page.screenshot({ path: 'generated-artifacts/project-phone-invoice-view.png' });
    }
    await page.getByRole('dialog').evaluate(dialog => { dialog.scrollTop = dialog.scrollHeight; });
    await check('invoice view bottom');
    await page.keyboard.press('Escape');
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Create Invoice', exact: true }).click();
    await check('invoice create');
    if (width === 320 && height === 480) {
      await page.screenshot({ path: 'generated-artifacts/project-phone-invoice-create.png' });
    }
    await page.getByTestId('select-invoice-type').click();
    await page.getByRole('option', { name: 'Custom', exact: true }).click();
    await check('invoice custom type');
    await page.getByRole('dialog').getByRole('button', { name: 'Create Invoice', exact: true }).click();
    await page.waitForFunction(() => window.savedInvoice);
    assert.equal(await page.evaluate(() => window.savedInvoice.lineItems.length), 1);
    assert.deepEqual(errors, []);
    console.log(`PASS project phone components at ${width}px`);
    await page.close();
  }
  await writeFile('generated-artifacts/project-phone-results.json', JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
