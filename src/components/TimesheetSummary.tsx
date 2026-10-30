import type { PortalTimeEntry } from '../../shared/employeePortal';
import { timesheetTotals } from '../../shared/timesheetTotals';

const card = 'rounded-2xl border border-[#e5e9e5] bg-white shadow-[0_3px_14px_rgba(33,54,43,.045)]';
const minutesLabel = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
const money = (amount: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount);

export function TimesheetSummary({ entries, hourlyRate, showRate = false, showPay = true, compact = false }: {
  entries: readonly PortalTimeEntry[];
  hourlyRate?: number | null;
  showPay?: boolean;
  showRate?: boolean;
  compact?: boolean;
}) {
  const totals = timesheetTotals(entries);
  const approvedPay = totals.approvedMinutes === 0
    ? 'No approved hours'
    : totals.approvedPay === null
      ? 'Unavailable'
      : money(totals.approvedPay);
  const metrics = [
    { label: 'Time on site · before breaks', value: minutesLabel(totals.workedMinutes), tone: 'text-[#314f3d]' },
    { label: 'Unpaid breaks', value: minutesLabel(totals.breakMinutes), tone: 'text-[#80643e]' },
    { label: 'Paid after breaks', value: minutesLabel(totals.paidMinutes), tone: 'text-[#314f3d]' },
    ...(showPay ? [{ label: 'Approved pay · before tax', value: approvedPay, tone: totals.missingRateCount ? 'text-[#9a5d37]' : 'text-[#314f3d]' }] : []),
  ];
  const statusCounts = {
    draft: entries.filter(e => e.status === 'draft').length,
    submitted: entries.filter(e => e.status === 'submitted').length,
    approved: entries.filter(e => e.status === 'approved').length,
  };

  return <section className={`${card} ${compact ? 'p-4' : 'p-4 sm:p-5'}`} aria-label="Timesheet totals">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-bold text-[#2b3b30]">Weekly totals</h2>
        <p className="mt-1 text-sm text-[#78847b]">Running clocks are excluded until clock-out.</p>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Entry status breakdown">
        <span className="rounded-full bg-[#f2f5f2] px-2.5 py-1 text-xs font-semibold text-[#627067]">Draft {statusCounts.draft} · {minutesLabel(totals.draftMinutes)}</span>
        <span className="rounded-full bg-[#fff3df] px-2.5 py-1 text-xs font-semibold text-[#96652a]">Submitted {statusCounts.submitted} · {minutesLabel(totals.submittedMinutes)}</span>
        <span className="rounded-full bg-[#edf5ee] px-2.5 py-1 text-xs font-semibold text-[#44654a]">Approved {statusCounts.approved} · {minutesLabel(totals.approvedMinutes)}</span>
      </div>
    </div>
    <div className={`mt-4 grid grid-cols-2 gap-2 ${showPay ? (compact ? 'xl:grid-cols-4' : 'sm:grid-cols-4') : (compact ? 'xl:grid-cols-3' : 'sm:grid-cols-3')}`}>
      {metrics.map(metric => <div key={metric.label} className="min-w-0 rounded-xl bg-[#f6f8f6] p-3">
        <p className="text-xs leading-4 text-[#78847b]">{metric.label}</p>
        <p className={`portal-mono mt-1 break-words text-base font-bold ${metric.tone}`}>{metric.value}</p>
        {metric.label.startsWith('Approved pay') && totals.missingRateCount > 0 && <p className="mt-1 text-xs leading-4 text-[#8a633f]">{totals.missingRateCount} approved {totals.missingRateCount === 1 ? 'entry' : 'entries'} missing recorded rate</p>}
      </div>)}
    </div>
    {(showRate || totals.runningCount > 0) && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#edf0ed] pt-3 text-sm text-[#728076]">
      {showRate && <span>Current hourly pay rate: <b className="text-[#34483a]">{hourlyRate == null ? 'Not set' : `${money(hourlyRate)} / hr`}</b></span>}
      {totals.runningCount > 0 && <span>{totals.runningCount} running {totals.runningCount === 1 ? 'clock' : 'clocks'} excluded</span>}
    </div>}
    {showPay && <p className="mt-3 text-sm leading-5 text-[#879188]">Estimate uses approved hours only and excludes tax, super, overtime, deductions and payments made. It is not an outstanding balance.</p>}
  </section>;
}
