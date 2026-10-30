import { timesheetTotals } from "../../../shared/timesheetTotals";
import type { PortalTimeEntry } from "../../../shared/employeePortal";

export type LinkedLabourCost = {
  category?: string;
  status?: string;
  amount_inc_gst?: number;
  timesheet_entry_id?: string | null;
};

export function entriesForJob(entries: readonly PortalTimeEntry[], jobId: string): PortalTimeEntry[] {
  return entries.filter((entry) => entry.project_id === jobId);
}

export function jobHoursLogged(entries: readonly PortalTimeEntry[], jobId: string): number {
  const totals = timesheetTotals(entriesForJob(entries, jobId));
  return totals.approvedMinutes + totals.submittedMinutes;
}

export function approvedJobLabour(entries: readonly PortalTimeEntry[], costs: readonly LinkedLabourCost[], jobId: string) {
  const approvedEntries = entriesForJob(entries, jobId).filter((entry) => entry.status === "approved");
  const totals = timesheetTotals(approvedEntries);
  const approvedIds = new Set(approvedEntries.map((entry) => entry.id));
  const matchedCostByEntry = new Map<string, number>();
  for (const cost of costs) {
    const entryId = cost.timesheet_entry_id;
    if (!entryId || !approvedIds.has(entryId) || cost.category !== "Labour" || cost.status !== "confirmed" || typeof cost.amount_inc_gst !== "number" || !Number.isFinite(cost.amount_inc_gst)) continue;
    if (!matchedCostByEntry.has(entryId)) matchedCostByEntry.set(entryId, cost.amount_inc_gst);
  }
  const completeLinkage = approvedIds.size === matchedCostByEntry.size;
  return {
    approvedMinutes: totals.approvedMinutes,
    amount: completeLinkage ? [...matchedCostByEntry.values()].reduce((sum, amount) => sum + amount, 0) : null,
    completeLinkage,
  };
}
