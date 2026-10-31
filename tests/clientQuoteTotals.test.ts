import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { createClientAccessRouter } from '../server/clientAccess';

const pid = '20000000-0000-4000-8000-000000000001';
const qid = '30000000-0000-4000-8000-000000000001';
const changeId = '40000000-0000-4000-8000-000000000001';
const projectToken = '50000000-0000-4000-8000-000000000001';
const quoteToken = '60000000-0000-4000-8000-000000000001';

async function withClient(action: (request: (id: string, status: string, token?: string, quoteAccess?: boolean) => Promise<any>, tables: any) => Promise<void>) {
  const quote = { id: qid, project_id: pid, subtotal: 1200, tax_rate: 10, tax_amount: 120,
    total: 1320, updated_at: '2026-10-30', approved_at: '2026-10-29', status: 'approved', quote_token: quoteToken };
  const tables: Record<string, any[]> = {
    projects: [{ id: pid, user_id: 'owner', client_access_token: projectToken, active_quote_id: qid }],
    quotes: [quote, { ...quote, id: 'old-quote', quote_token: 'old-token', subtotal: 900, total: 990,
      approved_at: '2025-01-02', updated_at: '2025-01-01' }],
    scope_items: [{ id: 'scope', project_id: pid, title: 'Base scope', category: 'included', cost: 1000 }],
    quote_line_items: [{ id: 'line', quote_id: qid, title: 'Base line', cost: 200, is_variation: false }],
    change_requests: [{ id: changeId, project_id: pid, title: 'Extra', status: 'pending', cost_impact: 100 }],
  };
  const db: any = {
    auth: { getUser() { throw new Error('Client approvals must not require a signed-in user'); } },
    from(table: string) {
      let rows = tables[table] ?? [];
      let patch: any;
      let single = false;
      let offset = 0;
      let end = Infinity;
      const query: any = {
        select() { return query; },
        eq(key: string, value: any) { rows = rows.filter(row => row[key] === value); return query; },
        in(key: string, values: any[]) { rows = rows.filter(row => values.includes(row[key])); return query; },
        filter(key: string, op: string, value: string) {
          assert.equal(op, 'eq'); return query.eq(key, value);
        },
        order() { return query; },
        range(start: number, last: number) { offset = start; end = last; return query; },
        single() { single = true; return query; },
        maybeSingle() { single = true; return query; },
        update(body: any) { patch = body; return query; },
        then(resolve: any, reject: any) {
          return Promise.resolve().then(() => {
            if (patch) rows.forEach(row => Object.assign(row, patch));
            const data = rows.slice(offset, end + 1).map(row => ({ ...row }));
            return { data: single ? data[0] ?? null : data, error: null };
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const app = express();
  app.use(express.json());
  app.use('/api', createClientAccessRouter(() => db));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const port = (server.address() as AddressInfo).port;
  try {
    await action(async (id, status, token = projectToken, quoteAccess = false) => {
      const response = await fetch(`http://127.0.0.1:${port}/api/client/data/change_requests?id=eq.${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json',
          [quoteAccess ? 'X-Client-Quote-Token' : 'X-Client-Project-Token']: token },
        body: JSON.stringify({ status }),
      });
      return { status: response.status, body: await response.json() };
    }, tables);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

test('project-token client approval stores correct active totals without sign-in and preserves historical quotes', async () => {
  await withClient(async (request, tables) => {
    const oldQuote = { ...tables.quotes[1] };
    const decision = tables.quotes[0].approved_at;
    assert.equal((await request(changeId, 'approved')).status, 200);
    assert.equal(tables.change_requests[0].status, 'approved');
    assert.equal(tables.quotes[0].subtotal, 1300);
    assert.equal(tables.quotes[0].tax_amount, 130);
    assert.equal(tables.quotes[0].total, 1430);
    assert.equal(tables.quotes[0].status, 'approved');
    assert.equal(tables.quotes[0].approved_at, decision);
    assert.deepEqual(tables.quotes[1], oldQuote);
    assert.equal((await request(changeId, 'approved')).status, 409);
    assert.equal(tables.quotes[0].total, 1430, 'a replay cannot double count the variation');
  });
});

test('quote-token client approval also updates the project active quote', async () => {
  await withClient(async (request, tables) => {
    assert.equal((await request(changeId, 'approved', quoteToken, true)).status, 200);
    assert.equal(tables.quotes[0].total, 1430);
  });
});

test('declined variations do not increase totals', async () => {
  await withClient(async (request, tables) => {
    assert.equal((await request(changeId, 'declined')).status, 200);
    assert.equal(tables.quotes[0].total, 1320);
  });
});

test('invalid capabilities and cross-project requests cannot change totals', async () => {
  await withClient(async (request, tables) => {
    const before = JSON.stringify(tables);
    assert.equal((await request(changeId, 'approved', '70000000-0000-4000-8000-000000000001')).status, 403);
    tables.change_requests.push({ id: 'private-change', project_id: 'other-project', status: 'pending', cost_impact: 999 });
    assert.equal((await request('private-change', 'approved')).status, 409);
    tables.change_requests.pop();
    assert.equal(JSON.stringify(tables), before);
  });
});
