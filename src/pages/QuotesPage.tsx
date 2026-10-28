import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/AppShell';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

type QuoteStatus = 'draft' | 'sent' | 'approved' | 'declined' | 'revised';

const STATUS_VARIANTS: Record<QuoteStatus, string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  sent: 'bg-amber-100 text-amber-800',
  approved: 'bg-green-100 text-green-800',
  declined: 'bg-red-100 text-red-800',
  revised: 'bg-amber-100 text-amber-800',
};

interface QuoteRow {
  id: string;
  quote_number: string;
  status: QuoteStatus;
  total: number | null;
  created_at: string;
  project_id: string;
  projectName: string;
  clientName: string;
}

function useAllQuotes() {
  const { user } = useAuth();
  return useQuery<QuoteRow[]>({
    queryKey: ['/quotes/all', user?.id],
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

      const { data: quotes, error: qe } = await supabase
        .from('quotes')
        .select('id, quote_number, status, total, created_at, project_id')
        .in('project_id', ids)
        .order('created_at', { ascending: false });
      if (qe) throw qe;

      return (quotes ?? []).map(q => ({
        ...q,
        status: q.status as QuoteStatus,
        projectName: projectMap.get(q.project_id)?.name ?? '',
        clientName: projectMap.get(q.project_id)?.client_name ?? '',
      }));
    },
    staleTime: 30_000,
  });
}

const formatCurrency = (n: number | null) =>
  n == null ? '—' : `$${n.toLocaleString('en-AU', { minimumFractionDigits: 0 })}`;

export default function QuotesPage() {
  const navigate = useNavigate();
  const { data: quotes, isLoading } = useAllQuotes();

  return (
    <AppShell>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold">Quotes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All quotes across your jobs</p>
        </div>

        <div className="rounded-xl border border-[#D8C3AD] bg-white dark:bg-zinc-900 overflow-hidden shadow-card">
          {/* Table header — desktop only */}
          <div className="hidden sm:grid sm:grid-cols-[1fr_140px_100px_100px_40px] gap-4 px-4 py-2.5 border-b bg-muted/30">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Job / Client</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Quote #</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</span>
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide text-right">Total</span>
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
          ) : !quotes?.length ? (
            <div className="text-center py-12 px-4">
              <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No quotes yet. Create a job and add a quote to get started.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {quotes.map(q => (
                <div
                  key={q.id}
                  onClick={() => navigate(`/manage/${q.project_id}?tab=quote`)}
                  className="cursor-pointer hover:bg-muted/40 transition-colors group"
                  data-testid={`quote-row-${q.id}`}
                >
                  {/* Mobile layout */}
                  <div className="flex items-center gap-3 px-4 py-3.5 sm:hidden">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium break-words">{q.projectName}</p>
                      <p className="text-xs text-muted-foreground break-words">{q.clientName} · {format(new Date(q.created_at), 'd MMM yyyy')}</p>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold capitalize', STATUS_VARIANTS[q.status])}>
                          {q.status}
                        </span>
                        <span className="text-xs font-semibold text-muted-foreground">{formatCurrency(q.total)}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden sm:grid sm:grid-cols-[1fr_140px_100px_100px_40px] gap-4 px-4 py-3.5 items-center">
                    <div>
                      <p className="text-sm font-medium">{q.projectName}</p>
                      <p className="text-xs text-muted-foreground">{q.clientName} · {format(new Date(q.created_at), 'd MMM yyyy')}</p>
                    </div>
                    <span className="text-sm text-muted-foreground font-mono">{q.quote_number}</span>
                    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold capitalize w-fit', STATUS_VARIANTS[q.status])}>
                      {q.status}
                    </span>
                    <span className="text-sm font-semibold text-right">{formatCurrency(q.total)}</span>
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
