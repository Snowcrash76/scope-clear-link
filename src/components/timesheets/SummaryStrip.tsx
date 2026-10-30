import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatHours } from "./format";

export interface SummaryMetric {
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "warning" | "success";
}

export function SummaryStrip({ metrics, runningCount = 0, payNote = false }: { metrics: SummaryMetric[]; runningCount?: number; payNote?: boolean }) {
  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {metrics.map((metric) => <div key={metric.label} className="min-w-0 rounded-xl bg-muted/70 p-3 sm:p-4">
        <p className="text-sm font-medium text-muted-foreground">{metric.label}</p>
        <p className={`mt-1 break-words text-xl font-bold tabular-nums ${metric.tone === "warning" ? "text-warning" : metric.tone === "success" ? "text-success" : "text-foreground"}`}>{metric.value}</p>
        {metric.detail && <p className="mt-1 text-sm text-muted-foreground">{metric.detail}</p>}
      </div>)}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {runningCount > 0 && <span className="inline-flex min-h-8 items-center gap-2 rounded-full bg-warning/15 px-3 text-sm font-semibold text-warning">Running clocks · {runningCount} · excluded from paid total</span>}
      {payNote && <TooltipProvider><Tooltip><TooltipTrigger asChild><button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground underline decoration-dotted underline-offset-4"><Info className="h-4 w-4" />About pay estimate</button></TooltipTrigger><TooltipContent className="max-w-64">Estimate uses approved hours only and excludes tax, super, overtime, deductions and payments made.</TooltipContent></Tooltip></TooltipProvider>}
    </div>
  </div>;
}

export { formatHours };
