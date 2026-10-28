import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calculateGst, completeMissingCostSubtotal, jobCostInputSchema, profitability, type JobCost } from '../shared/jobCosting';
import { summarizeJobs } from '../server/jobCostData';
import { createJobCostRouter } from '../server/jobCostRoutes';
import type { ReceiptExtractor } from '../server/receiptExtraction';

const owner = '11111111-1111-4111-8111-111111111111';
const otherOwner = '22222222-2222-4222-8222-222222222222';
const jobId = '33333333-3333-4333-8333-333333333333';
const otherJob = '44444444-4444-4444-8444-444444444444';
const costId = '55555555-5555-4555-8555-555555555555';
const otherCost = '66666666-6666-4666-8666-666666666666';
const quoteId = '77777777-7777-4777-8777-777777777777';
const itemId = '88888888-8888-4888-8888-888888888888';
const input = {
  job_id: jobId, supplier: 'Building supplies', description: 'Timber', cost_date: '2026-10-26',
  category: 'Materials' as const, amount_ex_gst: 100, gst_amount: 10, amount_inc_gst: 110,
  gst_applies: true, status: 'confirmed' as const, reference_number: 'INV-123', notes: '',
  receipt_image_url: null, quote_line_item_id: null,
};
const cost: JobCost = { ...input, id: costId, created_by: owner, created_at: '2026-10-26T00:00:00Z', updated_at: '2026-10-26T00:00:00Z' };
const project = { id: jobId, name: 'Deck', client_name: 'Client', status: 'in_progress', user_id: owner, active_quote_id: quoteId };

test('AUD amounts recalculate correctly in both GST directions and GST-free', () => {
  assert.deepEqual(calculateGst(110, 'inc', true), { amount_ex_gst: 100, gst_amount: 10, amount_inc_gst: 110 });
  assert.deepEqual(calculateGst(100, 'ex', true), { amount_ex_gst: 100, gst_amount: 10, amount_inc_gst: 110 });
  assert.deepEqual(calculateGst(110, 'inc', false), { amount_ex_gst: 110, gst_amount: 0, amount_inc_gst: 110 });
  const amounts = calculateGst(19.99, 'inc', true);
  assert.equal(amounts.amount_inc_gst, 19.99);
  assert.equal(jobCostInputSchema.safeParse({ ...input, ...amounts }).success, true);
});

test('blank cost subtotals use the total and actual GST, with standard or GST-free defaults only when tax is missing', () => {
  assert.deepEqual(completeMissingCostSubtotal('', '110', '10', true), { amount_ex_gst: '100.00', gst_amount: '10' });
  assert.deepEqual(completeMissingCostSubtotal('', '110', '5', true), { amount_ex_gst: '105.00', gst_amount: '5' });
  assert.deepEqual(completeMissingCostSubtotal('', '110', '0', true), { amount_ex_gst: '110.00', gst_amount: '0' });
  assert.deepEqual(completeMissingCostSubtotal('', '110', '', true), { amount_ex_gst: '100.00', gst_amount: '10.00' });
  assert.deepEqual(completeMissingCostSubtotal('', '110', '', false), { amount_ex_gst: '110.00', gst_amount: '0.00' });
  assert.deepEqual(completeMissingCostSubtotal(' ', '19.99', '', true), { amount_ex_gst: '18.17', gst_amount: '1.82' });
  assert.deepEqual(completeMissingCostSubtotal('', '0', '0', true), { amount_ex_gst: '0.00', gst_amount: '0' });
  assert.deepEqual(completeMissingCostSubtotal('95', '110', '10', true), { amount_ex_gst: '95', gst_amount: '10' });
  assert.deepEqual(completeMissingCostSubtotal('0', '110', '10', true), { amount_ex_gst: '0', gst_amount: '10' });
  for (const [total, tax] of [['', ''], ['bad', '10'], ['-110', '10'], ['110', 'bad'], ['110', '-1'], ['10', '11'], ['Infinity', '0'], ['1e308', '']])
    assert.deepEqual(completeMissingCostSubtotal('', total, tax, true), { amount_ex_gst: '', gst_amount: tax });
  const completed = completeMissingCostSubtotal('', '110', '', true);
  assert.equal(jobCostInputSchema.safeParse({ ...input, amount_ex_gst: Number(completed.amount_ex_gst), gst_amount: Number(completed.gst_amount) }).success, true);
});

