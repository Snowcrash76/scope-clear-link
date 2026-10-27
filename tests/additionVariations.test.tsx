import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChangeRequestCard } from '../src/components/ChangeRequestCard';
import { variationItemLinks, variationItemTitle, variationItemValue } from '../src/lib/variationItems';
import type { ChangeRequest, ScopeItem, QuoteLineItem } from '../src/types/project';

const request: ChangeRequest = {
  id: 'variation', type: 'addition', title: 'Extra timber',
  description: 'Two extra lengths', costImpact: 120, timeImpact: 1,
  status: 'pending', createdAt: new Date('2026-10-27'),
};

test('addition uses client approval and displays the linked original item', () => {
  const html = renderToStaticMarkup(createElement(ChangeRequestCard, {
    request, viewerRole: 'client', onApprove() {}, onDecline() {},
    relatedItemTitle: 'Decking',
  }));
  assert.match(html, /Addition/);
  assert.match(html, /Related quote item: Decking/);
  assert.match(html, /Approve/);
  assert.match(html, /Decline/);
  const approved = renderToStaticMarkup(createElement(ChangeRequestCard, {
    request: { ...request, status: 'approved' }, viewerRole: 'client',
  }));
  assert.doesNotMatch(approved, /<button/);
});

test('variation links round-trip included work and standalone quote items', () => {
  for (const value of ['scope:scope-id', 'quote:quote-item-id', 'none']) {
    assert.equal(variationItemValue(variationItemLinks(value)), value);
  }
  assert.deepEqual(variationItemLinks('none'), { relatedScopeItemId: '', relatedQuoteLineItemId: '' });
  const scopes = [{ id: 'scope-id', title: 'Decking' }] as ScopeItem[];
  const quotes = [{ id: 'quote-id', title: 'Handrail' }] as QuoteLineItem[];
  assert.equal(variationItemTitle({ ...request, relatedScopeItemId: 'scope-id' }, scopes, quotes), 'Decking');
  assert.equal(variationItemTitle({ ...request, relatedQuoteLineItemId: 'quote-id' }, scopes, quotes), 'Handrail');
});

test('addition migration preserves quote prices and validates project ownership', () => {
  const sql = readFileSync('supabase/migrations/20261027000001_addition_variations.sql', 'utf8');
  assert.match(sql, /add value if not exists 'addition'/);
  assert.match(sql, /s.project_id = new.project_id/);
  assert.match(sql, /q.project_id = new.project_id/);
  assert.match(sql, /Choose only one related quote item/);
  assert.doesNotMatch(sql, /update public.quotes|update public.quote_line_items|update public.scope_items/i);
});
