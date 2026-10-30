import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { build } from 'esbuild';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MOBILE_TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const pid = '20000000-0000-4000-8000-000000000001', second = '20000000-0000-4000-8000-000000000002';
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date());
const mondayDate = new Date(`${today}T12:00:00Z`);
mondayDate.setUTCDate(mondayDate.getUTCDate() - (mondayDate.getUTCDay() + 6) % 7);
const monday = mondayDate.toISOString().slice(0, 10);
const employees = ['Alex', 'Blake', 'Casey', 'Dana'].map((name, index) => ({
  id: `e${index + 1}`, name, email: `${name.toLowerCase()}@example.invalid`, role: 'labourer',
  active: true, hourly_rate: 40, auth_user_id: `auth-e${index + 1}`,
}));
const jobs = [{ id: pid, name: 'Kitchen', client_name: 'Client', client_address: null, client_phone: null },
  { id: second, name: 'Deck', client_name: 'Client', client_address: null, client_phone: null }];
const entry = (id, employee_id, project_id, status, minutes) => ({
  id, employee_id, project_id, work_date: monday, status, paid_minutes: minutes,
  started_at: `${monday}T01:00:00Z`, ended_at: new Date(Date.parse(`${monday}T01:00:00Z`) + (minutes || 0) * 60000).toISOString(),
  break_minutes: 0, notes: '', rate_snapshot: status === 'approved' ? 40 : null, created_at: `${monday}T00:00:00Z`,
});
const entries = [
  entry('a-kitchen', 'e1', pid, 'approved', 120), entry('a-deck', 'e1', second, 'approved', 60),
  entry('b-kitchen', 'e2', pid, 'submitted', 60), entry('b-deck', 'e2', second, 'submitted', 60),
  entry('c-kitchen', 'e3', pid, 'draft', 30),
];
entries.push({ ...entry('running', 'e3', second, 'draft', null), ended_at: null });
const cost = (id, amount, extra = {}) => ({
  id, job_id: pid, supplier: 'Alex', description: 'Labour cost', cost_date: monday, category: 'Labour',
  amount_ex_gst: amount, gst_amount: 0, amount_inc_gst: amount, gst_applies: false,
  status: 'confirmed', reference_number: null, notes: '', created_at: `${monday}T00:00:00Z`,
  updated_at: `${monday}T00:00:00Z`, receipt_image_url: null, quote_line_item_id: null, scope_item_id: null, ...extra,
});
const costs = [cost('posted', 80, { timesheet_entry_id: 'a-kitchen' }), cost('manual', 30)];
await mkdir('generated-artifacts', { recursive: true });
await build({
  entryPoints: ['tests/redesign.fixture.tsx'], bundle: true, format: 'esm', jsx: 'automatic',
  alias: { '@': resolve('src') }, loader: { '.sql': 'text' }, logLevel: 'error',
  define: { 'process.env.NODE_ENV': '"development"' }, outfile: 'generated-artifacts/job-timesheets.js',
  plugins: [{ name: 'job-timesheet-auth', setup(builder) {
    builder.onLoad({ filter: /(integrations\/supabase\/client\.ts|hooks\/useAuth\.tsx)$/ }, async () => ({
      contents: await readFile('tests/redesign.services.tsx', 'utf8'), loader: 'tsx',
    }));
  } }],
});
await writeFile('generated-artifacts/job-timesheets.html', '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"><div id="root"></div><script type="module" src="/generated-artifacts/job-timesheets.js"></script>');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
try {
  for (const width of [375, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [], mutations = [], bootstrapJobs = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const request = route.request(), url = new URL(request.url());
      if (request.method() !== 'GET') mutations.push(url.pathname);
      if (url.pathname === '/api/employee/session') return route.fulfill({ json: { employee: null, canManageTeam: true } });
      if (url.pathname === '/api/team/bootstrap') {
        const job = url.searchParams.get('job_id'); bootstrapJobs.push(job);
        return route.fulfill({ json: {
          timezone: 'Australia/Sydney', employees, jobs: job ? jobs.filter(row => row.id === job) : jobs,
          entries: job ? entries.filter(row => row.project_id === job) : entries,
          appointments: [], assignments: [], notes: [], documents: [], audit: [], permissions: {},
          submissions: [
            { id: 's1', employee_id: 'e1', week_start: monday, status: 'approved', submitted_at: `${monday}T01:00:00Z` },
            { id: 's2', employee_id: 'e2', week_start: monday, status: 'submitted', submitted_at: `${monday}T01:00:00Z` },
          ],
        } });
      }
      if (url.pathname === '/api/job-costs') return route.fulfill({ json: { costs, quoteLineItems: [], scopeLinkSetupRequired: false } });
      return route.fulfill({ json: {} });
    });
    const open = path => page.goto(`${base}/generated-artifacts/job-timesheets.html?view=${encodeURIComponent(path)}`);
    await open(`/manage/${pid}?tab=timesheets`);
    await page.getByRole('heading', { name: 'Weekly time review', exact: true }).waitFor();
    assert.ok(page.url().includes(`/team/timesheets?job=${pid}`), 'legacy job tab redirects with filter');
    const filter = page.getByRole('combobox', { name: 'Filter timesheets by job', exact: true });
    assert.equal(await filter.inputValue(), pid);
    assert.match(await page.locator('body').innerText(), /3h\s*30m/);
    assert.equal(await page.locator('[data-testid="timesheet-member-e4"]').count(), 0, 'job filter hides empty coworkers');
    assert.equal(await page.getByRole('button', { name: 'Approve all submitted', exact: true }).isDisabled(), true, 'filtered display cannot silently approve a whole week');
    assert.ok(bootstrapJobs.includes(null), 'review retains full-business data for full-week safety');
    await filter.selectOption(second);
    await page.waitForFunction(() => new URLSearchParams(location.search).get('job')?.endsWith('000002'));
    assert.match(await page.locator('body').innerText(), /2h\s*0m|2h\b/);
    await page.getByRole('button', { name: 'Clear job filter', exact: true }).click();
    assert.equal(new URL(page.url()).searchParams.has('job'), false);
    assert.match(await page.locator('body').innerText(), /5h\s*30m/);
    assert.ok(await page.locator('[data-testid="timesheet-member-e4"]').count(), 'All jobs restores the ordinary missing-hours rows');
    await open(`/manage/${pid}?tab=quote`);
    await page.getByRole('heading', { name: 'Synthetic North Fitzroy job', exact: true }).waitFor();
    assert.equal(await page.locator('[aria-label="Job sections"]').getByRole('button', { name: /Timesheets/ }).count(), 0);
    for (const tab of ['overview', 'staff']) {
      await open(`/manage/${pid}?tab=${tab}`);
      const hours = page.getByText('Hours logged', { exact: true });
      await hours.waitFor();
      assert.match(await hours.locator('..').innerText(), /3h\b/, 'Hours logged includes approved and submitted, not draft time');
    }
    await open(`/manage/${pid}?tab=costs`);
    const labour = page.locator('[data-testid="job-labour-summary"]');
    await labour.waitFor();
    assert.match(await labour.innerText(), /2h\b/);
    assert.match(await labour.innerText(), /\$80\.00/);
    assert.doesNotMatch(await labour.innerText(), /\$110\.00/);
    assert.ok(await labour.getByRole('link', { name: 'View timesheets for this job', exact: true }).count());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: `generated-artifacts/job-timesheets-costs-${width}.png` });
    assert.deepEqual(mutations, [], 'display/filter/alias never mutates timesheets or labour costs');
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`Job timesheets alias/filter/costs ${width}px passed`);
  }
} finally { await browser.close(); }