test('validation rejects invalid amounts, unreconciled GST, dates, categories and audit-field tampering', () => {
  for (const change of [
    { amount_ex_gst: -1 }, { amount_ex_gst: NaN }, { amount_inc_gst: Infinity },
    { amount_ex_gst: 100.001 }, { gst_amount: 0 }, { gst_applies: false },
    { amount_inc_gst: 120 }, { cost_date: '2026-02-30' }, { cost_date: 'not a date' },
    { category: 'Unknown' }, { status: 'paid' }, { job_id: 'bad' },
    { supplier: '  ' }, { description: '' }, { created_by: otherOwner },
  ]) {
    assert.equal(jobCostInputSchema.safeParse({ ...input, ...change }).success, false, JSON.stringify(change));
  }
  assert.equal(jobCostInputSchema.safeParse(input).success, true);
  assert.equal(jobCostInputSchema.safeParse({ ...input, ...calculateGst(100, 'ex', false), gst_applies: false }).success, true);
});

test('profitability uses one accepted quote, never adds variations twice or includes draft/cancelled invoices', () => {
  const [job] = summarizeJobs([project], [
    { id: 'old', project_id: jobId, status: 'approved', subtotal: 500, created_at: '2026-01-01' },
    { id: quoteId, project_id: jobId, status: 'approved', subtotal: 1000, created_at: '2026-02-01' },
    { id: 'draft', project_id: jobId, status: 'draft', subtotal: 9000, created_at: '2026-03-01' },
  ], [
    { project_id: jobId, status: 'paid', subtotal: 200 },
    { project_id: jobId, status: 'sent', subtotal: 300 },
    { project_id: jobId, status: 'overdue', subtotal: 100 },
    { project_id: jobId, status: 'cancelled', subtotal: 800 },
    { project_id: jobId, status: 'draft', subtotal: 10000 },
  ], [
    { project_id: jobId, status: 'approved', cost_impact: 50 },
    { project_id: jobId, status: 'pending', cost_impact: 900 },
  ], [cost, { ...cost, id: 'draft', status: 'draft', amount_ex_gst: 900 }]);
  assert.equal(job.quotedExGst, 1000);
  assert.equal(job.invoicedExGst, 600);
  assert.equal(job.approvedVariationsExGst, 50);
  assert.equal(job.confirmedCostsExGst, 100);
  assert.equal(job.draftCostsExGst, 900);
  assert.equal(job.costsByCategory.Materials, 100);
  assert.equal(job.costsByCategory.Labour, 0);
  assert.deepEqual(profitability(job, 'quoted'), { revenue: 1000, profit: 900, margin: 90, health: 'healthy' });
  assert.equal(profitability(job, 'invoiced').profit, 500);
});

test('margin thresholds handle zero, no accepted quote, low margin, boundary and loss', () => {
  const [base] = summarizeJobs([project], [], [], [], [cost]);
  assert.equal(profitability(base, 'quoted').revenue, null);
  assert.equal(profitability(base, 'quoted').margin, null);
  assert.equal(profitability(base, 'invoiced').profit, -100);
  assert.equal(profitability(base, 'invoiced').health, 'loss');
  assert.equal(profitability({ ...base, quotedExGst: 110 }, 'quoted').health, 'low');
  assert.equal(profitability({ ...base, quotedExGst: 1000, confirmedCostsExGst: 850 }, 'quoted').health, 'healthy');
  assert.equal(profitability({ ...base, quotedExGst: 99 }, 'quoted').health, 'loss');
});

