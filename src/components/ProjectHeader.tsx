import { Project } from '@/types/project';
import { Badge } from '@/components/ui/badge';
import { Building2, User, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface ProjectHeaderProps {
  project: Project;
  isClientView?: boolean;
}

const statusConfig = {
  draft: { label: 'Draft', variant: 'secondary' as const },
  sent: { label: 'Awaiting Response', variant: 'pending' as const },
  acknowledged: { label: 'Quote Acknowledged', variant: 'success' as const },
  in_progress: { label: 'In Progress', variant: 'success' as const },
  completed: { label: 'Completed', variant: 'success' as const },
};

export function ProjectHeader({ project, isClientView = true }: ProjectHeaderProps) {
  const status = statusConfig[project.status];

  return (
    <div className="bg-card border-b">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <Building2 className="w-4 h-4" />
              <span className="font-medium">{project.tradeBusinessName}</span>
            </div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground mb-3">
              {project.name}
            </h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4" />
                <span>{isClientView ? project.tradeName : project.clientName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>Started {format(project.createdAt, 'MMM d, yyyy')}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>Updated {format(project.updatedAt, 'MMM d, yyyy')}</span>
              </div>
            </div>
          </div>
          <Badge variant={status.variant} className="self-start text-sm px-3 py-1">
            {status.label}
          </Badge>
        </div>
      </div>
    </div>
  );
}
