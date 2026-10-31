import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateStoredQuoteTotals } from '../shared/quoteTotals.js';
import { readAll, repairQuoteTotals } from '../scripts/repair-quote-totals.mjs';

const scope = [
  { id: 's1', title: 'Base scope', category: 'included', cost: 1000 },
  { id: 's2', title: 'Variation: extra work', category: 'included', cost: 100 },
  { id: 's3', title: 'Legacy duplicate', category: 'included', cost: 100 },
  { id: 's4', title: 'Exclusion', category: 'excluded', cost: 9000 },
  { id: 's5', title: 'Assumption', category: 'assumption', cost: 8000 },
];
const items = [
  { id: 'l1', title: 'Base line', cost: 200, is_variation: false },
  { id: 'l2', title: 'Flagged extra', cost: 100, is_variation: true },
  { id: 'l3', title: 'Legacy duplicate', cost: 100, is_variation: false },
];
const changes = [
  { id: 'c1', project_id: 'p1', status: 'approved', cost_impact: 100 },
  { id: 'c2', project_id: 'p1', status: 'approved', cost_impact: 100 },
  { id: 'c3', project_id: 'p1', status: 'pending', cost_impact: 7000 },
  { id: 'c4', project_id: 'p1', status: 'declined', cost_impact: 6000 },
];

test('base scope and lines plus each approved request once, ignoring duplicates', () => {
  assert.deepEqual(calculateStoredQuoteTotals(scope, items, changes, 10),
    { subtotal: 1400, tax_amount: 140, total: 1540 });
});

test('negative changes, null costs, zero GST and empty quotes', () => {
  assert.deepEqual(calculateStoredQuoteTotals(scope.slice(0, 1), [],
    [{ status: 'approved', cost_impact: -250 }, { status: 'approved', cost_impact: null }], 0),
  { subtotal: 750, tax_amount: 0, total: 750 });
  assert.deepEqual(calculateStoredQuoteTotals([], [], [], null),
    { subtotal: 0, tax_amount: 0, total: 0 });
});

test('legacy variation titles use the same fallback as the live view', () => {
  for (const title of ['Variation: test', ' variation - test', 'VARIATION-test', 'Variation test']) {
    assert.equal(calculateStoredQuoteTotals([], [{ title, cost: 50 }], [], 10).total, 0);
    assert.equal(calculateStoredQuoteTotals([{ title, category: 'included', cost: 50 }], [], [], 10).total, 0);
  }
  // Explicit false is authoritative for quote lines, just as in useQuoteLineItems.
  assert.equal(calculateStoredQuoteTotals([], [{ title: 'Variation: manual', cost: 50, is_variation: false }], [], 0).total, 50);
});

function fakeClient({ failRead, failWrite, conflict = false } = {}) {
  const quote = { id: 'q1', project_id: 'p1', subtotal: 1600, tax_amount: 160,
    total: 1760, tax_rate: 10, updated_at: 'version1', status: 'approved', client_comment: 'Keep this',
    quote_token: 'unchanged', approved_at: 'unchanged' };
  const tables = {
    projects: [{ id: 'p1', active_quote_id: 'q1' }],
    change_requests: changes,
    scope_items: scope.map(row => ({ ...row, project_id: 'p1' })),
    quote_line_items: items.map(row => ({ ...row, quote_id: 'q1' })),
    quotes: [quote, { ...quote, id: 'q2', project_id: 'p2' },
      { ...quote, id: 'q-old', created_at: '2025-01-01', approved_at: '2025-01-02' }],
  };
  const updates = [];
  const client = {
    from(table) {
      let rows = tables[table];
      let patch;
      let single = false;
      let from = 0;
      let to = Infinity;
      const query = {
        select() { return query; },
        single() { single = true; return query; },
        order() { return query; },
        range(start, end) { from = start; to = end; return query; },
        eq(key, value) { rows = rows.filter(row => row[key] === value); return query; },
        update(value) { patch = value; return query; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            if ((!patch && failRead === table) || (patch && failWrite)) return { data: null, error: new Error('Database failure') };
            if (patch) {
              if (conflict) return { data: [], error: null };
              updates.push({ ...patch });
              rows.forEach(row => Object.assign(row, patch));
            }
            const data = rows.slice(from, to + 1);
            return { data: single ? data[0] : data, error: null };
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  return { client, tables, updates };
}

test('repair persists correct totals, preserves decisions, skips unaffected projects and is idempotent', async () => {
  const { client, tables, updates } = fakeClient();
  const original = { ...tables.quotes[0] };
  const historical = { ...tables.quotes[2] };
  assert.deepEqual(await repairQuoteTotals(client), { projects: 1, updated: 1 });
  assert.deepEqual(updates, [{ subtotal: 1400, tax_amount: 140, total: 1540 }]);
  assert.deepEqual(tables.quotes[0], { ...original, ...updates[0] });
  assert.equal(tables.quotes[1].total, 1760);
  assert.deepEqual(tables.quotes[2], historical, 'an earlier approved quote retains its historical amount and decision');
  assert.deepEqual(await repairQuoteTotals(client), { projects: 1, updated: 0 });
});

test('repair fails explicitly on partial reads, failed writes or concurrent edits', async () => {
  for (const failRead of ['change_requests', 'scope_items', 'quote_line_items', 'quotes', 'projects']) {
    const { client, updates } = fakeClient({ failRead });
    await assert.rejects(repairQuoteTotals(client), /Database failure/);
    assert.equal(updates.length, 0);
  }
  await assert.rejects(repairQuoteTotals(fakeClient({ failWrite: true }).client), /Database failure/);
  await assert.rejects(repairQuoteTotals(fakeClient({ conflict: true }).client), /changed during totals repair/);
});

test('repair reads every page, not just Supabase first-page results', async () => {
  const values = Array.from({ length: 1203 }, (_, id) => ({ id }));
  const offsets = [];
  assert.deepEqual(await readAll(() => ({
    order() { return this; },
    async range(start, end) {
      offsets.push(start);
      return { data: values.slice(start, end + 1), error: null };
    },
  })), values);
  assert.deepEqual(offsets, [0, 500, 1000]);
});
