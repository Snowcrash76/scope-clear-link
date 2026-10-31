import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, User } from "lucide-react";
import { StatusBadge } from "@/components/StatusBadge";
import { aud } from "@/hooks/useJobCosts";
import type { Project } from "@/types/project";
import type { QuoteSummary } from "@/lib/quoteDisplay";
import { cn } from "@/lib/utils";

interface JobCardProps {
  project: Project;
  quote?: QuoteSummary;
  status: string;
  children?: ReactNode;
  className?: string;
  testId?: string;
}

export function JobCard({
  project,
  quote,
  status,
  children,
  className,
  testId,
}: JobCardProps) {
  const completed = project.stages.filter((stage) => stage.status === "completed").length;
  const total = project.stages.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : null;
  const currentStage = project.stages.find((stage) => stage.status === "current");
  const validUntil = quote?.valid_until ? new Date(quote.valid_until) : null;
  const hasValidUntil = !!validUntil && !Number.isNaN(validUntil.getTime());
  const hasQuoteValue = typeof quote?.subtotal === "number" && Number.isFinite(quote.subtotal);
  const hasQuoteDetails = hasQuoteValue || hasValidUntil;

  return (
    <Link
      to={`/manage/${project.id}`}
      className={cn(
        "group block min-w-0 rounded-2xl border border-border bg-card transition-colors hover:border-primary/30 hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        className,
      )}
      data-testid={testId}
    >
      <div className="flex min-w-0 items-start gap-3 p-4 sm:gap-4 sm:p-5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary text-lg font-heading font-bold text-primary-foreground" aria-hidden="true">
          {project.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-3 gap-y-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 break-words text-[15px] font-semibold text-foreground">{project.name}</span>
              <StatusBadge status={status} size="sm" />
            </div>
            <span className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-[10px] border border-input bg-card px-3 text-sm font-medium text-foreground transition-colors group-hover:bg-muted">
              Open Job <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          {(project.clientName || quote?.quote_number) && (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {project.clientName && (
                <span className="inline-flex min-w-0 items-center gap-1 break-words">
                  <User className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {project.clientName}
                </span>
              )}
              {quote?.quote_number && <span>Ref. {quote.quote_number}</span>}
            </div>
          )}

          {hasQuoteDetails && (
            <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-border pt-3 sm:grid-cols-2">
              {hasQuoteValue && quote && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.06em] text-muted-foreground">Quote value · ex GST</p>
                  <p className="mt-0.5 font-semibold tabular-nums text-foreground">{aud(quote.subtotal)}</p>
                </div>
              )}
              {hasValidUntil && validUntil && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[.06em] text-muted-foreground">Quote valid until</p>
                  <p className="mt-0.5 font-semibold text-foreground">
                    {new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(validUntil)}
                  </p>
                </div>
              )}
            </div>
          )}

          {progress !== null && (
            <div className={cn("flex flex-wrap items-center gap-3", hasQuoteDetails ? "mt-3 border-t border-border pt-3" : "mt-4 border-t border-border pt-3")}>
              <div className="min-w-0 flex-1">
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span className="truncate">{currentStage?.name ?? (completed === total ? "All stages complete" : "Stage progress")}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-foreground">{progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Stage progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                  <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{completed} of {total} stages</span>
            </div>
          )}
          {children}
        </div>
      </div>
    </Link>
  );
}
