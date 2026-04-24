import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppShell } from '@/components/AppShell';
import { useProjects } from '@/hooks/useProjects';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, FolderOpen, User, GitBranch, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Project } from '@/types/project';

const STATUS_LABELS: Record<Project['status'], string> = {
  draft: 'Draft',
  sent: 'Sent',
  acknowledged: 'Acknowledged',
  in_progress: 'In Progress',
  completed: 'Completed',
};

const STATUS_VARIANTS: Record<Project['status'], string> = {
  draft: 'bg-zinc-100 text-zinc-600',
  sent: 'bg-amber-100 text-amber-800',
  acknowledged: 'bg-amber-100 text-amber-800',
  in_progress: 'bg-green-100 text-green-800',
  completed: 'bg-zinc-100 text-zinc-600',
};

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'draft', label: 'Drafts' },
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
  const { projects, loading } = useProjects();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('all');

  const filtered = projects.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.clientName.toLowerCase().includes(search.toLowerCase());

    if (tab === 'active') return matchesSearch && ['in_progress','acknowledged','sent'].includes(p.status);
    if (tab === 'completed') return matchesSearch && p.status === 'completed';
    if (tab === 'draft') return matchesSearch && p.status === 'draft';
    return matchesSearch;
  });

  const counts = {
    all: projects.length,
    active: projects.filter(p => ['in_progress','acknowledged','sent'].includes(p.status)).length,
    completed: projects.filter(p => p.status === 'completed').length,
    draft: projects.filter(p => p.status === 'draft').length,
  };

  return (
    <AppShell>
      <div className="border-b border-zinc-200 bg-white/80 backdrop-blur-md shadow-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects or clients..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 bg-muted/50 border-0 focus-visible:ring-1"
              data-testid="input-projects-search"
            />
          </div>
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-6">
          <h1 className="font-heading text-2xl font-bold">Projects</h1>
          <p className="text-sm text-muted-foreground mt-0.5">All your jobs in one place</p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 border-b">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
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

        <div className="rounded-xl border border-[#D8C3AD] bg-white overflow-hidden shadow-card">
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
                {search ? `No projects matching "${search}"` : 'No projects here yet.'}
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
                    className="flex items-center gap-4 px-4 py-3.5 hover:bg-muted/40 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/manage/${project.id}`)}
                    data-testid={`project-row-${project.id}`}
                  >
                    <ProjectInitial name={project.name} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm truncate">{project.name}</span>
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide', STATUS_VARIANTS[project.status])}>
                          {STATUS_LABELS[project.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{project.clientName}</span>
                        {pending > 0 && <span className="flex items-center gap-1 text-warning font-medium"><GitBranch className="w-3 h-3" />{pending} pending</span>}
                        {resolved > 0 && <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" />{resolved} resolved</span>}
                      </div>
                    </div>
                    {total > 0 && (
                      <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                        <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-muted-foreground">{completed}/{total}</span>
                      </div>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </AppShell>
  );
}
