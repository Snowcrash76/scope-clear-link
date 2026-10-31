import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type KpiCardProps = {
  label: string;
  value: ReactNode;
  description: ReactNode;
  definition: string;
  href?: string;
  onClick?: () => void;
  tone?: "primary" | "warning" | "purple" | "neutral";
};
const tones = {
  primary: "bg-primary",
  warning: "bg-warning",
  purple: "bg-[hsl(var(--purple))]",
  neutral: "bg-muted-foreground",
};
/** Presentation only: callers supply authoritative values and existing actions. */
export function KpiCard({ label, value, description, definition, href, onClick, tone = "primary" }: KpiCardProps) {
  const content = <>
    <p className="pr-8 text-xs font-semibold uppercase tracking-[.06em] text-muted-foreground">{label}</p>
    <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
  </>;
  const classes = "block h-full w-full rounded-2xl p-5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
  return <article className="relative min-w-0 rounded-2xl border border-border bg-card shadow-card">
    <span className={cn("absolute inset-x-3 top-0 h-[3px] rounded-full", tones[tone])} aria-hidden="true" />
    {href ? <Link to={href} onClick={onClick} className={cn(classes, "hover:bg-muted/50")}>{content}</Link>
      : onClick ? <button type="button" className={cn(classes, "hover:bg-muted/50")} onClick={onClick}>{content}</button>
      : <div className={classes}>{content}</div>}
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={`${label}: definition`} className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:text-primary">
          <Info className="h-4 w-4" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{definition}</TooltipContent>
    </Tooltip>
  </article>;
}
