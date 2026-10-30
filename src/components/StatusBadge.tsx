import {
  Check,
  Clock,
  X,
  Send,
  CircleDot,
  Briefcase,
  CircleCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  size?: "sm" | "default";
  viewerRole?: "client" | "trade";
  className?: string;
}

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    label: "Pending",
    className: "bg-warning/10 text-warning border-warning/25",
  },
  awaiting_client: {
    icon: Send,
    label: null,
    className: "bg-warning/10 text-warning border-warning/25",
  },
  approved: {
    icon: Check,
    label: "Approved",
    className: "bg-success/10 text-success border-success/25",
  },
  declined: {
    icon: X,
    label: "Declined",
    className: "bg-destructive/10 text-destructive border-destructive/25",
  },
  acknowledged: {
    icon: Check,
    label: "Acknowledged",
    className: "bg-success/10 text-success border-success/25",
  },
  draft: {
    icon: CircleDot,
    label: "Draft",
    className: "bg-muted text-muted-foreground border-border",
  },
  sent: {
    icon: Send,
    label: "Sent",
    className: "bg-warning/10 text-warning border-warning/25",
  },
  expired: {
    icon: Clock,
    label: "Expired",
    className: "bg-muted text-muted-foreground border-border",
  },
  lead: {
    icon: CircleDot,
    label: "Lead",
    className: "bg-muted text-muted-foreground border-border",
  },
  quoted: {
    icon: Send,
    label: "Quoted",
    className: "bg-warning/10 text-warning border-warning/25",
  },
  in_progress: {
    icon: Briefcase,
    label: "In progress",
    className: "bg-info/10 text-info border-info/25",
  },
  completed: {
    icon: CircleCheck,
    label: "Completed",
    className: "bg-success/10 text-success border-success/25",
  },
} as const;

export function StatusBadge({
  status,
  size = "default",
  viewerRole,
  className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? {
    icon: CircleDot,
    label: status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    className: "bg-muted text-foreground border-border",
  };
  const Icon = config.icon;
  const label =
    status === "awaiting_client"
      ? viewerRole === "client"
        ? "Awaiting Your Approval"
        : "Sent to Client"
      : config.label;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border font-medium transition-colors",
        config.className,
        className,
        size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1",
      )}
      aria-label={`Status: ${label}`}
    >
      <Icon className={size === "sm" ? "w-3 h-3 mr-1" : "w-3.5 h-3.5 mr-1.5"} />
      {label}
    </span>
  );
}
