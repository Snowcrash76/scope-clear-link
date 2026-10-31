import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/AppShell';
import { PageLayout } from '@/components/PageLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { CreateJobModal } from '@/components/CreateJobModal';
import { useCreateProject } from '@/hooks/useCreateProject';
import { FileText, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { StatusBadge } from '@/components/StatusBadge';
import { quoteDisplayStatus, type QuoteSummary } from '@/lib/quoteDisplay';
import { aud } from '@/hooks/useJobCosts';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

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
  const queryClient = useQueryClient();
  const { createProject } = useCreateProject();
  const query = useAllQuotes();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [newQuoteOpen, setNewQuoteOpen] = useState(false);
  const quotes = query.data ?? [];
  const visible = quotes.filter(quote => {
    const status = quoteDisplayStatus(quote);
    const matchesStatus = filter === 'all' || status === filter;
    const term = search.trim().toLocaleLowerCase();
    const matchesSearch = !term || [quote.projectName, quote.clientName, quote.quote_number, status ?? '']
      .some(value => value.toLocaleLowerCase().includes(term));
    return matchesStatus && matchesSearch;
  });
  const pipelineValue = quotes
    .filter((quote) => ["draft", "sent"].includes(quoteDisplayStatus(quote) ?? ""))
    .reduce((total, quote) => total + (quote.subtotal ?? 0), 0);
  const pageCount = Math.max(1, Math.ceil(visible.length / 10));
  const currentPage = Math.min(page, pageCount);
  const pageQuotes = visible.slice((currentPage - 1) * 10, currentPage * 10);

  const handleCreateQuote = async (data: Parameters<typeof createProject>[0]) => {
    const projectId = await createProject(data);
    if (!projectId) return false;
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/quotes/all'] }),
      queryClient.invalidateQueries({ queryKey: ['/projects'] }),
    ]);
    toast.success('Job and quote created', { description: 'The new draft is ready to review.' });
    setNewQuoteOpen(false);
    navigate(`/manage/${projectId}?tab=quote`);
    return true;
  };

  return <AppShell>
    <PageLayout
      title="Quotes"
      eyebrow="COMMERCIAL & RESIDENTIAL ESTIMATION"
      description="Every quote, with the client-facing status and ex-GST value. New quote starts a new job; open a job to manage its existing quote."
      actions={<Button className="min-h-11" onClick={() => setNewQuoteOpen(true)} data-testid="button-new-quote"><FileText className="mr-2 h-4 w-4" />New quote</Button>}
    >
      <section className="mb-6 grid gap-3 sm:grid-cols-2" aria-label="Quote overview">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card">
          <span className="absolute inset-x-0 top-0 h-[3px] bg-primary" aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-[.06em] text-muted-foreground">Open quote value · ex GST</p>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{query.isLoading ? "—" : aud(pipelineValue)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Draft and sent quotes, using saved subtotal values.</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card">
          <span className="absolute inset-x-0 top-0 h-[3px] bg-[hsl(var(--purple))]" aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-[.06em] text-muted-foreground">Quotes needing a decision</p>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{quotes.filter((quote) => quoteDisplayStatus(quote) === "sent").length}</p>
          <p className="mt-1 text-sm text-muted-foreground">Sent quotes that do not yet have a recorded decision.</p>
        </div>
      </section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:max-w-sm">
          <span className="sr-only">Search this quote list</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            name="quote-list-search"
            autoComplete="off"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search this quote list"
            className="min-h-11 pl-9"
            aria-label="Search this quote list"
            data-testid="input-quote-list-search"
          />
        </label>
        <p className="text-sm text-muted-foreground" aria-live="polite">Showing {visible.length} of {quotes.length} {quotes.length === 1 ? 'quote' : 'quotes'}</p>
      </div>
      <div className="mb-4 flex gap-1 overflow-x-auto border-b [-webkit-overflow-scrolling:touch]">
        {FILTERS.map(status => {
          const count = status === 'all' ? quotes.length : quotes.filter(q => quoteDisplayStatus(q) === status).length;
          return <button type="button" key={status} onClick={() => setFilter(status)} aria-pressed={filter === status}
            className={cn('min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium capitalize', filter === status ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground')}>
             {status === 'all' ? 'All' : status[0].toUpperCase() + status.slice(1)} <span className="ml-1 text-sm">{count}</span>
          </button>;
        })}
      </div>
       <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(100px,145px)_minmax(85px,110px)_minmax(105px,140px)_minmax(115px,145px)_20px] gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
          <span>Job / Client</span><span>Quote #</span><span>Status</span><span>Timeline / expiry</span><span className="text-right">Quote value</span><span />
        </div>
        {query.isLoading ? <div className="divide-y">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="flex items-center gap-4 p-4"><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-1/4" /></div><Skeleton className="h-6 w-20" /></div>)}</div>
          : query.isError ? <div className="px-5 py-12 text-center"><p role="alert" className="text-sm text-foreground">Quotes could not be loaded.</p><Button variant="outline" className="mt-3" onClick={() => query.refetch()}>Try again</Button></div>
              : visible.length === 0 ? <div className="px-5 py-12 text-center"><FileText className="mx-auto mb-3 h-9 w-9 text-muted-foreground" /><p className="font-semibold">No matching quotes</p><p className="mt-1 text-sm text-muted-foreground">Quotes will appear here when they are created.</p></div>
               : <div className="divide-y divide-border/70">{pageQuotes.map(quote => {
                const status = quoteDisplayStatus(quote) ?? 'draft';
                 const validUntil = quote.valid_until ? new Date(quote.valid_until) : null;
                return <button key={quote.id} type="button" onClick={() => navigate(`/manage/${quote.project_id}?tab=quote`)}
                   className="group grid w-full grid-cols-1 items-center gap-2 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:grid-cols-[minmax(0,1fr)_minmax(100px,145px)_minmax(85px,110px)_minmax(105px,140px)_minmax(115px,145px)_20px] lg:gap-3"
                  data-testid={`quote-row-${quote.id}`}>
                   <span className="min-w-0"><span className="block break-words text-sm font-semibold" title={quote.projectName}>{quote.projectName}</span><span className="mt-0.5 block break-words text-sm text-muted-foreground" title={quote.clientName}>{quote.clientName || "Client unavailable"} · {format(new Date(quote.created_at), 'd MMM yyyy')}</span></span>
                   <span className="font-mono text-sm text-muted-foreground">{quote.quote_number}</span>
                   <span><StatusBadge status={status} size="sm" /></span>
                   <span className="text-sm text-muted-foreground">{validUntil && !Number.isNaN(validUntil.getTime()) ? <>Valid until {format(validUntil, 'd MMM yyyy')}</> : <>Created {format(new Date(quote.created_at), 'd MMM yyyy')}</>}</span>
                   <span className="text-sm font-semibold tabular-nums lg:text-right">{quote.subtotal == null ? '—' : aud(quote.subtotal)}<span className="ml-1 text-xs font-normal text-muted-foreground">ex GST</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">Total {quote.total == null ? "unavailable" : `${aud(quote.total)} inc GST`}</span></span>
                   <ChevronRight className="hidden h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 lg:block" />
                </button>;
              })}</div>}
      </div>
       <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
         <span>Showing {visible.length === 0 ? 0 : (currentPage - 1) * 10 + 1}–{Math.min(currentPage * 10, visible.length)} of {visible.length} quotes</span>
         <div className="flex items-center gap-2">
           <Button variant="outline" className="min-h-11" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</Button>
           <span aria-label={`Page ${currentPage} of ${pageCount}`} className="tabular-nums">Page {currentPage} of {pageCount}</span>
           <Button variant="outline" className="min-h-11" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</Button>
         </div>
       </div>
    </PageLayout>
    <CreateJobModal
      open={newQuoteOpen}
      onOpenChange={setNewQuoteOpen}
      onCreateJob={handleCreateQuote}
    />
  </AppShell>;
}
