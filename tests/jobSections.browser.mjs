import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
await mkdir('generated-artifacts', { recursive: true });
await build({
  entryPoints: ['tests/jobSections.fixture.tsx'], bundle: true, format: 'esm', jsx: 'automatic',
  alias: { '@': resolve('src') }, define: { 'process.env.NODE_ENV': '"development"' },
  outfile: 'generated-artifacts/job-sections.js',
});
await writeFile('generated-artifacts/job-sections.html', '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"><title>Job navigation check</title></head><body><div id="root"></div><script type="module" src="/generated-artifacts/job-sections.js"></script></body></html>');
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined });
const base = process.env.MOBILE_TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`;
try {
  for (const width of [320, 390, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/generated-artifacts/job-sections.html`);
    let trigger = page.getByRole('button', { name: 'Job sections, Quote', exact: true });
    await trigger.waitFor();
    assert.equal(await page.getByRole('tablist').count(), 0);
    for (const label of ['Invoices', 'Costs', 'Variations', 'Stages', 'Documents', 'Quote']) {
      await trigger.click();
      const items = page.getByRole('menuitemradio');
      assert.equal(await items.count(), 6);
      if (label === 'Invoices') {
        assert.match(await page.getByRole('menuitemradio', { name: /^Invoices/ }).innerText(), /3/);
        assert.match(await page.getByRole('menuitemradio', { name: /^Variations/ }).innerText(), /2/);
        assert.match(await page.getByRole('menuitemradio', { name: /^Documents/ }).innerText(), /1/);
      }
      await page.getByRole('menuitemradio', { name: new RegExp(`^${label}`) }).click();
      trigger = page.getByRole('button', { name: `Job sections, ${label}`, exact: true });
      await trigger.waitFor();
      await page.getByRole('region', { name: label, exact: true }).waitFor();
      await page.getByRole('menu').waitFor({ state: 'hidden' });
      assert.equal(await page.getByRole('region').count(), 1);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    }
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await page.getByRole('menu').waitFor();
    assert.equal(await page.getByRole('menuitemradio', { name: /^Quote/ }).getAttribute('aria-checked'), 'true');
    const bounds = await page.getByRole('menu').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1);
    if (width === 390) await page.screenshot({ path: 'generated-artifacts/job-sections-open-390.jpg', fullPage: true });
    await page.keyboard.press('Escape');
    await page.getByRole('menu').waitFor({ state: 'hidden' });
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
    await trigger.click();
    await page.getByRole('menu').waitFor();
    // Radix modal menus intentionally hide background controls from the accessibility tree.
    await page.getByTestId('outside-menu').click({ force: true });
    await page.getByRole('menu').waitFor({ state: 'hidden' });
    await page.goto(`${base}/generated-artifacts/job-sections.html?tab=costs`);
    await page.getByRole('button', { name: 'Job sections, Costs', exact: true }).waitFor();
    await page.getByRole('region', { name: 'Costs', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log(`PASS six job sections, counts, keyboard, deep-link state and width at ${width}px`);
    await page.close();
  }
} finally { await browser.close(); }
