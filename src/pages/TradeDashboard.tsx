import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DashboardStats } from "@/components/DashboardStats";
import { AppShell, NewJobButton } from "@/components/AppShell";
import { PageLayout } from "@/components/PageLayout";
import { LoadErrorState } from "@/components/LoadErrorState";
import { ActivityFeed } from "@/components/ActivityFeed";
import { useProjects } from "@/hooks/useProjects";
import {
  exportProjectsReport,
  exportProjectsReportPDF,
} from "@/lib/exportReport";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronRight,
  Briefcase,
  GitBranch,
  User,
  HelpCircle,
  Download,
  MoreHorizontal,
  Clock3,
  Receipt,
  CircleDollarSign,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Project } from "@/types/project";
import { useQuoteSummaries } from "@/hooks/useQuoteSummaries";
import {
  awaitingQuoteResponse,
  jobDisplayStatus,
  type QuoteSummary,
} from "@/lib/quoteDisplay";
import { StatusBadge } from "@/components/StatusBadge";
import {
  useDashboardInvoices,
  type DashboardInvoice,
} from "@/hooks/useDashboardInvoices";
import { useJobProfitability } from "@/hooks/useJobCosts";
import type { JobProfitability } from "@/hooks/useJobCosts";
import { awaitingClientApproval, needsTradeResponse } from "@/lib/variationStatus";
import { ClientPageActions } from "@/components/project-manage/ClientPageActions";

interface AttentionItem {
  id: string;
  category: string;
  title: string;
  detail: string;
  href: string;
  timestamp?: number;
}

function relativeTime(value: string | Date | null | undefined) {
  if (!value) return "Date unavailable";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : formatDistanceToNow(date, { addSuffix: true });
}

