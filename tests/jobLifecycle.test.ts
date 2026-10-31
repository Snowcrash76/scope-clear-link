import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteJobRecord, filterJobArchive, isArchivedJob } from '../src/lib/jobLifecycle';

test('completed jobs are archived, other job states stay active without modifying records', () => {
  const jobs = ['draft', 'sent', 'in_progress', 'completed'].map((status, id) => ({ status, id }));
  assert.deepEqual(filterJobArchive(jobs, false).map(j => j.status), ['draft', 'sent', 'in_progress']);
  assert.deepEqual(filterJobArchive(jobs, true), [jobs[3]]);
  assert.equal(isArchivedJob(jobs[3]), true);
  assert.equal(jobs.length, 4);
  assert.equal(filterJobArchive(jobs, true)[0], jobs[3]);
});

function fixture(result: any) {
  const calls: any[] = [];
  const query = {
    delete() { calls.push(['delete']); return this; },
    eq(key: string, value: string) { calls.push(['eq', key, value]); return this; },
    async select(columns: string) { calls.push(['select', columns]); return result; },
  };
  return { calls, client: { from(table: string) { calls.push(['from', table]); return query; } } as any };
}
test('delete uses exactly one owner-scoped database statement and no child deletes', async () => {
  const { calls, client } = fixture({ data: [{ id: 'job' }], error: null });
  await deleteJobRecord(client, 'owner', 'job');
  assert.deepEqual(calls, [['from', 'projects'], ['delete'], ['eq', 'id', 'job'], ['eq', 'user_id', 'owner'], ['select', 'id']]);
});
test('zero affected rows is not a successful delete', async () => {
  const { client } = fixture({ data: [], error: null });
  await assert.rejects(deleteJobRecord(client, 'owner', 'foreign-or-missing'), /not found|permission/);
});
test('deleting while signed out makes no database requests', async () => {
  const { calls, client } = fixture({});
  await assert.rejects(deleteJobRecord(client, '', 'job'), /Sign in/);
  assert.deepEqual(calls, []);
});
for (const error of [{ code: '23503', message: 'foreign key' }, { code: '42501', message: 'Issued and cancelled invoices are retained for financial history and cannot be deleted.' }]) {
  test(`protected history explains archive alternative (${error.code})`, async () => {
    await assert.rejects(deleteJobRecord(fixture({ data: null, error }).client, 'owner', 'job'), /protected.*archive/);
  });
}
test('an uncertain network response never claims a successful deletion', async () => {
  await assert.rejects(deleteJobRecord(fixture({ error: { message: 'Failed to fetch' } }).client, 'owner', 'job'), /could not be confirmed/);
});
