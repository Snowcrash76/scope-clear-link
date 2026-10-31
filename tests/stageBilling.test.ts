import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { activeStageInvoice, getStageBilling } from '../src/lib/stageBilling';
import type { Invoice, ProjectStage, Quote } from '../src/types/project';

const quote = {
  id: 'q1', projectId: 'p1', quoteNumber: 'QT-001', status: 'approved',
  subtotal: 1000, total: 1100, taxRate: 10, taxAmount: 100,
} as Quote;
const stage = {
  id: 's1', name: 'Preparation', description: '', status: 'upcoming', invoicePercentage: 20,
} as ProjectStage;

test('an upcoming stage bills a saved quote percentage, not the live scope', () => {
  assert.deepEqual(getStageBilling(stage, quote), {
    subtotal: 200, taxRate: 10, taxAmount: 20, total: 220,
    allocationLabel: '20% of quote', quoteNumber: 'QT-001',
    description: 'Stage Payment: Preparation (20% of quote QT-001)',
  });
  assert.equal(stage.status, 'upcoming');
});

test('legacy saved total is a valid billing basis if subtotal was not stored', () => {
  assert.equal(getStageBilling(stage, { ...quote, subtotal: 0 }).subtotal, 200);
  assert.equal(getStageBilling(stage, { ...quote, subtotal: 0, taxRate: 0, total: 1000 }).total, 200);
});

test('fixed amounts remain ex GST and may be invoiced without a quote', () => {
  assert.equal(getStageBilling({ ...stage, invoiceAmount: 125 }, quote).total, 137.5);
  assert.deepEqual(getStageBilling({ ...stage, invoicePercentage: undefined, invoiceAmount: 125 }, null), {
    subtotal: 125, taxRate: 10, taxAmount: 12.5, total: 137.5,
    allocationLabel: 'Fixed stage amount', quoteNumber: null,
    description: 'Stage Payment: Preparation (Fixed stage amount)',
  });
  assert.equal(getStageBilling({ ...stage, invoiceAmount: 125 }, { ...quote, taxRate: 0 }).total, 125);
});

test('fractions round to cents and invalid amounts are refused', () => {
  assert.deepEqual(
    getStageBilling({ ...stage, invoicePercentage: 33.33 }, { ...quote, subtotal: 999.99 }),
    {
      subtotal: 333.3, taxRate: 10, taxAmount: 33.33, total: 366.63,
      allocationLabel: '33.33% of quote', quoteNumber: 'QT-001',
      description: 'Stage Payment: Preparation (33.33% of quote QT-001)',
    },
  );
  for (const bad of [0, -2, 100.01, 12.345, NaN]) {
    assert.throws(() => getStageBilling({ ...stage, invoicePercentage: bad }, quote));
  }
  for (const bad of [0, -1, 1.234, NaN]) {
    assert.throws(() => getStageBilling({ ...stage, invoiceAmount: bad }, quote));
  }
  assert.throws(() => getStageBilling(stage, null), /quote/);
  assert.throws(() => getStageBilling(stage, { ...quote, subtotal: 0, total: 0 }), /unavailable/);
  assert.throws(() => getStageBilling(stage, { ...quote, taxRate: -1 }), /GST/);
});

test('cancelled invoices remain in history but release their stage for re-invoicing', () => {
  const cancelled = { id: 'old', stageId: 's1', status: 'cancelled' } as Invoice;
  const draft = { id: 'new', stageId: 's1', status: 'draft' } as Invoice;
  assert.equal(activeStageInvoice([cancelled], 's1'), undefined);
  assert.equal(activeStageInvoice([cancelled, draft], 's1'), draft);
  assert.equal(activeStageInvoice([draft, cancelled], 'other'), undefined);
});

test('stage invoicing is atomic and a concurrent second active invoice is forbidden', () => {
  const sql = readFileSync('supabase/migrations/20261031000000_stage_invoice_atomic.sql', 'utf8');
  assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_active_per_stage/);
  assert.match(sql, /status <> 'cancelled'/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /INSERT INTO public\.invoices/);
  assert.match(sql, /INSERT INTO public\.invoice_line_items/);
});
