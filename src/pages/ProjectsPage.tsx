import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { jobDisplayStatus } from '@/lib/quoteDisplay';
import { StatusBadge } from '@/components/StatusBadge';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'lead', label: 'Lead' },
  { key: 'quoted', label: 'Quoted' },
  { key: 'approved', label: 'Approved' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'completed', label: 'Completed' },
] as const;

type Tab = typeof TABS[number]['key'];

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
  const navigate = useNavigate();
  const { projects, loading, updateProjectStatus } = useProjects();
  const profitabilityQuery = useJobProfitability();
  const profitabilityById = new Map((profitabilityQuery.data ?? []).map(job => [job.jobId, job]));
  const quoteQuery = useQuoteSummaries(projects.map(project => project.id));
  const latestQuoteByProject = new Map<string, NonNullable<typeof quoteQuery.data>[number]>();
  for (const quote of [...(quoteQuery.data ?? [])].sort((a, b) =>
    Number(a.status === 'declined') - Number(b.status === 'declined') || b.created_at.localeCompare(a.created_at))) {
    if (!latestQuoteByProject.has(quote.project_id)) latestQuoteByProject.set(quote.project_id, quote);
  }
  const [tab, setTab] = useState<Tab>('all');

  const filtered = projects.filter(p => tab === 'all' || jobDisplayStatus(p, latestQuoteByProject.get(p.id)) === tab);

  const counts = {
    all: projects.length,
    lead: projects.filter(p => jobDisplayStatus(p, latestQuoteByProject.get(p.id)) === 'lead').length,
    quoted: projects.filter(p => jobDisplayStatus(p, latestQuoteByProject.get(p.id)) === 'quoted').length,
    approved: projects.filter(p => jobDisplayStatus(p, latestQuoteByProject.get(p.id)) === 'approved').length,
    in_progress: projects.filter(p => jobDisplayStatus(p, latestQuoteByProject.get(p.id)) === 'in_progress').length,
    completed: projects.filter(p => jobDisplayStatus(p, latestQuoteByProject.get(p.id)) === 'completed').length,
  };

  return (
    <AppShell>
      <PageLayout title="Jobs" description="All your jobs in one place">
        {/* Tabs */}
        <div className="mb-5 -mx-4 flex items-center gap-1 overflow-x-auto border-b px-4 [-webkit-overflow-scrolling:touch] touch-pan-x overscroll-x-contain sm:mx-0 sm:px-0">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex min-h-11 shrink-0 items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                tab === t.key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              data-testid={`tab-${t.key}`}
            >
              {t.label}
              <span className={cn('text-xs rounded-full px-1.5 py-0.5 font-medium', tab === t.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                {counts[t.key]}
              </span>
            </button>
          ))}
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
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-4">
              <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                No jobs in this view yet.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filtered.map(project => {
                const completed = project.stages.filter(s => s.status === 'completed').length;
                const total = project.stages.length;
                const progress = total > 0 ? (completed / total) * 100 : 0;
                const pending = project.changeRequests.filter(c => c.status === 'pending').length;
                const resolved = project.changeRequests.filter(c => c.status === 'approved' || c.status === 'declined').length;

                return (
                  <div
                    key={project.id}
                    className="flex min-w-0 items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3.5 hover:bg-muted/40 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/manage/${project.id}`)}
                    data-testid={`project-row-${project.id}`}
                  >
                    <ProjectInitial name={project.name} />
                    <div className="flex-1 min-w-0">
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
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={e => e.stopPropagation()}
                          className="inline-flex h-11 w-11 items-center justify-center rounded hover:bg-muted transition-colors text-muted-foreground flex-shrink-0"
                          data-testid={`button-project-menu-${project.id}`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52" onClick={e => e.stopPropagation()}>
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
