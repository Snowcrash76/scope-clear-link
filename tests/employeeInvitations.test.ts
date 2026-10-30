import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveInvitationAccount } from '../server/employeeInvitations';

function fixture(options: { existingEmail?: string; authError?: boolean; createError?: boolean } = {}) {
  const calls: { create: unknown[]; get: string[] } = { create: [], get: [] };
  const db = { auth: {
    admin: { async createUser(input: unknown) {
      calls.create.push(input);
      return options.createError ? { data: { user: null }, error: new Error('Already registered') }
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