function NeedsAttention({
  projects,
  latestQuotes,
  quoteError,
  quoteLoading,
  invoices,
  invoiceError,
  invoiceLoading,
  costs,
  costError,
  costLoading,
  retry,
}: {
  projects: Project[];
  latestQuotes: Map<string, QuoteSummary>;
  quoteError: boolean;
  quoteLoading: boolean;
  invoices?: DashboardInvoice[];
  invoiceError: boolean;
  invoiceLoading: boolean;
  costs?: JobProfitability[];
  costError: boolean;
  costLoading: boolean;
  retry: () => void;
}) {
  const items: AttentionItem[] = [];
  const now = Date.now();
  const projectMap = new Map(projects.map((project) => [project.id, project]));

  if (!quoteError) {
    for (const project of projects) {
      const quote = latestQuotes.get(project.id);
      if (!quote || !awaitingQuoteResponse(project, quote)) continue;
      const sentAt = new Date(quote.updated_at ?? quote.created_at);
      if (
        Number.isNaN(sentAt.getTime()) ||
        now - sentAt.getTime() < 3 * 24 * 60 * 60 * 1000
      )
        continue;
      items.push({
        id: `quote-${quote.id}`,
        category: "Quote",
        title: `${project.name} · quote awaiting reply`,
        detail: `Sent ${relativeTime(sentAt)}${project.clientName ? ` · ${project.clientName}` : ""}`,
        href: `/manage/${project.id}?tab=quote`,
        timestamp: sentAt.getTime(),
      });
    }
  }

  for (const project of projects) {
    for (const variation of project.changeRequests.filter(needsTradeResponse)) {
      items.push({
        id: `client-request-${variation.id}`,
        category: "Client variation request",
        title: "Client variation request — needs your response",
        detail: `${variation.title || "Untitled request"} · ${project.name} · raised ${relativeTime(variation.createdAt)}`,
        href: `/manage/${project.id}?tab=changes&variation=${encodeURIComponent(variation.id)}`,
        timestamp: variation.createdAt.getTime(),
      });
    }
    for (const variation of project.changeRequests.filter(
      awaitingClientApproval,
    )) {
      items.push({
        id: `variation-${variation.id}`,
        category: "Variation",
        title: `${variation.title || "Variation"} · ${project.name}`,
        detail: `Waiting for client approval · raised ${relativeTime(variation.createdAt)}`,
        href: `/manage/${project.id}?tab=changes&variation=${encodeURIComponent(variation.id)}`,
        timestamp: variation.createdAt.getTime(),
      });
    }
  }

  if (!invoiceError) {
    for (const invoice of (invoices ?? []).filter(
      (item) => item.status === "overdue",
    )) {
      const project = projectMap.get(invoice.project_id);
      if (!project) continue;
      items.push({
        id: `invoice-${invoice.id}`,
        category: "Overdue invoice",
        title: `Invoice ${invoice.invoice_number} · ${project.name}`,
        detail: invoice.due_date
          ? `Due ${format(new Date(invoice.due_date), "d MMM yyyy")}`
          : "Past due · date unavailable",
        href: `/manage/${project.id}?tab=invoices`,
        timestamp: invoice.due_date
          ? new Date(invoice.due_date).getTime()
          : new Date(invoice.updated_at).getTime(),
      });
    }
  }

  const costsByJob = new Map((costs ?? []).map((job) => [job.jobId, job]));
  if (!costError && !costLoading) {
    for (const project of projects) {
      const record = costsByJob.get(project.id);
      if (
        !record ||
        !Number.isFinite(record.confirmedCostsIncGst) ||
        !Number.isFinite(record.draftCostsIncGst)
      )
        continue;
      if (record.confirmedCostsIncGst === 0 && record.draftCostsIncGst === 0) {
        items.push({
          id: `cost-${project.id}`,
          category: "No costs logged",
          title: `${project.name} · no costs logged`,
          detail: "No recorded confirmed or draft costs",
          href: `/manage/${project.id}?tab=costs`,
        });
      }
    }
  }

  items.sort((a, b) => {
    const rank = (item: AttentionItem) => item.category === "Client variation request" ? 0 : item.category === "Variation" ? 1 : 2;
    return rank(a) - rank(b) || (a.timestamp ?? Number.MAX_SAFE_INTEGER) - (b.timestamp ?? Number.MAX_SAFE_INTEGER);
  });
  const costRecordsMissing =
    !costError && !costLoading
      ? projects.filter((project) => {
          const record = costsByJob.get(project.id);
          return (
            !record ||
            !Number.isFinite(record.confirmedCostsIncGst) ||
            !Number.isFinite(record.draftCostsIncGst)
          );
        }).length
      : 0;
  const sourceUnavailable =
    quoteError || invoiceError || costError || costRecordsMissing > 0;
  const checking = quoteLoading || invoiceLoading || costLoading;
  const unavailableSources = [
    quoteError ? "quote data" : "",
    invoiceError ? "invoice data" : "",
    costError ? "cost data" : "",
  ].filter(Boolean);

  return (
    <section className="mb-8" aria-labelledby="needs-attention-title">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2
          id="needs-attention-title"
          className="font-heading text-base font-semibold"
        >
          Needs your attention
        </h2>
        {items.some((item) => item.category === "No costs logged") && (
          <Link
            to="/projects?status=no_costs"
            className="min-h-11 inline-flex items-center rounded-lg px-2 text-sm font-semibold text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View jobs with no costs
          </Link>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-background shadow-card">
        {checking ? (
          <div
            className="space-y-3 p-4"
            aria-label="Checking items that need attention"
          >
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex gap-3">
                <div className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-muted/70" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length ? (
          <>
            {sourceUnavailable && (
              <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-2 border-b border-warning/25 bg-warning/10 px-4 py-3 text-sm text-warning"
              >
                <p>
                  Some checks are unavailable
                  {unavailableSources.length
                    ? ` (${unavailableSources.join(", ")})`
                    : ""}
                  . Failed data is not treated as clear.
                  {costRecordsMissing > 0
                    ? ` ${costRecordsMissing} job${costRecordsMissing === 1 ? "" : "s"} have missing or incomplete cost records and are not counted as zero.`
                    : ""}
                </p>
                {(quoteError || invoiceError || costError) && (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 gap-2 bg-background"
                    onClick={retry}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry checks
                  </Button>
                )}
              </div>
            )}
            <div className="divide-y divide-border/60">
              {items.slice(0, 7).map((item) => (
                <Link
                  key={item.id}
                  to={item.href}
                  className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent/20 text-accent-foreground"
                    aria-hidden="true"
                  >
                    {item.category === "Quote" ? (
                      <Clock3 className="h-4 w-4" />
                    ) : item.category === "Variation" ? (
                      <GitBranch className="h-4 w-4" />
                    ) : item.category === "Overdue invoice" ? (
                      <Receipt className="h-4 w-4" />
                    ) : (
                      <CircleDollarSign className="h-4 w-4" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-semibold text-foreground">
                      {item.title}
                    </span>
                    <span className="mt-0.5 block break-words text-sm text-muted-foreground">
                      {item.detail}
                    </span>
                  </span>
                  <span className="hidden shrink-0 rounded-full border border-border px-2 py-1 text-xs font-medium text-muted-foreground sm:inline-flex">
                    {item.category}
                  </span>
                  <ChevronRight
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
            {items.length > 7 && (
              <p className="border-t border-border px-4 py-2.5 text-sm text-muted-foreground">
                {items.length - 7} more items need attention. Open the relevant
                dashboard filter to see the full list.
              </p>
            )}
          </>
        ) : sourceUnavailable ? (
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-foreground">
              {costRecordsMissing > 0
                ? `${costRecordsMissing} job${costRecordsMissing === 1 ? "" : "s"} have unavailable cost records. They are not treated as jobs with zero costs.`
                : "Some attention checks could not be verified. Failed data is not treated as clear."}
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 gap-2"
              onClick={retry}
            >
              <RefreshCw className="h-4 w-4" />
              Retry checks
            </Button>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm font-medium text-foreground">
            You're all caught up
          </p>
        )}
      </div>
    </section>
  );
}

function ProjectInitial({ name }: { name: string }) {
  const colors = [
    "bg-primary text-primary-foreground",
    "bg-muted text-muted-foreground",
    "bg-success text-success-foreground",
    "bg-warning text-warning-foreground",
    "bg-info text-info-foreground",
    "bg-destructive text-destructive-foreground",
  ];
  const idx = name.charCodeAt(0) % colors.length;
  return (
    <div
      className={cn(
        "w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0 font-heading font-bold text-lg",
        colors[idx],
      )}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function ProjectListItem({
  project,
  onView,
  quote,
}: {
  project: Project;
  onView: (id: string) => void;
  quote?: QuoteSummary;
}) {
  const navigate = useNavigate();
  const completedStages = project.stages.filter(
    (s) => s.status === "completed",
  ).length;
  const totalStages = project.stages.length;
  const stageProgress =
    totalStages > 0 ? (completedStages / totalStages) * 100 : 0;
  const currentStage = project.stages.find((stage) => stage.status === "current");
  const pendingVariations = project.changeRequests.filter(
    (cr) => needsTradeResponse(cr) || awaitingClientApproval(cr),
  ).length;
  const resolvedVariations = project.changeRequests.filter(
    (cr) => cr.status === "approved" || cr.status === "declined",
  ).length;

  return (
    <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
    <button
      type="button"
      onClick={() => onView(project.id)}
      aria-label={`Open job ${project.name}`}
      className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-muted/40 group"
      data-testid={`project-list-item-${project.id}`}
    >
      <ProjectInitial name={project.name} />

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-0.5">
          <span className="min-w-0 font-semibold text-sm break-words">
            {project.name}
          </span>
          <StatusBadge status={jobDisplayStatus(project, quote)} size="sm" />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span className="min-w-0 flex items-start gap-1 break-words">
            <User className="mt-0.5 w-3 h-3 flex-shrink-0" />
            {project.clientName}
          </span>
          {resolvedVariations > 0 && (
            <span className="flex items-center gap-1">
              <GitBranch className="w-3 h-3 flex-shrink-0" />
              {resolvedVariations} extra{resolvedVariations > 1 ? "s" : ""} &
              change{resolvedVariations > 1 ? "s" : ""} resolved
            </span>
          )}
          {pendingVariations > 0 && (
            <span className="flex items-center gap-1 text-warning font-medium">
              <GitBranch className="w-3 h-3 flex-shrink-0" />
              {pendingVariations} pending
            </span>
          )}
        </div>
        {totalStages > 0 && (
          <div className="mt-2 flex flex-wrap items-center gap-2" aria-label={`Stage progress ${completedStages} of ${totalStages}${currentStage ? `, current stage ${currentStage.name}` : ""}`}>
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden="true">
              <div className="h-full rounded-full bg-primary" style={{ width: `${stageProgress}%` }} />
            </div>
            <span className="text-sm text-muted-foreground">{completedStages} / {totalStages} · {currentStage?.name ?? (completedStages === totalStages ? "Complete" : "No current stage")}</span>
          </div>
        )}
      </div>

      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
    <div className="px-4 pb-3 sm:px-2 sm:py-2">
      <ClientPageActions project={project} onAddEmail={() => navigate(`/manage/${project.id}?client=edit`)} />
    </div>
    </div>
  );
}

function SupportWidget() {
  return (
    <div className="mt-6 flex justify-end">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Need help?"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="button-contact-support"
          >
            <HelpCircle
              className="h-4 w-4 text-muted-foreground"
              aria-hidden="true"
            />
            Help
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          className="z-40 w-[min(20rem,calc(100vw-2rem))]"
        >
          <p className="font-semibold text-foreground">Workspace help</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            A support contact is not configured here. Please contact your
            workspace administrator.
          </p>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function TradeDashboard() {
  const navigate = useNavigate();
  const {
    projects,
    loading,
    error: projectsError,
    refetch: refetchProjects,
  } = useProjects();
  const quoteQuery = useQuoteSummaries(projects.map((project) => project.id));
  const invoiceQuery = useDashboardInvoices(
    projects.map((project) => project.id),
  );
  const profitabilityQuery = useJobProfitability();
  const latestQuoteByProject = new Map<string, QuoteSummary>();
  for (const quote of [...(quoteQuery.data ?? [])].sort(
    (a, b) =>
      Number(a.status === "declined") - Number(b.status === "declined") ||
      b.created_at.localeCompare(a.created_at),
  )) {
    if (!latestQuoteByProject.has(quote.project_id))
      latestQuoteByProject.set(quote.project_id, quote);
  }
  const [isExporting, setIsExporting] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportFromDate, setExportFromDate] = useState("");
  const [exportToDate, setExportToDate] = useState("");
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");

  const handleExportReport = () => {
    if (projects.length === 0) {
      toast.error("No projects to export");
      return;
    }
    setShowExportDialog(true);
  };

  const handleConfirmExport = async () => {
    setIsExporting(true);
    try {
      const parseLocalDate = (s: string): Date => {
        const [year, month, day] = s.split("-").map(Number);
        return new Date(year, month - 1, day);
      };
      const fromDate = exportFromDate
        ? parseLocalDate(exportFromDate)
        : undefined;
      const toDate = exportToDate ? parseLocalDate(exportToDate) : undefined;
      if (exportFormat === "pdf") {
        await exportProjectsReportPDF(projects, fromDate, toDate);
      } else {
        await exportProjectsReport(projects, fromDate, toDate);
      }
      toast.success("Report downloaded");
      setShowExportDialog(false);
    } catch (err: unknown) {
      console.error("Export failed:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to export report",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const activeProjects = projects.filter(
    (p) =>
      jobDisplayStatus(p, latestQuoteByProject.get(p.id)) === "in_progress" &&
      !awaitingQuoteResponse(p, latestQuoteByProject.get(p.id)),
  );

  const filteredActive = activeProjects;
  const retryAttentionChecks = () => {
    void Promise.all([
      quoteQuery.refetch(),
      invoiceQuery.refetch(),
      profitabilityQuery.refetch(),
    ]);
  };

  const handleViewProject = (id: string) => {
    navigate(`/manage/${id}`);
  };

  if (projectsError) {
    return (
      <AppShell>
        <PageLayout
          title="Dashboard Overview"
          description="Your workspace overview."
        >
          <LoadErrorState
            title="Jobs could not be loaded"
            description="Dashboard counts and attention items are unavailable until the jobs request succeeds."
            onRetry={refetchProjects}
          />
        </PageLayout>
      </AppShell>
    );
  }

  return (
    <>
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent
          className="w-[calc(100vw-2rem)] max-w-sm"
          data-testid="dialog-export-report"
        >
          <DialogHeader>
            <DialogTitle>Export Report</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            Choose a date range to filter which projects are included. Leave
            blank to export all projects.
          </p>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>Format</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setExportFormat("csv")}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    exportFormat === "csv"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-muted",
                  )}
                  data-testid="button-export-format-csv"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => setExportFormat("pdf")}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors",
                    exportFormat === "pdf"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input bg-background hover:bg-muted",
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
                onChange={(e) => setExportFromDate(e.target.value)}
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
                onChange={(e) => setExportToDate(e.target.value)}
                min={exportFromDate || undefined}
                data-testid="input-export-to-date"
              />
            </div>
          </div>
          <DialogFooter className="mt-2 gap-2 sm:gap-0">
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
              {isExporting
                ? "Exporting…"
                : `Export ${exportFormat.toUpperCase()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AppShell>
        <PageLayout
          title="Dashboard Overview"
          description="Welcome back. Here's what's happening across your jobs today."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <NewJobButton testId="dashboard-new-job" />
              <Link to="/schedule" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium text-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground" data-testid="link-dashboard-schedule">
                <Clock3 className="h-4 w-4" />
                Open Schedule
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 gap-2"
                    aria-label="More dashboard actions"
                    data-testid="button-dashboard-more"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                    More
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="min-h-11 gap-2"
                    disabled={isExporting || loading}
                    onSelect={handleExportReport}
                  >
                    <Download className="h-4 w-4" />
                    {isExporting ? "Exporting…" : "Export report"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          }
        >
          {/* Stat cards */}
          <div className="mb-8">
            <DashboardStats projects={projects} loading={loading} />
          </div>

          <NeedsAttention
            projects={projects}
            latestQuotes={latestQuoteByProject}
            quoteError={!!quoteQuery.isError}
            quoteLoading={quoteQuery.isLoading}
            invoices={invoiceQuery.data}
            invoiceError={!!invoiceQuery.isError}
            invoiceLoading={invoiceQuery.isLoading}
            costs={profitabilityQuery.data}
            costError={!!profitabilityQuery.isError}
            costLoading={profitabilityQuery.isLoading}
            retry={retryAttentionChecks}
          />

          {/* Active projects */}
          <div className="mb-8">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="font-heading text-base font-semibold">
                Active Jobs
              </h2>
              <button
                onClick={() => navigate("/projects?status=in_progress")}
                className="min-h-11 text-sm text-primary font-medium flex items-center gap-0.5 hover:opacity-70 transition-opacity"
                data-testid="button-view-all-projects"
              >
                VIEW ALL <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="min-w-0 rounded-xl border border-border bg-background overflow-hidden shadow-card">
              {loading ? (
                <div className="divide-y">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-4 py-3.5 px-4 animate-pulse"
                    >
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
                  {filteredActive.map((project) => (
                    <ProjectListItem
                      key={project.id}
                      project={project}
                      quote={latestQuoteByProject.get(project.id)}
                      onView={handleViewProject}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 px-4">
                  <Briefcase className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No active jobs found at this time.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Activity feed — full width */}
          <ActivityFeed />
        </PageLayout>

        {/* Discreet support widget — fixed bottom-right */}
        <SupportWidget />
      </AppShell>
    </>
  );
}
