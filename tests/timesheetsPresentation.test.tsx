import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { PortalTimeEntry } from "../shared/employeePortal";
import { timesheetTotals } from "../shared/timesheetTotals";
import { TimesheetStatusBadge } from "../src/components/timesheets/TimesheetStatusBadge";
import { WeekSwitcher } from "../src/components/timesheets/WeekSwitcher";
import { SummaryStrip } from "../src/components/timesheets/SummaryStrip";
import {
  groupEntriesByDay,
  shiftWeek,
  sortReviewRows,
} from "../src/components/timesheets/model";

function entry(id: string, date: string, minutes: number): PortalTimeEntry {
  return {
    id,
    employee_id: "crew-1",
    project_id: "job-1",
    work_date: date,
    started_at: `${date}T07:00:00.000Z`,
    ended_at: `${date}T${minutes >= 60 ? "15:00" : "08:00"}:00.000Z`,
    break_minutes: 0,
    notes: "",
    status: "draft",
    paid_minutes: minutes,
    created_at: `${date}T07:00:00.000Z`,
  };
}

test("status badge maps every workflow state to readable text and an icon", () => {
  for (const status of [
    "draft",
    "submitted",
    "approved",
    "rejected",
    "running",
  ] as const) {
    const html = renderToStaticMarkup(
      createElement(TimesheetStatusBadge, { status }),
    );
    const expected = status[0].toUpperCase() + status.slice(1);
    assert.match(html, new RegExp(expected));
    assert.match(html, /<svg/);
  }
});

test("week switcher exposes named previous/next controls and week label", () => {
  const html = renderToStaticMarkup(
    createElement(WeekSwitcher, {
      value: "2026-10-26",
      onChange: () => undefined,
      today: "2026-10-29",
    }),
  );
  assert.match(html, /Previous week/);
  assert.match(html, /Next week/);
  assert.match(html, /This week/);
  assert.match(html, /26 Oct/);
  assert.match(html, /1 Nov 2026/);
});

test("week navigation advances and retreats by one calendar week", () => {
  assert.equal(shiftWeek("2026-10-26", 1), "2026-11-02");
  assert.equal(shiftWeek("2026-10-26", -1), "2026-10-19");
});

test("manager review rows prioritize submitted work, then sort names", () => {
  const rows = sortReviewRows([
    { name: "Zara", status: "approved" },
    { name: "Mina", status: "submitted" },
    { name: "Ari", status: "submitted" },
    { name: "Ben", status: "draft" },
  ]);
  assert.deepEqual(
    rows.map((row) => row.name),
    ["Ari", "Mina", "Ben", "Zara"],
  );
});

test("employee entries group by work date and retain chronological day totals", () => {
  const entries = [
    entry("b", "2026-10-27", 90),
    entry("a", "2026-10-26", 450),
    entry("c", "2026-10-27", 30),
  ];
  const groups = groupEntriesByDay(entries);
  assert.deepEqual(
    groups.map(([date]) => date),
    ["2026-10-26", "2026-10-27"],
  );
  assert.equal(timesheetTotals(groups[0][1]).paidMinutes, 450);
  assert.equal(timesheetTotals(groups[1][1]).paidMinutes, 120);
});

test("empty review rows and empty employee days are safe", () => {
  assert.deepEqual(sortReviewRows([]), []);
  assert.deepEqual(groupEntriesByDay([]), []);
});

test("weekly manager summary keeps one total headline and puts nonzero statuses on one line", () => {
  const html = renderToStaticMarkup(
    createElement(SummaryStrip, {
      metrics: [
        {
          label: "Total hours",
          value: "37h 30m",
          tooltip: "Includes 1h 00m of unpaid breaks removed",
        },
        {
          label: "Needs approval",
          value: "8h 30m",
          detail: "2 team members",
          tone: "warning",
        },
        { label: "Approved", value: "29h 00m", tone: "success" },
        {
          label: "Estimated approved pay",
          value: "$847.50",
          tooltip: "Approved-hours estimate only.",
        },
      ],
    }),
  );

  assert.match(html, /aria-label="Total hours: 37h 30m\. Includes 1h 00m of unpaid breaks removed"/);
  assert.match(html, /Needs approval/);
  assert.match(html, /Approved/);
  assert.match(html, /37h 30m/);
  assert.match(html, /\$847\.50/);
  assert.doesNotMatch(html, /grid-cols-2 gap-2 lg:grid-cols-4/);
  assert.equal((html.match(/aria-label="Total hours:/g) ?? []).length, 1);
});
