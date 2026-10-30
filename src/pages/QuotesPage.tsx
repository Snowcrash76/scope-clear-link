import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/AppShell';
import { PageLayout } from '@/components/PageLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { FileText, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { StatusBadge } from '@/components/StatusBadge';
import { quoteDisplayStatus, type QuoteSummary } from '@/lib/quoteDisplay';
import { aud } from '@/hooks/useJobCosts';
import { Button } from '@/components/ui/button';

interface QuoteRow extends QuoteSummary {
  projectName: string;
  clientName: string;
}

const FILTERS = ['all', 'draft', 'sent', 'approved', 'declined', 'expired'] as const;

function useAllQuotes() {
  const { user } = useAuth();
  return useQuery<QuoteRow[]>({
    queryKey: ['/quotes/all', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: projects, error: pe } = await supabase.from('projects')
        .select('id, name, client_name').eq('user_id', user!.id);
      if (pe) throw pe;
      if (!projects?.length) return [];
      const projectMap = new Map(projects.map(project => [project.id, project]));
      const { data: quotes, error } = await supabase.from('quotes')
        .select('id, quote_number, status, subtotal, total, tax_amount, created_at, project_id, valid_until')
        .in('project_id', projects.map(project => project.id))
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (quotes ?? []).map(quote => ({
        ...quote,
        projectName: projectMap.get(quote.project_id)?.name ?? '',
        clientName: projectMap.get(quote.project_id)?.client_name ?? '',
      })) as QuoteRow[];
    },
    staleTime: 30_000,
  });
}

export default function QuotesPage() {
  const navigate = useNavigate();
  const query = useAllQuotes();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const quotes = query.data ?? [];
  const visible = quotes.filter(quote => {
    const status = quoteDisplayStatus(quote);
    const matchesStatus = filter === 'all' || status === filter;
    return matchesStatus;
  });

  return <AppShell>
    <PageLayout title="Quotes" description="Every quote, with the client-facing status and ex-GST value.">
      <div className="mb-4 flex justify-end">
        <p className="text-sm text-muted-foreground">{visible.length} {visible.length === 1 ? 'quote' : 'quotes'}</p>
      </div>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b [-webkit-overflow-scrolling:touch]">
        {FILTERS.map(status => {
          const count = status === 'all' ? quotes.length : quotes.filter(q => quoteDisplayStatus(q) === status).length;
          return <button type="button" key={status} onClick={() => setFilter(status)}
            className={cn('min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium capitalize', filter === status ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
             {status === 'all' ? 'All' : status[0].toUpperCase() + status.slice(1)} <span className="ml-1 text-sm">{count}</span>
          </button>;
        })}
      </div>
      <div className="min-w-0 overflow-hidden rounded-xl border border-[#D8C3AD] bg-white shadow-card">
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(100px,150px)_minmax(85px,110px)_minmax(112px,145px)_16px] gap-4 border-b bg-muted/30 px-4 py-3 text-xs font-semibold text-muted-foreground sm:grid">
          <span>Job / Client</span><span>Quote #</span><span>Status</span><span className="text-right">Quote value (ex GST)</span><span />
        </div>
        {query.isLoading ? <div className="divide-y">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="flex items-center gap-4 p-4"><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-1/4" /></div><Skeleton className="h-6 w-20" /></div>)}</div>
          : query.isError ? <div className="px-5 py-12 text-center"><p role="alert" className="text-sm text-foreground">Quotes could not be loaded.</p><Button variant="outline" className="mt-3" onClick={() => query.refetch()}>Try again</Button></div>
              : visible.length === 0 ? <div className="px-5 py-12 text-center"><FileText className="mx-auto mb-3 h-9 w-9 text-muted-foreground" /><p className="font-semibold">No matching quotes</p><p className="mt-1 text-sm text-muted-foreground">Quotes will appear here when they are created.</p></div>
              : <div className="divide-y divide-border/70">{visible.map(quote => {
                const status = quoteDisplayStatus(quote) ?? 'draft';
                return <button key={quote.id} type="button" onClick={() => navigate(`/manage/${quote.project_id}?tab=quote`)}
                  className="group grid w-full grid-cols-1 items-center gap-2 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:grid-cols-[minmax(0,1fr)_minmax(100px,150px)_minmax(85px,110px)_minmax(112px,145px)_16px] sm:gap-4"
                  data-testid={`quote-row-${quote.id}`}>
                  <span className="min-w-0"><span className="block break-words text-sm font-semibold">{quote.projectName}</span><span className="mt-0.5 block break-words text-sm text-muted-foreground">{quote.clientName} · {format(new Date(quote.created_at), 'd MMM yyyy')}</span></span>
          <span className="font-mono text-sm text-muted-foreground">{quote.quote_number}</span>
                  <span><StatusBadge status={status} size="sm" /></span>
                  <span className="text-sm font-semibold tabular-nums sm:text-right">{quote.subtotal == null ? '—' : aud(quote.subtotal)}<span className="ml-1 text-xs font-normal text-muted-foreground">ex GST</span></span>
                  <ChevronRight className="hidden h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
                </button>;
              })}</div>}
      </div>
    </PageLayout>
  </AppShell>;
}
