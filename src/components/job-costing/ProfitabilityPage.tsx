import { useMemo, useState } from 'react';
import { ArrowDownUp, CircleDollarSign, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useJobProfitability, aud, profitability, type RevenueBasis } from '@/hooks/useJobCosts';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { JobCostSetupHelp, isJobCostSetupError } from '@/components/job-costing/JobCostSetupHelp';

type SortKey = 'name' | 'revenue' | 'costs' | 'profit' | 'margin';
export default function ProfitabilityPage() {
  const [basis, setBasis] = useState<RevenueBasis>('quoted');
  const [sort, setSort] = useState<{ key: SortKey; direction: 'asc' | 'desc' }>({ key: 'name', direction: 'asc' });
  const query = useJobProfitability();
  const rows = useMemo(() => {
    const data = (query.data ?? []).map(job => ({ job, result: profitability(job, basis) }));
    return data.sort((a, b) => {
      const av = sort.key === 'name' ? a.job.jobName.toLocaleLowerCase() : sort.key === 'costs' ? a.job.confirmedCostsExGst : a.result[sort.key === 'revenue' ? 'revenue' : sort.key];
      const bv = sort.key === 'name' ? b.job.jobName.toLocaleLowerCase() : sort.key === 'costs' ? b.job.confirmedCostsExGst : b.result[sort.key === 'revenue' ? 'revenue' : sort.key];
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
    <Card className="mb-4 flex items-start gap-3 border-[#D8C3AD] bg-[#F7F2EB] p-4"><CircleDollarSign className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" /><p className="text-xs leading-relaxed text-muted-foreground">All figures are AUD ex GST. Draft costs are excluded. Approved variations are already included in quote revenue. Quote line prices are sale prices; estimated cost tracking is not available.</p></Card>
    {query.isLoading ? <Card className="space-y-3 p-5 animate-pulse"><div className="h-8 rounded bg-muted" /><div className="h-16 rounded bg-muted/70" /><div className="h-16 rounded bg-muted/70" /></Card>
      : query.isError ? <Card className="p-6"><h2 className="font-semibold">Could not load profitability</h2><p className="mt-2 text-sm text-muted-foreground">{query.error instanceof Error ? query.error.message : 'Please try again.'}</p>{isJobCostSetupError(query.error) && <JobCostSetupHelp />}<Button variant="outline" className="mt-4" onClick={() => query.refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></Card>
      : !rows.length ? <Card className="border-dashed px-5 py-12 text-center"><CircleDollarSign className="mx-auto mb-3 h-9 w-9 text-amber-800" /><h2 className="font-semibold">No job figures yet</h2><p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Once jobs and their costing data are available, the comparison will appear here.</p></Card>
      : <>
        <div className="hidden max-w-full overflow-x-auto rounded-xl border border-[#D8C3AD] bg-background shadow-card md:block">
          <table className="w-full text-left text-sm"><thead className="bg-muted/60 text-xs text-muted-foreground"><tr>{([
            ['name', 'Job'], ['revenue', basis === 'quoted' ? 'Accepted quote' : 'Issued invoices'], ['costs', 'Confirmed costs'], ['profit', 'Profit'], ['margin', 'Margin'],
          ] as [SortKey, string][]).map(([key, label]) => <th key={key} className="px-4 py-3"><button onClick={() => toggleSort(key)} className="inline-flex items-center gap-1.5 font-semibold hover:text-foreground" data-testid={`sort-${key}`}>{label}<ArrowDownUp className="h-3 w-3" /></button></th>)}</tr></thead>
          <tbody className="divide-y divide-border">{rows.map(({ job, result }) => <tr key={job.jobId} className="hover:bg-muted/30" data-testid={`profitability-row-${job.jobId}`}><td className="px-4 py-3"><Link to={`/manage/${job.jobId}?tab=costs`} className="font-semibold hover:underline">{job.jobName}</Link><p className="mt-0.5 text-xs text-muted-foreground">{job.clientName} · {job.status.replace('_', ' ')}</p></td><td className="px-4 py-3 tabular-nums">{result.revenue === null ? <span className="text-xs text-muted-foreground">Unavailable</span> : aud(result.revenue)}</td><td className="px-4 py-3 tabular-nums">{aud(job.confirmedCostsExGst)}</td><td className="px-4 py-3 font-semibold tabular-nums">{result.profit === null ? '—' : aud(result.profit)}</td><td className="px-4 py-3"><Health result={result} /></td></tr>)}</tbody></table>
        </div>
        <div className="space-y-3 md:hidden">{rows.map(({ job, result }) => <Card key={job.jobId} className="p-4" data-testid={`profitability-card-${job.jobId}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><Link to={`/manage/${job.jobId}?tab=costs`} className="font-semibold hover:underline">{job.jobName}</Link><p className="mt-0.5 truncate text-xs text-muted-foreground">{job.clientName}</p></div><Health result={result} /></div><div className="mt-4 grid grid-cols-2 gap-3 text-xs"><Metric label={basis === 'quoted' ? 'Accepted quote' : 'Issued invoices'} value={result.revenue === null ? 'Unavailable' : aud(result.revenue)} /><Metric label="Confirmed costs" value={aud(job.confirmedCostsExGst)} /><Metric label="Profit" value={result.profit === null ? '—' : aud(result.profit)} strong /><Metric label="Margin" value={result.margin === null ? '—' : `${result.margin.toFixed(1)}%`} strong /></div></Card>)}</div>
      </>}
  </main></AppShell>;
}
function Health({ result }: { result: ReturnType<typeof profitability> }) {
  const className = result.health === 'healthy' ? 'bg-emerald-100 text-emerald-800' : result.health === 'low' ? 'bg-amber-100 text-amber-900' : result.health === 'loss' ? 'bg-rose-100 text-rose-800' : 'bg-muted text-muted-foreground';
  const label = result.health === 'healthy' ? 'Healthy' : result.health === 'low' ? 'Tight' : result.health === 'loss' ? 'Loss' : 'Unavailable';
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold', className)}>{result.health === 'loss' ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}{label}{result.margin !== null && ` · ${result.margin.toFixed(1)}%`}</span>;
}
function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) { return <div><p className="text-muted-foreground">{label}</p><p className={cn('mt-0.5 tabular-nums', strong && 'font-bold')}>{value}</p></div>; }