test('GST-inclusive profitability uses recorded receipt totals including GST-free costs, without converting revenue', () => {
  const [job] = summarizeJobs([project], [
    { id: quoteId, project_id: jobId, status: 'approved', subtotal: 1000, created_at: '2026-01-01' },
  ], [{ project_id: jobId, status: 'sent', subtotal: 600 }], [], [
    cost,
    { ...cost, id: 'gst-free', amount_ex_gst: 50, gst_amount: 0, amount_inc_gst: 50, gst_applies: false },
    { ...cost, id: 'printed-tax', amount_ex_gst: 80, gst_amount: 4, amount_inc_gst: 84 },
    { ...cost, id: 'draft', status: 'draft', amount_ex_gst: 200, gst_amount: 20, amount_inc_gst: 220 },
    { ...cost, id: 'other-job', job_id: otherJob, amount_ex_gst: 999, amount_inc_gst: 1098.9 },
  ]);
  assert.equal(job.confirmedCostsExGst, 230);
  assert.equal(job.confirmedCostsIncGst, 244);
  assert.equal(job.draftCostsIncGst, 220);
  assert.equal(job.quotedExGst, 1000);
  assert.equal(job.invoicedExGst, 600);
  assert.deepEqual(profitability(job, 'quoted', 'inc-gst'), { revenue: 1000, profit: 756, margin: 75.6, health: 'healthy' });
  assert.equal(profitability(job, 'invoiced', 'inc-gst').profit, 356);
  assert.equal(profitability({ ...job, quotedExGst: 0 }, 'quoted', 'inc-gst').profit, -244);
  assert.equal(profitability({ ...job, quotedExGst: 0 }, 'quoted', 'inc-gst').margin, null);
  assert.equal(profitability({ ...job, quotedExGst: null }, 'quoted', 'inc-gst').profit, null);
});

test('per-job profit uses the current unapproved quote as an explicitly labelled estimate', () => {
  const [job] = summarizeJobs([{ ...project, active_quote_id: 'current' }], [
    { id: 'current', project_id: jobId, status: 'draft', subtotal: 500, created_at: '2026-01-01' },
    { id: 'other', project_id: jobId, status: 'sent', subtotal: 1200, created_at: '2026-02-01' },
    { id: 'declined', project_id: jobId, status: 'declined', subtotal: 9000, created_at: '2026-03-01' },
  ], [], [], [cost]);
  assert.equal(job.quotedExGst, 500);
  assert.equal(job.quoteIsEstimate, true);
  assert.equal(job.quoteStatus, 'draft');
  assert.equal(profitability(job, 'quoted').profit, 400);
  assert.equal(profitability(job, 'quoted').margin, 80);
});

test('approved revenue stays authoritative and quote alternatives are never added together', () => {
  const [job] = summarizeJobs([{ ...project, active_quote_id: 'draft' }], [
    { id: 'approved', project_id: jobId, status: 'approved', subtotal: 1000, created_at: '2026-01-01' },
    { id: 'draft', project_id: jobId, status: 'draft', subtotal: 8000, created_at: '2026-03-01' },
  ], [], [], [cost]);
  assert.equal(job.quotedExGst, 1000);
  assert.equal(job.quoteIsEstimate, false);
  assert.equal(job.quoteStatus, 'approved');
});

test('missing, declined and null-valued quotes are not mistaken for a valid zero quote', () => {
  const quote = { id: 'one', project_id: jobId, status: 'draft', subtotal: null as number | null, created_at: '2026-01-01' };
  const summarize = (quotes: typeof quote[]) => summarizeJobs([project], quotes, [], [], [cost])[0];
  assert.equal(summarize([quote]).quotedExGst, null);
  assert.equal(summarize([{ ...quote, status: 'declined', subtotal: 999 }]).quotedExGst, null);
  const zero = summarize([{ ...quote, subtotal: 0 }]);
  assert.equal(profitability(zero, 'quoted').profit, -100);
  assert.equal(profitability(zero, 'quoted').margin, null);
});

