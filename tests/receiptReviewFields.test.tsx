import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReceiptReviewFields } from '../src/components/job-costing/ReceiptReviewFields';
import { receiptCurrencyForReview } from '../shared/receiptScanning';

test('receipt review displays fixed AUD without a currency confirmation checkbox', () => {
  const html = renderToStaticMarkup(createElement(ReceiptReviewFields, {
    abn: '',
    currency: receiptCurrencyForReview('USD'),
    onAbnChange: () => {},
  }));
  assert.match(html, /id="receipt-currency"[^>]*readonly=""[^>]*value="AUD"/);
  assert.doesNotMatch(html, /type="checkbox"|checkbox-receipt-currency-aud|I confirm these receipt amounts/);
  assert.match(html, /All receipt costs are recorded in AUD/);
});
