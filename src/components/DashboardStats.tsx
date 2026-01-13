import { Project } from '@/types/project';
import { Card } from '@/components/ui/card';
import { Briefcase, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardStatsProps {
  projects: Project[];
}

export function DashboardStats({ projects }: DashboardStatsProps) {
  const activeProjects = projects.filter(p => 
    p.status === 'in_progress' || p.status === 'acknowledged'
  ).length;
  
  const pendingApprovals = projects.reduce((acc, p) => 
    acc + p.changeRequests.filter(cr => cr.status === 'pending').length, 0
  );
  
  const awaitingResponse = projects.filter(p => p.status === 'sent').length;
  
  const completedProjects = projects.filter(p => p.status === 'completed').length;

  const stats = [
    {
      label: 'Active Projects',
      value: activeProjects,
      icon: Briefcase,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Pending Approvals',
      value: pendingApprovals,
      icon: Clock,
      color: 'text-pending-foreground',
      bgColor: 'bg-pending/10',
      highlight: pendingApprovals > 0,
    },
    {
      label: 'Awaiting Response',
      value: awaitingResponse,
      icon: AlertCircle,
      color: 'text-warning',
      bgColor: 'bg-warning/10',
      highlight: awaitingResponse > 0,
    },
    {
      label: 'Completed',
      value: completedProjects,
      icon: CheckCircle2,
      color: 'text-approved',
      bgColor: 'bg-approved/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card 
            key={stat.label}
            className={cn(
              "p-4 transition-all duration-200",
              stat.highlight && "ring-2 ring-pending/30"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn("p-2.5 rounded-lg", stat.bgColor)}>
                <Icon className={cn("w-5 h-5", stat.color)} />
              </div>
              <div>
                <p className="text-2xl font-heading font-bold">{stat.value}</p>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
