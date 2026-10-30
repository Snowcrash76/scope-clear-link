import { Info } from "lucide-react";
import { InfoPopover } from "./InfoPopover";
import { formatHours } from "./format";

export interface SummaryMetric {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "warning" | "success";
  tooltip?: string;
  warning?: string;
  warningTooltip?: string;
}

export function SummaryStrip({
  metrics,
  runningCount = 0,
}: {
  metrics: SummaryMetric[];
  runningCount?: number;
}) {
  const total = metrics.find((metric) => metric.label === "Total hours") ?? metrics[0];
  const pay = metrics.find((metric) => metric.label === "Estimated approved pay");
  const statuses = metrics.filter(
    (metric) => metric !== total && metric !== pay,
  );

  return (
    <section className="space-y-3" aria-label="Weekly timesheet summary">
      <div className={`grid gap-4 ${pay ? "sm:grid-cols-[minmax(0,1fr)_auto]" : ""}`}>
        {total && (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-muted-foreground">Total hours</p>
            {total.tooltip ? (
              <InfoPopover
                label={`Total hours: ${total.value}. ${total.tooltip}`}
                content={total.tooltip}
                testId="manager-total-hours"
                className="mt-1 max-w-full text-left text-3xl font-bold tabular-nums text-foreground underline decoration-dotted underline-offset-4"
              >
                <>{total.value}<Info className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /></>
              </InfoPopover>
            ) : <p className="mt-1 text-3xl font-bold tabular-nums">{total.value}</p>}
          </div>
        )}
        {pay && (
          <div className="min-w-0 sm:min-w-48">
            <p className="text-sm font-semibold text-muted-foreground">{pay.label}</p>
            {pay.tooltip ? (
              <InfoPopover
                label={`${pay.label}: ${pay.value}. ${pay.tooltip}`}
                content={pay.tooltip}
                className={`mt-1 max-w-full text-left text-xl font-bold tabular-nums ${pay.tone === "success" ? "text-success" : "text-foreground"} underline decoration-dotted underline-offset-4`}
              >
                <>{pay.value}<Info className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /></>
              </InfoPopover>
            ) : <p className="mt-1 text-xl font-bold tabular-nums">{pay.value}</p>}
            {pay.warning && pay.warningTooltip && (
              <InfoPopover
                label={`${pay.warning}. ${pay.warningTooltip}`}
                content={pay.warningTooltip}
                className="mt-1 max-w-full rounded-full bg-warning/15 px-3 text-sm font-semibold text-warning underline decoration-dotted underline-offset-2"
              >
                <>{pay.warning}<Info className="h-4 w-4 shrink-0" aria-hidden="true" /></>
              </InfoPopover>
            )}
          </div>
        )}
      </div>
      {statuses.length > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-2 text-sm text-muted-foreground" aria-label="Timesheet status totals">
          {statuses.map((metric, index) => (
            <span key={metric.label}>
              {index > 0 && <span aria-hidden="true" className="mr-2">·</span>}
              <span>{metric.label} </span>
              <strong className={metric.tone === "warning" ? "font-semibold text-warning" : metric.tone === "success" ? "font-semibold text-success" : "font-semibold text-foreground"}>
                {metric.value}
              </strong>
              {metric.detail && <span> · {metric.detail}</span>}
            </span>
          ))}
        </p>
      )}
      {runningCount > 0 && (
        <p className="text-sm font-semibold text-warning">
          Running clocks · {runningCount} · excluded from paid total
        </p>
      )}
    </section>
  );
}

export { formatHours };
