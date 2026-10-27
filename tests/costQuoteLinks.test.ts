import test from 'node:test';
import assert from 'node:assert/strict';
import { withApi } from './jobCosting.test';

const jobId = '33333333-3333-4333-8333-333333333333';
const otherJob = '44444444-4444-4444-8444-444444444444';
const scopeId = '12121212-1212-4212-8212-121212121212';
const otherScopeId = '34343434-3434-4343-8343-343434343434';
const excludedId = '56565656-5656-4565-8565-565656565656';
const quoteItemId = '88888888-8888-4888-8888-888888888888';
const payload = {
  job_id: jobId, supplier: 'Supplier', description: 'Building materials', cost_date: '2026-10-27',
  category: 'Materials', amount_ex_gst: 100, gst_amount: 10, amount_inc_gst: 110,
  gst_applies: true, status: 'draft', quote_line_item_id: null, scope_item_id: scopeId,
};

test('quote with included work but no separate line items lists selectable work and saves the cost link without changing the quote', async () => {
  await withApi(async (request, fake) => {
    fake.tables.quote_line_items = [];
    fake.tables.scope_items = [{ id: scopeId, project_id: jobId, category: 'included', title: 'Quoted building work' }];
    const originalQuotes = JSON.stringify(fake.tables.quotes);
    const originalScope = JSON.stringify(fake.tables.scope_items);
    const list = await request(`/job-costs?jobId=${jobId}`);
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.quoteLineItems, [{ id: scopeId, title: 'Quoted building work', source: 'scope', quote_number: 'Q-1' }]);
    assert.equal(list.body.scopeLinkSetupRequired, false);
    const saved = await request('/job-costs', 'POST', payload);
    assert.equal(saved.status, 200);
    assert.equal(saved.body.scope_item_id, scopeId);
    assert.equal(saved.body.quote_line_item_id, null);
    const reloaded = await request(`/job-costs?jobId=${jobId}`);
    assert.equal(reloaded.body.costs.find((cost: any) => cost.id === saved.body.id).scope_item_id, scopeId);
    assert.equal(JSON.stringify(fake.tables.quotes), originalQuotes);
    assert.equal(JSON.stringify(fake.tables.scope_items), originalScope);
  });
});

test('cost links can switch between included work and quote lines and can be removed', async () => {
  await withApi(async (request, fake) => {
    fake.tables.scope_items = [{ id: scopeId, project_id: jobId, category: 'included', title: 'Work' }];
    const created = await request('/job-costs', 'POST', payload);
    assert.equal(created.status, 200);
    const url = `/job-costs/${created.body.id}`;
    const quoteLink = await request(url, 'PUT', { ...payload, scope_item_id: null, quote_line_item_id: quoteItemId });
    assert.equal(quoteLink.status, 200);
    assert.equal(quoteLink.body.scope_item_id, null);
    assert.equal(quoteLink.body.quote_line_item_id, quoteItemId);
    const scopeLink = await request(url, 'PUT', payload);
    assert.equal(scopeLink.status, 200);
    assert.equal(scopeLink.body.quote_line_item_id, null);
    assert.equal(scopeLink.body.scope_item_id, scopeId);
    const removed = await request(url, 'PUT', { ...payload, scope_item_id: null });
    assert.equal(removed.status, 200);
    assert.equal(removed.body.scope_item_id, null);
    assert.equal(removed.body.quote_line_item_id, null);
  });
});

test('links reject another job, excluded or missing work and conflicting quote targets', async () => {
  await withApi(async (request, fake) => {
    fake.tables.scope_items = [
      { id: scopeId, project_id: jobId, category: 'included', title: 'Work' },
      { id: otherScopeId, project_id: otherJob, category: 'included', title: 'Private work' },
      { id: excludedId, project_id: jobId, category: 'excluded', title: 'Excluded work' },
    ];
    const before = fake.tables.job_costs.length;
    for (const changes of [
      { scope_item_id: otherScopeId }, { scope_item_id: excludedId }, { scope_item_id: quoteItemId },
      { quote_line_item_id: quoteItemId },
    ]) assert.equal((await request('/job-costs', 'POST', { ...payload, ...changes })).status, 400);
    assert.equal(fake.tables.job_costs.length, before);
    const list = await request(`/job-costs?jobId=${jobId}`);
    assert.ok(list.body.quoteLineItems.some((item: any) => item.source === 'quote' && item.id === quoteItemId));
    assert.ok(list.body.quoteLineItems.some((item: any) => item.source === 'scope' && item.id === scopeId));
    assert.ok(!list.body.quoteLineItems.some((item: any) => [otherScopeId, excludedId].includes(item.id)));
  });
});

test('missing link migration gives setup guidance while existing manual costs still work', async () => {
  await withApi(async (request, fake) => {
    fake.schema.scopeLinks = false;
    fake.tables.scope_items = [{ id: scopeId, project_id: jobId, category: 'included', title: 'Work' }];
    const list = await request(`/job-costs?jobId=${jobId}`);
    assert.equal(list.status, 200);
    assert.equal(list.body.scopeLinkSetupRequired, true);
    assert.ok(list.body.quoteLineItems.some((item: any) => item.id === scopeId));
    const linked = await request('/job-costs', 'POST', payload);
    assert.equal(linked.status, 503);
    assert.match(linked.body.error, /needs database setup/);
    const { scope_item_id, ...manualCost } = payload;
    assert.equal((await request('/job-costs', 'POST', manualCost)).status, 200);
  });
});
