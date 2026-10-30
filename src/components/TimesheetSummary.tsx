import { timesheetTotals } from "../../shared/timesheetTotals";
import type { PortalTimeEntry } from "../../shared/employeePortal";
import { formatDuration } from "./timesheets/format";

const money = (amount: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount);

export function TimesheetSummary({
  entries,
  hourlyRate,
  showRate = false,
  showPay = true,
}: {
  entries: readonly PortalTimeEntry[];
  hourlyRate?: number | null;
  showPay?: boolean;
  showRate?: boolean;
  compact?: boolean;
}) {
  const totals = timesheetTotals(entries);
  const approvedPay =
    totals.approvedMinutes === 0
      ? "No approved hours"
      : totals.approvedPay === null
        ? "Unavailable"
        : money(totals.approvedPay);
  return (
    <section className="rounded-xl border border-border bg-card p-4" aria-label="Timesheet details">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <p className="text-sm text-muted-foreground">Break <strong className="ml-1 text-foreground">{formatDuration(totals.breakMinutes)}</strong></p>
        <p className="text-sm text-muted-foreground">Paid <strong className="ml-1 text-foreground">{formatDuration(totals.paidMinutes)}</strong></p>
        {showPay && <p className="text-sm text-muted-foreground">Approved pay <strong className="ml-1 text-foreground">{approvedPay}</strong></p>}
      </div>
      {showRate && <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">Current hourly pay rate: <strong className="text-foreground">{hourlyRate == null ? "Not set" : `${money(hourlyRate)} / hr`}</strong></p>}
      {totals.missingRateCount > 0 && showPay && <p className="mt-2 text-sm text-warning">{totals.missingRateCount} approved {totals.missingRateCount === 1 ? "entry is" : "entries are"} missing a recorded rate.</p>}
      {totals.runningCount > 0 && <p className="mt-2 text-sm text-warning">{totals.runningCount} running {totals.runningCount === 1 ? "clock is" : "clocks are"} excluded.</p>}
    </section>
  );
}
