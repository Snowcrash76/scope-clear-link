import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { composeDirectory } from '../server/platformDirectory';
import { createPlatformRouter } from '../server/platformRoutes';
import { assertPlatformAccess, platformApiFence } from '../server/platformAccess';

const root = '90000000-0000-4000-8000-000000000001', owner = '90000000-0000-4000-8000-000000000002', staff = '90000000-0000-4000-8000-000000000003';
test('platform directory separates actual auth accounts, business ownership and email-matching unlinked memberships', () => {
  const data = composeDirectory({
    ready: false, users: [{ id: owner, email: 'owner@example.invalid', created_at: '2026-01-01' }, { id: staff, email: 'staff@example.invalid', created_at: '2026-01-01' }],
    profiles: [{ user_id: owner, business_name: 'Example business' }, { user_id: staff, business_name: '' }],
    employees: [{ id: 'member', owner_id: owner, auth_user_id: staff, email: 'staff@example.invalid', name: 'Staff', role: 'admin', active: true },
      { id: 'retired', owner_id: owner, auth_user_id: null, email: 'STAFF@example.invalid', name: 'Retired', role: 'labourer', active: false, archived_at: '2026-01-01' }],
    projects: [{ id: 'job', user_id: owner }], quotes: [{ id: 'quote', project_id: 'job' }], invoices: [],
    invitations: [{ employee_id: 'retired', created_at: '2026-01-01', expires_at: '2026-01-02', accepted_at: null }], controls: [],
  });
  assert.equal(data.accounts.length, 2); assert.equal(data.businesses.length, 1);
  assert.deepEqual(data.accounts.find(a => a.id === staff)?.membershipIds, ['member']);
  assert.equal(data.memberships[1].accountId, null);
  assert.equal(data.memberships[1].invitation, 'expired');
  assert.equal(data.businesses[0].quoteCount, 1);
  assert.equal(data.deletionPolicy, 'history_preserving_only');
});
test('access checks fail closed on errors or partial setup and allow only a wholly absent pre-migration feature', async () => {
  const db = (rpc: any, table: any) => ({
    rpc: async () => rpc,
    from: () => ({ select() { return this; }, limit: async () => table }),
  }) as any;
  await assert.rejects(assertPlatformAccess(db({ data: false, error: null }, {}), owner), { status: 403 });
  await assert.rejects(assertPlatformAccess(db({ error: { code: 'network' } }, {}), owner), { status: 503 });
  await assert.rejects(assertPlatformAccess(db({ error: { code: 'PGRST202' } }, { error: null }), owner), { status: 503 });
  await assertPlatformAccess(db({ error: { code: 'PGRST202' } }, { error: { code: 'PGRST205' } }), owner);
});
test('real admin routes deny ordinary owners/team admins, gate setup, and audit reset outcomes without changing passwords', async () => {
  const oldAdmin = process.env.ADMIN_EMAIL, oldBase = process.env.VITE_PUBLIC_BASE_URL;
  process.env.ADMIN_EMAIL = 'root@example.invalid'; process.env.VITE_PUBLIC_BASE_URL = 'https://example.invalid';
  let configured = true, restricted = false, resetFailure = false, resetRequests = 0, releaseAllowed = true;
  const events: any[] = [];
  const accounts = [{ id: root, email: 'ROOT@example.invalid' }, { id: owner, email: 'owner@example.invalid' }, { id: staff, email: 'staff@example.invalid' }];
  const db: any = {
    auth: {
      getUser: async (token: string) => ({ data: { user: accounts.find(a => a.id === token) || null }, error: null }),
      admin: { getUserById: async (id: string) => ({ data: { user: accounts.find(a => a.id === id) }, error: null }) },
      resetPasswordForEmail: async (email: string, options: any) => {
        resetRequests++; assert.equal(email, 'owner@example.invalid'); assert.equal(options.redirectTo, 'https://example.invalid/reset-password');
        return { error: resetFailure ? { status: 400, message: 'synthetic provider failure' } : null };
      },
    },
    from(table: string) {
      const q: any = {
        select() { return q; }, eq() { return q; }, gte() { return q; }, order() { return q; }, limit() { return q; },
        then(done: any) { return Promise.resolve(table === 'platform_controls'
          ? { data: [], error: configured ? null : { code: 'PGRST205' } }
          : { data: events, count: events.length, error: null }).then(done); },
      }; return q;
    },
    rpc: async (name: string, args: any) => {
      if (name === 'platform_check_access') return { data: !restricted, error: null };
      if (name === 'platform_record_event') {
        events.push({ id: 'event', actor: args.p_actor, action: args.p_action, outcome: args.p_outcome });
        return { data: 'event', error: null };
      }
      if (name === 'platform_finish_event') { events.at(-1).outcome = args.p_outcome; return { error: null }; }
      throw Error(`Unexpected fixture RPC ${name}`);
    },
  };
  const app = express(); app.use(express.json()); app.use('/api', platformApiFence(() => db));
  app.use('/api', createPlatformRouter(() => db, async () => releaseAllowed)); app.get('/api/protected', (_req, res) => res.json({ allowed: true }));
  const server = app.listen(0); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  const request = (path: string, actor = root, body?: any) => fetch(`${base}/api${path}`, {
    method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${actor}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  try {
    assert.equal((await request('/platform/session')).status, 200);
    assert.equal((await request('/platform/session', owner)).status, 403);
    assert.equal((await request('/platform/session', staff)).status, 403);
    assert.equal((await request('/platform/session', 'forged')).status, 401);
    restricted = true; assert.equal((await request('/protected', owner)).status, 403); restricted = false;
    const action = { action: 'password_reset', reason: 'Synthetic support request', confirmation: 'owner@example.invalid' };
    configured = false; assert.equal((await request(`/platform/accounts/${owner}/action`, root, action)).status, 503); assert.equal(resetRequests, 0);
    configured = true;
    releaseAllowed = false;
    assert.equal((await request(`/platform/accounts/${owner}/action`, root, action)).status, 503);
    assert.equal(resetRequests, 0);
    releaseAllowed = true;
    assert.equal((await request(`/platform/accounts/${owner}/action`, root, { ...action, confirmation: 'wrong@example.invalid' })).status, 400);
    assert.equal((await request(`/platform/accounts/${owner}/action`, root, action)).status, 200);
    assert.equal(resetRequests, 1); assert.equal(events[0].outcome, 'accepted'); assert.equal(events[0].actor, root);
    resetFailure = true;
    assert.equal((await request(`/platform/accounts/${owner}/action`, root, action)).status, 502);
    assert.equal(events[1].outcome, 'failed');
    assert.equal((await request(`/platform/accounts/${root}/action`, root, { ...action, confirmation: 'root@example.invalid' })).status, 409);
    assert.equal(events.length, 2);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    if (oldAdmin === undefined) delete process.env.ADMIN_EMAIL; else process.env.ADMIN_EMAIL = oldAdmin;
    if (oldBase === undefined) delete process.env.VITE_PUBLIC_BASE_URL; else process.env.VITE_PUBLIC_BASE_URL = oldBase;
  }
});
