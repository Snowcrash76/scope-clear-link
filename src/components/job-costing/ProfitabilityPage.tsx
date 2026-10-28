import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownUp, CircleDollarSign, RefreshCw } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useJobProfitability, aud, profitability, type RevenueBasis } from '@/hooks/useJobCosts';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { JobCostSetupHelp, isJobCostSetupError } from '@/components/job-costing/JobCostSetupHelp';

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
    const data = (query.data ?? []).map(job => ({ job: job as ProfitabilityJob, result: profitability(job, basis, 'inc-gst') }));
    return data.sort((a, b) => {
      const av = sort.key === 'name' ? a.job.jobName.toLocaleLowerCase() : sort.key === 'costs' ? a.job.confirmedCostsIncGst : a.result[sort.key === 'revenue' ? 'revenue' : sort.key];
      const bv = sort.key === 'name' ? b.job.jobName.toLocaleLowerCase() : sort.key === 'costs' ? b.job.confirmedCostsIncGst : b.result[sort.key === 'revenue' ? 'revenue' : sort.key];
      if (av === null || bv === null) return av === bv ? 0 : av === null ? 1 : -1;
      const cmp = typeof av === 'string' ? av.localeCompare(String(bv)) : Number(av) - Number(bv);
      return sort.direction === 'asc' ? cmp : -cmp;
    });
  }, [query.data, basis, sort]);
  const toggleSort = (key: SortKey) => setSort(current => ({ key, direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc' }));

  return <AppShell><main className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 [overflow-wrap:anywhere] sm:px-6 sm:py-8">
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><div className="mb-2 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900"><CircleDollarSign className="h-3.5 w-3.5" />Job costing</div><h1 className="font-heading text-2xl font-bold">Profitability</h1><p className="mt-1 text-sm text-muted-foreground">See what confirmed expenses leave behind across your jobs.</p></div>
      <div className="flex w-fit rounded-lg border bg-background p-1" role="group" aria-label="Revenue basis">{(['quoted', 'invoiced'] as RevenueBasis[]).map(value => <button key={value} onClick={() => setBasis(value)} className={cn('rounded-md px-3 py-1.5 text-sm font-medium capitalize', basis === value ? 'bg-zinc-900 text-white' : 'text-muted-foreground hover:text-foreground')}>{value}</button>)}</div>
    </div>
      <Card className="mb-4 flex items-start gap-3 border-[#D8C3AD] bg-[#F7F2EB] p-4"><CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" /><p className="text-xs leading-relaxed text-muted-foreground">All figures are AUD. Costs include GST. Quote and invoice revenue remain ex GST. Profit is revenue less GST-inclusive confirmed costs, before overheads. Draft costs are excluded until confirmed.</p></Card>
    {query.isLoading ? <Card className="space-y-3 p-5 animate-pulse"><div className="h-8 rounded bg-muted" /><div className="h-16 rounded bg-muted/70" /><div className="h-16 rounded bg-muted/70" /></Card>
      : query.isError ? <Card className="p-6"><h2 className="font-semibold">Could not load profitability</h2><p className="mt-2 text-sm text-muted-foreground">{query.error instanceof Error ? query.error.message : 'Please try again.'}</p>{isJobCostSetupError(query.error) && <JobCostSetupHelp />}<Button variant="outline" className="mt-4" onClick={() => query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></Card>
      : !rows.length ? <Card className="border-dashed px-5 py-12 text-center"><CircleDollarSign className="mx-auto mb-3 h-9 w-9 text-amber-800" /><h2 className="font-semibold">No job figures yet</h2><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Once jobs and their costing data are available, the comparison will appear here.</p></Card>
      : <>
        <div className="hidden max-w-full overflow-x-auto rounded-xl border border-[#D8C3AD] bg-background shadow-card md:block">
          <table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{([
            ['name', 'Job'], ['revenue', basis === 'quoted' ? 'Quote value (ex GST)' : 'Invoice value (ex GST)'], ['costs', 'Confirmed costs (inc GST)'], ['profit', 'Job profit'], ['margin', 'Margin'],
          ] as [SortKey, string][]).map(([key, label]) => <th key={key} className="px-4 py-3"><button onClick={() => toggleSort(key)} className="inline-flex items-center gap-1.5 font-semibold hover:text-foreground" data-testid={`sort-${key}`}>{label}<ArrowDownUp className="h-3 w-3" /></button></th>)}</tr></thead>
          <tbody className="divide-y divide-border">{rows.map(({ job, result }) => {
            const estimated = basis === 'quoted' && job.quoteIsEstimate === true;
            return <tr key={job.jobId} className="hover:bg-muted/30 align-top" data-testid={`profitability-row-${job.jobId}`}>
              <td className="px-4 py-4"><Link to={`/manage/${job.jobId}?tab=costs`} className="font-semibold hover:underline">{job.jobName}</Link><p className="mt-0.5 text-xs text-muted-foreground">{job.clientName} · {job.status.replace('_', ' ')}</p></td>
              <td className="px-4 py-4 tabular-nums">{result.revenue === null ? <MissingQuote jobId={job.jobId} /> : <><Value amount={result.revenue} /><p className="mt-1 text-xs text-muted-foreground">{estimated ? 'Estimated — quote not approved' : basis === 'quoted' ? 'Quote value' : 'Issued invoices'}</p></>}</td>
              <td className="px-4 py-4 tabular-nums"><Value amount={job.confirmedCostsIncGst} testId={`job-costs-${job.jobId}`} />{job.draftCostsIncGst > 0 && <DraftPending jobId={job.jobId} amount={job.draftCostsIncGst} />}</td>
              <td className="px-4 py-4">{result.profit === null ? <MissingQuote jobId={job.jobId} /> : <><Value amount={result.profit} testId={`job-profit-${job.jobId}`} prominent /><p className="mt-1 text-xs text-muted-foreground">{estimated ? 'Estimated profit' : 'Revenue − confirmed costs'}</p></>}</td>
              <td className="px-4 py-4">{result.revenue === null ? <MissingQuote jobId={job.jobId} /> : result.margin === null ? <span className="text-xs text-muted-foreground">Not applicable — $0 revenue</span> : <><span data-testid={`job-margin-${job.jobId}`} className={cn('tabular-nums font-semibold', result.margin < 0 ? 'text-rose-700' : 'text-foreground')}>{result.margin.toFixed(1)}%</span><p className="mt-1 text-xs text-muted-foreground">{estimated ? 'Estimated margin' : 'Profit ÷ revenue'}</p></>}</td>
            </tr>;
          })}</tbody></table>
        </div>
        <div className="space-y-3 md:hidden">{rows.map(({ job, result }) => {
          const estimated = basis === 'quoted' && job.quoteIsEstimate === true;
          return <Card key={job.jobId} className="p-4" data-testid={`profitability-card-${job.jobId}`}>
            <div className="min-w-0 border-b border-border pb-3"><Link to={`/manage/${job.jobId}?tab=costs`} className="font-semibold hover:underline">{job.jobName}</Link><p className="mt-0.5 truncate text-xs text-muted-foreground">{job.clientName} · {job.status.replace('_', ' ')}</p></div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4">
              <Metric label={basis === 'quoted' ? 'Quote value (ex GST)' : 'Invoice value (ex GST)'}>{result.revenue === null ? <MissingQuote jobId={job.jobId} compact /> : <><Value amount={result.revenue} /><span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{estimated ? 'Estimated — quote not approved' : basis === 'quoted' ? 'Quoted revenue' : 'Issued invoices'}</span></>}</Metric>
              <Metric label="Confirmed costs (inc GST)"><Value amount={job.confirmedCostsIncGst} testId={`job-costs-${job.jobId}`} />{job.draftCostsIncGst > 0 && <DraftPending jobId={job.jobId} amount={job.draftCostsIncGst} />}</Metric>
              <Metric label={estimated ? 'Estimated profit' : 'Job profit'} strong>{result.profit === null ? <span className="text-xs font-normal text-muted-foreground">Add a quote to calculate profit</span> : <Value amount={result.profit} testId={`job-profit-${job.jobId}`} prominent />}</Metric>
              <Metric label={estimated ? 'Estimated margin' : 'Margin'} strong>{result.revenue === null ? <MissingQuote jobId={job.jobId} compact /> : result.margin === null ? <span className="text-[11px] font-normal leading-snug text-muted-foreground">Not applicable — $0 revenue</span> : <span data-testid={`job-margin-${job.jobId}`} className={cn('tabular-nums', result.margin < 0 ? 'text-rose-700' : 'text-foreground')}>{result.margin.toFixed(1)}%</span>}</Metric>
            </div>
            {result.revenue !== null && <p className="mt-3 border-t border-border pt-2 text-[11px] text-muted-foreground">{estimated ? 'Estimate based on an unapproved quote. ' : ''}Profit = {basis === 'quoted' ? 'quote value' : 'invoice value'} (ex GST) − confirmed costs (inc GST).</p>}
          </Card>;
        })}</div>
      </>}
  </main></AppShell>;
}
function Value({ amount, testId, prominent = false }: { amount: number; testId?: string; prominent?: boolean }) {
  return <span data-testid={testId} className={cn('tabular-nums', prominent ? 'text-base font-bold sm:text-lg' : 'font-medium', prominent && amount < 0 && 'text-rose-700')}>{aud(amount)}</span>;
}
function Metric({ label, children, strong = false }: { label: string; children: ReactNode; strong?: boolean }) {
  return <div className="min-w-0"><p className="text-[11px] font-medium text-muted-foreground">{label}</p><div className={cn('mt-1 break-words text-sm tabular-nums', strong && 'font-bold')}>{children}</div></div>;
}
function MissingQuote({ jobId, compact = false }: { jobId: string; compact?: boolean }) {
  return <Link to={`/manage/${jobId}?tab=quote`} className={cn('text-xs font-medium text-amber-900 underline decoration-amber-900/40 underline-offset-2 hover:decoration-amber-900', compact && 'leading-snug')}>Add a quote to calculate profit</Link>;
}
function DraftPending({ jobId, amount }: { jobId: string; amount: number }) {
  return <Link to={`/manage/${jobId}?tab=costs`} className="mt-1 block text-[11px] leading-snug text-amber-900 underline decoration-amber-900/30 underline-offset-2 hover:decoration-amber-900">Draft costs pending confirmation (inc GST): {aud(amount)}</Link>;
}
