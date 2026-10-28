import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReceiptScanControls } from '../src/components/job-costing/ReceiptScanControls';
import { ReceiptLineItemsEditor } from '../src/components/job-costing/ReceiptLineItemsEditor';

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

test('receipt line items use a shrinkable single column until desktop widths', () => {
  const html = renderToStaticMarkup(createElement(ReceiptLineItemsEditor, {
    items: [{ description: 'Long material description'.repeat(20), quantity: 2, unit_price: 50, amount: 100 }],
    onChange: () => {},
  }));
  assert.match(html, /grid-cols-\[minmax\(0,1fr\)\]/);
  assert.match(html, /lg:grid-cols-/);
  assert.doesNotMatch(html, /sm:grid-cols-/);
  for (const label of ['Description', 'Qty', 'Unit price', 'Amount', 'Add row', 'Remove receipt line 1']) {
    assert.ok(html.includes(label), `The phone editor retains ${label}`);
  }
});
