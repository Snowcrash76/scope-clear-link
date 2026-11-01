import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MOBILE_TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
await mkdir('generated-artifacts', { recursive: true });
await build({
  entryPoints: ['tests/redesign.fixture.tsx'], bundle: true, format: 'esm', jsx: 'automatic',
  alias: { '@': resolve('src') }, loader: { '.sql': 'text' },
  define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'error',
  outfile: 'generated-artifacts/schedule-fixture.js',
  plugins: [{ name: 'schedule-synthetic-auth', setup(builder) {
    builder.onLoad({ filter: /(integrations\/supabase\/client\.ts|hooks\/useAuth\.tsx)$/ }, async () => ({
      contents: await readFile('tests/redesign.services.tsx', 'utf8'), loader: 'tsx',
    }));
  } }],
});
await writeFile('generated-artifacts/schedule-fixture.html', '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"><link rel="stylesheet" href="/generated-artifacts/schedule-fixture.css"><div id="root"></div><script type="module" src="/generated-artifacts/schedule-fixture.js"></script>');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
try {
  for (const width of (process.env.SCHEDULE_WIDTHS || '375,768,1280').split(',').map(Number)) for (const staff of (process.env.SCHEDULE_ROLES || 'owner,staff').split(',').map(role => role === 'staff')) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, timezoneId: 'America/Los_Angeles' });
    const errors = [], requests = [], unscheduledRequests = [], createdBookings = [];
    page.on('pageerror', error => errors.push(error.message));
    let fail = false;
    let backlogMode = 'jobs';
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('https://fonts.gstatic.com/**', route => route.abort());
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/employee/session') return route.fulfill({ json: {
        canManageTeam: !staff, employee: staff ? { id: 'e1', name: 'Alex', role: 'labourer', active: true } : null,
      } });
      if (url.pathname === '/api/employee/bootstrap') return route.fulfill({ json: { notifications: [] } });
      if (url.pathname === '/api/schedule/unscheduled') {
        unscheduledRequests.push(url.search);
        if (backlogMode === 'error') return route.fulfill({ status: 503, json: { error: 'Synthetic backlog unavailable' } });
        return route.fulfill({ json: {
          today: new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date()),
          timezone: 'Australia/Sydney',
          jobs: backlogMode === 'empty' ? [] : [{ id: 'j2', name: 'Deck', client_name: 'Casey Client', client_address: null, client_phone: null }],
        } });
      }
      if (url.pathname === '/api/schedule/bookings' && route.request().method() === 'POST') {
        createdBookings.push(route.request().postDataJSON());
        backlogMode = 'empty';
        return route.fulfill({ json: { id: 'created-booking' } });
      }
      if (url.pathname === '/api/schedule') {
        requests.push([url.searchParams.get('from'), url.searchParams.get('to')]);
        if (fail) return route.fulfill({ status: 503, json: { error: 'Synthetic unavailable' } });
        const date = url.searchParams.get('from');
        return route.fulfill({ json: {
          timezone: 'Australia/Sydney', canManage: !staff,
          jobs: [{ id: 'j1', name: 'Kitchen', client_address: '1 Main St', client_phone: '0400000000' },
            ...(!staff ? [{ id: 'j2', name: 'Deck', client_address: null, client_phone: null }] : [])],
          employees: [{ id: 'e1', name: 'Alex' }],
          appointments: [{ id: 'a1', project_id: 'j1', title: 'Kitchen booking', date, start_time: '07:00', end_time: '15:00', notes: 'Synthetic notes' }],
          assignments: [{ id: 'as1', employee_id: 'e1', employee_name: 'Alex', project_id: 'j1', appointment_id: 'a1', date, start_time: '07:00', end_time: '15:00', notes: null }],
        } });
      }
      return route.fulfill({ json: {} });
    });
    await page.goto(`${base}/generated-artifacts/schedule-fixture.html?view=/schedule`, { waitUntil: 'domcontentloaded' });
    const booking = page.getByRole('button', { name: /^Kitchen booking,/ }).first();
    await booking.waitFor({ timeout: 15000 }).catch(async error => {
      console.error({ width, staff, errors, body: (await page.locator('body').innerText()).slice(0, 2500) });
      throw error;
    });
    if (width === 375) {
      assert.equal(requests.at(-1)[0], requests.at(-1)[1], 'mobile defaults to Day');
      assert.equal(requests.at(-1)[0], new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date()), 'initial day is Sydney-local even in a US browser');
    }
    else assert.notEqual(requests.at(-1)[0], requests.at(-1)[1], 'desktop defaults to Week');
    if (!staff) {
      if (width >= 768) {
        await page.getByTestId('nav-schedule').waitFor();
        assert.equal(await page.getByTestId('nav-dashboard').count(), 1, 'Business Schedule uses the normal app navigation');
      } else {
        await page.getByTestId('button-account').waitFor();
      }
      assert.equal(await page.getByTestId('nav-variations').count(), 0, 'Global Variations navigation is removed');
    }
    await booking.click();
    await page.getByRole('dialog').waitFor();
    assert.ok(await page.getByRole('link', { name: '1 Main St' }).count());
    assert.ok(await page.getByRole('link', { name: '0400000000' }).count());
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => /Kitchen booking/.test(document.activeElement?.getAttribute('aria-label') || ''));
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.match(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') || ''), /Kitchen booking/);
    if (!staff) {
      await page.getByRole('button', { name: 'By job', exact: true }).click();
      assert.equal(await page.evaluate(() => localStorage.getItem('schedule-layout')), 'job');
      assert.ok(await page.getByText('Deck', { exact: true }).count());
    } else assert.equal(await page.getByRole('button', { name: 'By job', exact: true }).count(), 0);
    await page.getByRole('button', { name: 'Month', exact: true }).click();
    await page.getByRole('gridcell').first().waitFor();
    await page.getByRole('gridcell').first().focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelectorAll('[role="gridcell"]')[1]), true);
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelectorAll('[role="gridcell"]')[8]), true);
    await page.keyboard.press('ArrowUp');
    assert.equal(await page.evaluate(() => document.activeElement === document.querySelectorAll('[role="gridcell"]')[1]), true);
    await page.getByRole('button', { name: 'Toggle list view', exact: true }).click();
    await page.locator('.sc-list-row').first().waitFor();
    assert.equal(await page.getByRole('button', { name: 'Toggle list view', exact: true }).getAttribute('aria-pressed'), 'true');
    assert.ok(requests.at(-1)[0] < requests.at(-1)[1]);
    if (!staff) {
      assert.ok(unscheduledRequests.length > 0);
      assert.ok(unscheduledRequests.every(search => search === ''), 'Backlog never receives calendar date ranges');
      assert.equal(await page.getByText('Jobs without a booking in this view', { exact: true }).count(), 0);
      const sheetTrigger = page.getByRole('button', { name: /1 jobs to schedule/ });
      if (width < 768) {
        await sheetTrigger.click();
        await page.getByRole('dialog', { name: 'Unscheduled jobs', exact: true }).waitFor();
        await page.getByRole('dialog', { name: 'Unscheduled jobs', exact: true }).getByText('Casey Client', { exact: true }).waitFor();
      } else {
        await page.getByRole('heading', { name: 'Unscheduled jobs', exact: true }).waitFor();
        assert.equal(await sheetTrigger.count(), 0, 'Desktop does not show the mobile bar');
      }
      await page.screenshot({ path: `generated-artifacts/schedule-unscheduled-${width}.png`, animations: 'disabled' });
      await page.getByRole('button', { name: 'Add booking', exact: true }).last().click();
      const editor = page.getByRole('dialog', { name: 'Add booking', exact: true });
      await editor.waitFor();
      assert.equal(await editor.getByLabel('Job', { exact: true }).inputValue(), 'j2', 'Job is pre-linked');
      assert.equal(await page.getByRole('dialog').count(), 1, 'Sheet closes before booking editor opens');
      if (width === 375) {
        await editor.getByLabel('Booking title', { exact: true }).fill('Deck visit');
        await editor.getByLabel('Start time', { exact: true }).fill('09:00');
        await editor.getByLabel('End time', { exact: true }).fill('10:00');
        await editor.getByRole('button', { name: /Create booking|Save booking/ }).click();
        await editor.waitFor({ state: 'hidden' });
        assert.equal(createdBookings[0].project_id, 'j2');
        await page.getByRole('button', { name: /0 jobs to schedule/ }).click();
        await page.getByRole('heading', { name: 'All active jobs are scheduled.', exact: true }).waitFor();
        await page.keyboard.press('Escape');
      } else {
        await editor.getByRole('button', { name: 'Cancel', exact: true }).click();
        await editor.waitFor({ state: 'hidden' });
      }
    } else {
      assert.equal(unscheduledRequests.length, 0, 'Employees never request the owner backlog');
      assert.equal(await page.getByRole('button', { name: /jobs to schedule/ }).count(), 0);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `generated-artifacts/schedule-${staff ? 'employee' : 'owner'}-${width}.png` });
    if (width === 375 && !staff) {
      fail = true;
      await page.getByRole('button', { name: 'Next date range', exact: true }).click();
      await page.getByRole('heading', { name: 'Schedule could not load', exact: true }).waitFor({ timeout: 20000 });
      fail = false;
      await page.getByRole('button', { name: 'Retry', exact: true }).click();
      await page.getByRole('button', { name: /^Kitchen booking,/ }).first().waitFor();
      backlogMode = 'error';
      await page.goto(`${base}/generated-artifacts/schedule-fixture.html?view=/schedule`, { waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: /Jobs to schedule unavailable/ }).waitFor({ timeout: 20000 });
      await page.getByRole('button', { name: /Jobs to schedule unavailable/ }).click();
      const sheet = page.getByRole('dialog', { name: 'Unscheduled jobs', exact: true });
      await sheet.getByText('Unscheduled jobs could not load.', { exact: true }).waitFor();
      assert.equal(await sheet.getByText('All active jobs are scheduled.', { exact: true }).count(), 0, 'Errors are not presented as empty');
      backlogMode = 'empty';
      await sheet.getByRole('button', { name: 'Retry', exact: true }).click();
      await sheet.getByRole('heading', { name: 'All active jobs are scheduled.', exact: true }).waitFor();
      await page.keyboard.press('Escape');
    }
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`Schedule ${staff ? 'employee' : 'owner'} ${width}px passed`);
  }
} finally { await browser.close(); }
