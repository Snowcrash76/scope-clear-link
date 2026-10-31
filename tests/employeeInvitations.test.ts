import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveInvitationAccount, assertInvitationAccountEligible, deliverEmployeeInvitation, cleanupRejectedInvitationAccount } from '../server/employeeInvitations';

function fixture(options: { existingEmail?: string; authError?: boolean; createError?: boolean } = {}) {
  const calls: { create: unknown[]; get: string[] } = { create: [], get: [] };
  const db = { auth: {
    admin: { async createUser(input: unknown) {
      calls.create.push(input);
      return options.createError ? { data: { user: null }, error: { message: 'Already registered', code: 'email_exists', status: 422 } }
        : { data: { user: { id: 'new-invited-user' } }, error: null };
    } },
    async getUser(token: string) {
      calls.get.push(token);
      return options.authError ? { data: { user: null }, error: new Error('Expired') }
        : { data: { user: { id: 'existing-user', email: options.existingEmail } }, error: null };
    },
  } } as unknown as Parameters<typeof resolveInvitationAccount>[0];
  return { db, calls };
}

test('new-password invitation ignores an unrelated or expired browser session', async () => {
  for (const authError of [false, true]) {
    const { db, calls } = fixture({ existingEmail: 'owner@example.test', authError });
    assert.deepEqual(await resolveInvitationAccount(db, {
      email: 'invited@example.test', password: 'synthetic-test-password', authorization: 'Bearer unrelated-session',
    }), { userId: 'new-invited-user', created: true });
    assert.deepEqual(calls.get, []);
    assert.deepEqual(calls.create, [{
      email: 'invited@example.test', password: 'synthetic-test-password', email_confirm: true,
    }]);
  }
});

test('anonymous invitees can still create their invited account', async () => {
  const { db } = fixture();
  assert.equal((await resolveInvitationAccount(db, {
    email: 'invited@example.test', password: 'synthetic-test-password',
  })).created, true);
});

test('an existing account is not reset or accepted using a newly entered password', async () => {
  const { db, calls } = fixture({ createError: true, existingEmail: 'invited@example.test' });
  await assert.rejects(resolveInvitationAccount(db, {
    email: 'invited@example.test', password: 'synthetic-test-password', authorization: 'Bearer existing-session',
  }), { status: 409 });
  assert.deepEqual(calls.get, []);
});

test('existing-account acceptance requires the invited email and never creates an account', async () => {
  const { db, calls } = fixture({ existingEmail: 'INVITED@example.test' });
  assert.deepEqual(await resolveInvitationAccount(db, {
    email: 'invited@example.test', authorization: 'Bearer correct-session',
  }), { userId: 'existing-user', created: false });
  assert.deepEqual(calls.create, []);
});

test('wrong-account and expired sessions cannot accept an existing-account invitation', async () => {
  for (const options of [{ existingEmail: 'owner@example.test' }, { authError: true }]) {
    const { db, calls } = fixture(options);
    await assert.rejects(resolveInvitationAccount(db, {
      email: 'invited@example.test', authorization: 'Bearer invalid-session',
    }), { status: 403 });
    assert.deepEqual(calls.create, []);
  }
});

test('existing-account acceptance without a session still requires sign-in', async () => {
  const { db, calls } = fixture();
  await assert.rejects(resolveInvitationAccount(db, { email: 'invited@example.test' }), { status: 400 });
  assert.deepEqual(calls.create, []);
  assert.deepEqual(calls.get, []);
});

test('auth outages and password policy failures are not misreported as existing accounts', async () => {
  for (const [failure, status, code] of [
    [{ message: 'Service unavailable', status: 500 }, 503, 'ACCOUNT_SETUP_UNAVAILABLE'],
    [{ message: 'Weak password', status: 422, code: 'weak_password' }, 400, 'WEAK_PASSWORD'],
    [{ message: 'Too many requests', status: 429 }, 429, 'AUTH_RATE_LIMIT'],
  ] as const) {
    const db = { auth: { admin: { createUser: async () => ({ data: { user: null }, error: failure }) } } };
    await assert.rejects(resolveInvitationAccount(db as any, { email: 'staff@example.invalid', password: 'synthetic-password' }), { status, code });
  }
});

test('business-owning accounts are explained without deleting jobs or converting roles', async () => {
  for (const owned of ['projects', 'employees', null]) {
    const calls: string[] = [];
    const db = { from: (table: string) => {
      calls.push(table);
      const q = { select: () => q, eq: () => q, limit: async () => ({ data: table === owned ? [{ id: 'owned' }] : [], error: null }) };
      return q;
    } };
    if (owned) await assert.rejects(assertInvitationAccountEligible(db as any, 'existing'), { status: 409, code: 'BUSINESS_OWNER_ACCOUNT' });
    else await assertInvitationAccountEligible(db as any, 'existing');
    assert.deepEqual(calls.sort(), ['employees', 'projects']);
  }
  await assert.rejects(assertInvitationAccountEligible({} as any, 'owner', 'owner'), { code: 'BUSINESS_OWNER_ACCOUNT' });
});

test('email outcomes are explicit and prepared links survive delivery failure or uncertainty', async () => {
  const input = { email: 'staff@example.invalid', from: 'Test <test@example.invalid>', url: 'https://example.invalid/employee/accept?token=synthetic-only', key: 'synthetic-test-key', idempotencyKey: 'synthetic-operation' };
  await deliverEmployeeInvitation(input, (async (_url, options) => {
    assert.equal((options?.headers as any)['Idempotency-Key'], 'synthetic-operation');
    assert.ok(options?.signal);
    return new Response(JSON.stringify({ id: 'fixture-email' }), { status: 200 });
  }) as typeof fetch);
  for (const failure of [429, 403, 500, 'network']) {
    const send = (async () => { if (failure === 'network') throw new Error('network'); return new Response('{}', { status: failure as number }); }) as typeof fetch;
    await assert.rejects(deliverEmployeeInvitation(input, send), (error: any) => {
      assert.equal(error.status, 502);
      assert.equal(error.details.invitation_url, input.url);
      assert.equal(error.details.delivery, failure === 'network' ? 'unknown' : 'failed');
      assert.ok(!error.message.includes(input.key));
      return true;
    });
  }
});

test('cleanup never deletes an accepted account or an account with an uncertain acceptance outcome', async () => {
  const deleted: string[] = [];
  let linked = false, unreadable = false;
  const db = { auth: { admin: { deleteUser: async (id: string) => { deleted.push(id); return { error: null }; } } }, from: () => {
    const q = { select: () => q, eq: () => q, limit: async () => ({ data: linked ? [{ id: 'member' }] : [], error: unreadable ? { code: 'network' } : null }) }; return q;
  } };
  await cleanupRejectedInvitationAccount(db as any, 'fresh', false);
  assert.deepEqual(deleted, []);
  linked = true;
  await cleanupRejectedInvitationAccount(db as any, 'fresh', true);
  assert.deepEqual(deleted, []);
  linked = false; unreadable = true;
  await cleanupRejectedInvitationAccount(db as any, 'fresh', true);
  assert.deepEqual(deleted, []);
  unreadable = false;
  await cleanupRejectedInvitationAccount(db as any, 'fresh', true);
  assert.deepEqual(deleted, ['fresh']);
});
