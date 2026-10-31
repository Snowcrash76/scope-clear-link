import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useQuoteSummaries } from '@/hooks/useQuoteSummaries';
import { useDashboardInvoices } from '@/hooks/useDashboardInvoices';
import { awaitingQuoteResponse, jobDisplayStatus, type QuoteSummary } from '@/lib/quoteDisplay';
import { awaitingClientApproval, needsTradeResponse } from '@/lib/variationStatus';
import type { Project } from '@/types/project';
import { cn } from '@/lib/utils';
import { BriefcaseBusiness, GitBranch, Hourglass, CircleCheck, Receipt, TriangleAlert } from 'lucide-react';
import { aud } from '@/hooks/useJobCosts';

interface DashboardStatsProps {
  projects: Project[];
  loading?: boolean;
}

function formatMoney(value: number | null) {
  return value === null ? '—' : aud(value);
}

function latestQuotes(quotes: QuoteSummary[]) {
  const latest = new Map<string, QuoteSummary>();
  for (const quote of [...quotes].sort((a, b) =>
    Number(a.status === 'declined') - Number(b.status === 'declined') || b.created_at.localeCompare(a.created_at))) {
    if (!latest.has(quote.project_id)) latest.set(quote.project_id, quote);
  }
  return latest;
}

export function DashboardStats({ projects, loading = false }: DashboardStatsProps) {
  const quoteQuery = useQuoteSummaries(projects.map(project => project.id));
  const invoiceQuery = useDashboardInvoices(projects.map(project => project.id));
  const quotesByProject = latestQuotes(quoteQuery.data ?? []);
  const awaiting = projects.filter(project => awaitingQuoteResponse(project, quotesByProject.get(project.id)));
  const active = projects.filter(project =>
    jobDisplayStatus(project, quotesByProject.get(project.id)) === 'in_progress' &&
    !awaitingQuoteResponse(project, quotesByProject.get(project.id))
  );
  const completed = projects.filter(project => jobDisplayStatus(project, quotesByProject.get(project.id)) === 'completed');
  const pendingVariationCount = projects.reduce((total, project) =>
    total + project.changeRequests.filter(variation => needsTradeResponse(variation) || awaitingClientApproval(variation)).length, 0);
  const needsTradeResponseCount = projects.reduce((total, project) =>
    total + project.changeRequests.filter(needsTradeResponse).length, 0);
  const pendingJobs = projects.filter(project => project.changeRequests.some(variation => needsTradeResponse(variation) || awaitingClientApproval(variation))).length;
  const overdueInvoices = (invoiceQuery.data ?? []).filter(invoice => invoice.status === 'overdue');
  const unpaidInvoices = (invoiceQuery.data ?? []).filter(invoice => invoice.status === 'sent' || invoice.status === 'overdue');
  const sumBalances = (rows: typeof overdueInvoices) => {
    let total = 0;
    for (const invoice of rows) {
      if (invoice.total === null || !Number.isFinite(invoice.total)) return null;
      total += invoice.total;
    }
    return total;
  };
  const unpaidTotal = invoiceQuery.isError ? null : sumBalances(unpaidInvoices);
  const overdueTotal = invoiceQuery.isError ? null : sumBalances(overdueInvoices);
  const recentUpdate = active.reduce<Date | null>((latest, project) =>
    latest === null || project.updatedAt > latest ? project.updatedAt : latest, null);
  const quoteUnavailable = quoteQuery.isError;
  const invoiceError = invoiceQuery.isError;
  const loadingCards = loading;
  const unpaidSubtitle = invoiceError ? 'Invoice data unavailable' : unpaidTotal === null ? 'One or more totals unavailable' : unpaidInvoices.length ? 'Recorded sent + overdue totals' : 'No recorded unpaid invoices';
  const overdueSubtitle = invoiceError ? 'Invoice data unavailable' : overdueTotal === null ? 'One or more totals unavailable' : overdueInvoices.length ? `${overdueInvoices.length} overdue invoice${overdueInvoices.length === 1 ? '' : 's'} · recorded total` : 'No overdue invoices';

  const cards: {
    label: string;
    value: ReactNode;
    subtitle: string;
    href: string;
    title: string;
    testId: string;
    highlight?: boolean;
    loading?: boolean;
    accent: string;
    iconTone: string;
    iconBg: string;
    Icon: typeof BriefcaseBusiness;
  }[] = [
    {
      label: 'Active Jobs', value: active.length,
      subtitle: recentUpdate ? `Updated ${formatDistanceToNow(recentUpdate, { addSuffix: true })}` : 'No active jobs yet',
      href: '/projects?status=in_progress',
      title: 'Jobs currently in progress. Mutually exclusive with jobs awaiting quote response.',
      testId: 'stat-active-projects',
      accent: 'bg-primary',
      iconTone: 'text-primary',
      iconBg: 'bg-[hsl(var(--info-soft))]',
      Icon: BriefcaseBusiness,
    },
    {
      label: 'Variations awaiting action', value: pendingVariationCount,
      subtitle: `${needsTradeResponseCount} need your response · ${pendingVariationCount - needsTradeResponseCount} awaiting client across ${pendingJobs} job${pendingJobs === 1 ? '' : 's'}`,
      href: '/variations?filter=needs-action',
      title: 'Includes client requests that need your response and trade variations awaiting client approval.',
      testId: 'stat-pending-approvals',
      highlight: pendingVariationCount > 0,
      accent: 'bg-warning',
      iconTone: 'text-warning',
      iconBg: 'bg-[hsl(var(--warning-soft))]',
      Icon: GitBranch,
    },
    {
      label: 'Awaiting Response', value: quoteUnavailable ? '—' : awaiting.length,
      subtitle: quoteUnavailable ? 'Quote data unavailable' : awaiting.length ? 'Latest sent quote, no decision' : 'No unanswered quotes',
      href: '/projects?status=awaiting_response',
      title: 'Jobs with a latest sent quote awaiting a response. Excludes active and completed jobs.',
      testId: 'stat-awaiting-response',
      highlight: awaiting.length > 0,
      loading: quoteQuery.isLoading,
      accent: 'bg-[hsl(var(--purple))]',
      iconTone: 'text-[hsl(var(--purple))]',
      iconBg: 'bg-[hsl(var(--purple-soft))]',
      Icon: Hourglass,
    },
    {
      label: 'Completed', value: completed.length,
      subtitle: 'Jobs marked completed',
      href: '/projects?status=completed',
      title: 'All jobs marked Completed.',
      testId: 'stat-completed',
      accent: 'bg-success',
      iconTone: 'text-success',
      iconBg: 'bg-[hsl(var(--success-soft))]',
      Icon: CircleCheck,
    },
    {
      label: 'Unpaid invoices ($)', value: formatMoney(unpaidTotal),
      subtitle: unpaidSubtitle,
      href: '/invoices?status=unpaid',
      title: 'Recorded totals on sent and overdue invoices. Draft, paid and cancelled invoices are excluded; partial payments are not tracked.',
      testId: 'stat-unpaid-invoices',
      loading: invoiceQuery.isLoading,
      accent: 'bg-info',
      iconTone: 'text-info',
      iconBg: 'bg-[hsl(var(--info-soft))]',
      Icon: Receipt,
    },
    {
      label: 'Overdue ($)', value: formatMoney(overdueTotal),
      subtitle: overdueSubtitle,
      href: '/invoices?status=overdue',
      title: 'Recorded totals on invoices marked Overdue; partial payments are not tracked.',
      testId: 'stat-overdue-invoices',
      highlight: overdueInvoices.length > 0,
      loading: invoiceQuery.isLoading,
      accent: 'bg-destructive',
      iconTone: 'text-destructive',
      iconBg: 'bg-[hsl(var(--danger-soft))]',
      Icon: TriangleAlert,
    },
  ];

  return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Dashboard statistics">
      {cards.map(card => (
        <Link
          key={card.testId}
          to={card.href}
          title={card.title}
          aria-label={`${card.label}: ${card.loading || loadingCards ? 'loading' : card.value}`}
          data-testid={card.testId}
          className={cn(
            'group relative min-h-[150px] overflow-hidden rounded-2xl border border-border bg-card px-5 pb-4 pt-5 shadow-card transition-colors hover:border-primary/40 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
        >
          <span className={cn("absolute inset-x-0 top-0 h-[3px]", card.accent)} aria-hidden="true" />
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[.06em] text-muted-foreground">{card.label}</p>
            <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", card.iconBg, card.iconTone)}>
              <card.Icon className="h-4 w-4" aria-hidden="true" />
            </span>
          </div>
          {loadingCards || card.loading ? (
            <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" aria-label="Loading statistic" />
          ) : (
            <p className="mb-1 text-[32px] leading-9 font-heading font-bold tabular-nums tracking-tight text-foreground">{card.value}</p>
          )}
          <p className={cn('text-sm leading-5', card.highlight ? 'font-medium text-foreground' : 'text-muted-foreground')}>{card.subtitle}</p>
        </Link>
      ))}
    </div>
  );
}
