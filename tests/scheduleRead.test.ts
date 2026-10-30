import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { readSchedule, scheduleRange } from '../server/scheduleRead';
import type { PortalActor } from '../server/employeeAccess';

const owner: PortalActor = { userId: 'owner', ownerId: 'owner', employee: null, canManageTeam: true };
function database() {
  const rows: Record<string, any[]> = {
    appointments: [
      { id: 'overnight', user_id: 'owner', project_id: 'j1', title: 'Night', date: '2026-10-03', start_time: '23:00', end_time: '04:00', notes: null },
      { id: 'day', user_id: 'owner', project_id: 'j2', title: 'Day', date: '2026-10-04', start_time: '09:00', end_time: '11:00', notes: null },
      { id: 'past', user_id: 'owner', date: '2026-10-03', start_time: '09:00', end_time: '11:00' },
      { id: 'future', user_id: 'owner', date: '2026-11-20', start_time: '09:00', end_time: '11:00' },
      { id: 'foreign', user_id: 'other', date: '2026-10-04', start_time: '09:00', end_time: '11:00' },
    ],
    employee_assignments: [
      { id: 'a1', owner_id: 'owner', appointment_id: 'overnight', project_id: 'j1', employee_id: 'e1' },
      { id: 'a2', owner_id: 'owner', appointment_id: 'day', project_id: 'j2', employee_id: 'e2' },
      { id: 'a3', owner_id: 'owner', appointment_id: 'overnight', project_id: 'j1', employee_id: 'e2' },
      { id: 'foreign-a', owner_id: 'other', appointment_id: 'overnight', project_id: 'foreign-j', employee_id: 'e3' },
    ],
    projects: [
      { id: 'j1', user_id: 'owner', name: 'Job one', client_address: 'Street', client_phone: null, total: 9000 },
      { id: 'j2', user_id: 'owner', name: 'Job two', total: 5000 },
      { id: 'foreign-j', user_id: 'other', name: 'Other business' },
    ],
    employees: [
      { id: 'e1', owner_id: 'owner', name: 'One', hourly_rate: 50, email: 'private@example.invalid' },
      { id: 'e2', owner_id: 'owner', name: 'Two', hourly_rate: 60 },
      { id: 'e3', owner_id: 'other', name: 'Other' },
    ],
  };
  return { from(table: string) {
    let columns = '*';
    const filters: ((row: any) => boolean)[] = [];
    const query = {
      select(value: string) { columns = value; return query; },
      eq(key: string, value: unknown) { filters.push(row => row[key] === value); return query; },
      in(key: string, values: unknown[]) { filters.push(row => values.includes(row[key])); return query; },
      gte(key: string, value: string) { filters.push(row => row[key] >= value); return query; },
      lte(key: string, value: string) { filters.push(row => row[key] <= value); return query; },
      order() { return query; },
      async range(from: number, to: number) {
        return { error: null, data: rows[table].filter(row => filters.every(filter => filter(row))).slice(from, to + 1)
          .map(row => Object.fromEntries(columns.split(',').map(key => [key, row[key]]))) };
      },
    };
    return query;
  } } as any;
}

test('schedule owner reads only business bookings in range and previous overnight, with deduplicated appointments', async () => {
  const result = await readSchedule(database(), owner, { from: '2026-10-04', to: '2026-10-04' });
  assert.deepEqual(result.appointments.map(row => row.id), ['overnight', 'day']);
  assert.equal(result.assignments.length, 3);
  assert.equal(result.jobs.length, 2);
  assert.equal(result.timezone, 'Australia/Sydney');
  assert.deepEqual(Object.keys(result.employees[0]), ['id', 'name']);
  assert.ok(result.jobs.every(job => !('total' in job)));
});

test('schedule employees get only their own bookings, safe jobs and their own name, never coworker assignments', async () => {
  const actor: PortalActor = { ...owner, userId: 'staff', canManageTeam: false, employee: { id: 'e1', name: 'One' } };
  const result = await readSchedule(database(), actor, { from: '2026-10-04', to: '2026-10-04' });
  assert.deepEqual(result.appointments.map(row => row.id), ['overnight']);
  assert.deepEqual(result.assignments.map(row => row.employee_id), ['e1']);
  assert.deepEqual(result.jobs.map(row => row.id), ['j1']);
  assert.deepEqual(result.employees, [{ id: 'e1', name: 'One' }]);
  assert.equal(result.canManage, false);
});

test('calendar admin uses existing management access, while unenrolled nonmanager is rejected', async () => {
  const result = await readSchedule(database(), { ...owner, employee: { id: 'admin', role: 'admin' } }, { from: '2026-10-04', to: '2026-10-04' });
  assert.equal(result.appointments.length, 2);
  await assert.rejects(readSchedule(database(), { ...owner, canManageTeam: false }, { from: '2026-10-04', to: '2026-10-04' }));
});

test('calendar empty range remains empty without leaking assignments', async () => {
  const result = await readSchedule(database(), owner, { from: '2026-12-01', to: '2026-12-07' });
  assert.equal(result.appointments.length, 0);
  assert.equal(result.assignments.length, 0);
});

test('calendar range rejects malformed, impossible, reversed and oversized dates', () => {
  for (const value of [
    { from: '2026-02-30', to: '2026-03-02' }, { from: 'no', to: '2026-03-02' },
    { from: '2026-03-02', to: '2026-03-01' }, { from: '2026-01-01', to: '2026-06-01' },
  ]) assert.throws(() => scheduleRange(value));
  assert.equal(scheduleRange({ from: '2026-04-05', to: '2026-04-05' }).previous, '2026-04-04');
});
