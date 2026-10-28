import test from 'node:test';
import assert from 'node:assert/strict';
import { collectQuoteDraftItems, quoteDraftTotals, type QuoteDraftItem } from '../src/lib/newQuoteDraft';

const empty: QuoteDraftItem = { title: '', description: '', cost: 0, category: 'included' };

test('saving the first quote includes the item still in its entry fields', () => {
  const current = { ...empty, title: ' Decking ', description: '<p>Hardwood &amp; fixings</p>', cost: 1000, imageUrl: 'receipt-image' };
  const items = collectQuoteDraftItems([], current);
  assert.deepEqual(items, [{ ...current, title: 'Decking' }]);
  assert.deepEqual(quoteDraftTotals(items, 10), { subtotal: 1000, taxAmount: 100, total: 1100 });
  assert.equal(current.title, ' Decking ');
});

test('existing items and the final pending item are both saved in order', () => {
  const added = { ...empty, title: 'Labour', cost: 200 };
  const pending = { ...empty, title: 'Materials', cost: 100 };
  const items = collectQuoteDraftItems([added], pending);
  assert.deepEqual(items.map(item => item.title), ['Labour', 'Materials']);
  assert.equal(quoteDraftTotals(items, 10).total, 330);
  assert.deepEqual(collectQuoteDraftItems([added], empty), [added]);
});

test('excluded items and assumptions retain descriptions without increasing totals', () => {
  const items = collectQuoteDraftItems([
    { ...empty, title: 'Included', cost: 100 },
    { ...empty, title: 'Not included', category: 'excluded', description: '<p>Painting</p>', cost: 500 },
  ], { ...empty, title: 'Access', category: 'assumption', description: '<p>Clear access required</p>', cost: 200 });
  assert.equal(items.length, 3);
  assert.equal(items[2].description, '<p>Clear access required</p>');
  assert.equal(quoteDraftTotals(items, 0).total, 100);
});

test('incomplete item details are not silently discarded', () => {
  for (const current of [
    { ...empty, description: '<p>Extra materials</p>' },
    { ...empty, cost: 25 },
    { ...empty, imageUrl: 'uploaded-photo' },
  ]) assert.throws(() => collectQuoteDraftItems([], current), /enter a title/);
  assert.deepEqual(collectQuoteDraftItems([], { ...empty, description: '<p><br></p>' }), []);
});
