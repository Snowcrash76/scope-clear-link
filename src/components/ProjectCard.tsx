import { Link } from 'react-router-dom';
import { Project } from '@/types/project';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { 
  User, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  ExternalLink,
  MoreVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ProjectCardProps {
  project: Project;
  onViewProject?: (id: string) => void;
}

export function ProjectCard({ project, onViewProject }: ProjectCardProps) {
  const pendingChanges = project.changeRequests.filter(cr => cr.status === 'pending').length;
  const unacknowledgedItems = project.scopeItems.filter(si => !si.acknowledged).length;
  const needsAttention = pendingChanges > 0 || (project.status === 'sent' && unacknowledgedItems > 0);
  
  const statusConfig = {
    draft: { label: 'Draft', variant: 'secondary' as const },
    sent: { label: 'Awaiting Response', variant: 'pending' as const },
    acknowledged: { label: 'Acknowledged', variant: 'success' as const },
    in_progress: { label: 'In Progress', variant: 'default' as const },
    completed: { label: 'Completed', variant: 'success' as const },
  };

  const config = statusConfig[project.status];

  return (
    <Card className={cn(
      "overflow-hidden transition-all duration-200 hover:shadow-elevated",
      needsAttention && "ring-2 ring-pending/50"
    )}>
      <div className="p-4 sm:p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-semibold text-lg truncate">{project.name}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <User className="w-4 h-4" />
              <span className="truncate">{project.clientName}</span>
            </div>
          </div>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>{format(project.updatedAt, 'MMM d')}</span>
          </div>
          
          {pendingChanges > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-pending-foreground">
              <Clock className="w-4 h-4" />
              <span>{pendingChanges} pending</span>
            </div>
          )}
          
          {project.status === 'in_progress' && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CheckCircle2 className="w-4 h-4" />
              <span>Stage {project.currentStageIndex + 1}/{project.stages.length}</span>
            </div>
          )}
        </div>

        {/* Alerts */}
        {needsAttention && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-pending/10 text-pending-foreground text-sm mb-4">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>
              {pendingChanges > 0 
                ? `${pendingChanges} change${pendingChanges > 1 ? 's' : ''} awaiting approval`
                : `${unacknowledgedItems} item${unacknowledgedItems > 1 ? 's' : ''} to acknowledge`
              }
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => onViewProject?.(project.id)}
          >
            Manage
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            asChild
          >
            <Link to={`/project/${project.id}`} target="_blank">
              <ExternalLink className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
