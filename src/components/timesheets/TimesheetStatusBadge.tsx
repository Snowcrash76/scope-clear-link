import { Check, Circle, Clock3, RotateCcw, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type TimesheetStatus = "draft" | "submitted" | "approved" | "rejected" | "running";

const mapping: Record<TimesheetStatus, { label: string; styles: string; Icon: LucideIcon }> = {
  draft: { label: "Draft", styles: "bg-muted text-muted-foreground", Icon: Circle },
  submitted: { label: "Submitted", styles: "bg-warning/15 text-warning", Icon: Send },
  approved: { label: "Approved", styles: "bg-success/15 text-success", Icon: Check },
  rejected: { label: "Rejected", styles: "bg-destructive/10 text-destructive", Icon: RotateCcw },
  running: { label: "Running", styles: "bg-warning/15 text-warning", Icon: Clock3 },
};

export function TimesheetStatusBadge({ status }: { status: TimesheetStatus }) {
  const { label, styles, Icon } = mapping[status];
  return <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold ${styles}`}><Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}</span>;
}
