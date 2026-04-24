import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/AppShell';
import { Skeleton } from '@/components/ui/skeleton';
import { Receipt, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';

const STATUS_VARIANTS: Record<InvoiceStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  sent: 'bg-amber-100 text-amber-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
  cancelled: 'bg-zinc-100 text-zinc-600',
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

export default function InvoicesPage() {
  const navigate = useNavigate();
  const { data: invoices, isLoading } = useAllInvoices();

  const formatCurrency = (n: number | null) =>
    n == null ? '—' : `$${n.toLocaleString('en-AU', { minimumFractionDigits: 0 })}`;

  return (
    <AppShell>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All invoices across your projects</p>
        </div>

        <div className="rounded-xl border border-[#D8C3AD] bg-white overflow-hidden shadow-card">
          {/* Table header */}
          <div className="grid grid-cols-[1fr_140px_100px_100px_100px_40px] gap-4 px-4 py-2.5 border-b bg-muted/30">
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
                <div key={i} className="grid grid-cols-[1fr_140px_100px_100px_100px_40px] gap-4 px-4 py-3.5 items-center">
                  <div className="space-y-1.5"><Skeleton className="h-4 w-40" /><Skeleton className="h-3 w-24" /></div>
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                  <Skeleton className="h-4 w-16" />
                  <span />
                </div>
              ))}
            </div>
          ) : !invoices?.length ? (
            <div className="text-center py-12 px-4">
              <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No invoices yet. Invoices are created from within a project.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {invoices.map(inv => (
                <div
                  key={inv.id}
                  className="grid grid-cols-[1fr_140px_100px_100px_100px_40px] gap-4 px-4 py-3.5 items-center hover:bg-muted/40 transition-colors cursor-pointer group"
                  onClick={() => navigate(`/manage/${inv.project_id}?tab=invoices`)}
                  data-testid={`invoice-row-${inv.id}`}
                >
                  <div>
                    <p className="text-sm font-medium">{inv.projectName}</p>
                    <p className="text-xs text-muted-foreground">{inv.clientName} · {format(new Date(inv.created_at), 'd MMM yyyy')}</p>
                  </div>
                  <span className="text-sm text-muted-foreground font-mono">{inv.invoice_number}</span>
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize w-fit', STATUS_VARIANTS[inv.status])}>
                    {inv.status}
                  </span>
                  <span className="text-sm font-semibold text-right">{formatCurrency(inv.total)}</span>
                  <span className="text-xs text-muted-foreground">
                    {inv.due_date ? format(new Date(inv.due_date), 'd MMM yyyy') : '—'}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
