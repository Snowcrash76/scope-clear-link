import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { cleanDeletedFiles, createResourceDeletionRouter } from '../server/resourceDeletion';

const owner = '10000000-0000-4000-8000-000000000001';
const id = '20000000-0000-4000-8000-000000000001';

test('deletion API authenticates, requires confirmation, and never trusts a body actor', async () => {
  const calls: any[] = [];
  const db = {
    auth: { getUser: async (token: string) => ({ data: { user: token === 'valid' ? { id: owner } : null }, error: token === 'valid' ? null : {} }) },
    rpc: async (name: string, args: any) => { calls.push([name, args]); return { data: { deleted: true, recordsDeleted: 2 }, error: null }; },
  } as any;
  const app = express();
  app.use(express.json(), createResourceDeletionRouter(() => db));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as any).port}`;
  try {
    const request = (body: unknown, token?: string) => fetch(`${base}/owner/delete-resource`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    assert.equal((await request({ kind: 'invoice', id, confirmation: 'DELETE' })).status, 401);
    assert.equal((await request({ kind: 'invoice', id, confirmation: 'DELETE' }, 'expired')).status, 401);
    assert.equal((await request({ kind: 'invoice', id, confirmation: 'yes' }, 'valid')).status, 400);
    assert.equal(calls.length, 0);
    assert.equal((await request({ kind: 'invoice', id, confirmation: 'DELETE', p_actor: id }, 'valid')).status, 200);
    assert.equal(calls[0][1].p_actor, owner);
    assert.equal(calls[0][1].p_id, id);
    assert.equal(calls[0][1].p_confirmation, 'DELETE');
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

function cleanupFixture(files: unknown[], storageFails = false) {
  const removed: any[] = [];
  let queueRemoved = false;
  let deleting = false;
  const builder: any = {
    select() { return this; }, order() { return this; }, limit() { return this; }, eq() { return this; },
    delete() { deleting = true; queueRemoved = true; return this; },
    then(resolve: any) { return Promise.resolve({ data: deleting ? null : [{ id, owner_id: owner, files }], error: null }).then(resolve); },
  };
  return { db: {
    from: () => builder,
    storage: { from: (bucket: string) => ({ remove: async (paths: string[]) => {
      removed.push({ bucket, paths }); return { error: storageFails ? { message: 'temporary failure' } : null };
    } }) },
  } as any, removed, queueRemoved: () => queueRemoved };
}

test('attachment cleanup uses the correct buckets and clears its durable queue only on success', async () => {
  const f = cleanupFixture([
    { url: `${id}/document.jpg`, jobId: id, bucket: 'project-documents' },
    { url: `${owner}/${id}/receipt.jpg`, jobId: id, bucket: 'job-cost-receipts' },
  ]);
  assert.equal(await cleanDeletedFiles(f.db, id), true);
  assert.deepEqual(f.removed.map(x => x.bucket), ['project-documents', 'job-cost-receipts']);
  assert.equal(f.queueRemoved(), true);
});

test('unsafe cross-job file paths are never deleted', async () => {
  const f = cleanupFixture([{ url: 'another-job/private.jpg', jobId: id, bucket: 'project-documents' }]);
  assert.equal(await cleanDeletedFiles(f.db, id), false);
  assert.equal(f.removed.length, 0);
  assert.equal(f.queueRemoved(), false);
});

test('temporary attachment failures keep the cleanup queue for a retry', async () => {
  const f = cleanupFixture([{ url: `${id}/document.jpg`, jobId: id, bucket: 'project-documents' }], true);
  assert.equal(await cleanDeletedFiles(f.db, id), false);
  assert.equal(f.queueRemoved(), false);
});
