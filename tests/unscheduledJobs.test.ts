import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readUnscheduledJobs } from '../server/scheduleRead';
import type { PortalActor } from '../server/employeeAccess';

const owner: PortalActor = { userId: 'owner', ownerId: 'owner', employee: null, canManageTeam: true };
const now = new Date('2026-10-31T13:30:00Z'); // Already 1 November in Sydney.
function fixture() {
  const queries: { table: string; filters: unknown[] }[] = [];
  const tables: Record<string, any[]> = {
    projects: [
      { id: 'approved', user_id: 'owner', name: 'Approved no booking', client_name: 'One', status: 'acknowledged' },
      { id: 'past', user_id: 'owner', name: 'Past bookings only', client_name: 'Two', status: 'in_progress' },
      { id: 'today', user_id: 'owner', name: 'Booked today', status: 'in_progress' },
      { id: 'distant', user_id: 'owner', name: 'Booked next year', status: 'acknowledged' },
      { id: 'quote-approved', user_id: 'owner', name: 'Approved through quote', status: 'sent' },
      { id: 'draft', user_id: 'owner', name: 'Draft', status: 'draft' },
      { id: 'quoted-sent', user_id: 'owner', name: 'Sent quote not yet approved', status: 'sent' },
      { id: 'completed', user_id: 'owner', name: 'Completed', status: 'completed' },
      { id: 'revised', user_id: 'owner', name: 'Latest revision not approved', status: 'sent' },
      { id: 'foreign', user_id: 'other', name: 'Other business', status: 'in_progress' },
    ],
    quotes: [
      { project_id: 'quoted-sent', status: 'sent', created_at: '2026-10-30' },
      { project_id: 'quote-approved', status: 'approved', created_at: '2026-10-30' },
      { project_id: 'completed', status: 'approved', created_at: '2026-10-30' },
      { project_id: 'revised', status: 'approved', created_at: '2026-10-29' },
      { project_id: 'revised', status: 'draft', created_at: '2026-10-30' },
    ],
    appointments: [
      { id: 'a1', project_id: 'past', user_id: 'owner', date: '2026-10-31' },
      { id: 'a2', project_id: 'today', user_id: 'owner', date: '2026-11-01' },
      { id: 'a3', project_id: 'distant', user_id: 'owner', date: '2027-11-01' },
      { id: 'a4', project_id: 'approved', user_id: 'other', date: '2026-11-02' },
    ],
  };
  const db = { from(table: string) {
    let columns = '*'; const filters: ((row: any) => boolean)[] = [];
    const call = { table, filters: [] as unknown[] }; queries.push(call);
    const builder: any = {
      select(value: string) { columns = value; return this; }, order() { return this; },
      eq(key: string, value: unknown) { filters.push(row => row[key] === value); call.filters.push(['eq', key, value]); return this; },
      in(key: string, values: unknown[]) { filters.push(row => values.includes(row[key])); return this; },
      gte(key: string, value: string) { filters.push(row => row[key] >= value); call.filters.push(['gte', key, value]); return this; },
      async range(from: number, to: number) {
        const data = tables[table].filter(row => filters.every(filter => filter(row))).slice(from, to + 1);
        return { data: data.map(row => Object.fromEntries(columns.split(',').map(key => [key, row[key]]))), error: null };
      },
    };
    return builder;
  } } as any;
  return { db, queries };
}

test('unscheduled jobs use active displayed statuses and all bookings from Sydney today onward', async () => {
  const f = fixture();
  const result = await readUnscheduledJobs(f.db, owner, now);
  assert.equal(result.today, '2026-11-01');
  assert.deepEqual(result.jobs.map(job => job.id), ['approved', 'past', 'quote-approved']);
  assert.equal(result.jobs[0].client_name, 'One');
  assert.ok(f.queries.find(query => query.table === 'appointments')?.filters.some(filter =>
    JSON.stringify(filter) === JSON.stringify(['gte', 'date', '2026-11-01'])));
  assert.ok(!f.queries.flatMap(query => query.filters).some((filter: any) => filter[0] === 'lte'));
});

test('display range cannot influence the independent backlog', async () => {
  const f = fixture();
  const first = await readUnscheduledJobs(f.db, owner, now);
  const second = await readUnscheduledJobs(f.db, owner, now);
  assert.deepEqual(first, second); // No range argument, no dependency on loaded calendar events.
});

test('employees cannot read the owner backlog', async () => {
  const f = fixture();
  await assert.rejects(() => readUnscheduledJobs(f.db, { ...owner, canManageTeam: false,
    userId: 'staff', employee: { id: 'staff', name: 'Staff' } }, now));
  assert.equal(f.queries.length, 0);
});
