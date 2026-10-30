import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useQuoteSummaries } from '@/hooks/useQuoteSummaries';
import { useDashboardInvoices } from '@/hooks/useDashboardInvoices';
import { awaitingQuoteResponse, jobDisplayStatus, type QuoteSummary } from '@/lib/quoteDisplay';
import { awaitingClientApproval, needsTradeResponse } from '@/lib/variationStatus';
import type { Project } from '@/types/project';
import { cn } from '@/lib/utils';

interface DashboardStatsProps {
  projects: Project[];
  loading?: boolean;
}

function formatMoney(value: number | null) {
  return value === null ? '—' : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
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
  }[] = [
    {
      label: 'Active Jobs', value: active.length,
      subtitle: recentUpdate ? `Updated ${formatDistanceToNow(recentUpdate, { addSuffix: true })}` : 'No active jobs yet',
      href: '/projects?status=in_progress',
      title: 'Jobs currently in progress. Mutually exclusive with jobs awaiting quote response.',
      testId: 'stat-active-projects',
    },
    {
      label: 'Variations awaiting action', value: pendingVariationCount,
      subtitle: `${needsTradeResponseCount} need your response · ${pendingVariationCount - needsTradeResponseCount} awaiting client across ${pendingJobs} job${pendingJobs === 1 ? '' : 's'}`,
      href: '/variations?filter=needs-action',
      title: 'Includes client requests that need your response and trade variations awaiting client approval.',
      testId: 'stat-pending-approvals',
      highlight: pendingVariationCount > 0,
    },
    {
      label: 'Awaiting Response', value: quoteUnavailable ? '—' : awaiting.length,
      subtitle: quoteUnavailable ? 'Quote data unavailable' : awaiting.length ? 'Latest sent quote, no decision' : 'No unanswered quotes',
      href: '/projects?status=awaiting_response',
      title: 'Jobs with a latest sent quote awaiting a response. Excludes active and completed jobs.',
      testId: 'stat-awaiting-response',
      highlight: awaiting.length > 0,
      loading: quoteQuery.isLoading,
    },
    {
      label: 'Completed', value: completed.length,
      subtitle: 'Jobs marked completed',
      href: '/projects?status=completed',
      title: 'All jobs marked Completed.',
      testId: 'stat-completed',
    },
    {
      label: 'Unpaid invoices ($)', value: formatMoney(unpaidTotal),
      subtitle: unpaidSubtitle,
      href: '/invoices?status=unpaid',
      title: 'Recorded totals on sent and overdue invoices. Draft, paid and cancelled invoices are excluded; partial payments are not tracked.',
      testId: 'stat-unpaid-invoices',
      loading: invoiceQuery.isLoading,
    },
    {
      label: 'Overdue ($)', value: formatMoney(overdueTotal),
      subtitle: overdueSubtitle,
      href: '/invoices?status=overdue',
      title: 'Recorded totals on invoices marked Overdue; partial payments are not tracked.',
      testId: 'stat-overdue-invoices',
      highlight: overdueInvoices.length > 0,
      loading: invoiceQuery.isLoading,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Dashboard statistics">
      {cards.map(card => (
        <Link
          key={card.testId}
          to={card.href}
          title={card.title}
          aria-label={`${card.label}: ${card.loading || loadingCards ? 'loading' : card.value}`}
          data-testid={card.testId}
          className={cn(
            'group min-h-[112px] rounded-xl border border-[#D8C3AD] bg-white px-4 py-3.5 shadow-card transition-colors hover:border-amber-500 hover:bg-amber-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2',
            card.highlight && 'border-amber-500/70'
          )}
        >
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-600">{card.label}</p>
          {loadingCards || card.loading ? (
            <div className="h-8 w-24 animate-pulse rounded bg-amber-100" aria-label="Loading statistic" />
          ) : (
            <p className="mb-1 text-xl font-heading font-bold tabular-nums text-zinc-950 sm:text-2xl">{card.value}</p>
          )}
          <p className={cn('text-xs leading-4', card.highlight ? 'font-medium text-amber-900' : 'text-zinc-600')}>{card.subtitle}</p>
        </Link>
      ))}
    </div>
  );
}
