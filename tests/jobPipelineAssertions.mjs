import assert from 'node:assert/strict';

export async function checkJobPipeline(page, route, width, mode) {
  const noQuoted = mode === 'noquoted';
  if (route === '/dashboard') {
    const active = page.getByTestId('stat-active-projects');
    await active.waitFor();
    assert.match(await active.innerText(), new RegExp(`Active Jobs\\s*${noQuoted ? 2 : 4}`, 'i'));
    assert.equal(await active.getAttribute('href'), '/projects');
    const cards = page.locator('[data-testid^="project-list-item-"]');
    assert.equal(await cards.count(), noQuoted ? 2 : 4);
    assert.ok(await page.getByText('Deposit', { exact: true }).count(), 'Progress labels capitalise Deposit');
    return;
  }
  if (route !== '/projects') return;
  const labels = ['Active', 'Quoted', 'Approved', 'In Progress', 'Archive'];
  const keys = ['active', 'quoted', 'approved', 'in_progress', 'completed'];
  const counts = noQuoted ? [2, 0, 1, 1, 3] : [4, 2, 1, 1, 1];
  for (let i = 0; i < keys.length; i++) {
    const tab = page.getByTestId(`tab-${keys[i]}`);
    await tab.waitFor();
    assert.equal((await tab.innerText()).replace(/\s/g, ''), `${labels[i]}${counts[i]}`.replace(/\s/g, ''));
  }
  const group = page.getByTestId('tab-active').locator('..');
  assert.equal(await group.getByRole('button').count(), 5);
  const style = await page.getByTestId('tab-active').evaluate(button => {
    const css = getComputedStyle(button);
    return {
      color: css.color, weight: css.fontWeight, radius: css.borderRadius,
      border: css.borderBottomWidth, countColor: getComputedStyle(button.lastElementChild).color,
      difference: button.getBoundingClientRect().bottom - button.parentElement.getBoundingClientRect().bottom,
    };
  });
  assert.equal(style.color, 'rgb(37, 99, 235)');
  assert.equal(style.countColor, style.color);
  assert.equal(style.weight, '500');
  if (width >= 768) {
    assert.equal(style.border, '2px');
    assert.equal(style.radius, '0px');
    assert.ok(Math.abs(style.difference) <= 1, `Underline must be flush: ${style.difference}px`);
  } else assert.ok(parseFloat(style.radius) > 20, 'Mobile uses pills');
  assert.equal(await page.getByTestId('tab-quoted').evaluate(button => getComputedStyle(button).color), 'rgb(100, 116, 139)');
  assert.match(await page.getByText('Open Quote Value', { exact: true }).locator('..').innerText(), noQuoted ? /\$0\.00/ : /\$300\.00/);
  assert.match(await page.getByText('Quotes Awaiting Response', { exact: true }).locator('..').innerText(),
    new RegExp(`Quotes Awaiting Response\\s*${noQuoted ? 0 : mode === 'nodraft' ? 2 : 1}`, 'i'));
  assert.equal(await page.getByRole('heading', { name: 'No pending quote drafts', exact: true }).count(), mode === 'default' ? 0 : 1);
  await page.getByTestId('tab-quoted').click();
  if (noQuoted) {
    await page.getByRole('heading', { name: 'No quotes yet. Tap New Job to start one.', exact: true }).waitFor();
  } else {
    const rows = page.locator('[data-testid^="project-row-"]');
    assert.equal(await rows.count(), 2);
    assert.equal(await page.getByRole('button', { name: /^Send quote for / }).count(), 2);
  }
  await page.getByTestId('tab-approved').click();
  await page.getByRole('button', { name: /^Send deposit invoice for / }).waitFor();
  await page.getByTestId('tab-in_progress').click();
  await page.getByRole('button', { name: /^Log costs for / }).waitFor();
  await page.getByTestId('tab-completed').click();
  assert.equal(await page.locator('[data-testid^="project-row-"]').count(), noQuoted ? 3 : 1);
  await page.getByTestId('tab-active').click();
  await page.screenshot({ path: `generated-artifacts/mobile-consistency/pipeline-${mode}-${width}.png`, animations: 'disabled', fullPage: true });
  if (mode === 'default' && width === 1280) {
    for (const [name, destination] of [
      [/^Send quote for /, 'quote'],
      [/^Send deposit invoice for /, 'stages'],
      [/^Log costs for /, 'costs'],
    ]) {
      await page.getByRole('button', { name }).first().click();
      await page.waitForURL(url => url.pathname.startsWith('/manage/') && url.searchParams.get('tab') === destination);
      await page.goto(`${process.env.MOBILE_TEST_BASE_URL || `https://${process.env.REPLIT_DEV_DOMAIN}`}/generated-artifacts/mobile-consistency/fixture.html?view=/projects`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('tab-active').waitFor();
    }
  }
}
