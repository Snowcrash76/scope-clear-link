import test from "node:test";
import assert from "node:assert/strict";
import { approvedJobLabour, entriesForJob, jobHoursLogged } from "../src/components/team/jobTimesheetSummary";
import type { PortalTimeEntry } from "../shared/employeePortal";

const entries: PortalTimeEntry[] = [
  { id: "a1", employee_id: "e1", project_id: "job-a", work_date: "2026-07-06", started_at: "2026-07-06T08:00:00Z", ended_at: "2026-07-06T12:00:00Z", break_minutes: 30, notes: "", status: "approved", paid_minutes: 210, rate_snapshot: 38, created_at: "2026-07-06T08:00:00Z" },
  { id: "a2", employee_id: "e1", project_id: "job-a", work_date: "2026-07-07", started_at: "2026-07-07T08:00:00Z", ended_at: "2026-07-07T11:00:00Z", break_minutes: 0, notes: "", status: "submitted", paid_minutes: 180, rate_snapshot: null, created_at: "2026-07-07T08:00:00Z" },
  { id: "b1", employee_id: "e1", project_id: "job-b", work_date: "2026-07-07", started_at: "2026-07-07T12:00:00Z", ended_at: "2026-07-07T16:00:00Z", break_minutes: 0, notes: "", status: "approved", paid_minutes: 240, rate_snapshot: 38, created_at: "2026-07-07T12:00:00Z" },
  { id: "a3", employee_id: "e1", project_id: "job-a", work_date: "2026-07-08", started_at: "2026-07-08T08:00:00Z", ended_at: "2026-07-08T09:00:00Z", break_minutes: 0, notes: "", status: "draft", paid_minutes: 60, rate_snapshot: null, created_at: "2026-07-08T08:00:00Z" },
];

test("job-filtered hours include approved and submitted time for that job only", () => {
  assert.deepEqual(entriesForJob(entries, "job-a").map((entry) => entry.id), ["a1", "a2", "a3"]);
  assert.equal(jobHoursLogged(entries, "job-a"), 390);
  assert.equal(jobHoursLogged(entries, "job-b"), 240);
});

test("approved labour totals match linked confirmed costs and exclude manual Labour costs", () => {
  const result = approvedJobLabour(entries, [
    { category: "Labour", status: "confirmed", amount_inc_gst: 133, timesheet_entry_id: "a1" },
    { category: "Labour", status: "confirmed", amount_inc_gst: 152, timesheet_entry_id: "b1" },
    { category: "Labour", status: "confirmed", amount_inc_gst: 500 },
    { category: "Materials", status: "confirmed", amount_inc_gst: 25, timesheet_entry_id: "a1" },
    { category: "Labour", status: "draft", amount_inc_gst: 75, timesheet_entry_id: "a1" },
  ], "job-a");
  assert.equal(result.approvedMinutes, 210);
  assert.equal(result.amount, 133);
  assert.equal(result.completeLinkage, true);
});

test("approved hours without linked posted labour metadata are reported unavailable", () => {
  const result = approvedJobLabour(entries, [
    { category: "Labour", status: "confirmed", amount_inc_gst: 500 },
  ], "job-a");
  assert.equal(result.amount, null);
  assert.equal(result.completeLinkage, false);
});

test("a job with no approved time has a known zero linked labour total", () => {
  const result = approvedJobLabour(entries, [], "job-c");
  assert.equal(result.approvedMinutes, 0);
  assert.equal(result.amount, 0);
  assert.equal(result.completeLinkage, true);
});
