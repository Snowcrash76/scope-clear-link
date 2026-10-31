import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQuoteInvoice, calculateQuoteInvoiceAmounts } from '../src/lib/quoteInvoice';
import type { Quote } from '../src/types/project';

const quote = {
  id: 'quote-one', projectId: 'job-one', quoteNumber: 'Q-123', status: 'approved',
  subtotal: 1000, taxRate: 10, taxAmount: 100, total: 1100, notes: 'Saved notes', terms: 'Saved terms',
} as Quote;

test('deposit percentage applies to saved ex GST amount, with GST and total', () => {
  assert.deepEqual(calculateQuoteInvoiceAmounts(1000, 10, 20), { subtotal: 200, taxAmount: 20, total: 220 });
  const request = buildQuoteInvoice(quote, { type: 'deposit', percentage: 20 });
  assert.equal(request.type, 'deposit');
  assert.equal(request.quoteId, quote.id);
  assert.equal(request.taxRate, 10);
  assert.equal(request.lineItems[0].unitPrice, 200);
  assert.match(request.lineItems[0].description, /Deposit.*20%.*Q-123/);
  assert.equal(request.notes, quote.notes);
  assert.equal(request.terms, quote.terms);
  assert.equal(quote.subtotal, 1000);
});

test('stage description and fractional percentages persist on the invoice line', () => {
  const request = buildQuoteInvoice(quote, { type: 'staged', percentage: 33.33, description: 'Framing' });
  assert.equal(request.type, 'staged');
  assert.equal(request.lineItems[0].unitPrice, 333.3);
  assert.match(request.lineItems[0].description, /Stage payment.*33.33%.*Q-123: Framing/);
  assert.deepEqual(calculateQuoteInvoiceAmounts(999.99, 10, 33.33), {
    subtotal: 333.3, taxAmount: 33.33, total: 366.63,
  });
});

test('full invoice remains itemised when line items reconcile to saved quote', () => {
  const items = [{ description: 'Materials', quantity: 1, unitPrice: 400, scopeItemId: 'scope-one' },
    { description: 'Labour', quantity: 1, unitPrice: 600 }];
  const request = buildQuoteInvoice(quote, undefined, items);
  assert.equal(request.type, 'final');
  assert.deepEqual(request.lineItems, items);
});

test('changed or missing scope never changes the amount invoiced from the saved quote', () => {
  const request = buildQuoteInvoice(quote, undefined, [{ description: 'New scope', quantity: 1, unitPrice: 2000 }]);
  assert.equal(request.lineItems.length, 1);
  assert.equal(request.lineItems[0].unitPrice, 1000);
  assert.equal(buildQuoteInvoice(quote).lineItems[0].unitPrice, 1000);
});

test('invalid percentages, amounts and invoice types cannot create an invoice', () => {
  for (const percentage of [0, -1, 100.01, NaN, Infinity, 12.345]) {
    assert.throws(() => calculateQuoteInvoiceAmounts(1000, 10, percentage));
  }
  for (const subtotal of [0, -10, NaN, Infinity]) assert.throws(() => calculateQuoteInvoiceAmounts(subtotal, 10, 20));
  assert.throws(() => calculateQuoteInvoiceAmounts(0.01, 10, 0.01));
  assert.throws(() => calculateQuoteInvoiceAmounts(1000, -1, 20));
  assert.throws(() => buildQuoteInvoice(quote, { type: 'final', percentage: 20 }));
  assert.throws(() => buildQuoteInvoice(quote, { type: 'invalid', percentage: 20 } as never));
});

test('zero GST and 100 percent stage invoices are supported', () => {
  assert.deepEqual(calculateQuoteInvoiceAmounts(1000, 0, 100), { subtotal: 1000, taxAmount: 0, total: 1000 });
  assert.equal(buildQuoteInvoice(quote, { type: 'staged', percentage: 100 }).type, 'staged');
});
