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
  onTabChange,
  pendingVariationCount,
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
      <div className="min-w-0">
        <div className="flex min-w-0 items-start gap-2 sm:gap-3">
          <Button variant="ghost" size="icon" className="mt-0.5 h-11 w-11 flex-shrink-0" aria-label="Back to dashboard" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-start gap-2 sm:gap-3">
              <h1 className="min-w-0 break-words font-heading text-xl font-bold sm:text-2xl">{project.name}</h1>
              <StatusBadge className="mt-0.5 shrink-0" status={jobDisplayStatus(project, activeQuote ? {
                status: activeQuote.status,
                valid_until: activeQuote.validUntil?.toISOString() ?? null,
              } : null)} />
            </div>
          </div>
        </div>

        <div className="mt-3 flex w-full min-w-0 items-center">
          <div className="flex min-w-0 shrink-0 items-center gap-0 sm:gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-11 shrink-0 gap-2 border-zinc-400 bg-white px-3 text-sm text-zinc-900" aria-label="Actions" data-testid="button-project-actions-menu">
                  <MoreVertical className="w-4 h-4" />
                  <span>Actions</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuItem onClick={onAddVariation} className="min-h-11 gap-2" data-testid="menu-item-add-variation">
                  <CheckCircle2 className="h-4 w-4" />
                  Add variation
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => void onDuplicateProject()}
                  disabled={isDuplicating}
                  className="min-h-11 gap-2"
                  data-testid="menu-item-duplicate-project"
                >
                  {isDuplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                  {isDuplicating ? 'Creating copy…' : 'Duplicate job'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Job status</DropdownMenuLabel>
                {project.status !== 'completed' ? (
                  <DropdownMenuItem onClick={() => void onUpdateProjectStatus('completed')} className="min-h-11 gap-2" data-testid="menu-item-mark-completed">
                    <CheckCircle2 className="w-4 h-4 text-approved" />
                    Mark as Completed
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => void onUpdateProjectStatus('in_progress')} className="min-h-11 gap-2" data-testid="menu-item-mark-in-progress">
                    <RotateCcw className="w-4 h-4" />
                    Mark as In Progress
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled
                  title="Job archiving is not available because the current project schema has no archive state."
                  className="min-h-14 cursor-not-allowed items-start gap-2 opacity-100"
                  data-testid="menu-item-archive-unavailable"
                >
                  <FolderOpen className="mt-0.5 h-4 w-4 text-zinc-500" />
                  <span className="min-w-0">
                    <span className="block font-medium text-zinc-700">Archive unavailable</span>
                    <span className="mt-0.5 block whitespace-normal text-xs leading-4 text-zinc-600">Jobs have no archive state in the current schema.</span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {pendingVariationCount > 0 && (
            <Button type="button" variant="outline" className="min-h-11 gap-2 border-warning/40 text-warning" onClick={() => onTabChange("changes")}>
              {pendingVariationCount} variation{pendingVariationCount === 1 ? "" : "s"} need action
            </Button>
          )}
          <ClientPageActions project={project} onAddEmail={onAddClientEmail} onSendSuccess={onClientPageSent} />
        </div>
        <div className="mt-3 max-w-3xl">
          <ClientDetailsCard project={project} onSave={onSaveClient} open={clientEditOpen} onOpenChange={onClientEditOpenChange} />
        </div>
      </div>
    </JobHeader>
  );
}
