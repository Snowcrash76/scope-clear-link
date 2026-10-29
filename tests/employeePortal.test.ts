import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultPermissions, labourCost, localDate, localDateTimeToUtc, paidMinutes, weekStart } from '../shared/employeePortal';
import { validateClientPatch, validateClientSelect } from '../server/clientAccess';
import { fileCapability, verifyFileCapability } from '../server/employeeAccess';

test('employee labour uses paid minutes, cents rounding and no GST uplift', () => {
  assert.equal(paidMinutes('2026-10-25T21:00:00Z','2026-10-26T05:00:00Z',30),450);
  assert.equal(labourCost(450,42.50),318.75);
  assert.equal(labourCost(17,34.95),9.90);
  assert.throws(() => paidMinutes('2026-10-26T05:00:00Z','2026-10-26T05:00:00Z',0));
  assert.throws(() => paidMinutes('2026-10-26T05:00:00Z','2026-10-26T06:00:00Z',60));
});
test('Sydney local days/weeks and daylight-saving durations are explicit', () => {
  assert.equal(localDate(new Date('2026-10-25T13:30:00Z')),'2026-10-26');
  assert.equal(weekStart('2026-10-25'),'2026-10-19');
  assert.equal(weekStart('2026-10-26'),'2026-10-26');
  assert.equal(localDateTimeToUtc('2026-10-26T08:00'),'2026-10-25T21:00:00.000Z');
  assert.equal(paidMinutes(localDateTimeToUtc('2026-10-03T23:00'),localDateTimeToUtc('2026-10-04T04:00'),0),240);
  assert.equal(paidMinutes(localDateTimeToUtc('2026-04-04T23:00'),localDateTimeToUtc('2026-04-05T04:00'),0),360);
  assert.throws(() => localDateTimeToUtc('2026-10-04T02:30'),/daylight saving/);
  assert.throws(() => localDateTimeToUtc('2026-04-05T02:30'),/daylight saving/);
  assert.throws(() => weekStart('2026-02-30'));
});
test('operational role permissions never contain financial visibility switches', () => {
  assert.equal(defaultPermissions.labourer.review_timesheets,false);
  assert.equal(defaultPermissions.supervisor.review_timesheets,true);
  assert.ok(Object.keys(defaultPermissions.admin).every(k => !/rate|price|cost|margin|profit|invoice|quote/.test(k)));
});
test('client gateway rejects relation expansion, extra financial writes and invalid statuses', () => {
  assert.equal(validateClientSelect('id,title'),'id,title');
  for (const s of ['*,employees(*)','projects!inner(*)','id;select','id,*']) assert.throws(() => validateClientSelect(s));
  assert.throws(() => validateClientPatch('quotes',{status:'approved',total:1}));
  assert.throws(() => validateClientPatch('projects',{status:'completed'}));
  assert.throws(() => validateClientPatch('employee_cost_rates',{hourly_rate:1}));
  assert.doesNotThrow(() => validateClientPatch('scope_items',{acknowledged:true}));
});
test('private file capabilities are signed, short-lived and retain employee-only scope', () => {
  // Pure local fixture key, never a workspace or production credential.
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = 'local-employee-capability-test-key-only';
  try {
    const token = fileCapability('fixture-actor','fixture-document',true);
    const parsed = verifyFileCapability(token);
    assert.equal(parsed.employeeOnly,true);
    assert.equal(parsed.actorId,'fixture-actor');
    assert.throws(() => verifyFileCapability(`${token}x`));
    assert.throws(() => verifyFileCapability('bad.token'));
  } finally { if (previous === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previous; }
});
