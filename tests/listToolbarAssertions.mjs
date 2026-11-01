import assert from 'node:assert/strict';

export async function checkListToolbar(page, route, width, base) {
  page.setDefaultTimeout(10000);
  const kind = route === '/projects' ? 'job' : route === '/quotes' ? 'quote' : 'invoice';
  const plural = `${kind}s`;
  const allTab = kind === 'job' ? 'active' : 'all';
  const oppositeTab = kind === 'invoice' ? 'paid' : 'approved';
  const tab = value => kind === 'job'
    ? page.getByTestId(`tab-${value}`)
    : page.getByRole('button', { name: new RegExp(`^${value[0].toUpperCase() + value.slice(1)}\\s*\\d+$`) });
  const input = page.getByRole('textbox', { name: `Search ${plural}, clients or references`, exact: true });
  const count = page.getByTestId('list-result-count');
  const toolbar = page.getByTestId('list-toolbar');
  const waitCount = async n => count.getByText(`${n} ${n === 1 ? kind : plural}`, { exact: true }).waitFor();
  const waitQuery = async value => page.waitForURL(url => (url.searchParams.get('q') || '') === value);
  const clear = async () => {
    await input.fill('');
    await waitQuery('');
  };
  await clear();
  await tab(allTab).click();
  await waitCount(13);
  assert.equal(await toolbar.getByRole('textbox').count(), 1);
  assert.equal(await page.getByRole('button', { name: 'Search this list', exact: true }).count(), 0);
  const css = await input.evaluate(node => ({
    height: node.getBoundingClientRect().height,
    radius: getComputedStyle(node).borderRadius,
  }));
  assert.equal(css.height, 44);
  assert.equal(css.radius, '12px');
  const tb = await toolbar.boundingBox();
  const tabs = await tab(allTab).locator('..').boundingBox();
  const rc = await count.boundingBox();
  assert.ok(tb.y + tb.height <= tabs.y + 1, 'Toolbar precedes tabs');
  assert.ok(tabs.y + tabs.height <= rc.y + 1, 'Count is directly below tabs');
  if (width < 640) {
    const ib = await input.boundingBox();
    assert.ok(Math.abs(ib.width - tb.width) <= 2, 'Mobile search uses the full toolbar width');
    if (kind === 'invoice') {
      const action = await page.getByTestId('button-invoice-filter').boundingBox();
      assert.ok(action.y >= ib.y + ib.height, 'Mobile actions wrap below the search');
    }
  }
  if (kind === 'invoice') {
    await toolbar.getByTestId('button-invoice-export-csv').waitFor();
    assert.equal(await page.getByRole('button', { name: /^Status$/ }).count(), 0);
  }
  assert.equal(await page.getByText(/^Showing \d+ of \d+ quotes?$/).count(), 0);

  // Start on page two; a new term must reset pagination and remain reset on clear.
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  const reference = kind === 'invoice' ? 'INV-001' : 'QT-001';
  for (const term of ['NORTH FITZROY', 'SYNTHETIC CLIENT', reference.toLowerCase()]) {
    await input.fill(term);
    await waitQuery(term);
    await waitCount(1);
    assert.equal(await page.getByRole('button', { name: 'Next', exact: true }).isDisabled(), true);
    await page.getByText('Synthetic North Fitzroy job', { exact: true }).and(page.locator(':visible')).first().waitFor();
    const expectedTab = kind === 'job' ? 'quoted' : kind === 'quote' ? 'sent' : 'overdue';
    assert.match(await tab(expectedTab).innerText(), /\b1\b/);
    assert.match(await tab(oppositeTab).innerText(), /\b0\b/);
  }
  // A refresh loads the real component anew from the URL, not retained React state.
  const searchedPath = `${route}?q=${encodeURIComponent(reference.toLowerCase())}`;
  await page.goto(`${base}/generated-artifacts/mobile-consistency/fixture.html?view=${encodeURIComponent(searchedPath)}`);
  await waitCount(1);
  assert.equal(await input.inputValue(), reference.toLowerCase());
  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await page.goBack();
  await waitCount(1);
  assert.equal(await input.inputValue(), reference.toLowerCase(), 'Browser back restores q');

  await tab(oppositeTab).click();
  await page.getByRole('heading', { name: `No ${plural} match your search`, exact: true }).waitFor();
  await waitCount(0);
  await page.getByRole('button', { name: 'Clear search', exact: true }).last().click();
  await waitQuery('');
  await waitCount(4);
  assert.equal(await tab(oppositeTab).getAttribute('aria-pressed'), 'true', 'Clearing search retains the status tab');
  await tab(allTab).click();
  await waitCount(13);
  await page.getByText('Synthetic North Fitzroy job', { exact: true }).and(page.locator(':visible')).first().waitFor();

  await input.fill('pending query must be cancelled');
  await input.press('Escape');
  await page.waitForTimeout(240);
  assert.equal(await input.inputValue(), '');
  assert.equal(new URL(page.url()).searchParams.has('q'), false);
  await waitCount(13);
  await input.fill(reference);
  await waitCount(1);
  await toolbar.getByRole('button', { name: 'Clear search', exact: true }).click();
  await waitCount(13);
  await waitQuery('');

  if (kind === 'invoice') {
    await page.getByTestId('button-invoice-filter').click();
    await page.getByTestId('input-invoice-date-from').fill('2030-01-01');
    await page.keyboard.press('Escape');
    await waitCount(0);
    assert.match(await tab('all').innerText(), /\b0\b/);
    await page.getByTestId('button-invoice-filter').click();
    await page.getByTestId('input-invoice-date-from').fill('');
    await page.keyboard.press('Escape');
    await waitCount(13);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: `generated-artifacts/mobile-consistency/list-toolbar-${kind}-${width}.png`, animations: 'disabled' });

  // Even a bookmarked query on a genuinely empty account keeps the no-data state.
  await page.goto(`${base}/generated-artifacts/mobile-consistency/fixture.html?empty=1&view=${encodeURIComponent(`${route}?q=missing`)}`);
  await page.getByText(kind === 'job' ? 'No active jobs yet.' : `No ${plural} yet`, { exact: true }).waitFor();
  await waitCount(0);
  assert.equal(await page.getByRole('heading', { name: `No ${plural} match your search`, exact: true }).count(), 0);
  await page.goto(`${base}/generated-artifacts/mobile-consistency/fixture.html?view=${encodeURIComponent(route)}`);
  await waitCount(13);
}
