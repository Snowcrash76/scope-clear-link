import test from "node:test";
import assert from "node:assert/strict";
import {
  auditActorName,
  auditLabel,
  auditMatchesPersonWeek,
  reviewAuditForPersonWeek,
  type AuditRow,
} from "../src/components/project-manage/timesheetAudit";

const movedEntry: AuditRow = {
  id: "event-1",
  action: "time.corrected",
  created_at: "2026-11-02T00:00:00.000Z",
  actor_id: "auth-actor",
  employee_id: null,
  project_id: "job-1",
  detail: {
    reason: "Corrected after checking the signed sheet.",
    before: { employee_id: "crew-7", work_date: "2026-10-25" },
    after: { employee_id: "crew-7", work_date: "2026-10-26" },
  },
};

test("a moved time entry appears in both affected work weeks", () => {
  assert.equal(auditMatchesPersonWeek(movedEntry, "crew-7", "2026-10-19"), true);
  assert.equal(auditMatchesPersonWeek(movedEntry, "crew-7", "2026-10-26"), true);
  assert.deepEqual(
    reviewAuditForPersonWeek([movedEntry], "crew-7", "2026-10-19"),
    [movedEntry],
  );
  assert.deepEqual(
    reviewAuditForPersonWeek([movedEntry], "crew-7", "2026-10-26"),
    [movedEntry],
  );
});

test("audit actor lookup matches auth_user_id, never an employee row id", () => {
  const employees = [
    { id: "auth-actor", auth_user_id: "different-auth-id", name: "Wrong match" },
    { id: "crew-7", auth_user_id: "auth-actor", name: "Mina Patel" },
  ] as never;
  assert.equal(auditActorName(movedEntry, employees), "Mina Patel");
  assert.equal(auditActorName({ ...movedEntry, actor_id: "unknown" }, employees), "Admin");
});

test("review events use human labels and preserve the supplied reason", () => {
  const approval = { ...movedEntry, action: "week.approved", detail: { comment: "Reviewed with the supervisor." } };
  assert.deepEqual(auditLabel(approval), { label: "Approved", note: "Reviewed with the supervisor." });
  assert.equal(auditLabel({ ...movedEntry, action: "time.deleted" })?.label, "Entry deleted — reason shown");
});
