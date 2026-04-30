import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/AppShell';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Receipt, ChevronRight, Download, CalendarRange, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isWithinInterval, parseISO, startOfDay, endOfDay } from 'date-fns';

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

const STATUS_VARIANTS: Record<InvoiceStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  sent: 'bg-amber-100 text-amber-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-zinc-100 text-zinc-600',
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
};

interface InvoiceRow {
  id: string;
  invoice_number: string;
  status: InvoiceStatus;
  total: number | null;
  due_date: string | null;
  created_at: string;
  project_id: string;
  projectName: string;
  clientName: string;
}

function useAllInvoices() {
  const { user } = useAuth();
  return useQuery<InvoiceRow[]>({
    queryKey: ['/invoices/all', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: projects, error: pe } = await supabase
        .from('projects')
        .select('id, name, client_name')
        .eq('user_id', user!.id);
      if (pe) throw pe;
      if (!projects?.length) return [];

      const projectMap = new Map(projects.map(p => [p.id, p]));
      const ids = projects.map(p => p.id);

      const { data: invoices, error: ie } = await supabase
        .from('invoices')
        .select('id, invoice_number, status, total, due_date, created_at, project_id')
        .in('project_id', ids)
        .order('created_at', { ascending: false });
      if (ie) throw ie;

      return (invoices ?? []).map(inv => ({
        ...inv,
        status: inv.status as InvoiceStatus,
        projectName: projectMap.get(inv.project_id)?.name ?? '',
        clientName: projectMap.get(inv.project_id)?.client_name ?? '',
      }));
    },
    staleTime: 30_000,
  });
}

const formatCurrency = (n: number | null) =>
  n == null ? '—' : `$${n.toLocaleString('en-AU', { minimumFractionDigits: 0 })}`;

