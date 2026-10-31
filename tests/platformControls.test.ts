import test from 'node:test';
import assert from 'node:assert/strict';
import { platformReleaseReady, platformBuild } from '../server/platformAccess';
import { deliverPlatformRecovery } from '../server/platformRecovery';
import { deletePlatformIdentity } from '../server/platformDeletion';

test('published admin actions never depend on a self-HTTP request', async () => {
  let calls = 0;
  assert.equal(await platformReleaseReady((async () => { calls++; throw Error('self request queued'); }) as any, '1'), true);
  assert.equal(calls, 0);
});
test('preview still requires the current published access-control contract', async () => {
  assert.equal(await platformReleaseReady((async () => new Response(JSON.stringify({ build: platformBuild }))) as any, ''), true);
  assert.equal(await platformReleaseReady((async () => new Response(JSON.stringify({ build: 'old' }))) as any, ''), false);
});
test('recovery uses a server-generated link and configured email delivery, not restricted default SMTP', async () => {
  const db = { auth: { admin: { generateLink: async (args: any) => {
    assert.equal(args.type, 'recovery');
    assert.equal(args.options.redirectTo, 'https://example.invalid/reset-password');
    return { data: { properties: { action_link: 'https://example.invalid/auth/verify?token=synthetic-only&type=recovery' } }, error: null };
  } } } } as any;
  await deliverPlatformRecovery(db, 'recipient@example.invalid', 'https://example.invalid/reset-password', 'event', {
    apiKey: 'synthetic-not-a-real-key', from: 'ScopeStream <mail@example.invalid>',
    send: (async (_url, options: any) => {
      assert.equal(options.headers['Idempotency-Key'], 'platform-recovery-event');
      const body = JSON.parse(options.body);
      assert.deepEqual(body.to, ['recipient@example.invalid']);
      assert.match(body.html, /Choose a new password/);
      return new Response('{}', { status: 200 });
    }) as any,
  });
  await assert.rejects(deliverPlatformRecovery(db, 'recipient@example.invalid', 'https://example.invalid/reset-password', 'event', {
    apiKey: 'synthetic', from: 'mail@example.invalid', send: (async () => { throw Error('network'); }) as any,
  }), { outcome: 'unconfirmed' });
});
function deletionDb(options: { completed?: boolean; authDeleted?: boolean; providerFails?: boolean; finishFails?: boolean } = {}) {
  const calls: any[] = [];
  const db: any = {
    from: () => ({ select() { return this; }, limit: async () => ({ error: null }) }),
    auth: { admin: { deleteUser: async (id: string, soft: boolean) => {
      calls.push({ provider: id, soft }); return { error: options.providerFails ? { message: 'synthetic' } : null };
    } } },
    rpc: async (name: string, args: any) => {
      calls.push({ name, args });
      if (name === 'platform_prepare_deletion') return { data: { completed: options.completed, authDeleted: options.authDeleted, eventId: 'event' }, error: null };
      return { data: args.p_success, error: options.finishFails ? { code: 'network' } : null };
    },
  };
  return { db, calls };
}
test('account deletion soft-deletes Auth only and completes via audited SQL', async () => {
  const { db, calls } = deletionDb();
  const result = await deletePlatformIdentity(db, 'actor', 'account', 'target', { reason: 'Synthetic reason', confirmation: 'test@example.invalid' });
  assert.equal(result.success, true);
  assert.deepEqual(calls[1], { provider: 'target', soft: true });
  assert.equal(calls[2].args.p_success, true);
});
test('business deletion never deletes staff authentication accounts', async () => {
  const { db, calls } = deletionDb({ completed: true });
  await deletePlatformIdentity(db, 'actor', 'business', 'target', { reason: 'Synthetic reason', confirmation: 'test@example.invalid' });
  assert.equal(calls.length, 1);
});
test('uncertain account deletion remains blocked and explicitly retryable', async () => {
  const { db, calls } = deletionDb({ providerFails: true });
  await assert.rejects(deletePlatformIdentity(db, 'actor', 'account', 'target', { reason: 'Synthetic reason', confirmation: 'test@example.invalid' }), /Retry deletion/);
  assert.equal(calls.at(-1).args.p_success, false);
});
test('retry after Auth deletion finishes the same attempt without repeating provider deletion', async () => {
  const { db, calls } = deletionDb({ authDeleted: true });
  await deletePlatformIdentity(db, 'actor', 'account', 'target', { reason: 'Synthetic reason', confirmation: 'test@example.invalid' });
  assert.equal(calls.some(c => c.provider), false);
});
test('an unconfirmed completion never claims deletion succeeded', async () => {
  const { db } = deletionDb({ finishFails: true });
  await assert.rejects(deletePlatformIdentity(db, 'actor', 'account', 'target', {
    reason: 'Synthetic reason', confirmation: 'test@example.invalid',
  }), /Refresh the directory to check the current access state/);
});
