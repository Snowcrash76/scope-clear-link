import test from "node:test";
import assert from "node:assert/strict";
import {
  appointmentConflicts,
  dateKey,
  eventEndDate,
  jobColor,
  jobsWithoutBookingInRange,
  toCalendarEvents,
  visibleDateRange,
  type CalendarEvent,
  type ScheduleData,
} from "../src/components/schedule/scheduleUtils";

const fixture: ScheduleData = {
  timezone: "Australia/Sydney",
  canManage: true,
  jobs: [
    { id: "job-a", name: "Kitchen", client_address: "1 Main St", client_phone: "0400000000" },
    { id: "job-b", name: "Deck", client_address: null, client_phone: null },
  ],
  employees: [{ id: "staff-1", name: "Alex Smith" }],
  appointments: [
    { id: "a1", project_id: "job-a", title: "Kitchen work", date: "2026-04-04", start_time: "22:00", end_time: "01:00" },
    { id: "a2", project_id: "job-b", title: "Deck work", date: "2026-04-05", start_time: "00:30", end_time: "02:00" },
  ],
  assignments: [
    { id: "as1", employee_id: "staff-1", employee_name: "Alex Smith", project_id: "job-a", appointment_id: "a1", date: "2026-04-04", start_time: "22:00", end_time: "01:00", notes: null },
    { id: "as2", employee_id: "staff-1", employee_name: "Alex Smith", project_id: "job-b", appointment_id: "a2", date: "2026-04-05", start_time: "00:30", end_time: "02:00", notes: null },
  ],
};

test("visible date ranges stay consecutive across Sydney daylight-saving changes", () => {
  const range = visibleDateRange(new Date(2026, 3, 5), "week");
  assert.equal(range.dates.length, 7);
  assert.equal(range.from, "2026-03-30");
  assert.equal(range.to, "2026-04-05");
  assert.deepEqual(range.dates.map(dateKey), ["2026-03-30", "2026-03-31", "2026-04-01", "2026-04-02", "2026-04-03", "2026-04-04", "2026-04-05"]);
});

test("overnight appointments end on the following local date and overlaps identify crew", () => {
  const events = toCalendarEvents(fixture);
  assert.equal(eventEndDate(fixture.appointments[0]), "2026-04-05");
  assert.equal(appointmentConflicts(events[0], events)[0]?.employee, "Alex Smith");
});

test("job colours are stable and distinguish nearby job ids", () => {
  assert.deepEqual(jobColor("job-a"), jobColor("job-a"));
  assert.notDeepEqual(jobColor("job-a"), jobColor("job-b"));
});

test("view-local job list does not claim bookings outside the fetched range", () => {
  const events = toCalendarEvents(fixture).filter((event) => event.appointment.date === "2026-04-04");
  assert.deepEqual(jobsWithoutBookingInRange(fixture.jobs, events).map((job) => job.id), ["job-b"]);
});

test("month range covers full calendar weeks and includes all visible dates", () => {
  const range = visibleDateRange(new Date(2026, 1, 10), "month");
  assert.equal(range.dates.length % 7, 0);
  assert.ok(range.dates.length >= 28 && range.dates.length <= 42);
});
