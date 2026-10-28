import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QuoteSection } from '../src/components/QuoteSection';
import type { Quote } from '../src/types/project';

test('quote read view keeps actions and long content within a shrinkable phone layout', () => {
  const quote: Quote = {
    id: 'fixture', projectId: 'fixture-project', quoteNumber: 'QT-LONG-REFERENCE-PHONE-TEST',
    status: 'draft', subtotal: 1250, taxRate: 10, taxAmount: 125, total: 1375,
    createdAt: new Date('2026-10-28'), updatedAt: new Date('2026-10-28'),
  };
  const html = renderToStaticMarkup(createElement(QuoteSection, {
    quote,
    scopeItems: [{
      id: 'fixture-scope', title: 'Long carpentry item for hallway preparation',
      description: '<p>Prepare the surface for replacement materials.</p>',
      category: 'included', acknowledged: false, cost: 1250,
    }],
    changeRequests: [],
    onCreateQuote: async () => 'fixture',
    onUpdateQuote: async () => true,
    onSendQuote: async () => true,
    onReviseQuote: async () => true,
  }));
  assert.match(html, /w-full min-w-0/);
  assert.match(html, /flex flex-col sm:flex-row sm:flex-wrap/);
  assert.match(html, /w-full sm:w-auto/);
  assert.match(html, /overflow-wrap:anywhere/);
  for (const text of ['View Quote', 'Download PDF', 'Send to Client', 'hallway preparation', '1,250.00']) {
    assert.ok(html.includes(text), `The phone layout must retain ${text}`);
  }
});