export function fakeDatabase(options: { missing?: boolean } = {}) {
  const tables: Record<string, any[]> = {
    projects: [project, { ...project, id: otherJob, user_id: otherOwner }],
    quotes: [{ id: quoteId, project_id: jobId, quote_number: 'Q-1', status: 'approved', subtotal: 1000, created_at: '2026-01-01' }],
    invoices: [{ id: 'i', project_id: jobId, status: 'sent', subtotal: 200 }],
    change_requests: [],
    quote_line_items: [{ id: itemId, quote_id: quoteId, title: 'Decking' }],
    scope_items: [],
    job_costs: [{ ...cost }, { ...cost, id: otherCost, job_id: otherJob, created_by: otherOwner }],
  };
  let storageCalls = 0;
  const files = new Map<string, Blob>();
  const schema = { scopeLinks: true };
  const fake = {
    auth: { getUser: async (token: string) => ({ data: { user: token === 'valid' ? { id: owner } : null }, error: null }) },
    storage: { from: () => ({
      createSignedUploadUrl: async () => { storageCalls++; return { data: { token: 'upload-test' }, error: null }; },
      createSignedUrl: async () => { storageCalls++; return { data: { signedUrl: 'https://example.test/receipt' }, error: null }; },
      download: async (path: string) => {
        storageCalls++;
        return { data: files.get(path) ?? new Blob([path.endsWith('.pdf') ? '%PDF-1.7\n' : new Uint8Array([0xff, 0xd8, 0xff, 0xd9])]), error: null };
      },
    }) },
    from(table: string) {
      let filters: [string, unknown][] = [];
      let inclusions: [string, unknown[]][] = [];
      let action = 'select';
      let selection = '*';
      let payload: any;
      let from = 0, to = Number.MAX_SAFE_INTEGER;
      const execute = () => {
        if (options.missing && table === 'job_costs')
          return { data: null, error: { code: 'PGRST205', message: 'Missing table' } };
        if (!schema.scopeLinks && table === 'job_costs' && (selection === 'scope_item_id' || payload?.scope_item_id !== undefined))
          return { data: null, error: { code: '42703', message: 'Missing scope_item_id column' } };
        const match = (row: any) => filters.every(([k, v]) => row[k] === v) && inclusions.every(([k, vs]) => vs.includes(row[k]));
        let data = (tables[table] ?? []).filter(match);
        if (action === 'insert') {
          const row = { ...payload, id: '99999999-9999-4999-8999-999999999999' };
          tables[table].push(row); data = [row];
        } else if (action === 'update') data.forEach(row => Object.assign(row, payload));
        else if (action === 'delete') tables[table] = tables[table].filter(row => !match(row));
        return { data: data.slice(from, to + 1), error: null };
      };
      const query: any = {
        select: (fields = '*') => { selection = fields; return query; },
        eq: (k: string, v: unknown) => { filters.push([k, v]); return query; },
        in: (k: string, v: unknown[]) => { inclusions.push([k, v]); return query; },
        order: () => query,
        range: (a: number, b: number) => { from = a; to = b; return query; },
        limit: (n: number) => { to = n - 1; return query; },
        insert: (v: unknown) => { action = 'insert'; payload = v; return query; },
        update: (v: unknown) => { action = 'update'; payload = v; return query; },
        delete: () => { action = 'delete'; return query; },
        single: async () => { const result = execute(); return { ...result, data: result.data?.[0] ?? null }; },
        maybeSingle: async () => { const result = execute(); return { ...result, data: result.data?.[0] ?? null }; },
        then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(execute()).then(resolve, reject),
      };
      return query;
    },
  };
  return { db: fake as unknown as SupabaseClient, tables, files, schema, storageCalls: () => storageCalls };
}

