import type { PortalTimeEntry } from './employeePortal';

/** Approved pay is estimated at the rate recorded when each entry was approved. */
export function timesheetTotals(entries: readonly PortalTimeEntry[]) {
  let workedMinutes = 0, breakMinutes = 0, paidMinutes = 0;
  let approvedMinutes = 0, submittedMinutes = 0, draftMinutes = 0;
  let runningCount = 0, missingRateCount = 0, approvedCents = 0;
  for (const entry of entries) {
    if (!entry.ended_at) { runningCount++; continue; }
    const gross = Math.round((Date.parse(entry.ended_at) - Date.parse(entry.started_at)) / 60000);
    const unpaid = Math.max(0, entry.break_minutes);
    const paid = entry.paid_minutes ?? Math.max(0, gross - unpaid);
    if (!Number.isFinite(paid) || !Number.isFinite(gross) || paid < 0 || gross <= 0) continue;
    workedMinutes += paid + unpaid;
    breakMinutes += unpaid;
    paidMinutes += paid;
    if (entry.status === 'approved') {
      approvedMinutes += paid;
      const rate = entry.rate_snapshot;
      if (rate == null || !Number.isFinite(rate) || rate < 0) missingRateCount++;
      else approvedCents += Math.round(paid * Math.round(rate * 100) / 60);
    } else if (entry.status === 'submitted') submittedMinutes += paid;
    else draftMinutes += paid;
  }
  return {
    workedMinutes, breakMinutes, paidMinutes, approvedMinutes, submittedMinutes, draftMinutes,
    runningCount, missingRateCount, approvedPay: missingRateCount ? null : approvedCents / 100,
  };
}
