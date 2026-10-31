import test from 'node:test';
import assert from 'node:assert/strict';
import { employeePreviewActor, employeePreviewRequest, type PortalActor } from '../server/employeeAccess';
import { assistanceMemberFromPath, employeeAssistanceHref } from '../src/lib/employeeAssistance';

const ownerId = '10000000-0000-4000-8000-000000000001';
const memberId = '60000000-0000-4000-8000-000000000001';
const owner: PortalActor = { userId: ownerId, ownerId, employee: null, canManageTeam: true };
function fixture(overrides: Record<string, unknown> = {}) {
  const employee = { id: memberId, owner_id: ownerId, auth_user_id: 'employee-login', name: 'Fixture member', active: true, role: 'labourer', ...overrides };
  let reads = 0;
  const db = { from: (table: string) => {
    assert.equal(table, 'employees'); reads++;
    const filters: Record<string, unknown> = {};
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters[key] = value; return query; },
      maybeSingle: async () => ({ data: Object.entries(filters).every(([k, v]) => employee[k as keyof typeof employee] === v) ? employee : null, error: null }),
    };
    return query;
  } };
  return { db: db as any, employee, reads: () => reads };
}

test('preview binds an owned target but never changes the authenticated actor', async () => {
  const { db } = fixture();
  const result = await employeePreviewRequest(db, owner, memberId, 'GET', '/employee/bootstrap');
  assert.equal(result.userId, ownerId);
  assert.equal(result.employee.auth_user_id, 'employee-login');
  assert.equal(result.employee.id, memberId);
  assert.equal(result.ownerId, ownerId);
  assert.equal(result.canManageTeam, false);
  assert.deepEqual(result.assistance, { ownerId, memberId, status: 'active', readOnly: true });
  assert.equal(owner.employee, null);
  assert.equal((await employeePreviewActor(fixture({ role: 'admin' }).db, owner, memberId)).canManageTeam, true);
});

test('employees including employee admins, foreign owners and malformed targets fail closed', async () => {
  for (const canManageTeam of [false, true]) {
    const { db, reads } = fixture();
    await assert.rejects(employeePreviewActor(db, { ...owner, userId: 'employee-login', employee: { id: 'staff' }, canManageTeam }, memberId));
    assert.equal(reads(), 0);
  }
  await assert.rejects(employeePreviewActor(fixture().db, { ...owner, userId: 'other-owner', ownerId: 'other-owner' }, memberId), /not found/);
  await assert.rejects(employeePreviewActor(fixture().db, owner, '../owner'), /valid team member/);
});

test('unavailable accounts expose truthful setup status only, never a working portal', async () => {
  for (const [patch, status] of [
    [{ auth_user_id: null }, 'setup_required'], [{ active: false }, 'inactive'],
    [{ archived_at: '2026-10-31T00:00:00Z' }, 'removed'],
  ] as const) {
    const { db } = fixture(patch);
    const result = await employeePreviewRequest(db, owner, memberId, 'GET', '/employee/session');
    assert.equal(result.assistance?.status, status);
    await assert.rejects(employeePreviewRequest(db, owner, memberId, 'GET', '/employee/bootstrap'), /active portal/);
  }
});

test('all preview writes and owner/commercial reads are denied before any target lookup', async () => {
  const { db, reads } = fixture();
  for (const method of ['POST', 'PATCH', 'DELETE', 'PUT', 'HEAD']) {
    for (const path of ['/employee/clock-in', '/employee/notifications/x/read', '/team/review', '/team/time/x', '/employee/bootstrap']) {
      await assert.rejects(employeePreviewRequest(db, owner, memberId, method, path), /read-only/);
    }
  }
  for (const path of ['/team/bootstrap', '/team/setup', '/team/documents/x/url', '/invoices', '/employee/invitations/x']) {
    await assert.rejects(employeePreviewRequest(db, owner, memberId, 'GET', path), /read-only/);
  }
  assert.equal(reads(), 0);
});

test('preview navigation retains member context and invalid paths do not fall back to owner mode', () => {
  const root = `/team/assist/${memberId}`;
  for (const [source, target] of [
    ['/employee', root], ['/employee/week', `${root}/week`],
    ['/employee/jobs/example?x=1', `${root}/jobs/example?x=1`],
    ['/employee/timesheets', `${root}/timesheets`], ['/employee/notifications', `${root}/notifications`],
    ['/schedule?job=one', `${root}/schedule?job=one`],
  ]) assert.equal(employeeAssistanceHref(memberId, source), target);
  assert.equal(employeeAssistanceHref(null, '/employee'), '/employee');
  assert.equal(assistanceMemberFromPath(`${root}/timesheets`), memberId);
  assert.equal(assistanceMemberFromPath('/team/assist/not-a-valid-id'), 'not-a-valid-id');
  assert.equal(assistanceMemberFromPath('/team'), null);
});