function exportInvoicesCSV(rows: InvoiceRow[]) {
  const headers = ['Invoice #', 'Project', 'Client', 'Status', 'Total (AUD)', 'Due Date', 'Created Date'];
  const csvRows = rows.map(inv => [
    inv.invoice_number,
    inv.projectName,
    inv.clientName,
    STATUS_LABELS[inv.status],
    inv.total != null ? inv.total.toFixed(2) : '',
    inv.due_date ? format(parseISO(inv.due_date), 'dd/MM/yyyy') : '',
    format(parseISO(inv.created_at), 'dd/MM/yyyy'),
  ]);

  const csvContent = [headers, ...csvRows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `invoices-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { data: invoices, isLoading } = useAllInvoices();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const isFiltered = !!dateFrom || !!dateTo;

  const filtered = (invoices ?? []).filter(inv => {
    if (!isFiltered) return true;
    const created = parseISO(inv.created_at);
    if (dateFrom && dateTo) {
      return isWithinInterval(created, {
        start: startOfDay(parseISO(dateFrom)),
        end: endOfDay(parseISO(dateTo)),
      });
    }
    if (dateFrom) return created >= startOfDay(parseISO(dateFrom));
    if (dateTo) return created <= endOfDay(parseISO(dateTo));
    return true;
  });

  const clearFilter = () => {
    setDateFrom('');
    setDateTo('');
    setFilterOpen(false);
  };

  return (
    <AppShell>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Page heading + toolbar */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="font-heading text-2xl font-bold">Invoices</h1>
            <p className="text-sm text-muted-foreground mt-0.5">All invoices across your projects</p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Date filter */}
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={isFiltered ? 'default' : 'outline'}
                  size="sm"
                  className="gap-2"
                  data-testid="button-invoice-filter"
                >
                  <CalendarRange className="w-4 h-4" />
                  {isFiltered ? (
                    <span>
                      {dateFrom && dateTo
                        ? `${format(parseISO(dateFrom), 'd MMM')} – ${format(parseISO(dateTo), 'd MMM yyyy')}`
                        : dateFrom
                        ? `From ${format(parseISO(dateFrom), 'd MMM yyyy')}`
                        : `Until ${format(parseISO(dateTo), 'd MMM yyyy')}`}
                    </span>
                  ) : (
                    'Filter by date'
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4 space-y-4" align="end">
                <p className="text-sm font-semibold">Filter by created date</p>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-date-from" className="text-xs">From</Label>
                    <input
                      id="inv-date-from"
                      type="date"
                      value={dateFrom}
                      max={dateTo || undefined}
                      onChange={e => setDateFrom(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      data-testid="input-invoice-date-from"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-date-to" className="text-xs">To</Label>
                    <input
                      id="inv-date-to"
                      type="date"
                      value={dateTo}
                      min={dateFrom || undefined}
                      onChange={e => setDateTo(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      data-testid="input-invoice-date-to"
                    />
                  </div>
                </div>
                {isFiltered && (
                  <Button variant="ghost" size="sm" className="w-full gap-2" onClick={clearFilter} data-testid="button-invoice-filter-clear">
                    <X className="w-3.5 h-3.5" />
                    Clear filter
                  </Button>
                )}
              </PopoverContent>
            </Popover>

            {/* Clear badge when filter is active */}
            {isFiltered && (
              <button
                onClick={clearFilter}
                className="p-1.5 rounded hover:bg-muted transition-colors"
                title="Clear date filter"
                data-testid="button-invoice-filter-clear-badge"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            )}

            {/* Export CSV */}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={isLoading || filtered.length === 0}
              onClick={() => exportInvoicesCSV(filtered)}
              data-testid="button-invoice-export-csv"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Active filter summary */}
        {isFiltered && !isLoading && (
          <p className="text-sm text-muted-foreground mb-4">
            Showing <span className="font-medium text-foreground">{filtered.length}</span> of {invoices?.length ?? 0} invoices
          </p>
        )}

        <div className="rounded-xl border border-[#D8C3AD] bg-white dark:bg-zinc-900 overflow-hidden shadow-card">
          {/* Table header — desktop only */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_140px_100px_100px_100px_40px] gap-4 px-4 py-2.5 border-b bg-muted/30">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Project / Client</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invoice #</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Total</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Due</span>
            <span />
          </div>

          {isLoading ? (
            <div className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3.5">
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-14" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-4">
              <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {isFiltered
                  ? 'No invoices match the selected date range.'
                  : 'No invoices yet. Invoices are created from within a project.'}
              </p>
              {isFiltered && (
                <button onClick={clearFilter} className="text-sm text-primary font-medium mt-2 hover:opacity-70 transition-opacity">
                  Clear filter
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map(inv => (
                <div
                  key={inv.id}
                  onClick={() => navigate(`/manage/${inv.project_id}?tab=invoices`)}
                  className="cursor-pointer hover:bg-muted/40 transition-colors group"
                  data-testid={`invoice-row-${inv.id}`}
                >
                  {/* Mobile layout */}
                  <div className="flex items-center gap-3 px-4 py-3.5 sm:hidden">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{inv.projectName}</p>
                      <p className="text-xs text-muted-foreground truncate">{inv.clientName} · {format(parseISO(inv.created_at), 'd MMM yyyy')}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold capitalize', STATUS_VARIANTS[inv.status])}>
                          {inv.status}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">{formatCurrency(inv.total)}</span>
                        {inv.due_date && (
                          <span className="text-xs text-muted-foreground">· Due {format(parseISO(inv.due_date), 'd MMM')}</span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden sm:grid sm:grid-cols-[1fr_140px_100px_100px_100px_40px] gap-4 px-4 py-3.5 items-center">
                    <div>
                      <p className="text-sm font-medium">{inv.projectName}</p>
                      <p className="text-xs text-muted-foreground">{inv.clientName} · {format(parseISO(inv.created_at), 'd MMM yyyy')}</p>
                    </div>
                    <span className="text-sm text-muted-foreground font-mono">{inv.invoice_number}</span>
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize w-fit', STATUS_VARIANTS[inv.status])}>
                      {inv.status}
                    </span>
                    <span className="text-sm font-semibold text-right">{formatCurrency(inv.total)}</span>
                    <span className="text-xs text-muted-foreground">
                      {inv.due_date ? format(parseISO(inv.due_date), 'd MMM yyyy') : '—'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
