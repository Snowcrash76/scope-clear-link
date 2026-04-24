import { Link } from 'react-router-dom';
import { Project } from '@/types/project';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/StatusBadge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  User, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  ExternalLink,
  Send,
  RotateCcw,
  Loader2,
  Trash2
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface ProjectCardProps {
  project: Project;
  onViewProject?: (id: string) => void;
  onUpdateStatus?: (id: string, status: 'draft' | 'sent' | 'in_progress' | 'completed') => Promise<boolean>;
  onDeleteProject?: (id: string) => Promise<boolean>;
}

export function ProjectCard({ project, onViewProject, onUpdateStatus, onDeleteProject }: ProjectCardProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const pendingChanges = project.changeRequests.filter(cr => cr.status === 'pending').length;
  const unacknowledgedItems = project.scopeItems.filter(si => !si.acknowledged).length;
  const needsAttention = pendingChanges > 0 || (project.status === 'sent' && unacknowledgedItems > 0);

  // Variations resolved (approved or declined) within the last 72 hours
  const recentlyResolved = project.changeRequests.filter(cr => {
    if (!cr.resolvedAt || cr.status === 'pending' || cr.status === 'awaiting_client') return false;
    return (Date.now() - cr.resolvedAt.getTime()) < 72 * 60 * 60 * 1000;
  }).length;

  const handleDelete = async () => {
    if (!onDeleteProject || isDeleting) return;
    
    setIsDeleting(true);
    const success = await onDeleteProject(project.id);
    if (success) {
      toast.success('Draft deleted');
    }
    setIsDeleting(false);
  };

  const handleStatusAction = async () => {
    if (!onUpdateStatus || isUpdating) return;
    
    setIsUpdating(true);
    let newStatus: 'draft' | 'sent' | 'in_progress' | 'completed';
    let successMessage: string;
    
    if (project.status === 'draft') {
      newStatus = 'sent';
      successMessage = 'Job is now active';
    } else if (project.status === 'completed') {
      newStatus = 'in_progress';
      successMessage = 'Job reopened';
    } else {
      newStatus = 'completed';
      successMessage = 'Job marked as complete';
    }
    
    const success = await onUpdateStatus(project.id, newStatus);
    if (success) {
      toast.success(successMessage);
    }
    setIsUpdating(false);
  };

  const getActionButton = () => {
    if (!onUpdateStatus) return null;
    
    if (project.status === 'draft') {
      return (
        <Button 
          variant="default" 
          size="sm" 
          onClick={handleStatusAction}
          disabled={isUpdating}
          className="gap-1.5"
        >
          {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send
        </Button>
      );
    } else if (project.status === 'completed') {
      return (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleStatusAction}
          disabled={isUpdating}
          className="gap-1.5"
        >
          {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          Reopen
        </Button>
      );
    } else {
      return (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleStatusAction}
          disabled={isUpdating}
          className="gap-1.5"
        >
          {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
          Complete
        </Button>
      );
    }
  };
  
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
      "overflow-hidden transition-all duration-200 bg-white border border-[#D8C3AD] shadow-card hover:shadow-elevated",
      needsAttention && "ring-2 ring-amber-300/50"
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

          {recentlyResolved > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-approved">
              <CheckCircle2 className="w-4 h-4" />
              <span>{recentlyResolved} variation{recentlyResolved > 1 ? 's' : ''} resolved</span>
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
        {(needsAttention || recentlyResolved > 0) && (
          <div className="mb-4 space-y-2">
            {needsAttention && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-pending/10 text-pending-foreground text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>
                  {pendingChanges > 0 
                    ? `${pendingChanges} variation${pendingChanges > 1 ? 's' : ''} awaiting approval`
                    : `${unacknowledgedItems} item${unacknowledgedItems > 1 ? 's' : ''} to acknowledge`
                  }
                </span>
              </div>
            )}
            {recentlyResolved > 0 && (
              <div className="flex items-center gap-2 p-2 rounded-lg bg-approved/10 text-approved text-sm">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>
                  {recentlyResolved} variation{recentlyResolved > 1 ? 's' : ''} recently resolved — check Variations
                </span>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {getActionButton()}
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            asChild
          >
            <Link to={`/manage/${project.id}`}>
              Manage
            </Link>
          </Button>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  asChild
                >
                  <Link to={`/project/${project.id}`} target="_blank">
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Preview Client Page</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {project.status === 'draft' && onDeleteProject && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete draft?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{project.name}" and all its data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    </Card>
  );
}
