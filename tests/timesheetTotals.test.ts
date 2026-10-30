import test from 'node:test';
import assert from 'node:assert/strict';
import type { PortalTimeEntry } from '../shared/employeePortal';
import { timesheetTotals } from '../shared/timesheetTotals';
import { ownEmployeeHourlyRate, safeEntryColumns } from '../server/employeeAccess';

function entry(changes: Partial<PortalTimeEntry> = {}): PortalTimeEntry {
  return {
    id: 'entry-a', employee_id: 'employee-a', project_id: 'job-a', work_date: '2026-10-26',
    started_at: '2026-10-25T21:00:00Z', ended_at: '2026-10-26T05:00:00Z',
    break_minutes: 30, paid_minutes: 450, notes: '', status: 'approved', rate_snapshot: 40,
    created_at: '2026-10-26T06:00:00Z', ...changes,
  };
}

test('hours distinguish gross attendance, unpaid breaks and paid time', () => {
  const totals = timesheetTotals([entry()]);
  assert.equal(totals.workedMinutes, 480);
  assert.equal(totals.breakMinutes, 30);
  assert.equal(totals.paidMinutes, 450);
  assert.equal(totals.approvedPay, 300);
});

test('pending and draft time are visible but never counted as approved pay', () => {
  const totals = timesheetTotals([entry(), entry({ status: 'submitted' }), entry({ status: 'draft' })]);
  assert.equal(totals.paidMinutes, 1350);
  assert.equal(totals.approvedMinutes, 450);
  assert.equal(totals.submittedMinutes, 450);
  assert.equal(totals.draftMinutes, 450);
  assert.equal(totals.approvedPay, 300);
});

test('running clocks do not inflate settled weekly totals', () => {
  const totals = timesheetTotals([entry({ ended_at: null, paid_minutes: null, status: 'draft' })]);
  assert.equal(totals.runningCount, 1);
  assert.equal(totals.paidMinutes, 0);
  assert.equal(totals.approvedPay, 0);
});

test('approved entries retain their own historical rates and rounding', () => {
  const totals = timesheetTotals([entry({ rate_snapshot: 40 }), entry({ rate_snapshot: 50 })]);
  assert.equal(totals.approvedPay, 675);
  const minute = entry({ paid_minutes: 1, break_minutes: 0, rate_snapshot: 1 });
  assert.equal(timesheetTotals([minute, minute, minute]).approvedPay, 0.06);
});

test('missing historic rates are unavailable, while a recorded zero rate is valid', () => {
  assert.equal(timesheetTotals([entry({ rate_snapshot: null })]).approvedPay, null);
  assert.equal(timesheetTotals([entry({ rate_snapshot: undefined }), entry()]).missingRateCount, 1);
  assert.equal(timesheetTotals([entry({ rate_snapshot: 0 })]).approvedPay, 0);
  assert.equal(timesheetTotals([entry({ status: 'submitted', rate_snapshot: null })]).approvedPay, 0);
});

test('empty weeks and SQL-rounded closed entries reconcile without NaN', () => {
  assert.equal(timesheetTotals([]).paidMinutes, 0);
  const totals = timesheetTotals([entry({ paid_minutes: null, ended_at: '2026-10-26T05:00:31Z' })]);
  assert.equal(totals.workedMinutes, 481);
  assert.equal(totals.paidMinutes, 451);
});

test('own rate lookup is constrained by authenticated employee and business', async () => {
  const filters: unknown[] = [];
  const query = {
    select(value: string) { assert.equal(value, 'hourly_rate'); return this; },
    eq(field: string, value: string) { filters.push([field, value]); return this; },
    async maybeSingle() { return { data: { hourly_rate: 42 }, error: null }; },
  };
  const db = { from(table: string) { assert.equal(table, 'employee_cost_rates'); return query; } } as unknown as Parameters<typeof ownEmployeeHourlyRate>[0];
  const actor = { employee: { id: 'employee-a' }, ownerId: 'owner-a' } as Parameters<typeof ownEmployeeHourlyRate>[1];
  assert.equal(await ownEmployeeHourlyRate(db, actor), 42);
  assert.deepEqual(filters, [['employee_id', 'employee-a'], ['owner_id', 'owner-a']]);
  assert.ok(!safeEntryColumns.includes('rate_snapshot'), 'Supervisor/co-worker entry projections remain pay-free');
});

test('an unset current rate stays null, not a made-up zero', async () => {
  const query = { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: null, error: null }; } };
  const db = { from() { return query; } } as unknown as Parameters<typeof ownEmployeeHourlyRate>[0];
  const actor = { employee: { id: 'employee-a' }, ownerId: 'owner-a' } as Parameters<typeof ownEmployeeHourlyRate>[1];
  assert.equal(await ownEmployeeHourlyRate(db, actor), null);
});

test('own-rate lookup cannot run without a verified employee identity', async () => {
  const db = { from() { throw new Error('Must not query rates'); } } as unknown as Parameters<typeof ownEmployeeHourlyRate>[0];
  const actor = { employee: null, ownerId: 'owner-a' } as Parameters<typeof ownEmployeeHourlyRate>[1];
  await assert.rejects(ownEmployeeHourlyRate(db, actor), { status: 403 });
});
