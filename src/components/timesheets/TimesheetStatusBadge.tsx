import { StatusBadge } from "@/components/ui/status-badge";

export type TimesheetStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "running";

export function TimesheetStatusBadge({ status }: { status: TimesheetStatus }) {
  const label = status === "running" ? "Running" : status[0].toUpperCase() + status.slice(1);
  const centralStatus =
    status === "running" || status === "submitted"
      ? "pending"
      : status === "rejected"
        ? "declined"
        : status;
  return <StatusBadge status={centralStatus} labelOverride={label} size="sm" />;
}
