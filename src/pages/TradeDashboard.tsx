import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { DashboardStats } from '@/components/DashboardStats';
import { AppShell } from '@/components/AppShell';
import { ActivityFeed } from '@/components/ActivityFeed';
import { useProjects } from '@/hooks/useProjects';
import { exportProjectsReport, exportProjectsReportPDF } from '@/lib/exportReport';
import { toast } from 'sonner';
import {
  Search,
  ChevronRight,
  Briefcase,
  GitBranch,
  User,
  HelpCircle,
  Download,
} from 'lucide-react';
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
  sent: 'bg-blue-50 text-blue-700',
  acknowledged: 'bg-amber-50 text-amber-700',
  in_progress: 'bg-green-50 text-green-700',
  completed: 'bg-zinc-100 text-zinc-600',
};

function ProjectInitial({ name }: { name: string }) {
  const colors = [
    'bg-blue-500', 'bg-emerald-500', 'bg-violet-500',
    'bg-amber-500', 'bg-rose-500', 'bg-cyan-500',
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div className={cn('w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-heading font-bold text-lg', colors[idx])}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function ProjectListItem({
  project,
  onView,
}: {
  project: Project;
  onView: (id: string) => void;
}) {
  const completedStages = project.stages.filter(s => s.status === 'completed').length;
  const totalStages = project.stages.length;
  const stageProgress = totalStages > 0 ? (completedStages / totalStages) * 100 : 0;
  const pendingVariations = project.changeRequests.filter(cr => cr.status === 'pending').length;
  const resolvedVariations = project.changeRequests.filter(cr => cr.status === 'approved' || cr.status === 'declined').length;

  return (
    <div onClick={() => onView(project.id)} className="flex items-center gap-4 py-3.5 px-4 hover:bg-muted/40 transition-colors cursor-pointer group" data-testid={`project-list-item-${project.id}`}>
      <ProjectInitial name={project.name} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-sm truncate">{project.name}</span>
          <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide', STATUS_VARIANTS[project.status])}>
            {STATUS_LABELS[project.status]}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {project.clientName}
          </span>
          {resolvedVariations > 0 && (
            <span className="flex items-center gap-1">
              <GitBranch className="w-3 h-3" />
              {resolvedVariations} variation{resolvedVariations > 1 ? 's' : ''} resolved
            </span>
          )}
          {pendingVariations > 0 && (
            <span className="flex items-center gap-1 text-warning font-medium">
              <GitBranch className="w-3 h-3" />
              {pendingVariations} pending
            </span>
          )}
        </div>
      </div>

      {totalStages > 0 && (
        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Stage</span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-500 transition-all"
                style={{ width: `${stageProgress}%` }}
              />
            </div>
            <span className="text-xs font-semibold">{completedStages} / {totalStages}</span>
          </div>
        </div>
      )}

      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}

function SupportWidget() {
  return (
    <div className="fixed bottom-6 right-6 z-50 group">
      <button
        className="flex items-center gap-2 px-3 py-2 rounded-full shadow-lg text-xs font-medium transition-all duration-200 bg-zinc-900 text-zinc-100"
        style={{ boxShadow: '0 4px 16px -4px rgba(0,0,0,0.25)' }}
        data-testid="button-contact-support"
      >
        <HelpCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
        <span className="text-zinc-400 group-hover:text-zinc-100 transition-colors">Need help?</span>
      </button>
    </div>
  );
}

export default function TradeDashboard() {
  const navigate = useNavigate();
  const { projects, loading } = useProjects();
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFromDate, setExportFromDate] = useState('');
  const [exportToDate, setExportToDate] = useState('');
  const [exportFormat, setExportFormat] = useState<'csv' | 'pdf'>('csv');

  const handleExportReport = () => {
    if (projects.length === 0) {
      toast.error('No projects to export');
      return;
    }
    setShowExportDialog(true);
  };

  const handleConfirmExport = async () => {
    setIsExporting(true);
    try {
      const parseLocalDate = (s: string): Date => {
        const [year, month, day] = s.split('-').map(Number);
        return new Date(year, month - 1, day);
      };
      const fromDate = exportFromDate ? parseLocalDate(exportFromDate) : undefined;
      const toDate = exportToDate ? parseLocalDate(exportToDate) : undefined;
      if (exportFormat === 'pdf') {
        await exportProjectsReportPDF(projects, fromDate, toDate);
      } else {
        await exportProjectsReport(projects, fromDate, toDate);
      }
      toast.success('Report downloaded');
      setShowExportDialog(false);
    } catch (err: unknown) {
      console.error('Export failed:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to export report');
    } finally {
      setIsExporting(false);
    }
  };

  const activeProjects = projects.filter(p =>
    p.status === 'in_progress' || p.status === 'acknowledged' || p.status === 'sent'
  );

  const filteredActive = activeProjects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.clientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleViewProject = (id: string) => {
    navigate(`/manage/${id}`);
  };

  return (
    <>
    <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
      <DialogContent className="sm:max-w-sm" data-testid="dialog-export-report">
        <DialogHeader>
          <DialogTitle>Export Report</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">
          Choose a date range to filter which projects are included. Leave blank to export all projects.
        </p>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>Format</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExportFormat('csv')}
                className={cn(
                  'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                  exportFormat === 'csv'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background hover:bg-muted'
                )}
                data-testid="button-export-format-csv"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => setExportFormat('pdf')}
                className={cn(
                  'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                  exportFormat === 'pdf'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-background hover:bg-muted'
                )}
                data-testid="button-export-format-pdf"
              >
                PDF
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="export-from-date">From</Label>
            <Input
              id="export-from-date"
              type="date"
              value={exportFromDate}
              onChange={e => setExportFromDate(e.target.value)}
              max={exportToDate || undefined}
              data-testid="input-export-from-date"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="export-to-date">To</Label>
            <Input
              id="export-to-date"
              type="date"
              value={exportToDate}
              onChange={e => setExportToDate(e.target.value)}
              min={exportFromDate || undefined}
              data-testid="input-export-to-date"
            />
          </div>
        </div>
        <DialogFooter className="mt-2">
          <Button
            variant="outline"
            onClick={() => setShowExportDialog(false)}
            disabled={isExporting}
            data-testid="button-export-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmExport}
            disabled={isExporting}
            className="flex items-center gap-2"
            data-testid="button-export-confirm"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Exporting…' : `Export ${exportFormat.toUpperCase()}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <AppShell>
      {/* Top search bar */}
      <div className="border-b bg-background/95 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="relative max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search projects, quotes, or clients..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/50 border-0 focus-visible:ring-1"
              data-testid="input-dashboard-search"
            />
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Page heading */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="font-heading text-2xl font-bold">Dashboard Overview</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Welcome back. Here's what's happening across your jobs today.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportReport}
            disabled={isExporting || loading}
            className="flex items-center gap-2 flex-shrink-0"
            data-testid="button-export-report"
          >
            <Download className="w-4 h-4" />
            {isExporting ? 'Exporting…' : 'Export Report'}
          </Button>
        </div>

        {/* Stat cards */}
        <div className="mb-8">
          <DashboardStats projects={projects} />
        </div>

        {/* Active projects */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-base font-semibold">Active Projects</h2>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-sm text-primary font-medium flex items-center gap-0.5 hover:opacity-70 transition-opacity"
              data-testid="button-view-all-projects"
            >
              VIEW ALL <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="rounded-xl border bg-white overflow-hidden" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.04)' }}>
            {loading ? (
              <div className="divide-y">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 py-3.5 px-4 animate-pulse">
                    <div className="w-14 h-14 rounded-lg bg-muted flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/3" />
                      <div className="h-3 bg-muted rounded w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredActive.length > 0 ? (
              <div className="divide-y divide-border/50">
                {filteredActive.map(project => (
                  <ProjectListItem
                    key={project.id}
                    project={project}
                    onView={handleViewProject}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-10 px-4">
                <Briefcase className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? `No active projects matching "${searchQuery}"`
                    : 'No other active projects found at this time.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Activity feed — full width */}
        <ActivityFeed />
      </main>

      {/* Discreet support widget — fixed bottom-right */}
      <SupportWidget />
    </AppShell>
    </>
  );
}
