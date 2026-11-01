import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  description,
  accent = "bg-primary",
  href,
  title,
  testId,
  icon: Icon,
  iconTone = "text-primary",
  iconBackground = "bg-accent",
  highlight = false,
  loading = false,
  accessibleValue,
  className = "",
}: {
  label: string;
  value: ReactNode;
  description?: ReactNode;
  accent?: string;
  href: string;
  title?: string;
  testId?: string;
  icon?: LucideIcon;
  iconTone?: string;
  iconBackground?: string;
  highlight?: boolean;
  loading?: boolean;
  accessibleValue?: string;
  className?: string;
}) {
  return (
    <Card asChild className={cn("group relative min-h-[132px] min-w-0 overflow-hidden px-3 pb-3 pt-4 transition-colors hover:border-primary/40 hover:bg-accent/30 sm:min-h-[150px] sm:px-5 sm:pb-4 sm:pt-5", className)}>
    <Link
      to={href}
      title={title}
      aria-label={`${label}: ${loading ? "loading" : accessibleValue ?? (typeof value === "string" || typeof value === "number" ? value : "value available")}`}
      data-testid={testId}
      className="block min-w-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <span className={`absolute inset-x-0 top-0 h-[3px] ${accent}`} aria-hidden="true" />
      <div className="mb-2 flex items-start justify-between gap-2 sm:mb-3 sm:items-center sm:gap-3">
        <p className="min-w-0 text-[11px] font-semibold uppercase leading-4 tracking-[.04em] text-muted-foreground sm:text-xs sm:tracking-[.06em]">{label}</p>
        {Icon && <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg sm:h-9 sm:w-9 sm:rounded-xl", iconBackground, iconTone)}><Icon className="h-4 w-4" aria-hidden="true" /></span>}
      </div>
      {loading ? <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" aria-label="Loading statistic" /> : <p className="mb-1 min-w-0 break-words text-[clamp(1rem,5.2vw,2rem)] font-heading font-bold leading-tight tabular-nums tracking-tight text-foreground [overflow-wrap:anywhere] sm:text-[32px] sm:leading-9">{value}</p>}
      {description && <p className={cn("text-xs leading-4 sm:text-sm sm:leading-5", highlight ? "font-medium text-foreground" : "text-muted-foreground")}>{description}</p>}
    </Link>
    </Card>
  );
}
