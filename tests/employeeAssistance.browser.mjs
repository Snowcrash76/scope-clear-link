import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { baselineAssets } from './baselineSources.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const child = spawn('bun', ['tests/employeeAssistance.server.ts'], { stdio: ['ignore', 'pipe', 'pipe'] });
let stderr = '';
child.stderr.on('data', chunk => { stderr += chunk; });
const port = await new Promise((resolve, reject) => {
  const timer = setTimeout(() => { child.kill(); reject(new Error(`Fixture did not start: ${stderr}`)); }, 30000);
  child.once('exit', code => { clearTimeout(timer); reject(new Error(`Fixture exited ${code}: ${stderr}`)); });
  child.stdout.once('data', chunk => { clearTimeout(timer); resolve(JSON.parse(String(chunk).trim()).port); });
});
const local = `http://127.0.0.1:${port}`;
const owner = '10000000-0000-4000-8000-000000000001';
const member = '60000000-0000-4000-8000-000000000001';
const second = '60000000-0000-4000-8000-000000000002';
const job = '20000000-0000-4000-8000-000000000001';
const otherJob = '20000000-0000-4000-8000-000000000002';
const doc = '70000000-0000-4000-8000-000000000001';
const root = `/team/assist/${member}`;
async function api(path, { token = 'fixture-owner', target = member, method = 'GET', body } = {}) {
  return fetch(local + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(target ? { 'X-Employee-Preview': target } : {}), 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
let browser;
try {
  const response = await api('/api/employee/bootstrap');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.employee.id, member);
  assert.equal(data.hourly_rate, 40);
  assert.deepEqual(data.jobs.map(j => j.id), [job]);
  assert.ok(data.entries.every(e => e.employee_id === member));
  assert.ok(!JSON.stringify(data).includes('999999'));
  assert.equal((await api(`/api/employee/jobs/${otherJob}`)).status, 403);
  for (const token of ['fixture-employee', 'fixture-employee-admin', 'other-owner']) {
    assert.ok([403, 404].includes((await api('/api/employee/bootstrap', { token })).status));
  }
  for (const token of [null, 'expired']) assert.equal((await api('/api/employee/session', { token })).status, 401);
  assert.equal((await api('/api/employee/session', { target: 'malformed' })).status, 400);
  for (const [method, path] of [
    ['POST', '/api/employee/clock-in'], ['POST', '/api/employee/submit'],
    ['POST', '/api/employee/notes'], ['POST', '/api/employee/photos/upload'],
    ['PATCH', '/api/employee/time/80000000-0000-4000-8000-000000000001'],
    ['DELETE', '/api/employee/time/80000000-0000-4000-8000-000000000001'],
    ['POST', '/api/employee/notifications/90000000-0000-4000-8000-000000000001/read'],
    ['POST', '/api/team/review'], ['POST', `/api/team/employees/${member}/invite`],
  ]) assert.equal((await api(path, { method, body: {} })).status, 403, `${method} ${path}`);
  assert.equal((await api('/api/team/bootstrap')).status, 403);
  const capabilityResponse = await api(`/api/employee/documents/${doc}/url`);
  assert.equal(capabilityResponse.status, 200);
  const capability = (await capabilityResponse.json()).url;
  assert.equal((await fetch(local + capability)).status, 200);
  assert.equal((await fetch(local + capability + 'x')).status, 403);
  const initial = await (await fetch(local + '/__fixture/state')).json();
  assert.equal(initial.writes.length, 0);
  await mkdir('generated-artifacts', { recursive: true });
  const baseline = await baselineAssets();
  await build({ entryPoints: ['tests/redesign.fixture.tsx'], bundle: true, format: 'esm', jsx: 'automatic', alias: { '@': resolve('src') },
    loader: { '.sql': 'text' }, define: { 'process.env.NODE_ENV': '"development"' },
    outfile: 'generated-artifacts/employee-assistance.js', logLevel: 'error',
    plugins: [{ name: 'isolated-owner-services', setup(b) {
      b.onLoad({ filter: /(integrations\/supabase\/client\.ts|hooks\/useAuth\.tsx)$/ }, async () => ({
        contents: await readFile('tests/redesign.services.tsx', 'utf8'), loader: 'tsx', resolveDir: process.cwd(),
      }));
    } }, ...baseline.plugins] });
  await writeFile('generated-artifacts/employee-assistance.html', `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${baseline.css}"><link rel="stylesheet" href="/generated-artifacts/employee-assistance.css"><div id="root"></div><script type="module" src="/generated-artifacts/employee-assistance.js"></script>`);
  browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
  const base = process.env.MOBILE_TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
  for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const req = route.request(), path = new URL(req.url()).pathname + new URL(req.url()).search;
      requests.push({ path, method: req.method(), target: req.headers()['x-employee-preview'] });
      const upstream = await fetch(local + path, { method: req.method(), headers: {
        Authorization: req.headers().authorization || '', 'Content-Type': 'application/json',
        ...(req.headers()['x-employee-preview'] ? { 'X-Employee-Preview': req.headers()['x-employee-preview'] } : {}),
      }, ...(req.postData() ? { body: req.postData() } : {}) });
      await route.fulfill({ status: upstream.status, contentType: upstream.headers.get('content-type') || 'application/json', body: Buffer.from(await upstream.arrayBuffer()) });
    });
    const open = async path => {
      await page.goto(`${base}/generated-artifacts/employee-assistance.html?view=${encodeURIComponent(path)}`);
    };
    const navigate = async path => {
      await page.evaluate(route => {
        history.pushState(null, '', route);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, path);
    };
    const layout = async () => {
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `overflow at ${width}`);
      const banner = page.getByRole('complementary', { name: 'Employee assistance status' });
      await banner.waitFor();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      assert.ok((await banner.boundingBox()).y >= 0, 'assistance banner stays visible');
      await page.evaluate(() => window.scrollTo(0, 0));
    };
    await open(root);
    await page.getByText('Assigned Northbridge job', { exact: true }).first().waitFor();
    await layout();
    assert.equal(await page.getByRole('button', { name: /^Clock|^Sign out/ }).count(), 0);
    assert.equal(await page.getByText('Liam private assignment', { exact: true }).count(), 0);
    await page.screenshot({ path: `generated-artifacts/employee-assistance-${width}.png`, fullPage: true });
    await open(`${root}/jobs/${job}`);
    await page.getByText('Employee-safe scope').waitFor();
    assert.equal(await page.locator('input[type=file]').count(), 0);
    assert.equal(await page.getByRole('button', { name: /Save note|Upload/ }).count(), 0);
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Crew guide' }).click();
    const popup = await popupPromise; await popup.waitForLoadState(); await popup.close();
    assert.equal(requests.findLast(r => r.path.includes(`/documents/${doc}/url`)).target, member);
    await open(`${root}/timesheets`);
    await page.getByText('Installed fixture trim', { exact: true }).first().waitFor();
    assert.equal(await page.getByRole('button', { name: /^Add time$|^Submit week$|^Edit$|^Delete$/ }).count(), 0);
    await layout();
    await page.getByRole('link', { name: 'Help edit timesheets', exact: true }).click();
    await page.getByText('Editing as yourself', { exact: false }).first().waitFor();
    await page.getByRole('button', { name: 'Close review', exact: true }).click();
    await page.getByRole('link', { name: /Back to employee portal/ }).first().click();
    await page.getByText('Assigned Northbridge job', { exact: true }).first().waitFor();
    await open(`${root}/notifications`);
    await page.getByText('Read-only notification fixture').waitFor();
    assert.equal(await page.getByRole('button', { name: /Mark read/ }).count(), 0);
    await open(`${root}/schedule`);
    await page.getByRole('heading', { name: 'Schedule', exact: true }).waitFor();
    await layout();
    await navigate(`/team/assist/${second}`);
    await page.getByText('Liam private assignment', { exact: true }).first().waitFor();
    assert.equal(await page.getByText('Assigned Northbridge job', { exact: true }).count(), 0);
    await navigate(root);
    await page.getByRole('link', { name: 'Help edit details', exact: true }).click();
    const name = page.locator('input[name=name]');
    await name.waitFor(); await name.fill('Mae Installer');
    await name.locator('xpath=ancestor::form').getByRole('button', { name: 'Save changes', exact: true }).click();
    await name.waitFor({ state: 'detached' });
    await page.getByRole('link', { name: /Back to employee portal/ }).first().click();
    await page.getByText('Assigned Northbridge job', { exact: true }).first().waitFor();
    await page.getByRole('link', { name: 'Account setup', exact: true }).click();
    const recovery = page.locator('a[href^="/forgot-password?email=mae%40example.invalid"]').first();
    await recovery.click();
    assert.equal(await page.locator('input[type=email]').inputValue(), 'mae@example.invalid');
    await page.getByRole('link', { name: 'Back to Team', exact: true }).first().click();
    await page.getByRole('heading', { name: 'Team', exact: true }).waitFor();
    assert.equal(await page.getByRole('complementary', { name: 'Employee assistance status' }).count(), 0);
    for (const [last, heading] of [['3', 'Employee access is inactive'], ['4', 'Account setup incomplete'], ['5', 'Team member removed']]) {
      await open(`/team/assist/60000000-0000-4000-8000-00000000000${last}`);
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
    }
    await open('/team/assist/not-a-member');
    await page.getByRole('heading', { name: 'Team member unavailable' }).waitFor();
    assert.deepEqual(errors, []);
    assert.equal(requests.filter(r => r.target && r.method !== 'GET').length, 0);
    await page.close();
  }
  const finalState = await (await fetch(local + '/__fixture/state')).json();
  assert.ok(finalState.writes.length > 0);
  assert.ok(finalState.writes.every(w => w.p_actor === owner && w.p_employee === member));
  assert.equal(finalState.tables.employee_notifications[0].read_at, null);
  await fetch(local + '/__fixture/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clearAssignments: true }) });
  assert.equal((await fetch(local + capability)).status, 403, 'capability rechecks current assignment');
  console.log('Employee assistance: API ownership, read-only, capability revocation, real components, owner edits and 375/1280 layouts passed.');
} finally {
  await browser?.close();
  child.kill();
}
