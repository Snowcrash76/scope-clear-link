import { JobHeader } from '@/components/JobHeader';
import { StatusBadge } from '@/components/StatusBadge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { jobDisplayStatus } from '@/lib/quoteDisplay';
import type { Project, Quote } from '@/types/project';
import { ClientDetailsCard, type ClientEditValues } from './ClientDetailsCard';
import { ClientPageActions } from './ClientPageActions';
import { ArrowLeft, CheckCircle2, Copy, FolderOpen, Loader2, MoreVertical, RotateCcw } from 'lucide-react';

type ProjectManageHeaderProps = {
  project: Project;
  activeQuote: Quote | null;
  onTabChange: (tab: string) => void;
  pendingVariationCount: number;
  isDuplicating: boolean;
  onBack: () => void;
  onAddVariation: () => void;
  onDuplicateProject: () => void | Promise<void>;
  onSaveClient: (values: ClientEditValues, applyToAll: boolean) => Promise<boolean>;
  onAddClientEmail: () => void;
  onClientPageSent: () => void | Promise<void>;
  clientEditOpen: boolean;
  onClientEditOpenChange: (open: boolean) => void;
  onUpdateProjectStatus: (status: 'completed' | 'in_progress') => boolean | Promise<boolean>;
};

export function ProjectManageHeader({
  project,
  activeQuote,
  isDuplicating,
  onBack,
  onAddVariation,
  onDuplicateProject,
  onSaveClient,
  onAddClientEmail,
  onClientPageSent,
  clientEditOpen,
  onClientEditOpenChange,
  onUpdateProjectStatus,
}: ProjectManageHeaderProps) {
  return (
    <JobHeader>
      <section className="relative min-w-0 rounded-xl border border-border bg-card px-4 py-3 shadow-soft sm:px-5" aria-label="Job header">
        <div className="grid min-w-0 gap-y-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-x-4">
          <div className="order-1 flex min-w-0 items-center gap-2.5 pr-10 md:pr-0">
            <Button type="button" variant="link" className="h-8 min-h-8 shrink-0 gap-1 px-0 text-xs font-medium text-muted-foreground" aria-label="Back to Jobs" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" /> Jobs
            </Button>
            <h1 className="min-w-0 break-words font-heading text-xl font-bold leading-tight sm:text-2xl">{project.name}</h1>
            <StatusBadge className="shrink-0" status={jobDisplayStatus(project, activeQuote ? {
              status: activeQuote.status,
              valid_until: activeQuote.validUntil?.toISOString() ?? null,
            } : null)} />
          </div>
          <div className="order-3 flex min-w-0 items-center gap-1.5 md:order-2">
            <ClientPageActions project={project} onAddEmail={onAddClientEmail} onSendSuccess={onClientPageSent} layout="inline" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2 h-11 w-11 shrink-0 text-muted-foreground md:static" aria-label="More job actions" data-testid="button-project-actions-menu">
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>Job actions</DropdownMenuLabel>
                <DropdownMenuItem onClick={onAddVariation} className="min-h-11 gap-2" data-testid="menu-item-add-variation">
                  <CheckCircle2 className="h-4 w-4" />Add variation
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void onDuplicateProject()} disabled={isDuplicating} className="min-h-11 gap-2" data-testid="menu-item-duplicate-project">
                  {isDuplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                  {isDuplicating ? 'Creating copy…' : 'Duplicate job'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {project.status !== 'completed' ? (
                  <DropdownMenuItem onClick={() => void onUpdateProjectStatus('completed')} className="min-h-11 gap-2" data-testid="menu-item-mark-completed">
                    <CheckCircle2 className="h-4 w-4 text-approved" />Mark as Completed
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => void onUpdateProjectStatus('in_progress')} className="min-h-11 gap-2" data-testid="menu-item-mark-in-progress">
                    <RotateCcw className="h-4 w-4" />Mark as In Progress
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled title="Job archiving is not available because the current project schema has no archive state." className="min-h-11 gap-2 opacity-70" data-testid="menu-item-archive-unavailable">
                  <FolderOpen className="h-4 w-4" />Archive unavailable
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="order-2 min-w-0 border-t border-border/70 pt-1.5 md:order-3 md:col-span-2">
            <ClientDetailsCard project={project} onSave={onSaveClient} open={clientEditOpen} onOpenChange={onClientEditOpenChange} compact />
          </div>
        </div>
      </section>
    </JobHeader>
  );
}
