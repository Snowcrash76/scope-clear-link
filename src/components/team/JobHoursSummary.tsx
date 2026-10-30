import { Link } from "react-router-dom";
import { ArrowRight, Clock3 } from "lucide-react";
import { formatDuration } from "@/components/timesheets";
import type { PortalTimeEntry } from "../../../shared/employeePortal";
import { jobHoursLogged } from "./jobTimesheetSummary";

export function JobHoursSummary({ entries, jobId }: { entries: readonly PortalTimeEntry[]; jobId: string }) {
  const minutes = jobHoursLogged(entries, jobId);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-muted-foreground"><Clock3 className="h-5 w-5" /></span>
        <div><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hours logged</p><p className="mt-0.5 text-lg font-bold tabular-nums">{formatDuration(minutes)}</p><p className="text-xs text-muted-foreground">Approved + submitted</p></div>
      </div>
      <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4" to={`/team/timesheets?job=${encodeURIComponent(jobId)}`}>View timesheets for this job <ArrowRight className="h-4 w-4" /></Link>
    </div>
  );
}
