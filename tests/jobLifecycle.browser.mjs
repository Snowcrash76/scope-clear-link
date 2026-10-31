import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { baselineAssets } from './baselineSources.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MOBILE_TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const pid = '20000000-0000-4000-8000-000000000001';
const archived = '20000000-0000-4000-8000-000000000099';
await mkdir('generated-artifacts', { recursive: true });
const baseline = await baselineAssets();
let services = await readFile('tests/redesign.services.tsx', 'utf8');
services = services.replace('function query(table:string){', `
tables.projects.push({...project,id:'${archived}',name:'Previously completed job',status:'completed',active_quote_id:null});
tables.projects=JSON.parse(sessionStorage.getItem('job-lifecycle-rows')||'null')||tables.projects;
function query(table:string){ (window as any).__jobTables=tables;`);
services = services.replace('then:(resolve:any)=>{', `then:(resolve:any)=>{
 if(mutation?.action==='delete'&&(window as any).__jobDeleteFailure){
  ((window as any).__fixtureMutationCalls||=[]).push({table,...mutation});
  return Promise.resolve({data:null,error:{code:'23503',message:'Synthetic protected history'}}).then(resolve);
 }`);
services = services.replace('return Promise.resolve({data:single?', `sessionStorage.setItem('job-lifecycle-rows',JSON.stringify(tables.projects));
   return Promise.resolve({data:single?`);
await build({
  entryPoints: ['tests/redesign.fixture.tsx'], bundle: true, format: 'esm', jsx: 'automatic',
  alias: { '@': resolve('src') }, loader: { '.sql': 'text' }, define: { 'process.env.NODE_ENV': '"development"' },
  outfile: 'generated-artifacts/job-lifecycle.js', logLevel: 'error',
  plugins: [{ name: 'synthetic-job-lifecycle', setup(b) {
    b.onLoad({ filter: /(integrations\/supabase\/client\.ts|hooks\/useAuth\.tsx)$/ }, () => ({
      contents: services, loader: 'tsx', resolveDir: process.cwd(),
    }));
  } }, ...baseline.plugins],
});
await writeFile('generated-artifacts/job-lifecycle.html', `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${baseline.css}"><link rel="stylesheet" href="/generated-artifacts/job-lifecycle.css"><div id="root"></div><script type="module" src="/generated-artifacts/job-lifecycle.js"></script>`);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
try {
  for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/employee/session') return route.fulfill({ json: { employee: null, canManageTeam: true } });
      if (path === '/api/platform/session') return route.fulfill({ status: 403, json: { error: 'Not system admin' } });
      return route.fulfill({ json: [] });
    });
    await page.goto(`${base}/generated-artifacts/job-lifecycle.html?view=${encodeURIComponent('/projects')}`);
    const activeCard = () => page.getByTestId(`button-project-menu-${pid}`);
    const archivedCard = () => page.getByTestId(`button-project-menu-${archived}`);
    await activeCard().waitFor();
    assert.equal(await archivedCard().count(), 0);
    await page.getByTestId('tab-completed').click(); await archivedCard().waitFor();
    assert.equal(await activeCard().count(), 0);
    await page.getByTestId('tab-all').click(); await activeCard().click();
    await page.getByTestId(`menu-mark-completed-${pid}`).click();
    await activeCard().waitFor({ state: 'hidden' });
    await page.getByTestId('tab-completed').click(); await activeCard().waitFor();
    assert.equal(await page.evaluate(id => window.__jobTables.projects.find(p => p.id === id).status, pid), 'completed');
    await page.screenshot({ path: `generated-artifacts/job-archive-${width}.png`, fullPage: true });
    await activeCard().click(); await page.getByTestId(`menu-mark-in-progress-${pid}`).click();
    await activeCard().waitFor({ state: 'hidden' });
    await page.getByTestId('tab-all').click(); await activeCard().waitFor();
    await activeCard().click(); await page.getByTestId(`menu-delete-job-${pid}`).click();
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor();
    await page.screenshot({ path: `generated-artifacts/job-delete-confirm-${width}.png` });
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => (window.__fixtureMutationCalls || []).filter(c => c.action === 'delete').length), 0);
    await page.evaluate(() => { window.__jobDeleteFailure = true; });
    await activeCard().click(); await page.getByTestId(`menu-delete-job-${pid}`).click();
    await page.getByTestId('confirm-delete-job').click();
    await dialog.getByRole('alert').waitFor();
    assert.equal(await activeCard().count(), 1);
    await page.evaluate(() => { window.__jobDeleteFailure = false; });
    await page.getByTestId('confirm-delete-job').click();
    await dialog.waitFor({ state: 'hidden' }); await activeCard().waitFor({ state: 'hidden' });
    const deletes = await page.evaluate(() => window.__fixtureMutationCalls.filter(c => c.action === 'delete'));
    assert.equal(deletes.length, 2); assert.ok(deletes.every(c => c.table === 'projects'));
    await page.getByTestId('tab-completed').click(); await archivedCard().waitFor();
    await archivedCard().click(); await page.getByTestId(`menu-delete-job-${archived}`).click();
    await page.getByTestId('confirm-delete-job').click(); await dialog.waitFor({ state: 'hidden' });
    await page.getByText('No archived jobs yet.', { exact: true }).waitFor();
    await page.goto(`${base}/generated-artifacts/job-lifecycle.html?view=${encodeURIComponent('/projects?status=completed')}`);
    await page.getByText('No archived jobs yet.', { exact: true }).waitFor();
    assert.equal(await activeCard().count(), 0); assert.equal(await archivedCard().count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Jobs at 375/1280: active/archive separation, complete/reopen, cancellation, protected-history retry, successful atomic delete, archive deletion/empty state, and reload passed using actual components and hooks.');
} finally { await browser.close(); }
