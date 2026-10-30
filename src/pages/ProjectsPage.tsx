import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { PageLayout } from '@/components/PageLayout';
import { useProjects } from '@/hooks/useProjects';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FolderOpen, User, GitBranch, ChevronRight, MoreVertical, CheckCircle2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJobProfitability, aud, profitability } from '@/hooks/useJobCosts';
import { useQuoteSummaries } from '@/hooks/useQuoteSummaries';
import { awaitingQuoteResponse, jobDisplayStatus, quoteDisplayStatus, type QuoteSummary } from '@/lib/quoteDisplay';
import { StatusBadge } from '@/components/StatusBadge';
import { awaitingClientApproval } from '@/lib/variationStatus';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'lead', label: 'Lead' },
  { key: 'quoted', label: 'Quoted' },
  { key: 'approved', label: 'Approved' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
] as const;

type Tab = typeof TABS[number]['key'];
type SortOrder = 'newest' | 'oldest' | 'name' | 'quote';

function dateLabel(value: string | Date | undefined) {
  if (!value) return 'date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'date unavailable' : new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function nextAction(project: { status: string; createdAt: Date; updatedAt: Date }, quote?: QuoteSummary) {
  const quoteStatus = quoteDisplayStatus(quote);
  if (project.status === 'completed') return `Completed · updated ${dateLabel(project.updatedAt)}`;
  if (project.status === 'in_progress') return `In progress · updated ${dateLabel(project.updatedAt)}`;
  if (project.status === 'acknowledged') return `Approved · ${dateLabel(quote?.approved_at ?? project.updatedAt)}`;
  if (quoteStatus === 'sent') return `Waiting on client since ${dateLabel(quote?.updated_at ?? quote?.created_at)}`;
  if (quoteStatus === 'expired') return `Follow up on expired quote · expired ${dateLabel(quote?.valid_until ?? quote?.updated_at)}`;
  if (quoteStatus === 'approved') return `Approved · ${dateLabel(quote?.approved_at ?? quote?.updated_at)}`;
  if (quoteStatus === 'declined') return `Revise declined quote · ${dateLabel(quote?.declined_at ?? quote?.updated_at)}`;
  if (quoteStatus === 'draft') return `Finish draft quote · updated ${dateLabel(quote?.updated_at ?? quote?.created_at)}`;
  return `New lead · created ${dateLabel(project.createdAt)}`;
}

