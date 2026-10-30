import { timesheetTotals } from "../../shared/timesheetTotals";
import type { PortalTimeEntry } from "../../shared/employeePortal";
import { Info } from "lucide-react";
import { InfoPopover } from "@/components/timesheets/InfoPopover";

const money = (amount: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
    amount,
  );

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
    <section
      className="rounded-xl border border-border bg-card p-4"
      aria-label="Timesheet details"
    >
      {showPay && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>Estimated approved pay</span>
          <strong className="text-base tabular-nums text-foreground">{approvedPay}</strong>
          <InfoPopover
            label="About estimated approved pay"
            content="Estimate uses approved hours only and excludes tax, super, overtime, deductions and payments made. It is not an outstanding balance."
            className="text-muted-foreground hover:bg-muted"
          />
        </div>
      )}
      {showRate && (
        <p className="mt-3 border-t border-border pt-3 text-sm text-muted-foreground">
          Current hourly pay rate:{" "}
          <strong className="text-foreground">
            {hourlyRate == null ? "Not set" : `${money(hourlyRate)} / hr`}
          </strong>
        </p>
      )}
      {totals.missingRateCount > 0 && showPay && (
        <InfoPopover
          label={`Missing recorded rate: ${totals.missingRateCount} approved ${totals.missingRateCount === 1 ? "entry" : "entries"}`}
          content={`${totals.missingRateCount} approved ${totals.missingRateCount === 1 ? "entry is" : "entries are"} missing a recorded rate, so the estimate may be incomplete.`}
          className="mt-2 rounded-full bg-warning/15 px-3 text-xs font-semibold text-warning underline decoration-dotted underline-offset-2"
        >
          <>Missing recorded rate · {totals.missingRateCount}<Info className="h-4 w-4 shrink-0" aria-hidden="true" /></>
        </InfoPopover>
      )}
      {totals.runningCount > 0 && (
        <p className="mt-2 text-sm text-warning">
          {totals.runningCount} running{" "}
          {totals.runningCount === 1 ? "clock is" : "clocks are"} excluded.
        </p>
      )}
    </section>
  );
}