export async function withApi(run: (request: (path: string, method?: string, body?: unknown, token?: string | null) => Promise<{ status: number; body: any }>, fake: ReturnType<typeof fakeDatabase>) => Promise<void>, missing = false, extractReceipt?: ReceiptExtractor) {
  const fake = fakeDatabase({ missing });
  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use('/api', createJobCostRouter(() => fake.db, { extractReceipt }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  try {
    await run(async (path, method = 'GET', body, token = 'valid') => {
      const response = await fetch(url + path, {
        method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, body: await response.json() };
    }, fake);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

test('API requires a validated session and prevents cross-job read, edit, delete and receipt signing', async () => {
  await withApi(async (request, fake) => {
    assert.equal((await request(`/job-costs?jobId=${jobId}`, 'GET', undefined, null)).status, 401);
    assert.equal((await request(`/job-costs?jobId=${jobId}`, 'GET', undefined, 'invalid')).status, 401);
    assert.equal((await request(`/job-costs?jobId=${otherJob}`)).status, 404);
    assert.equal((await request(`/job-costs/${otherCost}`, 'PUT', { ...input, job_id: otherJob })).status, 404);
    assert.equal((await request(`/job-costs/${otherCost}`, 'PUT', input)).status, 404);
    assert.equal((await request(`/job-costs/${otherCost}`, 'DELETE')).status, 404);
    assert.equal((await request(`/job-costs/${otherCost}/receipt`)).status, 404);
    assert.equal((await request('/job-costs/receipt-upload', 'POST', { job_id: otherJob, content_type: 'image/jpeg', size: 100 })).status, 404);
    assert.equal(fake.tables.job_costs.length, 2);
    assert.equal(fake.storageCalls(), 0);
  });
});

test('API lists owned costs, creates, edits and deletes without changing quoting or invoicing', async () => {
  await withApi(async (request, fake) => {
    const quoteBefore = JSON.stringify(fake.tables.quotes);
    const invoicesBefore = JSON.stringify(fake.tables.invoices);
    const listed = await request(`/job-costs?jobId=${jobId}`);
    assert.equal(listed.status, 200);
    assert.equal(listed.body.costs.length, 1);
    assert.equal(listed.body.quoteLineItems[0].id, itemId);
    const created = await request('/job-costs', 'POST', input);
    assert.equal(created.status, 200);
    assert.equal(created.body.created_by, owner);
    const updated = await request(`/job-costs/${costId}`, 'PUT', { ...input, supplier: 'Updated', status: 'draft' });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.status, 'draft');
    assert.equal((await request(`/job-costs/${created.body.id}`, 'DELETE')).status, 200);
    assert.equal(fake.tables.job_costs.length, 2);
    assert.equal(JSON.stringify(fake.tables.quotes), quoteBefore);
    assert.equal(JSON.stringify(fake.tables.invoices), invoicesBefore);
  });
});

test('API validates forged fields, another job link, arbitrary receipt URLs and uploads', async () => {
  await withApi(async (request, fake) => {
    fake.tables.quotes.push({ id: otherJob, project_id: otherJob });
    fake.tables.quote_line_items.push({ id: otherCost, quote_id: otherJob, title: 'Another trade’s item' });
    for (const changed of [
      { created_by: otherOwner }, { amount_inc_gst: 999 }, { cost_date: '2026-02-30' },
      { quote_line_item_id: otherCost }, { receipt_image_url: 'https://evil.test/receipt.pdf' },
      { receipt_image_url: `${otherOwner}/${otherJob}/${costId}.pdf` },
    ]) assert.equal((await request('/job-costs', 'POST', { ...input, ...changed })).status, 400);
    assert.equal((await request('/job-costs/receipt-upload', 'POST', { job_id: jobId, content_type: 'text/html', size: 20 })).status, 400);
    assert.equal((await request('/job-costs/receipt-upload', 'POST', { job_id: jobId, content_type: 'image/jpeg', size: 11000000 })).status, 400);
    const upload = await request('/job-costs/receipt-upload', 'POST', { job_id: jobId, content_type: 'image/jpeg', size: 1024 });
    assert.equal(upload.status, 200);
    assert.match(upload.body.path, new RegExp(`^${owner}/${jobId}/[0-9a-f-]+\\.jpg$`));
    assert.equal(fake.storageCalls(), 1);
  });
});

test('reports paginate rather than dropping costs beyond the first response', async () => {
  await withApi(async (request, fake) => {
    fake.tables.job_costs = Array.from({ length: 1001 }, (_, i) => ({ ...cost, id: `cost-${i}` }));
    const report = await request('/job-profitability');
    assert.equal(report.status, 200);
    assert.equal(report.body[0].confirmedCostsExGst, 100100);
    const list = await request(`/job-costs?jobId=${jobId}`);
    assert.equal(list.status, 200);
    assert.equal(list.body.costs.length, 1001);
  });
});

test('API profitability is scoped to owned jobs and distinguishes absent setup from zero costs', async () => {
  await withApi(async request => {
    const report = await request('/job-profitability');
    assert.equal(report.status, 200);
    assert.equal(report.body.length, 1);
    assert.equal(report.body[0].jobId, jobId);
    assert.equal(report.body[0].confirmedCostsExGst, 100);
    assert.equal((await request(`/job-profitability?jobId=${otherJob}`)).status, 404);
  });
  await withApi(async request => {
    const list = await request(`/job-costs?jobId=${jobId}`);
    assert.equal(list.status, 503);
    assert.match(list.body.error, /migration/);
    assert.equal((await request('/job-profitability')).status, 503);
  }, true);
});
