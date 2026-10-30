import type { PortalTimeEntry } from "../../../shared/employeePortal";

export function shiftWeek(week: string, amount: number) {
  const date = new Date(`${week}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount * 7);
  return date.toISOString().slice(0, 10);
}

export function sortReviewRows<T extends { status: string; name: string }>(rows: T[]) {
  return [...rows].sort((a, b) => Number(b.status === "submitted") - Number(a.status === "submitted") || a.name.localeCompare(b.name));
}

export function groupEntriesByDay(entries: readonly PortalTimeEntry[]) {
  const groups = new Map<string, PortalTimeEntry[]>();
  entries.forEach((entry) => groups.set(entry.work_date, [...(groups.get(entry.work_date) ?? []), entry]));
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}
