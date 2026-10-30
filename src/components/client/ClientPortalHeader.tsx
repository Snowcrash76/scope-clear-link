import { Badge } from '@/components/ui/badge';
import { CalendarDays, Building2, UserRound } from 'lucide-react';

type ClientPortalHeaderProps = {
  businessName: string;
  projectName: string;
  clientName?: string;
  statusLabel: string;
  statusVariant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'pending';
  logoUrl?: string | null;
  referenceLabel?: string;
  createdAt?: Date | string;
};

export function ClientPortalHeader({
  businessName,
  projectName,
  clientName,
  statusLabel,
  statusVariant = 'secondary',
  logoUrl,
  referenceLabel,
  createdAt,
}: ClientPortalHeaderProps) {
  const dateLabel = createdAt
    ? new Date(createdAt).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex w-full max-w-4xl min-w-0 flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6">
        <div className="flex min-w-0 items-start gap-3">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${businessName || 'Business'} logo`}
              className="h-11 w-11 shrink-0 rounded-xl border border-border bg-background object-contain p-1"
            />
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary" aria-hidden="true">
              <Building2 className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-sm font-medium text-muted-foreground">
              <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="break-words [overflow-wrap:anywhere]">{businessName || 'Your project team'}</span>
            </div>
            {referenceLabel && (
              <p className="mt-1 text-sm font-semibold text-primary">{referenceLabel}</p>
            )}
            <h1 className="mt-1 break-words [overflow-wrap:anywhere] font-heading text-2xl font-bold leading-tight text-foreground sm:text-3xl">
              {projectName}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {clientName && (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="break-words [overflow-wrap:anywhere]">Prepared for {clientName}</span>
                </span>
              )}
              {dateLabel && (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Issued {dateLabel}</span>
                </span>
              )}
            </div>
          </div>
        </div>
        <Badge variant={statusVariant} className="self-start text-sm sm:self-center">
          {statusLabel}
        </Badge>
      </div>
    </header>
  );
}