function ProjectInitial({ name }: { name: string }) {
  const colors = ['bg-amber-600','bg-stone-600','bg-zinc-600','bg-amber-800','bg-orange-600','bg-stone-500'];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div className={cn('w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-heading font-bold', colors[idx])}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function ProjectsPage() {
  const { projects, loading, updateProjectStatus } = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const profitabilityQuery = useJobProfitability();
  const profitabilityById = new Map((profitabilityQuery.data ?? []).map(job => [job.jobId, job]));
  const quoteQuery = useQuoteSummaries(projects.map(project => project.id));
  const latestQuoteByProject = new Map<string, QuoteSummary>();
  for (const quote of [...(quoteQuery.data ?? [])].sort((a, b) =>
    Number(a.status === 'declined') - Number(b.status === 'declined') || b.created_at.localeCompare(a.created_at))) {
    if (!latestQuoteByProject.has(quote.project_id)) latestQuoteByProject.set(quote.project_id, quote);
  }
  const [sort, setSort] = useState<SortOrder>('newest');
  const filterParam = searchParams.get('status') ?? 'all';
  const specialFilter = ['awaiting_response', 'pending_approval', 'no_costs', 'missing_cost_data'].includes(filterParam);
  const tab: Tab = TABS.some(item => item.key === filterParam) ? filterParam as Tab : 'all';

  const selectFilter = (filter: string) => {
    const next = new URLSearchParams(searchParams);
    if (filter === 'all') next.delete('status');
    else next.set('status', filter);
    setSearchParams(next);
  };

  const filtered = projects.filter(project => {
    const quote = latestQuoteByProject.get(project.id);
    if (filterParam === 'awaiting_response') return awaitingQuoteResponse(project, quote);
    if (filterParam === 'pending_approval') return project.changeRequests.some(awaitingClientApproval);
    if (filterParam === 'in_progress') return jobDisplayStatus(project, quote) === 'in_progress' && !awaitingQuoteResponse(project, quote);
    if (filterParam === 'no_costs') {
      const costs = profitabilityById.get(project.id);
      return !!costs && costs.confirmedCostsIncGst === 0 && costs.draftCostsIncGst === 0;
    }
    if (filterParam === 'missing_cost_data') return !profitabilityById.has(project.id);
    return tab === 'all' || jobDisplayStatus(project, quote) === tab;
  });
  const sortedFiltered = [...filtered].sort((a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'quote') return (latestQuoteByProject.get(b.id)?.subtotal ?? -Infinity) - (latestQuoteByProject.get(a.id)?.subtotal ?? -Infinity);
    const createdA = a.createdAt.getTime();
    const createdB = b.createdAt.getTime();
    return sort === 'newest' ? createdB - createdA : createdA - createdB;
  });

  const counts = {
    all: projects.length,
    lead: projects.filter(p => jobDisplayStatus(p, latestQuoteByProject.get(p.id)) === 'lead').length,
    quoted: projects.filter(p => jobDisplayStatus(p, latestQuoteByProject.get(p.id)) === 'quoted').length,
    approved: projects.filter(p => jobDisplayStatus(p, latestQuoteByProject.get(p.id)) === 'approved').length,
    in_progress: projects.filter(p => jobDisplayStatus(p, latestQuoteByProject.get(p.id)) === 'in_progress').length,
    completed: projects.filter(p => jobDisplayStatus(p, latestQuoteByProject.get(p.id)) === 'completed').length,
  };
  const pendingVariationTotal = filtered.reduce((total, project) =>
    total + project.changeRequests.filter(awaitingClientApproval).length, 0);
  const filterLabel: Record<string, string> = {
    awaiting_response: 'Awaiting quote response',
    pending_approval: `Pending variations · ${pendingVariationTotal} requests across ${filtered.length} jobs`,
    no_costs: 'Jobs with no costs logged',
    missing_cost_data: 'Jobs with unavailable cost data',
  };

  return (
    <AppShell>
      <PageLayout title="Jobs" description="All your jobs in one place">
        {/* Tabs */}
        <div className="mb-5 -mx-4 flex items-center gap-1 overflow-x-auto border-b px-4 [-webkit-overflow-scrolling:touch] touch-pan-x overscroll-x-contain sm:mx-0 sm:px-0">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => selectFilter(t.key)}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                !specialFilter && tab === t.key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              aria-pressed={!specialFilter && tab === t.key}
              data-testid={`tab-${t.key}`}
            >
              {t.label}
              <span className={cn('text-xs rounded-full px-1.5 py-0.5 font-medium', tab === t.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{sortedFiltered.length} {sortedFiltered.length === 1 ? 'job' : 'jobs'}</p>
            {specialFilter&&<p className="mt-0.5 text-sm font-medium text-zinc-800">{filterLabel[filterParam]}</p>}
          </div>
          {specialFilter&&<button type="button" onClick={()=>selectFilter('all')} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-amber-900 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700">Clear dashboard filter</button>}
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-foreground">
            <span>Sort:</span>
            <select
              value={sort}
              onChange={event => setSort(event.target.value as SortOrder)}
              className="min-h-11 rounded-lg border border-zinc-400 bg-white px-3 text-sm text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700"
              aria-label="Sort jobs"
              name="job-sort"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="name">Job name A–Z</option>
              <option value="quote">Quote value — high to low</option>
            </select>
          </label>
        </div>

        <div className="min-w-0 rounded-xl border border-[#D8C3AD] bg-white overflow-hidden shadow-card">
          {loading ? (
            <div className="divide-y">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="w-12 h-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : (filterParam === 'no_costs' || filterParam === 'missing_cost_data') && profitabilityQuery.isLoading ? (
            <div className="space-y-3 p-5" aria-label="Checking cost records">{Array.from({length:3}).map((_,i)=><Skeleton key={i} className="h-16 w-full"/>)}</div>
          ) : (filterParam === 'no_costs' || filterParam === 'missing_cost_data') && profitabilityQuery.isError ? (
            <div className="p-8 text-center"><p role="alert" className="text-sm text-zinc-800">Cost records could not be checked. This is not evidence that a job has zero costs.</p><button type="button" onClick={()=>void profitabilityQuery.refetch()} className="mt-3 min-h-11 rounded-lg px-3 text-sm font-semibold text-amber-900 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700">Try again</button></div>
          ) : sortedFiltered.length === 0 ? (
            <div className="text-center py-12 px-4">
              <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No jobs in this view yet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {sortedFiltered.map(project => {
                const completed = project.stages.filter(s => s.status === 'completed').length;
                const total = project.stages.length;
                const progress = total > 0 ? (completed / total) * 100 : 0;
                const pending = project.changeRequests.filter(c => c.status === 'pending').length;
                const resolved = project.changeRequests.filter(c => c.status === 'approved' || c.status === 'declined').length;

                return (
                  <div key={project.id} className="flex min-w-0 items-center gap-2 px-2 py-2 transition-colors hover:bg-muted/40 sm:gap-3 sm:px-3 sm:py-2.5" data-testid={`project-row-${project.id}`}>
                    <Link
                      to={`/manage/${project.id}`}
                      className="group flex min-h-[76px] min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:gap-4 sm:px-2"
                    >
                      <ProjectInitial name={project.name} />
                      <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-0.5">
                        <span className="min-w-0 font-semibold text-sm break-words">{project.name}</span>
                        <StatusBadge status={jobDisplayStatus(project, latestQuoteByProject.get(project.id))} size="sm" />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="min-w-0 flex items-start gap-1 break-words"><User className="mt-0.5 w-3 h-3 flex-shrink-0" />{project.clientName}</span>
                        <span className="inline-flex items-center gap-1 font-medium text-foreground sm:hidden">
                          Quote {latestQuoteByProject.get(project.id)?.subtotal == null ? '—' : aud(latestQuoteByProject.get(project.id)!.subtotal!)} <span className="font-normal text-muted-foreground">ex GST</span>
                        </span>
                        {pending > 0 && <span className="flex items-center gap-1 text-warning font-medium"><GitBranch className="w-3 h-3 flex-shrink-0" />{pending} pending</span>}
                        {resolved > 0 && <span className="flex items-center gap-1"><GitBranch className="w-3 h-3 flex-shrink-0" />{resolved} resolved</span>}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {profitabilityQuery.isLoading ? <span className="h-5 w-24 animate-pulse rounded bg-muted" aria-label="Loading job profitability" /> :
                          profitabilityQuery.isError ? <span className="text-xs text-muted-foreground">Profitability unavailable</span> :
                          profitabilityById.has(project.id) ? (() => {
                            const item = profitabilityById.get(project.id)!;
                            const result = profitability(item, 'quoted');
                            return <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/70 px-2.5 py-1 text-xs font-medium text-foreground" data-testid={`profitability-badge-${project.id}`}>
                              {result.profit === null ? 'Costs so far · quote unavailable' : `Costs so far · ${aud(result.profit)} · ${result.margin === null ? '—' : `${result.margin.toFixed(1)}%`}`}
                            </span>;
                          })() : <span className="text-xs text-muted-foreground">Profitability unavailable</span>}
                        <span className="text-xs text-muted-foreground">Margin uses ex-GST revenue less confirmed costs inc GST. Costs may be incomplete.</span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-foreground lg:hidden">
                        <span className="text-muted-foreground">Next action · </span>{nextAction(project, latestQuoteByProject.get(project.id))}
                      </p>
                    </div>
                    <div className="hidden min-w-28 text-right sm:block">
                      <p className="text-xs text-muted-foreground">Quote value</p>
                      <p className="font-semibold tabular-nums">{latestQuoteByProject.get(project.id)?.subtotal == null ? '—' : aud(latestQuoteByProject.get(project.id)!.subtotal!)}</p>
                      <p className="text-xs text-muted-foreground">ex GST</p>
                    </div>
                    {total > 0 && (
                      <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                        <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">{completed}/{total}</span>
                      </div>
                    )}
                    <div className="hidden min-w-[16rem] max-w-[20rem] text-right lg:block">
                      <p className="text-sm font-medium text-foreground">{nextAction(project, latestQuoteByProject.get(project.id))}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">Next action</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex-shrink-0"
                          aria-label={`More actions for ${project.name}`}
                          data-testid={`button-project-menu-${project.id}`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        {project.status !== 'completed' ? (
                          <DropdownMenuItem
                            className="gap-2"
                            onSelect={() => updateProjectStatus(project.id, 'completed')}
                            data-testid={`menu-mark-completed-${project.id}`}
                          >
                            <CheckCircle2 className="w-4 h-4 text-approved" />
                            Mark as Completed
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            className="gap-2"
                            onSelect={() => updateProjectStatus(project.id, 'in_progress')}
                            data-testid={`menu-mark-in-progress-${project.id}`}
                          >
                            <RotateCcw className="w-4 h-4" />
                            Mark as In Progress
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PageLayout>
    </AppShell>
  );
}
