import { Project } from '@/types/project';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface DashboardStatsProps {
  projects: Project[];
}

export function DashboardStats({ projects }: DashboardStatsProps) {
  const activeProjects = projects.filter(p =>
    p.status === 'in_progress' || p.status === 'acknowledged' || p.status === 'sent'
  );

  const pendingApprovals = projects.reduce((acc, p) =>
    acc + p.changeRequests.filter(cr => cr.status === 'pending').length, 0
  );

  const awaitingResponse = projects.filter(p => p.status === 'sent').length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;

  const mostRecentUpdate = activeProjects.length > 0
    ? activeProjects.reduce((latest, p) =>
        p.updatedAt > latest ? p.updatedAt : latest,
        activeProjects[0].updatedAt
      )
    : null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Active projects — dark highlighted card */}
      <div
        className="rounded-xl p-4 col-span-1 bg-zinc-900"
        style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}
        data-testid="stat-active-projects"
      >
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
          Active Projects
        </p>
        <p className="text-3xl font-heading font-bold text-zinc-100 mb-2">
          {activeProjects.length}
        </p>
        {mostRecentUpdate ? (
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
            </span>
            <span className="text-xs font-medium text-amber-500">LIVE NOW</span>
            <span className="text-xs text-zinc-500">
              · Updated {formatDistanceToNow(mostRecentUpdate, { addSuffix: true })}
            </span>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">No active jobs yet</p>
        )}
      </div>

      {/* Pending Approvals */}
      <StatCard
        label="Pending Approvals"
        value={pendingApprovals}
        subtitle={pendingApprovals > 0 ? `${pendingApprovals} need your review` : 'No action required'}
        highlight={pendingApprovals > 0}
        testId="stat-pending-approvals"
      />

      {/* Awaiting Response */}
      <StatCard
        label="Awaiting Response"
        value={awaitingResponse}
        subtitle={awaitingResponse > 0 ? `${awaitingResponse} quote${awaitingResponse > 1 ? 's' : ''} sent` : 'Inbox is clear'}
        highlight={awaitingResponse > 0}
        testId="stat-awaiting-response"
      />

      {/* Completed */}
      <StatCard
        label="Completed"
        value={completedProjects}
        subtitle="Past 30 days"
        testId="stat-completed"
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
}: {
  label: string;
  value: number;
  subtitle: string;
  highlight?: boolean;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-white p-4 transition-all duration-200',
        highlight && 'ring-2 ring-amber-300/40'
      )}
      style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}
      data-testid={testId}
    >
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </p>
      <p className="text-3xl font-heading font-bold mb-2">{value}</p>
      <p className={cn('text-xs', highlight ? 'text-warning font-medium' : 'text-muted-foreground')}>
        {subtitle}
      </p>
    </div>
  );
}
