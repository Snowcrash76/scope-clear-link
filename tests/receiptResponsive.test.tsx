import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReceiptScanControls } from '../src/components/job-costing/ReceiptScanControls';
import { ReceiptLineItemsEditor } from '../src/components/job-costing/ReceiptLineItemsEditor';
import { ReceiptItemsSummary } from '../src/components/job-costing/ReceiptItemsSummary';

test('selected receipt photo and long filenames stay inside shrinkable containers', () => {
  const file = new File(['synthetic'], `IMG_${'LongCameraFilename'.repeat(15)}.jpg`, { type: 'image/jpeg' });
  const html = renderToStaticMarkup(createElement(ReceiptScanControls, {
    file, uploaded: true, busy: false, onFileChange: () => {}, onScan: () => {},
  }));
  assert.match(html, /min-w-0 max-w-full/);
  assert.match(html, /h-auto max-h-64 w-full min-w-0 max-w-full/);
  assert.match(html, /flex min-w-0 flex-col gap-2/);
  assert.match(html, /overflow-wrap:anywhere/);
  for (const text of ['Selected receipt preview', file.name, 'Original attached privately', 'Scan again']) {
    assert.ok(html.includes(text), `Photo review retains ${text}`);
  }
});

test('receipt line items keep description and line total readable in a shrinkable phone layout', () => {
  const html = renderToStaticMarkup(createElement(ReceiptLineItemsEditor, {
    items: [{ description: 'Long material description'.repeat(20), quantity: 2, unit_price: 50, amount: 100 }],
    onChange: () => {},
  }));
  assert.match(html, /grid-cols-\[minmax\(0,1fr\)_auto\]/);
  assert.match(html, /min-w-0 max-w-full/);
  for (const label of ['Product / description', 'Quantity', 'Unit price', 'Line total', 'Add row', 'Remove receipt line 1']) {
    assert.ok(html.includes(label), `The phone editor retains ${label}`);
  }
});

test('saved receipts show each individual item price and retain the independent bill total', () => {
  const html = renderToStaticMarkup(createElement(ReceiptItemsSummary, {
    items: [
      { description: 'Timber floor adhesive', quantity: 1, unit_price: 10.575, amount: 10.58 },
      { description: 'Steel post 600mm', quantity: 1, unit_price: 6.29, amount: 6.29 },
      { description: 'Nozzle 600ml', quantity: 2, unit_price: 0.99, amount: 1.98 },
    ],
    subtotal: 17.14, gst: 1.71, total: 18.85,
  }));
  for (const text of ['Timber floor adhesive', 'Steel post 600mm', 'Nozzle 600ml', '$10.58', '$6.29', '$1.98', '$0.99', '$17.14', '$1.71', '$18.85', 'Total AUD']) {
    assert.ok(html.includes(text), `The receipt retains ${text}`);
  }
  assert.equal((html.match(/data-testid="receipt-summary-line-/g) ?? []).length, 3);
});

test('missing line fields stay explicit and a mismatched provided total is never overwritten', () => {
  const html = renderToStaticMarkup(createElement(ReceiptItemsSummary, {
    items: [{ description: null, quantity: null, unit_price: null, amount: null },
      { description: 'Printed item', quantity: 1, unit_price: 10, amount: 10 }],
    subtotal: null, gst: null, total: 99,
  }));
  assert.ok(html.includes('Description not read'));
  assert.ok(html.includes('Not read'));
  assert.match(html, /data-testid="receipt-summary-total"[^>]*>\$99\.00/);
});
