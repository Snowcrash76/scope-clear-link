import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MOBILE_TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
await mkdir('generated-artifacts', { recursive: true });
await build({
  entryPoints: ['tests/redesign.fixture.tsx'], bundle: true, format: 'esm', jsx: 'automatic',
  alias: { '@': resolve('src') }, loader: { '.sql': 'text' }, define: { 'process.env.NODE_ENV': '"development"' },
  outfile: 'generated-artifacts/booking-fixture.js', logLevel: 'error',
  plugins: [{ name: 'synthetic-auth', setup(b) {
    b.onLoad({ filter: /(integrations\/supabase\/client\.ts|hooks\/useAuth\.tsx)$/ }, async () => ({
      contents: await readFile('tests/redesign.services.tsx', 'utf8'), loader: 'tsx', resolveDir: process.cwd(),
    }));
  } }],
});
await writeFile('generated-artifacts/booking-fixture.html', '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"><link rel="stylesheet" href="/generated-artifacts/booking-fixture.css"><div id="root"></div><script type="module" src="/generated-artifacts/booking-fixture.js"></script>');
const uuid = n => `80000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH, headless: true });
try {
  for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 850 }, timezoneId: 'Australia/Sydney' });
    let bookings = [], assignments = [], day, rejectNext = false, next = 10;
    const writes = [], errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.pathname === '/api/employee/session') return route.fulfill({ json: { employee: null, canManageTeam: true } });
      if (url.pathname === '/api/schedule') {
        day ??= url.searchParams.get('from');
        return route.fulfill({ json: {
          timezone: 'Australia/Sydney', canManage: true,
          jobs: [{ id: uuid(1), name: 'Kitchen', client_address: null, client_phone: null }, { id: uuid(2), name: 'Deck', client_address: null, client_phone: null }],
          employees: [{ id: uuid(3), name: 'Alex', active: true }],
          appointments: bookings, assignments,
        } });
      }
      if (url.pathname.startsWith('/api/schedule/bookings')) {
        const payload = req.postDataJSON(); writes.push({ method: req.method(), payload });
        if (rejectNext) { rejectNext = false; return route.fulfill({ status: 503, json: { error: 'Synthetic save failed' } }); }
        if (req.method() === 'DELETE') {
          const id = url.pathname.split('/').at(-1);
          bookings = bookings.filter(b => b.id !== id); assignments = assignments.filter(a => a.appointment_id !== id);
          return route.fulfill({ json: { id } });
        }
        if (payload.employee_ids.length && !payload.allow_conflicts) return route.fulfill({ json: {
          requires_confirmation: true, conflicts: [{ employee_name: 'Alex', title: 'Existing booking', date: payload.date, start_time: '09:00', end_time: '11:00' }],
        } });
        const id = req.method() === 'POST' ? uuid(next++) : url.pathname.split('/').at(-1);
        bookings = [...bookings.filter(b => b.id !== id), { id, ...payload }];
        assignments = [...assignments.filter(a => a.appointment_id !== id), ...payload.employee_ids.map(employee_id => ({
          id: uuid(next++), appointment_id: id, employee_id, employee_name: 'Alex', project_id: payload.project_id,
        }))];
        return route.fulfill({ json: { id } });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto(`${base}/generated-artifacts/booking-fixture.html?view=/schedule`);
    await page.getByRole('button', { name: 'Add booking', exact: true }).first().click();
    let dialog = page.getByRole('dialog');
    await dialog.getByLabel('Booking title', { exact: true }).fill('Material collection');
    await dialog.getByLabel('Date', { exact: true }).fill(day);
    await dialog.getByRole('button', { name: 'Save booking', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    const standalone = page.getByRole('button', { name: /^Material collection,/ }).first();
    await standalone.waitFor();
    assert.equal(writes[0].payload.project_id, null);
    assert.deepEqual(writes[0].payload.employee_ids, []);
    await standalone.click();
    await dialog.getByRole('button', { name: 'Edit booking', exact: true }).click();
    await dialog.getByLabel('Booking title', { exact: true }).fill('Deck inspection');
    await dialog.getByLabel('Job', { exact: true }).selectOption(uuid(2));
    await dialog.getByLabel('Alex', { exact: true }).check();
    await dialog.getByLabel('Notes', { exact: true }).fill('Keep this note after an error');
    rejectNext = true;
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await dialog.getByText('Synthetic save failed', { exact: true }).waitFor();
    assert.equal(await dialog.getByLabel('Notes', { exact: true }).inputValue(), 'Keep this note after an error');
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save anyway', exact: true }).waitFor();
    assert.equal(bookings[0].title, 'Material collection', 'Overlap warning made no write');
    await dialog.getByLabel('Notes', { exact: true }).fill('Revised after warning');
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).waitFor();
    assert.equal(await dialog.getByRole('button', { name: 'Save anyway', exact: true }).count(), 0, 'Edits invalidate acknowledgement');
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await dialog.getByRole('button', { name: 'Save anyway', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: /^Deck inspection,/ }).first().click();
    await dialog.getByRole('button', { name: 'Cancel booking', exact: true }).click();
    assert.equal(writes.filter(w => w.method === 'DELETE').length, 0);
    await dialog.getByRole('button', { name: 'Keep booking', exact: true }).click();
    await dialog.getByRole('button', { name: 'Cancel booking', exact: true }).click();
    await dialog.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(bookings.length, 0); assert.equal(assignments.length, 0);
    await page.getByRole('button', { name: 'Month', exact: true }).click();
    await page.getByRole('button', { name: /^Add booking on/ }).first().click();
    await dialog.getByLabel('Booking title', { exact: true }).fill('Overnight site work');
    await dialog.getByLabel('Start time', { exact: true }).fill('23:00');
    await dialog.getByLabel('End time', { exact: true }).fill('02:00');
    assert.equal(await dialog.getByRole('button', { name: 'Save booking', exact: true }).isDisabled(), true);
    await dialog.getByRole('checkbox', { name: /Finishes next day/ }).check();
    assert.equal(await dialog.getByRole('button', { name: 'Save booking', exact: true }).isEnabled(), true);
    await page.waitForFunction(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return dialog && getComputedStyle(dialog).opacity === '1';
    });
    assert.notEqual(await dialog.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(0, 0, 0, 0)', 'Portalled editor has an opaque background');
    await page.screenshot({ path: `generated-artifacts/booking-editor-${width}.png` });
    assert.equal(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await dialog.getByRole('button', { name: 'Save booking', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(bookings[0].overnight, true);
    await page.getByRole('button', { name: /^Overnight site work,/ }).first().waitFor();
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`Interactive calendar ${width}px: create, standalone visibility, edit, crew/job selection, error recovery, overlap confirmation, cancellation and date-click/overnight passed.`);
  }
} finally { await browser.close(); }
