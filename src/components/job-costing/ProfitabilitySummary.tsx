import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { CircleHelp, CircleDollarSign, ReceiptText, Scale, TrendingUp } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { aud, profitabilitySummary, type JobProfitability, type RevenueBasis } from '../../../shared/jobCosting';

interface ProfitabilitySummaryProps {
  jobs: JobProfitability[];
  basis: RevenueBasis;
}

export function ProfitabilitySummary({ jobs, basis }: ProfitabilitySummaryProps) {
  const summary = useMemo(() => profitabilitySummary(jobs, basis), [jobs, basis]);
  const basisLabel = basis === 'quoted' ? 'accepted quote revenue' : 'issued invoice revenue';

  return (
    <section aria-labelledby="portfolio-summary-heading" className="mb-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="portfolio-summary-heading" className="text-sm font-semibold tracking-tight">Portfolio totals</h2>
        <p className="text-xs text-muted-foreground">
          {summary.jobCount} {summary.jobCount === 1 ? 'job included' : 'jobs included'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <SummaryMetric
          testId="summary-revenue"
          label={basis === 'quoted' ? 'Accepted quote revenue' : 'Issued invoice revenue'}
          value={summary.revenue === null ? 'Unavailable' : aud(summary.revenue)}
          icon={<CircleDollarSign aria-hidden="true" className="h-4 w-4" />}
          tone="revenue"
        />
        <SummaryMetric
          testId="summary-costs"
          label="Confirmed costs"
          value={summary.confirmedCosts === null ? 'Unavailable' : aud(summary.confirmedCosts)}
          icon={<ReceiptText aria-hidden="true" className="h-4 w-4" />}
          tone="costs"
        />
        <SummaryMetric
          testId="summary-profit"
          label="Gross job profit"
          value={summary.profit === null ? 'Unavailable' : aud(summary.profit)}
          icon={<TrendingUp aria-hidden="true" className="h-4 w-4" />}
          tone="profit"
          prominent
          negative={summary.profit !== null && summary.profit < 0}
        />
        <SummaryMetric
          testId="summary-margin"
          label="Overall margin"
          value={summary.margin === null ? 'Unavailable' : `${summary.margin.toFixed(1)}%`}
          icon={<Scale aria-hidden="true" className="h-4 w-4" />}
          tone="margin"
          prominent
          negative={summary.margin !== null && summary.margin < 0}
        />
      </div>

      <Card className="mt-3 border-[#D8C3AD] bg-[#FBF8F4] p-3 sm:p-4">
        <div className="flex items-start gap-2.5">
          <CircleHelp aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-800" />
          <div className="min-w-0 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
            <p>
              <span className="font-semibold text-foreground">Profit</span> = revenue − confirmed costs.
              <span className="mx-1.5 text-[#B8A48F]" aria-hidden="true">·</span>
              <span className="font-semibold text-foreground">Margin</span> = profit ÷ revenue × 100.
              The portfolio margin is weighted across the included jobs, not an average of job margins.
            </p>
            <p>
              Figures are AUD ex GST and include confirmed costs only. Gross job profit is before other
              business expenses, so it is not net business profit.
            </p>
            {summary.revenue === 0 && <p>Margin is unavailable when revenue is $0; any recorded costs still count as a loss.</p>}
            {summary.excludedJobCount > 0 && (
              <p role="status" className="font-medium text-amber-950">
                Partial coverage: {summary.excludedJobCount} {summary.excludedJobCount === 1 ? 'job' : 'jobs'} excluded
                because {basisLabel} is unavailable. Their confirmed costs ({aud(summary.excludedCosts)}) are not
                included in the totals. An unavailable accepted quote is not counted as $0.
              </p>
            )}
          </div>
        </div>
      </Card>
    </section>
  );
}

function SummaryMetric({
  testId,
  label,
  value,
  icon,
  tone,
  prominent = false,
  negative = false,
}: {
  testId: string;
  label: string;
  value: string;
  icon: ReactNode;
  tone: 'revenue' | 'costs' | 'profit' | 'margin';
  prominent?: boolean;
  negative?: boolean;
}) {
  const iconTone = {
    revenue: 'bg-[#E8F0EC] text-[#345A48]',
    costs: 'bg-[#F1EAE2] text-[#74593F]',
    profit: 'bg-[#E7F0E8] text-[#345A48]',
    margin: 'bg-[#F6EEDC] text-[#806223]',
  }[tone];

  return (
    <Card className="min-w-0 border-[#E8DED2] bg-white p-3 shadow-sm sm:p-4">
      <div className="flex min-w-0 items-start gap-2">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconTone}`}>{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="min-h-8 text-[11px] font-medium leading-snug text-muted-foreground sm:min-h-0 sm:text-xs">{label}</p>
        </div>
      </div>
      <p data-testid={testId} className={`mt-2 break-words text-lg tabular-nums sm:text-xl ${negative ? 'font-bold text-destructive' : prominent ? 'font-bold text-[#294B3A]' : 'font-semibold text-foreground'}`}>
        {value}
      </p>
    </Card>
  );
}
