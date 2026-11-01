import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppShell } from '@/components/AppShell';
import { PageLayout } from '@/components/PageLayout';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateJobModal } from '@/components/CreateJobModal';
import { useCreateProject } from '@/hooks/useCreateProject';
import { FileText, ChevronRight } from 'lucide-react';
import { StatusBadge } from '@/components/StatusBadge';
import { quoteDisplayStatus, type QuoteSummary } from '@/lib/quoteDisplay';
import { aud } from '@/hooks/useJobCosts';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { KpiCard } from '@/components/KpiCard';
import { ListPagination } from '@/components/ListPagination';
import { SearchFilterButton, SearchOverlay } from '@/components/ui/search-overlay';
import { Money } from '@/components/ui/money';
import { formatFullDate } from '@/lib/dateFormat';
import { EmptyState } from '@/components/ui/empty-state';
import { FilterTabs } from '@/components/ui/filter-tabs';
import { DeleteResourceDialog } from '@/components/DeleteResourceDialog';
import { Trash2 } from 'lucide-react';

interface QuoteRow extends QuoteSummary {
  projectName: string;
  clientName: string;
}

const FILTERS = ['all', 'open', 'draft', 'sent', 'approved', 'declined', 'expired'] as const;

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
  const [deletingQuote, setDeletingQuote] = useState<QuoteRow | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { createProject } = useCreateProject();
  const query = useAllQuotes();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [newQuoteOpen, setNewQuoteOpen] = useState(false);
  const quotes = query.data ?? [];
  const visible = quotes.filter(quote => {
    const status = quoteDisplayStatus(quote);
    const matchesStatus = filter === 'all' || (filter === 'open' ? status === 'draft' || status === 'sent' : status === filter);
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
        <KpiCard label="Open quote value" value={query.isLoading || query.isError ? "—" : <Money value={pipelineValue} basis="ex GST" />}
          description="Draft and sent quotes, using saved subtotals."
          definition="Sum of stored ex-GST subtotals for draft and sent quotes. This is not collected revenue."
          onClick={() => { setFilter('open'); setSearch(''); }} />
        <KpiCard label="Quotes needing a decision" tone="purple" value={query.isLoading || query.isError ? "—" : quotes.filter((quote) => quoteDisplayStatus(quote) === "sent").length}
          description="Sent quotes with no recorded decision."
          definition="Quotes currently shown as sent. Select to show only those quotes."
          onClick={() => { setFilter('sent'); setSearch(''); }} />
      </section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchFilterButton onClick={() => setSearchOpen(true)} />
        <p className="text-sm text-muted-foreground" aria-live="polite">Showing {visible.length} of {quotes.length} {quotes.length === 1 ? 'quote' : 'quotes'}</p>
      </div>
      <FilterTabs
        label="Filter quotes"
        className="mb-4"
        value={filter}
        onChange={(value) => setFilter(value as (typeof FILTERS)[number])}
        options={FILTERS.map((status) => ({
          value: status,
          label: status === 'all' ? 'All' : status[0].toUpperCase() + status.slice(1),
          count: status === 'all' ? quotes.length : quotes.filter((quote) => status === 'open' ? ['draft', 'sent'].includes(quoteDisplayStatus(quote) ?? '') : quoteDisplayStatus(quote) === status).length,
        }))}
      />
       <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
        <div className="hidden grid-cols-[minmax(0,1fr)_minmax(100px,145px)_minmax(85px,110px)_minmax(105px,140px)_minmax(115px,145px)_20px] gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground lg:grid">
          <span>Job / Client</span><span>Quote #</span><span>Status</span><span>Timeline / expiry</span><span className="text-right">Quote value</span><span />
        </div>
        {query.isLoading ? <div className="divide-y">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="flex items-center gap-4 p-4"><div className="flex-1 space-y-2"><Skeleton className="h-4 w-2/5" /><Skeleton className="h-3 w-1/4" /></div><Skeleton className="h-6 w-20" /></div>)}</div>
          : query.isError ? <div className="px-5 py-12 text-center"><p role="alert" className="text-sm text-foreground">Quotes could not be loaded.</p><Button variant="outline" className="mt-3" onClick={() => query.refetch()}>Try again</Button></div>
              : visible.length === 0 ? <EmptyState className="border-0 shadow-none" icon={<FileText className="h-5 w-5" />} title="No matching quotes" description={quotes.length ? "Try another status or search term." : "Quotes will appear here when they are created."} />
               : <div className="divide-y divide-border/70">{pageQuotes.map(quote => {
                const status = quoteDisplayStatus(quote) ?? 'draft';
                 const validUntil = quote.valid_until ? new Date(quote.valid_until) : null;
                return <div key={quote.id} className="flex min-w-0 items-center">
                  <button type="button" onClick={() => navigate(`/manage/${quote.project_id}?tab=quote`)}
                   className="group grid min-w-0 flex-1 grid-cols-1 items-center gap-2 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:grid-cols-[minmax(0,1fr)_minmax(100px,145px)_minmax(85px,110px)_minmax(105px,140px)_minmax(115px,145px)_20px] lg:gap-3"
                  data-testid={`quote-row-${quote.id}`}>
                   <span className="min-w-0"><span className="block break-words text-sm font-semibold" title={quote.projectName}>{quote.projectName}</span><span className="mt-0.5 block break-words text-sm text-muted-foreground" title={quote.clientName}>{quote.clientName || "Client unavailable"} · {formatFullDate(quote.created_at)}</span></span>
                   <span className="font-mono text-sm text-muted-foreground">{quote.quote_number}</span>
                   <span><StatusBadge status={status} size="sm" /></span>
                   <span className="text-sm text-muted-foreground">{validUntil && !Number.isNaN(validUntil.getTime()) ? <>Valid until {formatFullDate(validUntil)}</> : <>Created {formatFullDate(quote.created_at)}</>}</span>
                   <span className="flex flex-col items-start gap-0.5 text-sm font-semibold tabular-nums lg:items-end lg:text-right"><Money value={quote.subtotal} basis="ex GST" /><span className="text-xs font-normal text-muted-foreground">Total <Money value={quote.total} basis="inc GST" /></span></span>
                   <ChevronRight className="hidden h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 lg:block" />
                </button>
                <Button variant="ghost" size="icon" className="mr-2 shrink-0 text-destructive" aria-label={`Delete quote ${quote.quote_number}`}
                  onClick={() => setDeletingQuote(quote)}><Trash2 /></Button>
                </div>;
              })}</div>}
      </div>
       <ListPagination page={currentPage} pageSize={10} total={visible.length} onChange={setPage} />
    </PageLayout>
    <SearchOverlay
      open={searchOpen}
      onOpenChange={setSearchOpen}
      value={search}
      onValueChange={(value) => { setSearch(value); setPage(1); }}
      resultSummary={`${visible.length} matching ${visible.length === 1 ? 'quote' : 'quotes'}`}
    >
      {visible.slice(0, 12).map((quote) => (
        <button
          key={quote.id}
          type="button"
          onClick={() => { setSearchOpen(false); navigate(`/manage/${quote.project_id}?tab=quote`); }}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="min-w-0">
            <span className="block truncate font-medium">{quote.projectName}</span>
            <span className="block truncate text-sm text-muted-foreground">{quote.clientName} · {quote.quote_number}</span>
          </span>
          <StatusBadge status={quoteDisplayStatus(quote) ?? 'draft'} size="sm" />
        </button>
      ))}
      {visible.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No quotes match this search.</p>}
    </SearchOverlay>
    <DeleteResourceDialog target={deletingQuote ? { kind: 'quote', id: deletingQuote.id } : null}
      label={deletingQuote?.quote_number ?? ''} onClose={() => setDeletingQuote(null)} />
    <CreateJobModal
      open={newQuoteOpen}
      onOpenChange={setNewQuoteOpen}
      onCreateJob={handleCreateQuote}
    />
  </AppShell>;
}
