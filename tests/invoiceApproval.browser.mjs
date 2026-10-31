// Actual signed-in components; isolated data and intercepted email requests only.
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
  outfile: 'generated-artifacts/invoice-approval-fixture.js',
  plugins: [{ name: 'isolated-invoice-approval', setup(builder) {
    builder.onLoad({ filter: /(integrations\/supabase\/client\.ts|hooks\/useAuth\.tsx)$/ }, async () => {
      const source = await readFile('tests/redesign.services.tsx', 'utf8');
      const seed = `
        tables.invoices=[{...invoice,id:'approval-fixture',invoice_number:'INV-REVIEW',
          status:'draft',stage_id:'stage-one',quote_id:qid,revision:0,approved_at:null,
          approved_by:null,delivery_token:null,subtotal:200,tax_rate:10,tax_amount:20,total:220}];
        if(new URLSearchParams(location.search).get('cancelled')==='1')tables.invoices[0].status='cancelled';
        tables.invoice_line_items=[{id:'line-review',invoice_id:'approval-fixture',
          description:'Stage payment',quantity:1,unit_price:200,total:200,created_at:created}];
        (window as any).__approvalTables=tables;
        (window as any).__approvalCalls=[];
      `;
      const rpc = `rpc:async(name:string,args:any)=>{
        const inv=tables.invoices[0];
        (window as any).__approvalTables=tables;
        (window as any).__approvalCalls.push({name,args});
        if(name==='save_invoice_for_approval'||name==='approve_invoice'){
          if(args.p_expected_revision!==inv.revision)return {data:null,error:{code:'P0001',message:'Invoice changed. Refresh first.'}};
          if((window as any).__failInvoiceSave&&name==='save_invoice_for_approval')
            return {data:null,error:{code:'P0001',message:'Synthetic save failure; please retry.'}};
          if(name==='save_invoice_for_approval'){
            const lines=args.p_line_items.map((x:any,i:number)=>({...x,id:'edited-'+i,
              invoice_id:inv.id,total:Math.round(x.quantity*x.unit_price*100)/100,created_at:created}));
            const subtotal=lines.reduce((sum:number,x:any)=>sum+x.total,0);
            const tax=Math.round(subtotal*args.p_tax_rate)/100;
            Object.assign(inv,{invoice_number:args.p_invoice_number,due_date:args.p_due_date,
              notes:args.p_notes,terms:args.p_terms,subtotal,tax_rate:args.p_tax_rate,tax_amount:tax,
              total:subtotal+tax,approved_at:null,approved_by:null});
            tables.invoice_line_items=lines;
          }else{inv.approved_at=new Date().toISOString();inv.approved_by=uid;}
          inv.revision++;inv.updated_at=new Date().toISOString();
          return {data:inv.id,error:null};
        }
        return {data:true,error:null};
      }`;
      return {
        contents: source.replace('function query(table:string)', seed + '\nfunction query(table:string)')
          .replace("rpc:async(name:string)=>({data:name.includes('invoice')?'INV-FIXTURE':true,error:null})", rpc),
        loader: 'tsx', resolveDir: process.cwd(),
      };
    });
  } }],
});
await writeFile('generated-artifacts/invoice-approval-fixture.html',
  '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"><div id="root"></div><script type="module" src="/generated-artifacts/invoice-approval-fixture.js"></script>');
