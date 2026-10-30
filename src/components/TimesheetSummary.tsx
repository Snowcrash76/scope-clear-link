import { timesheetTotals } from "../../shared/timesheetTotals";
import type { PortalTimeEntry } from "../../shared/employeePortal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";
import { Info } from "lucide-react";

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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="About estimated approved pay" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
                  <Info className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-64">
                Estimate uses approved hours only and excludes tax, super, overtime, deductions and payments made. It is not an outstanding balance.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="mt-2 inline-flex min-h-8 items-center rounded-full bg-warning/15 px-3 text-xs font-semibold text-warning underline decoration-dotted underline-offset-2">
                Missing recorded rate · {totals.missingRateCount}
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-64">
              {totals.missingRateCount} approved {totals.missingRateCount === 1 ? "entry is" : "entries are"} missing a recorded rate, so the estimate may be incomplete.
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
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
