import test from 'node:test';
import assert from 'node:assert/strict';
import { ClientPageEmailError, sendClientPageLink } from '../server/clientPageEmail';

const projectId = '20000000-0000-4000-8000-000000000001';
const capability = '30000000-0000-4000-8000-000000000001';
const request = {
  projectId, to: 'client@example.invalid', subject: 'Your project page',
  message: 'Hello, here is your project page.', sendCopy: false,
};
function fixture(options: { status?: string; sendError?: boolean; updateError?: boolean; missingProfile?: boolean; noProject?: boolean } = {}) {
  const calls: { table: string; filters: [string, unknown][]; update?: unknown }[] = [];
  const deliveries: { to: string; subject: string; html: string; bcc?: string[] }[] = [];
  const project = { id: projectId, user_id: 'owner', name: 'Synthetic <Job>', client_email: request.to, status: options.status ?? 'draft' };
  const db = {
    from(table: string) {
      const call = { table, filters: [] as [string, unknown][], update: undefined as unknown };
      calls.push(call);
      const query = {
        select(_columns: string) { return this; },
        eq(key: string, value: unknown) { call.filters.push([key, value]); return this; },
        update(value: unknown) { call.update = value; return this; },
        async maybeSingle() {
          if (table === 'profiles') return { data: options.missingProfile ? null : { email: 'owner@example.invalid' }, error: null };
          return { data: options.noProject || !call.filters.some(([key, value]) => key === 'user_id' && value === 'owner') ? null : project, error: null };
        },
        then(resolve: (value: unknown) => unknown) {
          if (!options.updateError && project.status === 'draft') project.status = 'sent';
          return Promise.resolve(resolve({ data: options.updateError ? null : [{ id: projectId }], error: options.updateError ? { message: 'Synthetic write failed' } : null }));
        },
      };
      return query;
    },
  };
  const dependencies = {
    db: db as unknown as Parameters<typeof sendClientPageLink>[2]['db'],
    baseUrl: 'https://fixture.example.invalid',
    async makeLink(id: string) { return `https://fixture.example.invalid/project/${id}?access=${capability}`; },
    async send(to: string, subject: string, html: string, bcc?: string[]) {
      if (options.sendError) throw new Error('Synthetic provider failure');
      deliveries.push({ to, subject, html, bcc });
      return { id: 'synthetic-message' };
    },
  };
  return { calls, deliveries, project, dependencies };
}

test('client page email is owner scoped, contains a capability and marks only a draft sent after delivery', async () => {
  const f = fixture();
  const result = await sendClientPageLink(request, 'owner', f.dependencies);
  assert.equal(result.success, true);
  assert.equal(result.markedSent, true);
  assert.equal(result.activityRecorded, false, 'No invented persistent activity log');
  assert.equal(f.project.status, 'sent');
  assert.match(f.deliveries[0].html, new RegExp(`access=${capability}`));
  assert.match(f.deliveries[0].html, /Synthetic &lt;Job&gt;/);
  assert.ok(f.calls.every(call => call.filters.some(([key, value]) => key === 'user_id' && value === 'owner')));
  assert.ok(f.calls.at(-1)?.filters.some(([key, value]) => key === 'status' && value === 'draft'));
});

test('email failure does not change job status or write activity', async () => {
  const f = fixture({ sendError: true });
  await assert.rejects(sendClientPageLink(request, 'owner', f.dependencies), (error: unknown) =>
    error instanceof ClientPageEmailError && error.status === 502);
  assert.equal(f.project.status, 'draft');
  assert.equal(f.calls.some(call => call.update), false);
});

test('sending existing sent, in-progress and completed jobs does not change status', async () => {
  for (const status of ['sent', 'in_progress', 'completed']) {
    const f = fixture({ status });
    const result = await sendClientPageLink(request, 'owner', f.dependencies);
    assert.equal(result.markedSent, false);
    assert.equal(f.project.status, status);
    assert.equal(f.calls.some(call => call.update), false);
  }
});

test('a different recipient requires explicit confirmation; case-only differences do not', async () => {
  const f = fixture();
  await assert.rejects(sendClientPageLink({ ...request, to: 'other@example.invalid' }, 'owner', f.dependencies), /Confirm sending/);
  assert.equal(f.deliveries.length, 0);
  await sendClientPageLink({ ...request, to: 'other@example.invalid', confirmDifferentRecipient: true }, 'owner', f.dependencies);
  assert.equal(f.deliveries.at(-1)?.to, 'other@example.invalid');
  const second = fixture();
  await sendClientPageLink({ ...request, to: 'CLIENT@example.invalid' }, 'owner', second.dependencies);
  assert.equal(second.deliveries.length, 1);
});

test('copy uses the authenticated owner profile, not a browser-supplied copy address', async () => {
  const f = fixture();
  const result = await sendClientPageLink({ ...request, sendCopy: true }, 'owner', f.dependencies);
  assert.equal(result.copySent, true);
  assert.deepEqual(f.deliveries[0].bcc, ['owner@example.invalid']);
  const missing = fixture({ missingProfile: true });
  await assert.rejects(sendClientPageLink({ ...request, sendCopy: true }, 'owner', missing.dependencies), /business email is unavailable/);
  assert.equal(missing.deliveries.length, 0);
});

test('unknown fields, invalid email, blank message and header injection are rejected before sending', async () => {
  for (const changes of [{ to: 'bad' }, { subject: 'Hello\r\nBcc: attacker@example.invalid' },
    { message: '' }, { clientUrl: 'https://other.example.invalid' }, { bcc: ['other@example.invalid'] }]) {
    const f = fixture();
    await assert.rejects(sendClientPageLink({ ...request, ...changes }, 'owner', f.dependencies), /valid recipient/);
    assert.equal(f.deliveries.length, 0);
  }
});

test('unauthenticated or cross-owner calls cannot send a client link', async () => {
  const f = fixture();
  await assert.rejects(sendClientPageLink(request, '', f.dependencies), /sign in/);
  await assert.rejects(sendClientPageLink(request, 'not-owner', f.dependencies), /access denied/);
  assert.equal(f.deliveries.length, 0);
});

test('message HTML is escaped and the generated URL must contain a separate valid capability', async () => {
  const f = fixture();
  await sendClientPageLink({ ...request, message: '<script>alert("no")</script>' }, 'owner', f.dependencies);
  assert.doesNotMatch(f.deliveries[0].html, /<script>/);
  assert.match(f.deliveries[0].html, /&lt;script&gt;/);
  for (const url of [`https://fixture.example.invalid/project/${projectId}`, `https://other.example.invalid/project/${projectId}?access=${capability}`]) {
    const invalid = fixture();
    invalid.dependencies.makeLink = async () => url;
    await assert.rejects(sendClientPageLink(request, 'owner', invalid.dependencies), /secure client link/);
    assert.equal(invalid.deliveries.length, 0);
  }
});

test('a status write failure after successful delivery returns a warning rather than inviting duplicate sending', async () => {
  const f = fixture({ updateError: true });
  const result = await sendClientPageLink(request, 'owner', f.dependencies);
  assert.equal(result.success, true);
  assert.equal(result.markedSent, false);
  assert.match(result.warning ?? '', /email was sent/);
  assert.equal(f.deliveries.length, 1);
});
