// Real application/components, isolated synthetic services. Never signs into a real account.
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MOBILE_TEST_BASE_URL;
if (!base) throw new Error('Set MOBILE_TEST_BASE_URL to the development preview URL');
const pid = '20000000-0000-4000-8000-000000000001';
const capability = '60000000-0000-4000-8000-000000000001';
const pdfStream = 'BT /F1 16 Tf 20 100 Td (Synthetic document) Tj ET';
const pdfObjects = [
  '<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 140] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  `<< /Length ${pdfStream.length} >>\nstream\n${pdfStream}\nendstream`,
];
let fixturePdf = '%PDF-1.4\n';
const pdfOffsets = [0];
for (const [index, object] of pdfObjects.entries()) {
  pdfOffsets.push(fixturePdf.length);
  fixturePdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
}
const xrefOffset = fixturePdf.length;
fixturePdf += `xref\n0 6\n0000000000 65535 f \n${pdfOffsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
await mkdir('generated-artifacts', { recursive: true });
await build({
  entryPoints: ['tests/redesign.fixture.tsx'], bundle: true, format: 'esm',
  jsx: 'automatic', alias: { '@': resolve('src') }, loader: { '.sql': 'text' },
  define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'error',
  outfile: 'generated-artifacts/job-workspace.js',
  plugins: [{ name: 'synthetic-job-services', setup(builder) {
    builder.onLoad({ filter: /(integrations\/supabase\/client\.ts|hooks\/useAuth\.tsx)$/ }, async () => {
      const source = await readFile('tests/redesign.services.tsx', 'utf8');
      const richerData = `
        project.client_phone='0400000000';
        tables.project_stages=[
          {id:'stage-one',project_id:pid,name:'Preparation',status:'completed',stage_order:0},
          {id:'stage-two',project_id:pid,name:'Installation',status:'current',stage_order:1},
          {id:'stage-three',project_id:pid,name:'Finish',status:'pending',stage_order:2}
        ];
        tables.change_requests.push({
          id:'client-request',project_id:pid,type:'client_request',title:'Client requested shelf',
          description:'Synthetic requested work',status:'pending',cost_impact:0,created_at:created
        });
        tables.project_documents=[
          {id:'70000000-0000-4000-8000-000000000001',project_id:pid,file_name:'synthetic-photo.png',
           display_name:'Synthetic photo',file_url:pid+'/photo.png',file_type:'image/png',
           file_size:100,created_at:created,purpose:'client_document',employee_visible:false},
          {id:'70000000-0000-4000-8000-000000000002',project_id:pid,file_name:'synthetic-file.pdf',
           display_name:'Synthetic PDF',file_url:pid+'/file.pdf',file_type:'application/pdf',
           file_size:100,created_at:created,purpose:'client_document',employee_visible:false}
        ];
      `;
      return {
        contents: source.replace('function query(table:string)', richerData + '\nfunction query(table:string)')
          .replace("createSignedUrl:async()=>({data:{signedUrl:''},error:null})",
            "createSignedUrl:async(path:string)=>({data:{signedUrl:window.location.origin+'/synthetic-document'+(path.endsWith('.pdf')?'.pdf':'.png')},error:null})"),
        loader: 'tsx', resolveDir: process.cwd(),
      };
    });
  } }],
});
await writeFile('generated-artifacts/job-workspace.html', '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"><div id="root"></div><script type="module" src="/generated-artifacts/job-workspace.js"></script>');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
try {
  for (const width of (process.env.JOB_TEST_WIDTHS || '320,375,768,1280').split(',').map(Number)) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [], sent = [];
    let providerFails = true;
    await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {
      configurable: true, value: { writeText: async value => { window.__copiedClientLink = value; } },
    }));
    await page.context().route('**/project/**', route => route.fulfill({
      contentType: 'text/html', body: '<!doctype html><title>Synthetic secure client view</title>',
    }));
    await page.context().route('**/synthetic-document.png', route => route.fulfill({
      contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfxkAAAAASUVORK5CYII=', 'base64'),
    }));
    await page.context().route('**/synthetic-document.pdf', route => route.fulfill({
      contentType: 'application/pdf', body: fixturePdf,
    }));
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/employee/session') return route.fulfill({ json: { employee: null, canManageTeam: true } });
      if (path === '/api/team/bootstrap') return route.fulfill({ json: {
        employees: [], jobs: [], appointments: [], assignments: [], entries: [],
        submissions: [], permissions: {}, timezone: 'Australia/Sydney', notes: [], documents: [], audit: [],
      } });
      if (path === `/api/team/jobs/${pid}/client-link`) return route.fulfill({ json: {
        path: `/project/${pid}?access=${capability}`,
      } });
      if (path === '/api/send-client-page-link') {
        sent.push(route.request().postDataJSON());
        return route.fulfill(providerFails ? { status: 502, json: { error: 'Synthetic email provider unavailable' } }
          : { json: { success: true, messageId: 'synthetic', markedSent: false, copySent: false, activityRecorded: false } });
      }
      if (path === '/api/job-profitability') return route.fulfill({ json: [] });
      if (path === '/api/job-costs') return route.fulfill({ json: { costs: [], quoteLineItems: [], scopeLinkSetupRequired: false } });
      return route.fulfill({ json: [] });
    });
    async function open(path) {
      await page.goto(`${base}/generated-artifacts/job-workspace.html?view=${encodeURIComponent(path)}`);
      await page.getByRole('navigation', { name: 'Job sections', exact: true }).waitFor();
      await page.waitForTimeout(150);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `No page overflow at ${width}: ${path}`);
      assert.deepEqual(errors, [], `No runtime errors at ${width}: ${path}`);
    }
    await open(`/manage/${pid}`);
    await page.getByRole('region', { name: 'Overview', exact: true }).waitFor();
    assert.equal(await page.getByTestId('job-section-overview').getAttribute('aria-current'), 'page');
    assert.equal(await page.locator('a[href="tel:0400000000"]').count() > 0, true, 'Uses existing client phone');
    const nav = page.getByRole('navigation', { name: 'Job sections', exact: true });
    const labels = await nav.locator('button[data-section-item]').allTextContents();
    assert.equal(labels.length, 9, 'All nine job sections are exposed; timesheets are reviewed under Team');
    const tops = await nav.locator('button[data-section-item]').evaluateAll(buttons => buttons.map(button => Math.round(button.getBoundingClientRect().top)));
    assert.equal(new Set(tops).size, 1, 'Job navigation stays in a top row at every screen width');
    const overviewBox = await page.getByRole('region', { name: 'Overview', exact: true }).boundingBox();
    const navBox = await nav.boundingBox();
    assert.ok(navBox.y + navBox.height <= overviewBox.y + 2, 'Job navigation sits above content, not beside it');
    assert.equal(await page.getByTestId('nav-variations').count(), 0, 'Variations is not in the global menu');
    assert.equal(await page.getByRole('button', { name: 'All sections', exact: true }).count(), 0, 'No redundant All sections button');
    if (width < 1024) {
      await page.getByTestId('job-section-stages').click();
      assert.equal(await page.getByTestId('job-section-stages').getAttribute('aria-current'), 'page');
      await page.waitForFunction(() => {
        const button = document.querySelector('[data-testid="job-section-stages"]');
        const rect = button.getBoundingClientRect(), parent = button.closest('nav').getBoundingClientRect();
        return rect.left >= parent.left - 2 && rect.right <= parent.right + 2;
      }, undefined, { timeout: 3000 });
    }
    for (const [alias, selected] of [['scope', 'changes'], ['variations', 'changes'], ['changes', 'changes'], ['staff', 'staff'], ['employee-updates', 'staff']]) {
      await open(`/manage/${pid}?tab=${alias}`);
      assert.equal(await page.getByTestId(`job-section-${selected}`).getAttribute('aria-current'), 'page', `Alias ${alias} selected`);
    }
    await open(`/manage/${pid}?tab=quote`);
    await page.getByRole('button', { name: 'Copy link', exact: true }).first().click();
    await page.waitForFunction(() => Boolean(window.__copiedClientLink));
    const copied = new URL(await page.evaluate(() => window.__copiedClientLink));
    assert.equal(copied.pathname, `/project/${pid}`);
    assert.equal(copied.searchParams.get('access'), capability, 'Copied URL has a separate secure capability');
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'View client page', exact: true }).first().click();
    const popup = await popupPromise;
    await popup.waitForURL(url => url.pathname === `/project/${pid}` && url.searchParams.get('access') === capability);
    await popup.close();
    await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
    const editDialog = page.getByRole('dialog', { name: 'Edit client details', exact: true });
    await editDialog.getByLabel('Client name', { exact: true }).fill('');
    await editDialog.getByRole('button', { name: /Save/ }).click();
    await editDialog.getByRole('alert').waitFor();
    await editDialog.getByLabel('Client name', { exact: true }).fill('Updated synthetic client');
    await editDialog.getByLabel('Email', { exact: true }).fill('invalid');
    await editDialog.getByRole('button', { name: /Save/ }).click();
    assert.match(await editDialog.getByRole('alert').innerText(), /email/i);
    await editDialog.getByLabel('Email', { exact: true }).fill('client@example.invalid');
    await editDialog.getByRole('button', { name: /Save/ }).click();
    await editDialog.waitFor({ state: 'hidden' });
    await page.getByText('Updated synthetic client', { exact: true }).waitFor();
    const first = nav.locator('button[data-section-item]').first();
    await first.focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await nav.locator('button[data-section-item]').nth(1).evaluate(button => button === document.activeElement), true, 'Arrow-key navigation');
    await page.getByRole('button', { name: 'Send to client', exact: true }).first().click();
    const sendDialog = page.getByRole('dialog', { name: 'Email the client page' });
    await sendDialog.waitFor();
    assert.match(await sendDialog.getByLabel('To', { exact: true }).inputValue(), /client@example.invalid/);
    await sendDialog.getByLabel('To', { exact: true }).fill('other@example.invalid');
    await sendDialog.getByRole('button', { name: 'Send client page', exact: true }).click();
    assert.equal(sent.length, 0, 'A different email needs explicit confirmation');
    await sendDialog.getByLabel(/^Send to a different address/).check();
    await sendDialog.getByRole('button', { name: 'Send client page', exact: true }).click();
    await sendDialog.getByRole('alert').waitFor();
    assert.match(await sendDialog.innerText(), /Synthetic email provider unavailable/);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].confirmDifferentRecipient, true);
    assert.equal('url' in sent[0], false, 'Browser cannot provide a client URL');
    providerFails = false;
    await sendDialog.getByRole('button', { name: 'Send client page', exact: true }).click();
    await sendDialog.waitFor({ state: 'hidden' });
    assert.equal(sent.length, 2);
    await open(`/manage/${pid}?tab=documents`);
    assert.match(await page.getByRole('region', { name: 'Documents', exact: true }).innerText(), /document/i);
    await page.getByRole('button', { name: 'Grid', exact: true }).click();
    await page.locator('[aria-label="Image thumbnail for Synthetic photo"]').scrollIntoViewIfNeeded();
    const photo = page.getByAltText('Preview thumbnail of Synthetic photo');
    await photo.waitFor();
    await page.waitForFunction(() => {
      const image = document.querySelector('img[alt="Preview thumbnail of Synthetic photo"]');
      return image?.complete && image.naturalWidth > 0;
    });
    await page.getByRole('button', { name: 'View Synthetic photo', exact: true }).click();
    const preview = page.getByRole('dialog', { name: 'Synthetic photo', exact: true });
    await preview.getByAltText('Preview of Synthetic photo').waitFor();
    await page.keyboard.press('Escape');
    await preview.waitFor({ state: 'hidden' });
    await page.locator('[aria-label="First page thumbnail for Synthetic PDF"]').scrollIntoViewIfNeeded();
    await page.locator('iframe[title="First page PDF thumbnail of Synthetic PDF"]').waitFor();
    await page.getByRole('button', { name: 'View Synthetic PDF', exact: true }).click();
    const pdfPreview = page.getByRole('dialog', { name: 'Synthetic PDF', exact: true });
    await pdfPreview.locator('iframe[title="PDF preview of Synthetic PDF"]').waitFor();
    await page.keyboard.press('Escape');
    await pdfPreview.waitFor({ state: 'hidden' });
    await page.getByRole('textbox', { name: 'Search job documents', exact: true }).fill('Synthetic PDF');
    await page.getByRole('button', { name: 'View Synthetic PDF', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'View Synthetic photo', exact: true }).count(), 0);
    await page.getByRole('textbox', { name: 'Search job documents', exact: true }).fill('');
    await page.getByRole('combobox', { name: 'Filter documents by type', exact: true }).selectOption('image');
    await page.getByRole('button', { name: 'View Synthetic photo', exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'View Synthetic PDF', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'List', exact: true }).click();
    await page.screenshot({ path: `generated-artifacts/job-workspace-documents-${width}.png` });
    await page.goto(`${base}/generated-artifacts/job-workspace.html?view=${encodeURIComponent('/variations')}`);
    const filters = page.getByRole('navigation', { name: 'Filter variations', exact: true });
    await filters.getByRole('button', { name: /^Needs your response/ }).click();
    await page.locator('a[href*="variation=client-request"]').waitFor();
    await filters.getByRole('button', { name: /^Awaiting client/ }).click();
    await page.locator('a[href*="variation=variation-one"]').waitFor();
    assert.equal(await page.locator('a[href*="variation=client-request"]').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    console.log(`PASS job navigation, aliases, secure send confirmation/error/retry and documents at ${width}px`);
    await page.close();
  }
} finally { await browser.close(); }
