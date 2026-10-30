import { Project } from '@/types/project';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { useQuoteSummaries } from '@/hooks/useQuoteSummaries';
import { quoteDisplayStatus } from '@/lib/quoteDisplay';

interface DashboardStatsProps {
  projects: Project[];
}

export function DashboardStats({ projects }: DashboardStatsProps) {
  const quoteQuery = useQuoteSummaries(projects.map(project => project.id));
  const quotes = quoteQuery.data ?? [];
  const latestByProject = new Map<string, typeof quotes[number]>();
  for (const quote of [...quotes].sort((a, b) =>
    Number(a.status === 'declined') - Number(b.status === 'declined') || b.created_at.localeCompare(a.created_at))) {
    if (!latestByProject.has(quote.project_id)) latestByProject.set(quote.project_id, quote);
  }
  const activeProjects = projects.filter(p => p.status === 'in_progress');

  const pendingApprovals = projects.reduce((acc, p) =>
    acc + p.changeRequests.filter(cr => cr.status === 'pending').length, 0
  );

  const awaitingResponse = projects.filter(p => quoteDisplayStatus(latestByProject.get(p.id)) === 'sent').length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;

  const mostRecentUpdate = activeProjects.length > 0
    ? activeProjects.reduce((latest, p) =>
        p.updatedAt > latest ? p.updatedAt : latest,
        activeProjects[0].updatedAt
      )
    : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Active projects */}
      <div
        title="Jobs marked In progress only. Quoted and awaiting-response jobs are counted separately."
        className="rounded-lg px-4 py-3 col-span-1 bg-white border border-[#D8C3AD] shadow-card"
        data-testid="stat-active-projects"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-1">
          Active Jobs
        </p>
        <p className="text-2xl font-heading font-bold text-zinc-900 mb-1">
          {activeProjects.length}
        </p>
        {mostRecentUpdate ? (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span className="text-xs font-medium text-amber-700">LIVE</span>
            <span className="text-xs text-zinc-400">
              · {formatDistanceToNow(mostRecentUpdate, { addSuffix: true })}
            </span>
          </div>
        ) : (
          <p className="text-xs text-zinc-400">No active jobs yet</p>
        )}
      </div>

      {/* Pending Approvals */}
      <StatCard
        label="Pending Approvals"
        value={pendingApprovals}
        subtitle={pendingApprovals > 0 ? `${pendingApprovals} need your review` : 'No action required'}
        highlight={pendingApprovals > 0}
        testId="stat-pending-approvals"
        title="Variations awaiting a decision from the client."
      />

      {/* Awaiting Response */}
      <StatCard
        label="Awaiting Response"
        value={awaitingResponse}
        subtitle={awaitingResponse > 0 ? `${awaitingResponse} quote${awaitingResponse > 1 ? 's' : ''} sent` : 'Inbox is clear'}
        highlight={awaitingResponse > 0}
        testId="stat-awaiting-response"
        title="Latest quotes with Sent status and no recorded client decision."
      />

      {/* Completed */}
      <StatCard
        label="Completed"
        value={completedProjects}
        subtitle="Past 30 days"
        testId="stat-completed"
        title="Jobs marked Completed. The subtitle is retained from the existing dashboard."
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  highlight,
  testId,
  title,
}: {
  label: string;
  value: number;
  subtitle: string;
  highlight?: boolean;
  testId?: string;
  title: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-white px-4 py-3 shadow-card transition-all duration-200',
        highlight && 'ring-2 ring-amber-300/40'
      )}
      data-testid={testId}
      title={title}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </p>
      <p className="text-2xl font-heading font-bold mb-1">{value}</p>
      <p className={cn('text-xs', highlight ? 'text-warning font-medium' : 'text-muted-foreground')}>
        {subtitle}
      </p>
    </div>
  );
}
