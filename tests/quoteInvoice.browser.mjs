// Exercise the real quote UI with isolated services; no customer account or payment data.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MOBILE_TEST_BASE_URL;
if (!base) throw new Error('Set MOBILE_TEST_BASE_URL to the development preview URL');

await mkdir('generated-artifacts', { recursive: true });
await build({
  entryPoints: ['tests/redesign.fixture.tsx'],
  bundle: true, format: 'esm', jsx: 'automatic', alias: { '@': resolve('src') },
  loader: { '.sql': 'text' }, define: { 'process.env.NODE_ENV': '"development"' },
  outfile: 'generated-artifacts/quote-invoice-fixture.js', logLevel: 'error',
  plugins: [{
    name: 'invoice-fixture',
    setup(builder) {
      builder.onLoad({ filter: /(integrations\/supabase\/client\.ts|hooks\/useAuth\.tsx)$/ }, async () => ({
        contents: (await readFile('tests/redesign.services.tsx', 'utf8'))
          .replace('function query(table:string)', "quote.status='approved'; tables.invoices=[];\nfunction query(table:string)")
          // The actual database supplies a draft status on insert.
          .replace("if(mutation?.action==='insert'){rows=", "if(mutation?.action==='insert'){if(table==='invoices')mutation.value={status:'draft',created_at:created,updated_at:created,...mutation.value};rows="),
        loader: 'tsx',
        resolveDir: process.cwd(),
      }));
    },
  }],
});
await writeFile('generated-artifacts/quote-invoice-fixture.html',
  '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"><div id="root"></div><script type="module" src="/generated-artifacts/quote-invoice-fixture.js"></script>');

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
try {
  for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/employee/session') return route.fulfill({ json: { employee: null, canManageTeam: true } });
      if (path === '/api/job-profitability') return route.fulfill({ json: [] });
      if (path === '/api/job-costs') return route.fulfill({ json: { costs: [], quoteLineItems: [], scopeLinkSetupRequired: false } });
      return route.fulfill({ json: [] });
    });
    await page.goto(`${base}/generated-artifacts/quote-invoice-fixture.html?view=/manage/20000000-0000-4000-8000-000000000001%3Ftab%3Dquote`);
    const create = page.getByRole('button', { name: 'Create invoice', exact: true });
    await create.waitFor();
    await create.click();
    const dialog = page.getByRole('dialog', { name: 'Create invoice' });
    await dialog.waitFor();
    assert.ok(await dialog.getByRole('button', { name: /Full invoice/ }).getAttribute('aria-pressed') === 'true');
    await dialog.getByRole('button', { name: /Deposit/ }).click();
    const percentage = dialog.getByLabel('Quote percentage');
    assert.equal(await percentage.inputValue(), '20');
    await percentage.fill('105');
    assert.equal(await dialog.getByRole('button', { name: 'Create invoice', exact: true }).isDisabled(), true);
    await percentage.fill('12.5');
    assert.match(await dialog.innerText(), /\$3,387\.50/);
    assert.match(await dialog.innerText(), /\$338\.75/);
    assert.match(await dialog.innerText(), /\$3,726\.25/);
    await dialog.getByRole('button', { name: 'Create invoice', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    const records = await page.evaluate(() => window.__fixtureMutationCalls || []);
    const row = records.find(call => call.table === 'invoices' && call.action === 'insert');
    const item = records.find(call => call.table === 'invoice_line_items' && call.action === 'insert');
    assert.equal(row.value.type, 'deposit');
    assert.equal(row.value.subtotal, 3387.5);
    assert.equal(row.value.tax_amount, 338.75);
    assert.equal(row.value.total, 3726.25);
    assert.equal(row.value.quote_id, '30000000-0000-4000-8000-000000000001');
    assert.equal(item.value[0].unit_price, 3387.5);
    assert.match(item.value[0].description, /Deposit.*12.5%.*QT-001/);

    await page.getByRole('navigation', { name: 'Job sections' }).getByRole('button', { name: 'Quote', exact: true }).click();
    await create.click();
    await dialog.getByRole('button', { name: /Stage payment/ }).click();
    await percentage.fill('25');
    await dialog.getByLabel('Payment description').fill('Framing');
    await dialog.getByRole('button', { name: 'Create invoice', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    let invoiceRows = await page.evaluate(() => window.__fixtureMutationCalls.filter(call => call.table === 'invoices' && call.action === 'insert'));
    assert.equal(invoiceRows.length, 2);
    assert.equal(invoiceRows[1].value.type, 'staged');
    assert.equal(invoiceRows[1].value.subtotal, 6775);
    let lineRows = await page.evaluate(() => window.__fixtureMutationCalls.filter(call => call.table === 'invoice_line_items' && call.action === 'insert'));
    assert.match(lineRows[1].value[0].description, /Stage payment.*25%.*QT-001: Framing/);

    await page.getByRole('navigation', { name: 'Job sections' }).getByRole('button', { name: 'Quote', exact: true }).click();
    await create.click();
    assert.equal(await dialog.getByRole('button', { name: /Full invoice/ }).getAttribute('aria-pressed'), 'true');
    await dialog.getByRole('button', { name: 'Create invoice', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    invoiceRows = await page.evaluate(() => window.__fixtureMutationCalls.filter(call => call.table === 'invoices' && call.action === 'insert'));
    lineRows = await page.evaluate(() => window.__fixtureMutationCalls.filter(call => call.table === 'invoice_line_items' && call.action === 'insert'));
    assert.equal(invoiceRows.length, 3);
    assert.equal(invoiceRows[2].value.type, 'final');
    assert.equal(invoiceRows[2].value.subtotal, 27100);
    assert.equal(lineRows[2].value[0].scope_item_id, 'scope-one');
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS quote deposit invoice at ${width}px`);
  }
} finally {
  await browser.close();
}
