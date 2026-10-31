import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BrandLogo } from '../src/components/BrandLogo';

for (const variant of ['horizontal', 'stacked', 'mark'] as const) {
  test(`ScopeStream ${variant} uses supplied vector artwork with one accessible name`, () => {
    const html = renderToStaticMarkup(createElement(BrandLogo, { variant, className: 'w-40' }));
    assert.match(html, /role="img"/);
    assert.equal((html.match(/aria-label="ScopeStream"/g) || []).length, 1);
    assert.match(html, new RegExp(`/brand/scopestream-${variant}-light.svg`));
    assert.match(html, new RegExp(`/brand/scopestream-${variant}-dark.svg`));
    assert.doesNotMatch(html, /ScopeClear/);
    for (const mode of ['light', 'dark']) {
      const svg = readFileSync(`public/brand/scopestream-${variant}-${mode}.svg`, 'utf8');
      assert.match(svg, /<svg[^>]+viewBox=/);
      assert.match(svg, /<path/);
      assert.match(svg, /fill: #2563eb;/);
      assert.doesNotMatch(svg, /#abb7ff/i);
      assert.doesNotMatch(svg, /<script|foreignObject|onload=|href=/i);
    }
  });
}

test('inverse logo always uses the light-on-dark artwork', () => {
  const html = renderToStaticMarkup(createElement(BrandLogo, { inverse: true }));
  assert.match(html, /scopestream-horizontal-dark.svg/);
  assert.doesNotMatch(html, /scopestream-horizontal-light.svg/);
});

test('browser identity uses the new name and supplied symbol favicon', () => {
  const html = readFileSync('index.html', 'utf8');
  assert.match(html, /<title>ScopeStream/);
  assert.match(html, /rel="icon"[^>]+scopestream-mark-light.svg/);
  assert.doesNotMatch(html, /ScopeClear/);
});
