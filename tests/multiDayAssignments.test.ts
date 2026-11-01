import { test, expect } from 'bun:test';
import { assignmentDates } from '../shared/assignmentDates';
import { createTeamAssignments } from '../server/assignmentWrite';

const owner = { userId: 'owner', ownerId: 'owner', employee: null, canManageTeam: true };
const payload = {
  project_id: '10000000-0000-4000-8000-000000000001',
  employee_ids: ['20000000-0000-4000-8000-000000000001'],
  date: '2026-10-02', start_time: '08:00', end_time: '16:00', notes: 'North entry',
};
function fakeDb(error: any = null) {
  const calls: any[] = [];
  return { calls, rpc: async (name: string, args: any) => {
    calls.push({ name, args }); return { data: { success: true }, error };
  } };
}
test('inclusive date ranges preserve weekends, leap days and DST calendar dates', () => {
  expect(assignmentDates('2026-10-02', '2026-10-05')).toEqual(['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']);
  expect(assignmentDates('2028-02-28', '2028-03-01')).toEqual(['2028-02-28', '2028-02-29', '2028-03-01']);
  expect(assignmentDates('2026-12-31', '2027-01-01')).toHaveLength(2);
  expect(assignmentDates('2026-10-02', '')).toEqual(['2026-10-02']);
});
test('invalid dates, reversed dates and overlong ranges are rejected', () => {
  for (const [start, end] of [['2026-02-30', '2026-03-01'], ['bad', '2026-03-01'], ['2026-10-05', '2026-10-02'], ['2026-01-01', '2026-02-01']]) {
    expect(() => assignmentDates(start, end)).toThrow();
  }
  expect(assignmentDates('2026-01-01', '2026-01-31')).toHaveLength(31);
});
test('single-day and existing-booking requests retain the original checked mutation', async () => {
  const db = fakeDb();
  await createTeamAssignments(db as any, owner, payload);
  await createTeamAssignments(db as any, owner, { ...payload, start_time: '08:00:00', end_time: '16:00:00' });
  await createTeamAssignments(db as any, owner, { project_id: payload.project_id, employee_ids: payload.employee_ids, appointment_id: payload.project_id });
  expect(db.calls.map(call => call.name)).toEqual(['portal_mutate', 'portal_mutate', 'portal_mutate']);
});
test('a multi-day, multi-employee request uses one atomic RPC with unchanged daily hours', async () => {
  const db = fakeDb();
  const second = '20000000-0000-4000-8000-000000000002';
  await createTeamAssignments(db as any, owner, { ...payload, employee_ids: [second, ...payload.employee_ids, second], end_date: '2026-10-05' });
  expect(db.calls).toHaveLength(1);
  expect(db.calls[0].name).toBe('portal_assign_days');
  expect(db.calls[0].args.p_payload.dates).toEqual(assignmentDates(payload.date, '2026-10-05'));
  expect(db.calls[0].args.p_payload.employee_ids).toHaveLength(2);
  expect(db.calls[0].args.p_payload.start_time).toBe('08:00');
  expect(db.calls[0].args.p_payload.end_time).toBe('16:00');
  expect(db.calls[0].args.p_payload.notes).toBe('North entry');
});
test('unauthorised actors, invalid times and invalid ranges never reach the database', async () => {
  const db = fakeDb();
  await expect(createTeamAssignments(db as any, { ...owner, canManageTeam: false }, payload)).rejects.toThrow();
  for (const patch of [{ end_date: '2026-09-01' }, { date: '2026-02-30' }, { start_time: '25:00' }, { end_time: '07:00' }, { employee_ids: [] }, { appointment_id: payload.project_id, end_date: '2026-10-05' }]) {
    await expect(createTeamAssignments(db as any, owner, { ...payload, ...patch })).rejects.toThrow();
  }
  expect(db.calls).toHaveLength(0);
});
test('missing setup and database failures never report successful assignments', async () => {
  await expect(createTeamAssignments(fakeDb({ code: 'PGRST202' }) as any, owner, { ...payload, end_date: '2026-10-05' })).rejects.toThrow('No bookings were saved');
  await expect(createTeamAssignments(fakeDb({ code: '42501', message: 'Denied' }) as any, owner, { ...payload, end_date: '2026-10-05' })).rejects.toThrow();
});
