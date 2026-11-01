import { test } from 'bun:test';
import assert from 'node:assert/strict';
import { bookingSchema, writeSchedule } from '../server/scheduleWrite';
import type { PortalActor } from '../server/employeeAccess';
const actor: PortalActor = { userId: 'owner', ownerId: 'owner', canManageTeam: true, employee: null };
const id = '10000000-0000-4000-8000-000000000001';
const body = { title: ' Site inspection ', project_id: null, date: '2026-11-01', start_time: '08:00', end_time: '09:00', employee_ids: [] };

test('booking schema permits standalone/job-linked bookings, trimmed text and explicit overnight', () => {
  assert.equal(bookingSchema.parse(body).title, 'Site inspection');
  assert.equal(bookingSchema.parse({ ...body, project_id: id }).project_id, id);
  assert.equal(bookingSchema.parse({ ...body, start_time: '23:00', end_time: '02:00', overnight: true }).overnight, true);
});
test('booking schema rejects impossible dates/times, mismatched overnight, duplicate crew and supplied owner', () => {
  for (const extra of [{ date: '2026-02-30' }, { start_time: '25:00' }, { end_time: '08:00' }, { end_time: '07:00' },
    { overnight: true }, { employee_ids: [id, id] }, { user_id: id }, { title: ' ' }, { notes: 'x'.repeat(4001) }])
    assert.throws(() => bookingSchema.parse({ ...body, ...extra }));
});
test('calendar write never accepts employee or preview writes, before querying database', async () => {
  for (const restricted of [{ ...actor, employee: { id }, canManageTeam: false },
    { ...actor, assistance: { ownerId: 'owner', memberId: id, readOnly: true, status: 'active' as const } }])
    await assert.rejects(writeSchedule({} as any, restricted, 'create', body), /not permitted|read-only/);
});
test('calendar write uses authenticated actor, atomic RPC and explicit confirmation response', async () => {
  let args: any;
  const db = { rpc: async (name: string, payload: unknown) => {
    assert.equal(name, 'portal_schedule_booking'); args = payload;
    return { data: { requires_confirmation: true, conflicts: [{ title: 'Other booking' }] }, error: null };
  } } as any;
  const response = await writeSchedule(db, actor, 'create', body);
  assert.equal(args.p_actor, 'owner'); assert.equal(args.p_id, null);
  assert.equal(args.p_payload.project_id, null); assert.equal(args.p_payload.allow_conflicts, false);
  assert.equal(response.requires_confirmation, true);
  await writeSchedule(db, actor, 'update', { ...body, allow_conflicts: true }, id);
  assert.equal(args.p_id, id); assert.equal(args.p_payload.allow_conflicts, true);
  await writeSchedule(db, actor, 'delete', {}, id);
  assert.deepEqual(args.p_payload, {}); assert.equal(args.p_operation, 'delete');
});
test('calendar missing migration and database failures fail explicitly', async () => {
  await assert.rejects(writeSchedule({ rpc: async () => ({ data: null, error: { code: 'PGRST202', message: '' } }) } as any,
    actor, 'create', body), /Interactive calendar database setup/);
  await assert.rejects(writeSchedule({ rpc: async () => ({ data: null, error: null }) } as any, actor, 'create', body), /not saved/);
});
