// Real app and components, with isolated invoice writes and no customer data.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MOBILE_TEST_BASE_URL;
if (!base) throw new Error('Set MOBILE_TEST_BASE_URL');
await mkdir('generated-artifacts', { recursive: true });
await build({
  entryPoints: ['tests/redesign.fixture.tsx'], bundle: true, format: 'esm', jsx: 'automatic',
  alias: { '@': resolve('src') }, loader: { '.sql': 'text' },
  define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'error',
  outfile: 'generated-artifacts/stage-invoice-fixture.js',
  plugins: [{ name: 'isolated-stage-data', setup(builder) {
    builder.onLoad({ filter: /(integrations\/supabase\/client\.ts|hooks\/useAuth\.tsx)$/ }, async () => {
      const source = await readFile('tests/redesign.services.tsx', 'utf8');
      const stages = `
        quote.status='approved'; quote.subtotal=1000; quote.total=1100; quote.tax_amount=100;
        tables.project_stages=[
          {id:'stage-one',project_id:pid,name:'Preparation',description:'',status:'upcoming',stage_order:0,invoice_percentage:20,invoice_amount:null},
          {id:'stage-two',project_id:pid,name:'Fixtures',description:'',status:'current',stage_order:1,invoice_percentage:null,invoice_amount:120}
        ];
        tables.invoices=[{...invoice,id:'cancelled-stage',invoice_number:'INV-OLD',stage_id:'stage-two',quote_id:qid,status:'cancelled'}];
        tables.invoice_line_items=[];
      `;
      const rpc = `rpc:async(name:string,args:any)=>{
        if(name==='create_stage_invoice'){
          ((window as any).__stageInvoiceCalls||=[]).push(args);
          const prior=tables.invoices.find((row:any)=>row.stage_id===args.p_stage_id&&row.status!=='cancelled');
          if(prior)return {data:prior.id,error:null};
          const id='created-'+args.p_stage_id,subtotal=args.p_expected_subtotal,tax=Math.round(subtotal*10)/100;
          tables.invoices.unshift({id,project_id:pid,quote_id:qid,stage_id:args.p_stage_id,
            invoice_number:'INV-'+args.p_stage_id,type:'staged',status:'draft',subtotal,
            tax_rate:10,tax_amount:tax,total:subtotal+tax,amount_paid:0,due_date:args.p_due_date,
            notes:args.p_notes,terms:args.p_terms,created_at:created,updated_at:created});
          tables.invoice_line_items.push({id:'line-'+id,invoice_id:id,description:'Stage Payment',
            quantity:1,unit_price:subtotal,total:subtotal,created_at:created});
          return {data:id,error:null};
        }
        return {data:true,error:null};
      }`;
      return {
        contents: source.replace('function query(table:string)', stages + '\nfunction query(table:string)')
          .replace("rpc:async(name:string)=>({data:name.includes('invoice')?'INV-FIXTURE':true,error:null})", rpc),
        loader: 'tsx', resolveDir: process.cwd(),
      };
    });
  } }],
});
await writeFile('generated-artifacts/stage-invoice-fixture.html',
  '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"><div id="root"></div><script type="module" src="/generated-artifacts/stage-invoice-fixture.js"></script>');
const pid = '20000000-0000-4000-8000-000000000001';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
try {
  for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/employee/session') return route.fulfill({ json: { employee: null, canManageTeam: true } });
      if (path === '/api/job-profitability') return route.fulfill({ json: [] });
      if (path === '/api/job-costs') return route.fulfill({ json: { costs: [], quoteLineItems: [], scopeLinkSetupRequired: false } });
      return route.fulfill({ json: [] });
    });
    await page.goto(base + '/generated-artifacts/stage-invoice-fixture.html?view=' +
      encodeURIComponent(`/manage/${pid}?tab=stages`));
    const stages = page.getByRole('region', { name: 'Stages' });
    const createStage = stages.getByRole('button', { name: 'Generate invoice' });
    await createStage.first().waitFor();
    assert.equal(await createStage.count(), 2, 'upcoming and current stages with allocations can be invoiced');
    await createStage.first().click();
    const preview = page.getByRole('dialog', { name: 'Create stage invoice' });
    await preview.waitFor();
    assert.match(await preview.innerText(), /Preparation/);
    assert.match(await preview.innerText(), /20% of quote/);
    assert.match(await preview.innerText(), /QT-001/);
    assert.match(await preview.innerText(), /\$200\.00/);
    assert.match(await preview.innerText(), /\$20\.00/);
    assert.match(await preview.innerText(), /\$220\.00/);
    await preview.getByLabel('Due date').fill('2026-11-10');
    await preview.getByRole('button', { name: 'Create stage invoice' }).click();
    await preview.waitFor({ state: 'hidden' });
    let calls = await page.evaluate(() => window.__stageInvoiceCalls);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].p_stage_id, 'stage-one');
    assert.equal(calls[0].p_expected_subtotal, 200);
    assert.equal(calls[0].p_due_date, '2026-11-10');
    const invoiceView = page.getByRole('dialog', { name: 'Invoice INV-stage-one' });
    await invoiceView.waitFor();
    await invoiceView.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('navigation', { name: 'Job sections' }).getByRole('button', { name: 'Stages', exact: true }).click();
    const viewStage = stages.getByRole('button', { name: 'View invoice' });
    await viewStage.first().waitFor();
    assert.equal(await stages.getByRole('button', { name: 'Generate invoice' }).count(), 1);
    await viewStage.first().click();
    await invoiceView.waitFor();
    await invoiceView.getByRole('button', { name: 'Close', exact: true }).click();
    calls = await page.evaluate(() => window.__stageInvoiceCalls);
    assert.equal(calls.length, 1, 'view never generates a duplicate invoice');
    await page.getByRole('button', { name: 'Create Invoice', exact: true }).click();
    await page.getByTestId('select-invoice-type').click();
    await page.getByRole('option', { name: 'Saved stage', exact: true }).click();
    const picker = page.getByRole('combobox', { name: 'Choose saved stage' });
    await picker.click();
    await page.getByRole('option', { name: /Preparation/ }).click();
    const createDialog = page.getByRole('dialog', { name: 'Create Invoice', exact: true });
    await createDialog.getByRole('button', { name: 'View invoice' }).waitFor();
    assert.equal(await createDialog.getByRole('button', { name: 'Create stage invoice' }).isDisabled(), true);
    await createDialog.getByRole('button', { name: 'View invoice' }).click();
    await invoiceView.waitFor();
    await invoiceView.getByRole('button', { name: 'Close', exact: true }).click();
    await picker.click();
    await page.getByRole('option', { name: /Fixtures/ }).click();
    assert.match(await createDialog.innerText(), /\$120\.00/);
    assert.match(await createDialog.innerText(), /\$132\.00/);
    await page.screenshot({ path: `generated-artifacts/stage-invoice-${width}.png` });
    await createDialog.getByRole('button', { name: 'Create stage invoice' }).click();
    await createDialog.waitFor({ state: 'hidden' });
    await page.getByRole('dialog', { name: 'Invoice INV-stage-two' }).waitFor();
    calls = await page.evaluate(() => window.__stageInvoiceCalls);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].p_stage_id, 'stage-two');
    assert.equal(calls[1].p_expected_amount, 120);
    assert.equal(calls[1].p_expected_percentage, null);
    assert.equal(calls[1].p_expected_subtotal, 120);
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS stage invoices from Stages and Invoices at ${width}px`);
  }
} finally {
  await browser.close();
}
