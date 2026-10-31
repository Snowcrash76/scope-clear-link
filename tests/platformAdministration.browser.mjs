import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { baselineAssets } from './baselineSources.mjs';
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MOBILE_TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
await mkdir('generated-artifacts', { recursive: true });
const baseline = await baselineAssets();
await build({
  entryPoints: ['tests/redesign.fixture.tsx'], bundle: true, format: 'esm', jsx: 'automatic',
  alias: { '@': resolve('src') }, loader: { '.sql': 'text' }, define: { 'process.env.NODE_ENV': '"development"' },
  outfile: 'generated-artifacts/platform-administration.js', logLevel: 'error',
  plugins: [{ name: 'synthetic-platform-auth', setup(b) {
    b.onLoad({ filter: /(integrations\/supabase\/client\.ts|hooks\/useAuth\.tsx)$/ }, async () => ({
      contents: await readFile('tests/redesign.services.tsx', 'utf8'), loader: 'tsx', resolveDir: process.cwd(),
    }));
  } }, ...baseline.plugins],
});
await writeFile('generated-artifacts/platform-administration.html', `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="${baseline.css}"><link rel="stylesheet" href="/generated-artifacts/platform-administration.css"><div id="root"></div><script type="module" src="/generated-artifacts/platform-administration.js"></script>`);
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const accounts = Array.from({ length: 10 }, (_, n) => ({
  id: id(n + 1), email: `owner${n}@example.invalid`, name: `Owner ${n}`, createdAt: '2026-01-01',
  lastSignInAt: null, emailConfirmed: true, systemAdmin: n === 0, providerBanned: false,
  control: { status: 'active', reason: '' }, businessIds: [id(n + 1)], membershipIds: [],
}));
const businesses = accounts.map((a, n) => ({
  id: a.id, name: `Example Business ${n}`, email: a.email, contact: a.name, phone: null, abn: null, address: null, website: null,
  createdAt: a.createdAt, lastSignInAt: null, control: a.control, systemAdmin: a.systemAdmin, loginExists: true,
  memberCount: 1, projectCount: 1, quoteCount: 1, invoiceCount: 0,
}));
const memberships = [{ id: id(30), ownerId: id(1), name: 'Synthetic field worker', email: 'worker@example.invalid', role: 'labourer', active: true, removed: false, accountId: null, invitation: 'pending' }];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
try {
  for (const width of [375, 1280]) {
    for (const mode of ['ready', 'setup', 'denied', 'error']) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      let directoryRequests = 0;
      const actions = [], errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/api/**', route => {
        const req = route.request(), path = new URL(req.url()).pathname;
        const send = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
        if (path === '/api/platform/session') return mode === 'denied' ? send({ error: 'System administrator required.' }, 403) : send({ admin: true });
        if (path === '/api/platform/directory') {
          directoryRequests++;
          if (mode === 'error') return send({ error: 'Synthetic directory outage.' }, 503);
          return send({ ready: mode === 'ready', setupMessage: 'Security setup is pending.', accounts, businesses, memberships, deletionPolicy: 'history_preserving_only' });
        }
        if (path.startsWith('/api/platform/businesses/') && req.method() === 'GET') {
          const business = businesses.find(b => b.id === path.split('/').at(-1));
          return send({ business, memberships: business.systemAdmin ? memberships : [], projects: [{ id: id(40), name: 'Synthetic job', status: 'in_progress', created_at: '2026-01-01' }] });
        }
        if (path === '/api/platform/audit') return send({ ready: mode === 'ready', events: [{ id: id(50), actor_id: id(1), target_kind: 'account', target_id: id(2), action: 'suspend', reason: 'Synthetic audit only', outcome: 'completed', created_at: '2026-01-01' }] });
        if (req.method() === 'POST' && path.startsWith('/api/platform/')) {
          actions.push({ path, ...req.postDataJSON() }); return send({ success: true, message: 'Synthetic action confirmed. History retained.' });
        }
        if (path === '/api/employee/session') return send({ employee: null, canManageTeam: true });
        return send([]);
      });
      await page.goto(`${base}/generated-artifacts/platform-administration.html?view=${encodeURIComponent('/admin')}`);
      if (mode === 'denied') {
        await page.waitForURL(url => url.pathname === '/dashboard');
        assert.equal(directoryRequests, 0);
      } else if (mode === 'error') {
        await page.getByText('Platform directory unavailable', { exact: true }).waitFor();
        await page.getByRole('button', { name: 'Retry', exact: true }).waitFor();
      } else {
        await page.getByRole('tab', { name: 'Accounts', exact: true }).click();
        await page.getByPlaceholder('Search account name or email').waitFor();
        assert.equal(await page.getByText('owner9@example.invalid', { exact: true }).count(), 0);
        await page.getByRole('button', { name: 'Next', exact: true }).click();
        await page.getByText('owner9@example.invalid', { exact: true }).waitFor();
        await page.getByPlaceholder('Search account name or email').fill('OWNER1@EXAMPLE.INVALID');
        await page.getByText('owner1@example.invalid', { exact: true }).waitFor();
        const suspend = page.getByRole('button', { name: 'Suspend', exact: true });
        if (mode === 'setup') {
          assert.equal(await suspend.isDisabled(), true);
          await page.getByText('Platform controls are not configured', { exact: true }).waitFor();
          assert.equal(actions.length, 0);
        } else {
          await suspend.click();
          const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Confirm action', exact: true }) });
          await dialog.getByLabel(/Reason/).fill('Synthetic support decision');
          await dialog.getByLabel(/Type .* to confirm/).fill('wrong@example.invalid');
          assert.equal(await dialog.getByRole('button', { name: 'Confirm action', exact: true }).isDisabled(), true);
          await dialog.getByLabel(/Type .* to confirm/).fill('owner1@example.invalid');
          await dialog.getByRole('button', { name: 'Confirm action', exact: true }).click();
          await dialog.waitFor({ state: 'hidden' });
          assert.equal(actions.length, 1); assert.equal(actions[0].action, 'suspend');
          await page.getByRole('tab', { name: 'Businesses', exact: true }).click();
          await page.getByPlaceholder('Search name, email, contact, or ABN').fill('Example Business 0');
          await page.getByRole('button', { name: /Example Business 0/ }).click();
          await page.getByText('Synthetic job', { exact: true }).waitFor();
          await page.getByText(/Synthetic field worker/).waitFor();
          assert.equal(await page.getByRole('button', { name: 'Remove member', exact: true }).isDisabled(), false);
          await page.getByRole('button', { name: 'Remove member', exact: true }).click();
          await page.getByRole('heading', { name: 'Confirm action', exact: true }).waitFor();
          await page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Confirm action', exact: true }) }).getByRole('button', { name: 'Cancel', exact: true }).click();
          await page.getByRole('heading', { name: 'Confirm action', exact: true }).waitFor({ state: 'hidden' });
          assert.equal(actions.length, 1);
        }
        await page.screenshot({ path: `generated-artifacts/platform-admin-${mode}-${width}.png`, fullPage: true });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${mode} overflows at ${width}`);
      }
      assert.deepEqual(errors, []);
      await page.close();
    }
  }
  console.log('Platform admin UI: capability denial, complete pagination/search, confirmation/cancel, protected admin and ordinary member controls, live detail, setup gating and errors passed at 375/1280.');
} finally { await browser.close(); }
