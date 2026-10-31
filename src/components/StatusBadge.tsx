import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "default";
  viewerRole?: "client" | "trade";
  className?: string;
}

const STATUS_CONFIG = {
  pending: {
    label: "Pending",
    className: "bg-[hsl(var(--warning-soft))] text-warning border-warning/20",
    dot: "bg-warning",
  },
  awaiting_client: {
    label: null,
    className: "bg-[hsl(var(--purple-soft))] text-[hsl(var(--purple))] border-[hsl(var(--purple)/.18)]",
    dot: "bg-[hsl(var(--purple))]",
  },
  approved: {
    label: "Approved",
    className: "bg-[hsl(var(--success-soft))] text-success border-success/25",
    dot: "bg-success",
  },
  declined: {
    label: "Declined",
    className: "bg-[hsl(var(--danger-soft))] text-destructive border-destructive/25",
    dot: "bg-destructive",
  },
  acknowledged: {
    label: "Acknowledged",
    className: "bg-[hsl(var(--success-soft))] text-success border-success/25",
    dot: "bg-success",
  },
  draft: {
    label: "Draft",
    className: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
  sent: {
    label: "Sent",
    className: "bg-[hsl(var(--info-soft))] text-info border-info/20",
    dot: "bg-info",
  },
  expired: {
    label: "Expired",
    className: "bg-[hsl(var(--danger-soft))] text-destructive border-destructive/20",
    dot: "bg-destructive",
  },
  lead: {
    label: "Lead",
    className: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground",
  },
  quoted: {
    label: "Quoted",
    className: "bg-[hsl(var(--purple-soft))] text-[hsl(var(--purple))] border-[hsl(var(--purple)/.18)]",
    dot: "bg-[hsl(var(--purple))]",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-[hsl(var(--warning-soft))] text-warning border-warning/20",
    dot: "bg-warning",
  },
  completed: {
    label: "Completed",
    className: "bg-[hsl(var(--success-soft))] text-success border-success/25",
    dot: "bg-success",
  },
  overdue: {
    label: "Overdue",
    className: "bg-[hsl(var(--danger-soft))] text-destructive border-destructive/25",
    dot: "bg-destructive",
  },
  awaiting_response: {
    label: "Awaiting Response",
    className: "bg-[hsl(var(--purple-soft))] text-[hsl(var(--purple))] border-[hsl(var(--purple)/.18)]",
    dot: "bg-[hsl(var(--purple))]",
  },
} as const;

export function StatusBadge({
  status,
  size = "default",
  viewerRole,
  className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? {
    label: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    className: "bg-muted text-foreground border-border",
    dot: "bg-muted-foreground",
  };
  const label =
    status === "awaiting_client"
      ? viewerRole === "client"
        ? "Awaiting Your Approval"
        : "Sent to Client"
      : config.label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium transition-colors",
        config.className,
        className,
        size === "sm" ? "text-xs px-2 py-1" : "text-[13px] px-2.5 py-1",
      )}
      aria-label={`Status: ${label}`}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", config.dot)} aria-hidden="true" />
      {label}
    </span>
  );
}
