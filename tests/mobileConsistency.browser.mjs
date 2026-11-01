// Render the real application with isolated synthetic services. Never changes auth
// or customer data. The generated fixture is ignored and excluded from publishing.
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.MOBILE_TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
const pid = '20000000-0000-4000-8000-000000000001';
await mkdir('generated-artifacts/mobile-consistency', { recursive: true });
await build({
  entryPoints: ['tests/redesign.fixture.tsx'], bundle: true, format: 'esm', jsx: 'automatic',
  alias: { '@': resolve('src') }, loader: { '.sql': 'text' },
  define: { 'process.env.NODE_ENV': '"development"' }, logLevel: 'error',
  outfile: 'generated-artifacts/mobile-consistency/fixture.js',
  plugins: [{ name: 'isolated-consistency-services', setup(builder) {
    builder.onLoad({ filter: /(integrations\/supabase\/client\.ts|hooks\/useAuth\.tsx)$/ }, async () => ({
      contents: await readFile('tests/redesign.services.tsx', 'utf8'), loader: 'tsx',
      resolveDir: process.cwd(),
    }));
  } }],
});
await writeFile('generated-artifacts/mobile-consistency/fixture.html', `<!doctype html>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/src/index.css">
<link rel="stylesheet" href="/generated-artifacts/mobile-consistency/fixture.css">
<div id="root"></div><script type="module" src="/generated-artifacts/mobile-consistency/fixture.js"></script>`);

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date());
const profit = { jobId: pid, jobName: 'Synthetic North Fitzroy job', clientName: 'Synthetic client',
  status: 'in_progress', quotedExGst: 27100, quoteStatus: 'sent', quoteIsEstimate: true,
  invoicedExGst: 1000, approvedVariationsExGst: 0, confirmedCostsExGst: 689.96,
  confirmedCostsIncGst: 758.97, draftCostsExGst: 0, draftCostsIncGst: 0,
  costsByCategory: { Materials: 689.96, Labour: 0, Other: 0, Subcontractor: 0, 'Plant/Equipment': 0 } };
