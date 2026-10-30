import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownUp, CircleDollarSign, RefreshCw, Info } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { PageLayout } from '@/components/PageLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useJobProfitability, aud, money, profitability, type RevenueBasis } from '@/hooks/useJobCosts';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { JobCostSetupHelp, isJobCostSetupError } from '@/components/job-costing/JobCostSetupHelp';
import { StatusBadge } from '@/components/StatusBadge';
import { jobDisplayStatus } from '@/lib/quoteDisplay';
import type { Project } from '@/types/project';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type SortKey = 'name' | 'revenue' | 'costs' | 'profit' | 'margin';
type ProfitabilityJob = NonNullable<ReturnType<typeof useJobProfitability>['data']>[number] & {
  quoteIsEstimate?: boolean;
  quoteStatus?: string | null;
};

export default function ProfitabilityPage() {
  const [basis, setBasis] = useState<RevenueBasis>('quoted');
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const query = useJobProfitability();
  const rows = useMemo(() => {
    const data = (query.data ?? []).map(job => ({ job: job as ProfitabilityJob, result: profitability(job, basis) }));
    return data.sort((a, b) => {
      const av = sort.key === 'name' ? a.job.jobName.toLocaleLowerCase() : sort.key === 'costs' ? a.job.confirmedCostsIncGst : a.result[sort.key === 'revenue' ? 'revenue' : sort.key];
      const bv = sort.key === 'name' ? b.job.jobName.toLocaleLowerCase() : sort.key === 'costs' ? b.job.confirmedCostsIncGst : b.result[sort.key === 'revenue' ? 'revenue' : sort.key];
      if (av === null || bv === null) return av === bv ? 0 : av === null ? 1 : -1;
      const cmp = typeof av === 'string' ? av.localeCompare(String(bv)) : Number(av) - Number(bv);
      return sort.direction === 'asc' ? cmp : -cmp;
    });
  }, [query.data, basis, sort]);
  const totals = useMemo(() => {
    const knownRows = rows.filter(({ result }) => result.revenue !== null);
    const knownRevenue = knownRows.reduce((sum, { result }) => sum + (result.revenue ?? 0), 0);
    const knownCosts = knownRows.reduce((sum, { job }) => sum + job.confirmedCostsIncGst, 0);
    const allCosts = rows.reduce((sum, { job }) => sum + job.confirmedCostsIncGst, 0);
    const knownProfit = knownRows.reduce((sum, { result }) => sum + (result.profit ?? 0), 0);
    const profit = knownRows.length ? money(knownProfit) : null;
    return {
      knownJobs: knownRows.length,
      knownRevenue: knownRows.length ? money(knownRevenue) : null,
      knownCosts: money(knownCosts),
      allCosts: money(allCosts),
      profit,
      margin: profit !== null && knownRevenue > 0 ? (profit / knownRevenue) * 100 : null,
    };
  }, [rows]);
  const toggleSort = (key: SortKey) => setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));
  const sortable = rows.length >= 5;
  const columns: { key: SortKey; label: string; help: string }[] = [
    { key: 'name', label: 'Job', help: 'Job and client name. Open a job to review its confirmed costs.' },
    { key: 'revenue', label: basis === 'quoted' ? 'Quote value (ex GST)' : 'Invoice value (ex GST)', help: 'Revenue is shown ex GST. Choose Quote or Invoiced above to change the basis.' },
    { key: 'costs', label: 'Costs so far (inc GST)', help: 'Confirmed costs include GST. Draft costs are excluded.' },
    { key: 'profit', label: 'Job profit', help: 'Profit is ex-GST revenue less GST-inclusive confirmed costs, before overheads.' },
    { key: 'margin', label: 'Margin', help: 'Profit divided by ex-GST revenue. Costs may be incomplete; this is not a final margin.' },
  ];

  return <AppShell><PageLayout title="Profitability" description="See what confirmed expenses leave behind across your jobs."
    className="[overflow-wrap:anywhere]"
    actions={<div className="flex w-fit rounded-lg border bg-background p-1" role="group" aria-label="Revenue basis">{(['quoted', 'invoiced'] as RevenueBasis[]).map(value => <button key={value} type="button" onClick={() => setBasis(value)} aria-pressed={basis === value} className={cn('min-h-11 rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors', basis === value ? 'bg-amber-500 text-zinc-950' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>{value}</button>)}</div>}>
    {query.isLoading ? <Card className="space-y-3 p-5 animate-pulse"><div className="h-8 rounded bg-muted" /><div className="h-16 rounded bg-muted/70" /><div className="h-16 rounded bg-muted/70" /></Card>
      : query.isError ? <Card className="p-6"><h2 className="font-semibold">Could not load profitability</h2><p className="mt-2 text-sm text-muted-foreground">{query.error instanceof Error ? query.error.message : 'Please try again.'}</p>{isJobCostSetupError(query.error) && <JobCostSetupHelp />}<Button variant="outline" className="mt-4" onClick={() => query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></Card>
      : !rows.length ? <Card className="border-dashed px-5 py-12 text-center"><CircleDollarSign className="mx-auto mb-3 h-9 w-9 text-amber-800" /><h2 className="font-semibold">No job figures yet</h2><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Once jobs and their costing data are available, the comparison will appear here.</p></Card>
      : <>
        <div className="hidden max-w-full overflow-x-auto rounded-xl border border-[#D8C3AD] bg-background shadow-card md:block">
          <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{columns.map(({ key, label, help }) => <th key={key} className="px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              {sortable
                ? <button type="button" onClick={() => toggleSort(key)} className="inline-flex min-h-11 items-center gap-1.5 text-left font-semibold hover:text-foreground" data-testid={`sort-${key}`}>{label}<ArrowDownUp className="h-3 w-3 shrink-0" /></button>
                : <span className="font-semibold">{label}</span>}
              <Tooltip>
                <TooltipTrigger asChild><button type="button" aria-label={`About ${label}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><Info className="h-4 w-4" /></button></TooltipTrigger>
                <TooltipContent className="max-w-xs text-sm leading-relaxed">{help}</TooltipContent>
              </Tooltip>
            </div>
          </th>)}</tr></thead>
          <tbody className="divide-y divide-border">{rows.map(({ job, result }) => {
            const estimated = basis === 'quoted' && job.quoteIsEstimate === true;
            return <tr key={job.jobId} className="hover:bg-muted/30 align-top" data-testid={`profitability-row-${job.jobId}`}>
              <td className="px-4 py-4"><Link to={`/manage/${job.jobId}?tab=costs`} className="font-semibold hover:underline">{job.jobName}</Link><div className="mt-1 flex flex-wrap items-center gap-2"><span className="text-sm text-muted-foreground">{job.clientName}</span><StatusBadge size="sm" status={jobDisplayStatus({ status: job.status as Project['status'] }, job.quoteStatus ? { status: job.quoteStatus, valid_until: null } : null)} /></div></td>
              <td className="px-4 py-4 tabular-nums">{result.revenue === null ? <MissingQuote jobId={job.jobId} /> : <><Value amount={result.revenue} />{estimated && <span className="ml-2 inline-flex rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 text-sm font-semibold text-amber-950">Estimated</span>}<p className="mt-1 text-sm text-muted-foreground">{estimated ? 'Quote not approved' : basis === 'quoted' ? 'Quote value' : 'Issued invoices'}</p></>}</td>
              <td className="px-4 py-4 tabular-nums"><Link to={`/manage/${job.jobId}?tab=costs`} className="inline-flex min-h-11 items-center rounded-md font-medium underline decoration-amber-800/40 underline-offset-2 hover:decoration-amber-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`View costs for ${job.jobName}`}><Value amount={job.confirmedCostsIncGst} testId={`job-costs-${job.jobId}`} /></Link><p className="text-sm text-muted-foreground">Costs so far</p>{job.draftCostsIncGst > 0 && <DraftPending jobId={job.jobId} amount={job.draftCostsIncGst} />}</td>
              <td className="px-4 py-4">{result.profit === null ? <MissingQuote jobId={job.jobId} /> : <><Value amount={result.profit} testId={`job-profit-${job.jobId}`} prominent /><p className="mt-1 text-xs text-muted-foreground">{estimated ? 'Estimated profit' : 'Revenue − confirmed costs'}</p></>}</td>
              <td className="px-4 py-4">{result.revenue === null ? <MissingQuote jobId={job.jobId} /> : result.margin === null ? <span className="text-sm text-muted-foreground">Not applicable — $0 revenue</span> : <><span className="mb-1 inline-flex rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">Costs so far</span><span data-testid={`job-margin-${job.jobId}`} className={cn('block tabular-nums font-semibold', result.margin < 0 ? 'text-rose-700' : 'text-foreground')}>{result.margin.toFixed(1)}%</span><p className="mt-1 text-sm text-muted-foreground">{estimated ? 'Estimated margin' : 'Profit ÷ revenue'}</p></>}</td>
            </tr>;
          })}</tbody>
          <tfoot className="border-t-2 border-[#D8C3AD] bg-amber-50/70 text-foreground">
            <tr className="align-top">
              <th scope="row" className="px-4 py-4 text-left">Totals</th>
              <td className="px-4 py-4">{totals.knownRevenue === null ? '—' : <Value amount={totals.knownRevenue} prominent />}<p className="mt-1 text-sm text-muted-foreground">{totals.knownJobs} of {rows.length} jobs with known revenue</p></td>
              <td className="px-4 py-4"><Value amount={totals.allCosts} prominent /><p className="mt-1 text-sm text-muted-foreground">All jobs · known-revenue jobs: {aud(totals.knownCosts)}</p></td>
              <td className="px-4 py-4">{totals.profit === null ? '—' : <Value amount={totals.profit} prominent />}<p className="mt-1 text-sm text-muted-foreground">{totals.knownJobs ? `Known revenue · ${totals.knownJobs} jobs` : 'No known revenue'}</p></td>
              <td className="px-4 py-4">{totals.margin === null ? '—' : <span className={cn('font-bold tabular-nums', totals.margin < 0 && 'text-rose-700')}>{totals.margin.toFixed(1)}%</span>}<p className="mt-1 text-sm text-muted-foreground">Known revenue only</p></td>
            </tr>
          </tfoot>
          </table>
        </div>
        <Card className="border-[#D8C3AD] bg-amber-50/70 p-4 md:hidden" data-testid="profitability-totals-mobile">
          <h2 className="font-semibold">Totals</h2>
          <p className="mt-1 text-sm text-muted-foreground">{totals.knownJobs} of {rows.length} jobs with known revenue</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Metric label={basis === 'quoted' ? 'Revenue (ex GST)' : 'Invoice revenue (ex GST)'} strong>{totals.knownRevenue === null ? '—' : <Value amount={totals.knownRevenue} prominent />}</Metric>
            <Metric label="Costs so far (all jobs, inc GST)" strong><Value amount={totals.allCosts} prominent /></Metric>
            <Metric label="Profit (known revenue jobs)" strong>{totals.profit === null ? '—' : <Value amount={totals.profit} prominent />}</Metric>
            <Metric label="Margin (known revenue only)" strong>{totals.margin === null ? '—' : `${totals.margin.toFixed(1)}%`}</Metric>
          </div>
        </Card>
        <p className="text-sm leading-relaxed text-muted-foreground">Totals for profit and margin exclude jobs without recorded revenue; the costs total includes all jobs. Costs may be incomplete, so margins are indicative. Draft costs are excluded.</p>
        <div className="space-y-3 md:hidden">{rows.map(({ job, result }) => {
          const estimated = basis === 'quoted' && job.quoteIsEstimate === true;
          return <Card key={job.jobId} className="p-4" data-testid={`profitability-card-${job.jobId}`}>
            <div className="min-w-0 border-b border-border pb-3"><Link to={`/manage/${job.jobId}?tab=costs`} className="font-semibold hover:underline">{job.jobName}</Link><div className="mt-1 flex flex-wrap items-center gap-2"><span className="truncate text-sm text-muted-foreground">{job.clientName}</span><StatusBadge size="sm" status={jobDisplayStatus({ status: job.status as Project['status'] }, job.quoteStatus ? { status: job.quoteStatus, valid_until: null } : null)} /></div></div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4">
              <Metric label={basis === 'quoted' ? 'Quote value (ex GST)' : 'Invoice value (ex GST)'}>{result.revenue === null ? <MissingQuote jobId={job.jobId} compact /> : <><Value amount={result.revenue} />{estimated && <span className="mt-1 inline-flex rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 text-sm font-semibold text-amber-950">Estimated</span>}<span className="mt-1 block text-sm leading-snug text-muted-foreground">{estimated ? 'Quote not approved' : basis === 'quoted' ? 'Quoted revenue' : 'Issued invoices'}</span></>}</Metric>
              <Metric label="Costs so far (inc GST)"><Link to={`/manage/${job.jobId}?tab=costs`} className="inline-flex min-h-11 items-center rounded-md underline decoration-amber-800/40 underline-offset-2" aria-label={`View costs for ${job.jobName}`}><Value amount={job.confirmedCostsIncGst} testId={`job-costs-${job.jobId}`} /></Link>{job.draftCostsIncGst > 0 && <DraftPending jobId={job.jobId} amount={job.draftCostsIncGst} />}</Metric>
              <Metric label={estimated ? 'Estimated profit' : 'Job profit'} strong>{result.profit === null ? <span className="text-xs font-normal text-muted-foreground">Add a quote to calculate profit</span> : <Value amount={result.profit} testId={`job-profit-${job.jobId}`} prominent />}</Metric>
              <Metric label={estimated ? 'Estimated margin' : 'Margin'} strong>{result.revenue === null ? <MissingQuote jobId={job.jobId} compact /> : result.margin === null ? <span className="text-sm font-normal leading-snug text-muted-foreground">Not applicable — $0 revenue</span> : <><span className="mb-1 inline-flex rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">Costs so far</span><span data-testid={`job-margin-${job.jobId}`} className={cn('block tabular-nums', result.margin < 0 ? 'text-rose-700' : 'text-foreground')}>{result.margin.toFixed(1)}%</span></>}</Metric>
            </div>
            {result.revenue !== null && <p className="mt-3 border-t border-border pt-2 text-sm text-muted-foreground">{estimated ? 'Estimate based on an unapproved quote. ' : ''}Profit = {basis === 'quoted' ? 'quote value' : 'invoice value'} (ex GST) − confirmed costs (inc GST).</p>}
          </Card>;
        })}</div>
      </>}
  </PageLayout></AppShell>;
}
function Value({ amount, testId, prominent = false }: { amount: number; testId?: string; prominent?: boolean }) {
  return <span data-testid={testId} className={cn('tabular-nums', prominent ? 'text-base font-bold sm:text-lg' : 'font-medium', prominent && amount < 0 && 'text-rose-700')}>{aud(amount)}</span>;
}
function Metric({ label, children, strong = false }: { label: string; children: ReactNode; strong?: boolean }) {
  return <div className="min-w-0"><p className="text-sm font-medium text-muted-foreground">{label}</p><div className={cn('mt-1 break-words text-sm tabular-nums', strong && 'font-bold')}>{children}</div></div>;
}
function MissingQuote({ jobId, compact = false }: { jobId: string; compact?: boolean }) {
  return <Link to={`/manage/${jobId}?tab=quote`} className={cn('text-sm font-medium text-amber-900 underline decoration-amber-900/40 underline-offset-2 hover:decoration-amber-900', compact && 'leading-snug')}>Add a quote to calculate profit</Link>;
}
function DraftPending({ jobId, amount }: { jobId: string; amount: number }) {
  return <Link to={`/manage/${jobId}?tab=costs`} className="mt-1 block text-sm leading-snug text-amber-900 underline decoration-amber-900/30 underline-offset-2 hover:decoration-amber-900">Draft costs pending confirmation (inc GST): {aud(amount)}</Link>;
}