const pid = '20000000-0000-4000-8000-000000000001';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
try {
  for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    let emailRequests = 0;
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      if (route.request().url().includes('/send-invoice-to-client')) {
        emailRequests++;
        const request = route.request().postDataJSON();
        assert.equal(request.invoiceId, 'approval-fixture');
        if (emailRequests === 1) {
          await page.evaluate(() => {
            const inv = window.__approvalTables.invoices[0];
            inv.delivery_token = 'synthetic-pending-delivery'; inv.revision++;
          });
          await route.fulfill({ status: 502, json: { error: 'Delivery confirmation pending. Retry delivery.' } });
        } else {
          await page.evaluate(() => {
            const inv = window.__approvalTables.invoices[0];
            inv.status = 'sent'; inv.delivery_token = null; inv.revision++;
          });
          await route.fulfill({ json: { success: true, result: { clientName: 'Synthetic client' } } });
        }
      } else await route.fulfill({ json: {} });
    });
    await page.goto(`${base}/generated-artifacts/invoice-approval-fixture.html?view=${encodeURIComponent('/invoices')}`, { waitUntil: 'networkidle' });
    await page.getByTestId('invoice-row-approval-fixture').click();
    let viewer = page.getByRole('dialog');
    await viewer.getByRole('button', { name: 'Approve invoice', exact: true }).waitFor();
    assert.equal(await viewer.getByRole('button', { name: 'Send to client', exact: true }).count(), 0);
    await viewer.getByRole('button', { name: 'Edit invoice', exact: true }).click();
    let editor = page.getByRole('dialog', { name: 'Edit invoice', exact: true });
    await editor.getByLabel('Invoice reference').fill('INV-EDITED');
    await editor.getByLabel('Due date').fill('2026-11-12');
    await editor.getByLabel('Description', { exact: true }).fill('Updated stage preparation');
    await editor.getByLabel('Quantity', { exact: true }).fill('2');
    await editor.getByLabel('Unit price', { exact: true }).fill('125');
    await editor.getByLabel('GST rate (%)').fill('15');
    await page.evaluate(() => { window.__failInvoiceSave = true; });
    await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
    await editor.getByRole('alert').waitFor();
    assert.equal(await editor.getByLabel('Invoice reference').inputValue(), 'INV-EDITED');
    if (width === 375) {
      await page.waitForTimeout(11000); // The hook refreshes every ten seconds.
      assert.equal(await editor.getByLabel('Invoice reference').inputValue(), 'INV-EDITED', 'background refresh must not erase edits');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: `generated-artifacts/invoice-editor-${width}.png` });
    }
    await page.evaluate(() => { window.__failInvoiceSave = false; });
    await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
    await editor.waitFor({ state: 'hidden' });
    viewer = page.getByRole('dialog');
    await viewer.getByText('$287.50', { exact: true }).waitFor();
    await viewer.getByRole('button', { name: 'Approve invoice', exact: true }).click();
    await viewer.getByRole('button', { name: 'Send to client', exact: true }).waitFor();
    assert.equal(emailRequests, 0, 'approval never emails');
    await viewer.getByRole('button', { name: 'Edit invoice', exact: true }).click();
    editor = page.getByRole('dialog', { name: 'Edit invoice', exact: true });
    await editor.getByLabel('Unit price', { exact: true }).fill('150');
    await editor.getByRole('button', { name: 'Save changes', exact: true }).click();
    await editor.waitFor({ state: 'hidden' });
    viewer = page.getByRole('dialog');
    await viewer.getByRole('button', { name: 'Approve invoice', exact: true }).waitFor();
    assert.equal(await viewer.getByRole('button', { name: 'Send to client', exact: true }).count(), 0, 'editing requires approval again');
    await viewer.getByRole('button', { name: 'Approve invoice', exact: true }).click();
    await viewer.getByRole('button', { name: 'Send to client', exact: true }).click();
    await viewer.getByRole('button', { name: 'Retry delivery', exact: true }).waitFor({ timeout: 10000 }).catch(async error => {
      console.error(JSON.stringify({
        emailRequests, errors, dialogs: await page.getByRole('dialog').allTextContents(),
        invoice: await page.evaluate(() => window.__approvalTables.invoices[0]),
      }));
      throw error;
    });
    assert.ok(await viewer.getByRole('button', { name: 'Edit invoice', exact: true }).isDisabled());
    assert.equal(await viewer.getByText('Sent', { exact: true }).count(), 0, 'failed delivery cannot claim Sent');
    await viewer.getByRole('button', { name: 'Retry delivery', exact: true }).click();
    await viewer.getByText('Sent', { exact: true }).waitFor();
    assert.equal(await viewer.getByRole('button', { name: 'Edit invoice', exact: true }).count(), 0, 'issued invoice is read-only');
    const saved = await page.evaluate(() => window.__approvalTables.invoices[0]);
    assert.equal(saved.stage_id, 'stage-one');
    assert.equal(saved.quote_id, '30000000-0000-4000-8000-000000000001');
    assert.equal(saved.total, 345);
    assert.equal(emailRequests, 2);
    assert.deepEqual(errors, []);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: `generated-artifacts/invoice-approved-${width}.png` });
    await page.goto(`${base}/generated-artifacts/invoice-approval-fixture.html?cancelled=1&view=${encodeURIComponent(`/manage/${pid}?tab=invoices`)}`, { waitUntil: 'networkidle' });
    await page.getByText('Cancelled', { exact: true }).first().waitFor();
    assert.equal(await page.getByTestId('button-delete-invoice-approval-fixture').count(), 0, 'cancelled invoices cannot be deleted in the UI');
    await page.close();
    console.log(`PASS invoice edit, failed save, approval, reapproval, delivery retry and issued protection at ${width}px`);
  }
} finally { await browser.close(); }