const jobs = [{ id: pid, name: profit.jobName, client_name: profit.clientName, client_address: 'Synthetic street' }];
const routes = process.env.CONSISTENCY_ROUTES?.split(',') || [
  '/dashboard', '/projects', '/quotes', '/invoices', '/clients', '/profitability', '/schedule',
  '/team', '/team/assignments', '/team/timesheets', '/team/permissions',
  `/manage/${pid}`,
  ...['quote', 'costs', 'invoices', 'changes', 'documents', 'stages', 'activity'].map(tab => `/manage/${pid}?tab=${tab}`),
];
const widths = (process.env.CONSISTENCY_WIDTHS || '320,360,390,430,768,1280').split(',').map(Number);
const results = [];
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH });
try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 850 } });
    if (process.env.CONSISTENCY_PIPELINE_MODE) await page.addInitScript(mode => {
      window.__pipelineFixture = true;
      window.__pipelineNoDraft = mode === 'nodraft';
      window.__pipelineNoQuoted = mode === 'noquoted';
    }, process.env.CONSISTENCY_PIPELINE_MODE);
    const errors = [];
    let allowDeletion = false;
    const deletionRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    // Avoid waiting on third-party font/CDN availability in isolated tests.
    // Layout constraints are checked against the actual shared component CSS.
    await page.route('https://fonts.googleapis.com/**', route => route.abort());
    await page.route('https://fonts.gstatic.com/**', route => route.abort());
    await page.route('**/api/**', async route => {
      const url = new URL(route.request().url()), path = url.pathname;
      if (path === '/api/owner/delete-resource' && process.env.CONSISTENCY_DELETE_CHECKS) {
        deletionRequests.push(route.request().postDataJSON());
        return allowDeletion
          ? route.fulfill({ json: { deleted: true, recordsDeleted: 4, filesPending: false } })
          : route.fulfill({ status: 409, json: { error: 'Synthetic dependency blocked deletion. Nothing was deleted.' } });
      }
      if (path === '/api/employee/session') return route.fulfill({ json: { employee: null, canManageTeam: true } });
      if (path === '/api/platform/session') return route.fulfill({ json: { admin: false } });
      if (path === '/api/team/bootstrap') return route.fulfill({ json: {
        employees: [{ id: 'member', name: 'Synthetic team member', email: 'member@example.invalid', role: 'labourer', active: true, hourly_rate: 40 }],
        jobs, assignments: [], entries: [], submissions: [], appointments: [], audit: [], timezone: 'Australia/Sydney', today,
      } });
      if (path === '/api/job-profitability') return route.fulfill({ json: [profit] });
      if (path === '/api/job-costs') return route.fulfill({ json: { costs: [], quoteLineItems: [], scopeLinkSetupRequired: false } });
      if (path === '/api/schedule/unscheduled') return route.fulfill({ json: { timezone: 'Australia/Sydney', today, jobs } });
      if (path === '/api/schedule') return route.fulfill({ json: {
        timezone: 'Australia/Sydney', canManage: true, jobs, employees: [], appointments: [], assignments: [],
      } });
      return route.fulfill({ json: [] });
    });
    for (const routePath of routes) {
    try {
      if (page.url() === 'about:blank') {
        await page.goto(`${base}/generated-artifacts/mobile-consistency/fixture.html?view=${encodeURIComponent(routePath)}`, { waitUntil: 'domcontentloaded' });
      } else {
        // BrowserRouter's real navigation listener: retain the same browser/app
        // session, as a user moving between screens does, without reloading the
        // entire isolated bundle for every route.
        await page.evaluate(path => {
          history.pushState({}, '', path);
          window.dispatchEvent(new PopStateEvent('popstate'));
          window.scrollTo(0, 0);
        }, routePath);
      }
      const desktop = width >= 768;
      const mobileHeader = page.getByTestId('app-header');
      const sidebar = page.getByTestId('app-sidebar');
      const header = desktop ? sidebar : mobileHeader;
      await header.waitFor({ timeout: 20000 });
      await (desktop ? mobileHeader : sidebar).waitFor({ state: 'hidden' });
      await page.waitForTimeout(200);
      assert.deepEqual(errors, [], `${routePath} at ${width}: runtime errors`);
      const titleContract = await page.getByRole('heading', { level: 1 }).first().evaluate(el => {
        const previous = el.previousElementSibling;
        const subtitle = el.nextElementSibling?.tagName === 'P' ? el.nextElementSibling : null;
        return {
          previous: previous?.textContent.trim() ?? '',
          previousTag: previous?.tagName ?? '',
          fontSize: getComputedStyle(el).fontSize,
          weight: getComputedStyle(el).fontWeight,
          subtitleSize: subtitle && getComputedStyle(subtitle).fontSize,
          subtitleColor: subtitle && getComputedStyle(subtitle).color,
        };
      });
      assert.ok(!titleContract.previous || titleContract.previousTag === 'BUTTON', `${routePath}: no text above the title ${JSON.stringify(titleContract)}`);
      assert.equal(titleContract.fontSize, '24px', `${routePath}: page title is text-2xl`);
      assert.equal(titleContract.weight, '700', `${routePath}: page title is bold`);
      if (titleContract.subtitleSize) {
        assert.equal(titleContract.subtitleSize, '14px', `${routePath}: subtitle is text-sm`);
        assert.equal(titleContract.subtitleColor, 'rgb(100, 116, 139)', `${routePath}: subtitle is slate-500`);
      }
      const bounds = await header.evaluate(el => {
        const box = e => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
        const visible = e => e.getClientRects().length && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
        return { viewport: innerWidth, page: document.documentElement.scrollWidth, header: box(el),
          brand: Array.from(el.querySelectorAll('[role="img"]')).filter(visible).map(box),
          buttons: Array.from(el.querySelectorAll(innerWidth >= 768 ? '[data-testid="button-global-search-sidebar"]' : 'button,a')).filter(visible).map(e => ({ ...box(e), label: e.getAttribute('aria-label') || e.textContent })),
        };
      });
      assert.ok(bounds.page <= width + 1, `${width}px ${routePath}: page overflow ${JSON.stringify(bounds)}`);
      for (const button of bounds.buttons) {
        assert.ok(button.left >= -1 && button.right <= width + 1, `${width}px ${routePath}: header control outside viewport ${JSON.stringify(button)}`);
        assert.ok(button.height >= 43, `${width}px ${routePath}: header touch target too short ${JSON.stringify(button)}`);
        for (const brand of bounds.brand) {
          assert.ok(button.right <= brand.left + 1 || button.left >= brand.right - 1 || button.bottom <= brand.top || button.top >= brand.bottom,
            `${width}px ${routePath}: control overlaps logo ${JSON.stringify({ button, brand })}`);
        }
      }
      const jobDetails = routePath.startsWith('/manage/') || routePath.startsWith('/jobs/');
      const visibleBrands = await page.locator('[role="img"][aria-label="ScopeStream"]').evaluateAll(elements =>
        elements.filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden').length);
      assert.equal(visibleBrands, !desktop && jobDetails ? 0 : 1, 'Exactly one brand except the mobile job back-arrow replacement');
      if (!desktop) {
        assert.match((await mobileHeader.innerText()).trim(), /^[A-Z]{0,3}$/, 'Mobile header has no section label');
        assert.equal(await page.getByTestId('button-mobile-menu').count(), 0, 'No hamburger in the slim header');
        if (jobDetails) await page.getByTestId('button-job-back').waitFor();
      }
      if (!jobDetails && !desktop) {
        assert.ok(bounds.brand.some(box => box.width >= 75), 'Phone brand remains readable');
      }
      const nav = page.getByTestId('bottom-tab-bar');
      if (!desktop) {
        await nav.waitFor();
        const navBox = await nav.boundingBox();
        assert.ok(navBox.x >= 0 && navBox.x + navBox.width <= width + 1, 'Bottom navigation fits viewport');
      } else await nav.waitFor({ state: 'hidden' });
      // Every owner screen exposes the same search overlay, including nested job tabs.
      const globalSearch = page.getByTestId(desktop ? 'button-global-search-sidebar' : 'button-global-search');
      await globalSearch.click();
      const dialog = page.getByRole('dialog', { name: 'Search jobs, quotes or clients', exact: true });
      await dialog.waitFor();
      const input = dialog.getByRole('textbox');
      await input.fill('Fixture reference');
      await page.waitForTimeout(100);
      assert.ok((await dialog.innerText()).includes('Synthetic North Fitzroy job'), `${routePath}: job reference search works`);
      const dialogBounds = await dialog.evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth, left: el.getBoundingClientRect().left, right: el.getBoundingClientRect().right }));
      assert.ok(dialogBounds.left >= -1 && dialogBounds.right <= width + 1 && dialogBounds.scroll <= dialogBounds.client + 1, 'Search dialog fits');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'hidden' });
      for (const [shortcut, term] of [['Control+k', 'Synthetic client'], ['Meta+k', 'Synthetic North Fitzroy job']]) {
        await page.keyboard.press(shortcut);
        await dialog.waitFor();
        await dialog.getByRole('textbox').fill(term);
        await dialog.getByRole('button', { name: /^Job Synthetic North Fitzroy job/ }).waitFor();
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
      }
      if (routePath === '/dashboard') {
        const h1 = page.getByRole('heading', { level: 1 });
        assert.equal(await h1.evaluate(el => getComputedStyle(el).fontSize), '24px', 'Shared mobile title scale');
        if (width <= 430) {
          const stats = page.locator('[aria-label="Dashboard statistics"]');
          const columns = await stats.evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
          assert.equal(columns, 2, 'Phone dashboard uses compact two-column metrics');
          await page.getByTestId('button-account').click();
          const drawer = page.getByRole('dialog', { name: 'Navigation', exact: true });
          await drawer.waitFor();
          assert.equal(await drawer.locator('[role="img"][aria-label="ScopeStream"]').count(), 0, 'Drawer does not duplicate the brand');
          await drawer.getByTestId('nav-clients').waitFor();
          await drawer.getByTestId('nav-team').waitFor();
          await page.keyboard.press('Control+k');
          await drawer.waitFor({ state: 'hidden' });
          await dialog.waitFor();
          await page.keyboard.press('Escape');
          await dialog.waitFor({ state: 'hidden' });
        }
        await page.screenshot({ path: `generated-artifacts/mobile-consistency/dashboard-${width}.png`, fullPage: true });
        if (!desktop) await page.getByTestId('button-account').click();
        await page.locator('[data-testid="button-sidebar-settings"]:visible').click();
        const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
        await settings.waitFor();
        await page.setViewportSize({ width, height: 420 });
        await page.waitForTimeout(250); // Let the open animation and viewport reflow finish.
        const settingsBounds = await settings.evaluate(el => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, height: r.height, client: el.clientWidth, scroll: el.scrollWidth };
        });
        assert.ok(settingsBounds.left >= -1 && settingsBounds.right <= width + 1 &&
          settingsBounds.height <= 420 && settingsBounds.scroll <= settingsBounds.client + 1,
        'Account settings fits a reduced-height phone viewport');
        await page.keyboard.press('Escape');
        await settings.waitFor({ state: 'hidden' });
        await page.setViewportSize({ width, height: 850 });
      }
      if (routePath === '/projects') {
        const localSearch = page.getByRole('textbox', { name: 'Search jobs, clients or references' });
        await localSearch.fill('no matching job');
        await page.getByText('No jobs match your search.', { exact: true }).waitFor();
        await page.keyboard.press('Control+k');
        await dialog.waitFor();
        await dialog.getByRole('textbox').fill('Fixture reference');
        await dialog.getByRole('button', { name: /^Job Synthetic North Fitzroy job/ }).waitFor();
        await page.keyboard.press('Escape');
        await dialog.waitFor({ state: 'hidden' });
        assert.equal(await localSearch.inputValue(), 'no matching job', 'Global search does not change the inline Jobs filter');
        await localSearch.fill('Synthetic');
        await page.locator('[data-testid^="project-row-"]').first().waitFor();
        await page.screenshot({ path: `generated-artifacts/mobile-consistency/jobs-${width}.png`, fullPage: true });
        await globalSearch.click();
        const navigationSearch = page.getByRole('dialog', { name: 'Search jobs, quotes or clients', exact: true });
        await navigationSearch.getByRole('textbox').fill('Fixture reference');
        await navigationSearch.getByRole('button', { name: /^Job Synthetic North Fitzroy job/ }).click();
        await page.waitForURL(`**/manage/${pid}`);
        if (!desktop) await page.getByTestId('button-job-back').click();
        else await page.goBack();
        await page.waitForURL('**/projects');
        await page.getByRole('heading', { name: 'Jobs', exact: true }).waitFor();
      }
      if (process.env.CONSISTENCY_DELETE_CHECKS && ['/quotes', '/invoices', '/clients'].includes(routePath)) {
        const kind = routePath === '/quotes' ? 'quote' : routePath === '/invoices' ? 'invoice' : 'client';
        const trigger = page.getByRole('button', { name: kind === 'client' ? /^Delete / : new RegExp(`^Delete ${kind} `) }).first();
        const initialRequests = deletionRequests.length;
        allowDeletion = false;
        await trigger.click();
        const deletionDialog = page.getByRole('dialog', { name: `Delete ${kind} permanently?`, exact: true });
        await deletionDialog.waitFor();
        const remove = deletionDialog.getByRole('button', { name: 'Delete permanently', exact: true });
        assert.equal(await remove.isDisabled(), true);
        await deletionDialog.getByLabel('Type DELETE to confirm').fill('delete');
        assert.equal(await remove.isDisabled(), true);
        await deletionDialog.getByRole('button', { name: 'Cancel', exact: true }).click();
        await deletionDialog.waitFor({ state: 'hidden' });
        assert.equal(deletionRequests.length, initialRequests);
        await trigger.click();
        await deletionDialog.getByLabel('Type DELETE to confirm').fill('DELETE');
        if (width === 390) await page.screenshot({ path: `generated-artifacts/mobile-consistency/delete-${kind}-390.png` });
        await remove.click();
        await page.getByText('Synthetic dependency blocked deletion. Nothing was deleted.', { exact: true }).first().waitFor();
        await remove.waitFor();
        assert.equal(await deletionDialog.isVisible(), true);
        assert.equal(deletionRequests.length, initialRequests + 1);
        allowDeletion = true;
        await remove.click();
        await deletionDialog.waitFor({ state: 'hidden' });
        assert.equal(deletionRequests.length, initialRequests + 2);
        assert.equal(deletionRequests.at(-1).kind, kind);
        assert.equal(deletionRequests.at(-1).confirmation, 'DELETE');
        assert.ok(kind === 'client' ? deletionRequests.at(-1).clientKey : deletionRequests.at(-1).id);
      }
      assert.deepEqual(errors, [], `${routePath}: interaction runtime errors`);
      if (routePath === '/projects' || routePath.includes('?tab=quote')) {
        await page.screenshot({ path: `generated-artifacts/mobile-consistency/shell-${routePath === '/projects' ? 'jobs' : 'detail'}-${width}.png`, animations: 'disabled' });
      }
      if (process.env.CONSISTENCY_PIPELINE_MODE) {
        const { checkJobPipeline } = await import('./jobPipelineAssertions.mjs');
        await checkJobPipeline(page, routePath, width, process.env.CONSISTENCY_PIPELINE_MODE);
      }
      results.push({ width, route: routePath, pageWidth: bounds.page, headerControls: bounds.buttons.length });
      console.log(`PASS ${width}px ${routePath}`);
    } catch (error) {
      await page.screenshot({ path: 'generated-artifacts/mobile-consistency/failure.png', fullPage: true });
      console.error({ width, routePath, errors, text: (await page.locator('body').innerText()).slice(0, 2000) });
      throw error;
    }
    }
    await page.close();
  }
  const reportName = (process.env.CONSISTENCY_REPORT || 'results').replace(/[^a-z0-9-]/gi, '');
  await writeFile(`generated-artifacts/mobile-consistency/${reportName}.json`, JSON.stringify(results, null, 2));
} finally { await browser.close(); }
