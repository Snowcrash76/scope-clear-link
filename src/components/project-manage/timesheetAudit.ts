import type { TeamBootstrap } from "../../../shared/employeePortal";
import { weekStart } from "../../../shared/employeePortal";

export type AuditRow = TeamBootstrap["audit"][number] & {
  employee_id?: string | null;
};

type Detail = Record<string, unknown>;

const asRecord = (value: unknown): Detail =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Detail)
    : {};
const stringValue = (value: unknown) =>
  typeof value === "string" ? value : "";

export function auditEmployeeId(row: AuditRow): string | null {
  const detail = asRecord(row.detail);
  const before = asRecord(detail.before);
  const after = asRecord(detail.after);
  const snapshot = detail.employee_id ?? before.employee_id ?? after.employee_id;
  return row.employee_id ?? (typeof snapshot === "string" ? snapshot : null);
}

export function auditWeekStart(row: AuditRow): string | null {
  const detail = asRecord(row.detail);
  const direct = stringValue(detail.week_start);
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) return direct;
  const snapshots: unknown[] = [
    ...((Array.isArray(detail.entries) ? detail.entries : []) as unknown[]),
    detail.before,
    detail.after,
    detail,
  ];
  for (const value of snapshots) {
    const candidate = stringValue(asRecord(value).work_date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
      try {
        return weekStart(candidate);
      } catch {
        return null;
      }
    }
  }
  return null;
}

function auditWeekStarts(row: AuditRow): Set<string> {
  const detail = asRecord(row.detail);
  const weeks = new Set<string>();
  const direct = stringValue(detail.week_start);
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) weeks.add(direct);
  const snapshots: unknown[] = [
    ...((Array.isArray(detail.entries) ? detail.entries : []) as unknown[]),
    detail.before,
    detail.after,
    detail,
  ];
  for (const value of snapshots) {
    const candidate = stringValue(asRecord(value).work_date);
    if (/^\d{4}-\d{2}-\d{2}$/.test(candidate)) {
      try {
        weeks.add(weekStart(candidate));
      } catch {
        // Malformed snapshots cannot be assigned to a week.
      }
    }
  }
  return weeks;
}

export function auditMatchesPersonWeek(
  row: AuditRow,
  personId: string,
  week: string,
): boolean {
  return auditEmployeeId(row) === personId && auditWeekStarts(row).has(week);
}

export function auditLabel(row: AuditRow): { label: string; note?: string } | null {
  const detail = asRecord(row.detail);
  const reason = stringValue(detail.reason || detail.comment).trim();
  switch (row.action) {
    case "week.submitted":
      return { label: "Submitted for review" };
    case "week.approved":
      return { label: "Approved", ...(reason ? { note: reason } : {}) };
    case "week.rejected":
      return { label: reason ? "Denied — reason shown" : "Denied", ...(reason ? { note: reason } : {}) };
    case "week.reopen":
      return { label: "Week reopened", ...(reason ? { note: reason } : {}) };
    case "time.corrected":
    case "time.edited":
      return { label: "Entry edited", ...(reason ? { note: reason } : {}) };
    case "time.deleted":
      return { label: reason ? "Entry deleted — reason shown" : "Entry deleted", ...(reason ? { note: reason } : {}) };
    case "time.manual":
      return { label: "Time entry recorded" };
    case "time.clock_in":
      return { label: "Clock started" };
    case "time.clock_out":
      return { label: "Clock stopped" };
    default:
      return null;
  }
}

export function auditActorName(
  row: AuditRow,
  employees: TeamBootstrap["employees"],
): string {
  return employees.find((employee) => employee.auth_user_id === row.actor_id)?.name || "Admin";
}

export function formatAuditTimestamp(value: string, timezone: string) {
  const date = new Date(value);
  return {
    dateTime: date.toISOString(),
    text: new Intl.DateTimeFormat("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: timezone,
    }).format(date),
  };
}

export function reviewAuditForPersonWeek(
  rows: AuditRow[],
  personId: string,
  week: string,
) {
  return rows
    .filter((row) => auditMatchesPersonWeek(row, personId, week))
    .filter((row) => auditLabel(row) !== null)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

