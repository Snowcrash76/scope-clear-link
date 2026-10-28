import { useState } from 'react';
import { AlertTriangle, CircleDollarSign, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { useJobProfitability, aud, profitability, type RevenueBasis, COST_CATEGORIES } from '@/hooks/useJobCosts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { JobCostSetupHelp, isJobCostSetupError } from '@/components/job-costing/JobCostSetupHelp';

export function JobProfitabilityPanel({ jobId }: { jobId: string }) {
  const [basis, setBasis] = useState<RevenueBasis>('quoted');
  const query = useJobProfitability(jobId);
  const job = query.data?.[0];

  if (query.isLoading) return <Card className="mb-6 p-5 animate-pulse"><div className="h-5 w-44 rounded bg-muted" /><div className="mt-5 h-24 rounded bg-muted/70" /></Card>;
  if (query.isError) return (
    <Card className="mb-6 p-5 border-amber-300 bg-amber-50/60">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">Job profitability unavailable</h2>
          <p className="mt-1 text-sm text-muted-foreground">{query.error instanceof Error ? query.error.message : 'Could not load profitability.'}</p>
          {isJobCostSetupError(query.error) && <JobCostSetupHelp />}
          <Button variant="outline" size="sm" className="mt-3" onClick={() => query.refetch()}><RefreshCw className="mr-2 h-3.5 w-3.5" />Try again</Button>
        </div>
      </div>
    </Card>
  );
  if (!job) return null;

  const result = profitability(job, basis);
  const ratio = job.quotedExGst !== null && job.quotedExGst > 0 ? Math.min(job.confirmedCostsExGst / job.quotedExGst * 100, 100) : 0;
  const healthStyles = {
    healthy: 'border-emerald-300 bg-emerald-50 text-emerald-800',
    low: 'border-amber-300 bg-amber-50 text-amber-800',
    loss: 'border-rose-300 bg-rose-50 text-rose-800',
    unknown: 'border-border bg-muted/40 text-muted-foreground',
  } as const;
  const healthLabel = { healthy: 'On track', low: 'Tight margin', loss: 'Operating at a loss', unknown: 'Unavailable' }[result.health];

  return (
    <Card className="mb-6 min-w-0 [overflow-wrap:anywhere] border-[#D8C3AD] shadow-card" data-testid="job-profitability-panel">
      <div className="flex flex-col gap-4 border-b bg-[#F7F2EB] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div>
          <div className="flex items-center gap-2">
            <CircleDollarSign className="h-5 w-5 text-amber-700" />
            <h2 className="font-heading text-lg font-semibold">Job profitability</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">All figures AUD, ex GST. Draft costs are excluded.</p>
        </div>
        <div className="flex rounded-lg border bg-background p-1" role="group" aria-label="Revenue basis">
          {(['quoted', 'invoiced'] as RevenueBasis[]).map(value => (
            <button key={value} type="button" onClick={() => setBasis(value)}
              className={cn('rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors', basis === value ? 'bg-zinc-900 text-white' : 'text-muted-foreground hover:text-foreground')}
              data-testid={`profitability-basis-${value}`}>{value}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[1fr_1.15fr]">
        <div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Accepted quote</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{job.quotedExGst === null ? 'Unavailable' : aud(job.quotedExGst)}</p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Issued invoices</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{aud(job.invoicedExGst)}</p>
            </div>
            <div className="rounded-lg border bg-background p-3 sm:col-span-2">
              <p className="text-xs text-muted-foreground">Confirmed costs</p>
              <p className="mt-1 text-lg font-bold tabular-nums">{aud(job.confirmedCostsExGst)}</p>
            </div>
          </div>
          <div className={cn('mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-3', healthStyles[result.health])}>
            <div>
              <p className="text-xs font-medium">{healthLabel}</p>
              <p className="mt-0.5 text-xs opacity-80">Profit · {result.margin === null ? 'Margin unavailable' : `${result.margin.toFixed(1)}% margin`}</p>
            </div>
            <p className="text-xl font-bold tabular-nums">{result.profit === null ? '—' : aud(result.profit)}</p>
          </div>
          {job.quotedExGst === null && basis === 'quoted' && (
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">No accepted quote is available for comparison yet. Quote line prices are sale prices; estimated cost tracking is not available.</p>
          )}
          {job.quotedExGst === 0 && <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Quoted revenue is recorded as $0.00, so a costs-to-quote comparison is unavailable.</p>}
          {job.quotedExGst !== null && job.quotedExGst > 0 && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Confirmed costs vs quote</span><span>{job.confirmedCostsExGst > job.quotedExGst ? 'Over quoted amount' : `${ratio.toFixed(1)}%`}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Confirmed costs as a share of quoted revenue" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ratio}>
                <div className={cn('h-full rounded-full transition-all', job.confirmedCostsExGst > job.quotedExGst ? 'bg-rose-600' : 'bg-amber-600')} style={{ width: `${ratio}%` }} />
              </div>
            </div>
          )}
        </div>
        <div className="rounded-lg border bg-background p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">Confirmed cost breakdown</h3>
            {job.draftCostsExGst > 0 && <span className="text-xs text-muted-foreground">{aud(job.draftCostsExGst)} draft excluded</span>}
          </div>
          <div className="space-y-2.5">
            {COST_CATEGORIES.map(category => {
              const value = job.costsByCategory?.[category] ?? 0;
              return <div key={category} className="flex items-center justify-between gap-3">
                <span className="truncate text-xs text-muted-foreground">{category}</span>
                <span className="text-xs font-medium tabular-nums">{aud(value)}</span>
              </div>;
            })}
          </div>
          <p className="mt-3 border-t pt-2 text-xs leading-relaxed text-muted-foreground">
            Approved variations: {aud(job.approvedVariationsExGst)} — already included in the quote subtotal; not added again.
          </p>
          {basis === 'invoiced' && result.revenue === 0 && <p className="mt-2 text-xs text-muted-foreground">No issued invoice revenue is recorded yet.</p>}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t px-4 py-2.5 text-xs text-muted-foreground sm:px-5">
        {result.health === 'loss' ? <TrendingDown className="h-3.5 w-3.5 text-rose-700" /> : <TrendingUp className="h-3.5 w-3.5 text-emerald-700" />}
        Profit uses the selected revenue basis and confirmed costs. Drafts are excluded. Estimated cost comparison is unavailable; quote line items are sale prices.
      </div>
    </Card>
  );
}
