import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="min-w-0 rounded-xl bg-muted/70 p-3 sm:p-4"
          >
            <p className="text-sm font-medium text-muted-foreground">
              {metric.label}
            </p>
            {metric.tooltip ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" aria-label={`${metric.label}: ${metric.value}. ${metric.tooltip}`} className={`mt-1 min-h-11 break-words text-left text-xl font-bold tabular-nums underline decoration-dotted underline-offset-4 ${metric.tone === "success" ? "text-success" : "text-foreground"}`}>
                      {metric.value}<Info className="ml-1 inline h-4 w-4 align-middle text-muted-foreground" aria-hidden="true" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-72">{metric.tooltip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : (
              <p className={`mt-1 break-words text-xl font-bold tabular-nums ${metric.tone === "success" ? "text-success" : "text-foreground"}`}>
                {metric.value}
              </p>
            )}
            {metric.detail && (
              <p className="mt-1 text-sm text-muted-foreground">
                {metric.detail}
              </p>
            )}
            {metric.warning && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="mt-2 inline-flex min-h-8 items-center rounded-full bg-warning/15 px-2 text-xs font-semibold text-warning underline decoration-dotted underline-offset-2">
                      {metric.warning}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-72">{metric.warningTooltip}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {runningCount > 0 && (
          <span className="inline-flex min-h-8 items-center gap-2 rounded-full bg-warning/15 px-3 text-sm font-semibold text-foreground">
            Running clocks · {runningCount} · excluded from paid total
          </span>
        )}
      </div>
    </div>
  );
}

export { formatHours };
