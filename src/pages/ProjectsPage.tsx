import { useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppShell, NewJobButton } from "@/components/AppShell";
import { PageLayout } from "@/components/PageLayout";
import { LoadErrorState } from "@/components/LoadErrorState";
import { useProjects } from "@/hooks/useProjects";
import type { Project } from "@/types/project";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FolderOpen,
  GitBranch,
  MoreVertical,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useJobProfitability, aud, profitability } from "@/hooks/useJobCosts";
import { useQuoteSummaries } from "@/hooks/useQuoteSummaries";
import {
  awaitingQuoteResponse,
  jobDisplayStatus,
  type QuoteSummary,
} from "@/lib/quoteDisplay";
import { JobCard } from "@/components/JobCard";
import { awaitingClientApproval, needsTradeResponse } from "@/lib/variationStatus";
import { ClientPageActions } from "@/components/project-manage/ClientPageActions";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-overlay";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { Money } from "@/components/ui/money";
import { toast } from "sonner";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { filterJobArchive, isArchivedJob } from "@/lib/jobLifecycle";

const TABS = [
  { key: "active", label: "Active" },
  { key: "quoted", label: "Quoted" },
  { key: "approved", label: "Approved" },
  { key: "in_progress", label: "In Progress" },
  { key: "completed", label: "Archive" },
] as const;

type Tab = (typeof TABS)[number]["key"];
type SortOrder = "newest" | "oldest" | "name" | "quote";

export default function ProjectsPage() {
  const navigate = useNavigate();
  const {
    projects,
    loading,
    error: projectsError,
    refetch: refetchProjects,
    updateProjectStatus,
    deleteProject,
  } = useProjects();
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const deleteLock = useRef(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const profitabilityQuery = useJobProfitability();
  const profitabilityById = new Map(
    (profitabilityQuery.data ?? []).map((job) => [job.jobId, job]),
  );
  const quoteQuery = useQuoteSummaries(projects.map((project) => project.id));
  const latestQuoteByProject = new Map<string, QuoteSummary>();
  for (const quote of [...(quoteQuery.data ?? [])].sort(
    (a, b) =>
      Number(a.status === "declined") - Number(b.status === "declined") ||
      b.created_at.localeCompare(a.created_at),
  )) {
    if (!latestQuoteByProject.has(quote.project_id))
      latestQuoteByProject.set(quote.project_id, quote);
  }
  const [sort, setSort] = useState<SortOrder>("newest");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filterParam = searchParams.get("status") ?? "active";
  const specialFilter = [
    "awaiting_response",
    "pending_approval",
    "no_costs",
    "missing_cost_data",
  ].includes(filterParam);
  const tab: Tab = TABS.some((item) => item.key === filterParam)
    ? (filterParam as Tab)
    : "active";
  const activeProjects = filterJobArchive(projects, false);
  const archivedProjects = filterJobArchive(projects, true);
  const archiveView = !specialFilter && tab === "completed";

  const selectFilter = (filter: string) => {
    const next = new URLSearchParams(searchParams);
    if (filter === "active") next.delete("status");
    else next.set("status", filter);
    setSearchParams(next);
  };

  const filteredByStatus = (archiveView ? archivedProjects : activeProjects).filter((project) => {
    const quote = latestQuoteByProject.get(project.id);
    if (archiveView) return isArchivedJob(project);
    if (filterParam === "awaiting_response")
      return awaitingQuoteResponse(project, quote);
    if (filterParam === "pending_approval")
      return project.changeRequests.some((variation) => needsTradeResponse(variation) || awaitingClientApproval(variation));
    if (filterParam === "in_progress")
      return (
        jobDisplayStatus(project, quote) === "in_progress" &&
        !awaitingQuoteResponse(project, quote)
      );
    if (filterParam === "no_costs") {
      const costs = profitabilityById.get(project.id);
      return (
        !!costs &&
        costs.confirmedCostsIncGst === 0 &&
        costs.draftCostsIncGst === 0
      );
    }
    if (filterParam === "missing_cost_data")
      return !profitabilityById.has(project.id);
    return tab === "active" || jobDisplayStatus(project, quote) === tab;
  });
  const filtered = filteredByStatus.filter((project) => {
    const term = search.trim().toLocaleLowerCase();
    const quote = latestQuoteByProject.get(project.id);
    return !term || [project.name, project.clientName, quote?.quote_number, quote?.reference]
      .some((value) => value?.toLocaleLowerCase().includes(term));
  });
  const sortedFiltered = [...filtered].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "quote")
      return (
        (latestQuoteByProject.get(b.id)?.subtotal ?? -Infinity) -
        (latestQuoteByProject.get(a.id)?.subtotal ?? -Infinity)
      );
    const createdA = a.createdAt.getTime();
    const createdB = b.createdAt.getTime();
    return sort === "newest" ? createdB - createdA : createdA - createdB;
  });
  const pageCount = Math.max(1, Math.ceil(sortedFiltered.length / 10));
  const currentPage = Math.min(page, pageCount);
  const pageProjects = sortedFiltered.slice((currentPage - 1) * 10, currentPage * 10);

  const counts = {
    active: activeProjects.length,
    quoted: activeProjects.filter(
      (p) => jobDisplayStatus(p, latestQuoteByProject.get(p.id)) === "quoted",
    ).length,
    approved: activeProjects.filter(
      (p) => jobDisplayStatus(p, latestQuoteByProject.get(p.id)) === "approved",
    ).length,
    in_progress: activeProjects.filter(
      (p) =>
        jobDisplayStatus(p, latestQuoteByProject.get(p.id)) === "in_progress",
    ).length,
    completed: archivedProjects.length,
  };
  const pendingVariationTotal = filtered.reduce(
    (total, project) =>
      total + project.changeRequests.filter((variation) => needsTradeResponse(variation) || awaitingClientApproval(variation)).length,
    0,
  );
  const filterLabel: Record<string, string> = {
    awaiting_response: "Awaiting quote response",
    pending_approval: `Pending variations · ${pendingVariationTotal} requests across ${filtered.length} jobs`,
    no_costs: "Jobs with no costs logged",
    missing_cost_data: "Jobs with unavailable cost data",
  };
  const activeJobQuoteValue = activeProjects.reduce(
    (total, project) => total + (latestQuoteByProject.get(project.id)?.subtotal ?? 0),
    0,
  );
  const jobsAwaitingResponse = activeProjects.filter((project) =>
    awaitingQuoteResponse(project, latestQuoteByProject.get(project.id))
  ).length;
  const hasPendingQuoteDrafts = activeProjects.some((project) =>
    jobDisplayStatus(project, latestQuoteByProject.get(project.id)) === "quoted" &&
    (quoteQuery.data ?? []).some(
      (quote) =>
        quote.project_id === project.id &&
        (quote.status === "draft" || quote.status === "revised"),
    )
  );

  const changeArchiveStatus = async (project: Project, status: "completed" | "in_progress") => {
    const succeeded = await updateProjectStatus(project.id, status);
    if (!succeeded) return;
    toast.success(
      status === "completed"
        ? `${project.name} moved to the archive.`
        : `${project.name} returned to active jobs.`,
    );
  };

  const confirmDelete = async () => {
    if (!deleteTarget || deleteLock.current) return;
    deleteLock.current = true;
    setDeletePending(true);
    setDeleteError(null);
    try {
      const succeeded = await deleteProject(deleteTarget.id);
      if (!succeeded) {
        setDeleteError("The job could not be deleted. It may contain protected issued invoices or staff history. Archive it instead to keep those records.");
        return;
      }
      toast.success(`${deleteTarget.name} deleted.`);
      setDeleteTarget(null);
    } catch {
      setDeleteError("The job could not be deleted. Protected issued invoices or staff history may need to be retained. Archive it instead.");
    } finally {
      deleteLock.current = false;
      setDeletePending(false);
    }
  };

  if (projectsError) {
    return (
      <AppShell>
        <PageLayout title="Jobs" description="All your jobs in one place.">
          <LoadErrorState
            title="Jobs could not be loaded"
            description="A failed jobs request is not an empty job list. Retry to fetch the saved jobs."
            onRetry={refetchProjects}
          />
        </PageLayout>
      </AppShell>
    );
  }
  if (quoteQuery.isError) {
    return (
      <AppShell>
        <PageLayout title="Jobs" description="All your jobs in one place.">
          <LoadErrorState
            title="Quote statuses could not be loaded"
            description="Job lifecycle filters depend on saved quote status. Retry before treating a filtered list as empty."
            onRetry={quoteQuery.refetch}
          />
        </PageLayout>
      </AppShell>
    );
  }

  return (
    <AppShell>
        <PageLayout title="Jobs" description="Your jobs, quotes and next actions in one place." actions={<NewJobButton />}>
        <section className="mb-6 grid gap-3 sm:grid-cols-2" aria-label="Jobs overview">
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-card">
            <span className="absolute inset-x-0 top-0 h-[3px] bg-primary" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-[.06em] text-muted-foreground">Active Job Quote Value</p>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight"><Money value={activeJobQuoteValue} basis="ex GST" /></p>
            <p className="mt-1 text-sm text-muted-foreground">Ex-GST quote values for Quoted, Approved and In Progress jobs.</p>
          </div>
          <button type="button" onClick={() => selectFilter("awaiting_response")} className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 text-left shadow-card transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="absolute inset-x-0 top-0 h-[3px] bg-warning" aria-hidden="true" />
            <p className="text-xs font-semibold uppercase tracking-[.06em] text-muted-foreground">Quotes Awaiting Response</p>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight">{jobsAwaitingResponse}</p>
            <p className="mt-1 text-sm text-muted-foreground">Quoted jobs with a sent quote awaiting a client decision.</p>
          </button>
        </section>
        {!projectsError && !loading && !quoteQuery.isLoading && !quoteQuery.isError && !hasPendingQuoteDrafts && (
          <EmptyState
            className="mb-6 border-dashed"
            icon={<FolderOpen className="h-5 w-5" />}
            title="No pending quote drafts"
            description="Draft or revised quotes on quoted jobs will appear here when they need sending."
          />
        )}
        <div className="mb-4 flex min-w-0 items-center gap-2">
          <SearchInput
            className="flex-1"
            name="job-list-search"
            testId="input-job-list-search"
            value={search}
            onChange={setSearch}
            placeholder="Search jobs, clients or references"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Sort jobs"
                title="Sort jobs"
                data-testid="button-job-sort"
              >
                <SlidersHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {([
                ["newest", "Newest first"],
                ["oldest", "Oldest first"],
                ["name", "Job name A–Z"],
                ["quote", "Quote value — high to low"],
              ] as const).map(([value, label]) => (
                <DropdownMenuItem
                  key={value}
                  onSelect={() => setSort(value)}
                  aria-checked={sort === value}
                  role="menuitemradio"
                  className="min-h-11"
                >
                  <span className="flex-1">{label}</span>
                  {sort === value && <span aria-hidden="true">Selected</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <FilterTabs
          label="Filter jobs"
          className="mb-4 -mx-4 px-4 touch-pan-x overscroll-x-contain sm:mx-0 sm:px-0"
          value={specialFilter ? ("__special_filter" as Tab) : tab}
          onChange={selectFilter}
          options={TABS.map((item) => ({
            value: item.key,
            label: item.label,
            count: counts[item.key],
            testId: `tab-${item.key}`,
          }))}
        />

        <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {sortedFiltered.length} {sortedFiltered.length === 1 ? "job" : "jobs"}
            {specialFilter && ` · ${filterLabel[filterParam]}`}
          </p>
          {specialFilter && (
            <button
              type="button"
              onClick={() => selectFilter("active")}
              className="min-h-11 rounded-xl px-3 text-sm font-semibold text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear dashboard filter
            </button>
          )}
        </div>

        <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-card">
          {loading ? (
            <div className="divide-y">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 p-4">
                  <Skeleton className="w-12 h-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : (filterParam === "no_costs" ||
              filterParam === "missing_cost_data") &&
            profitabilityQuery.isLoading ? (
            <div className="space-y-3 p-5" aria-label="Checking cost records">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (filterParam === "no_costs" ||
              filterParam === "missing_cost_data") &&
            profitabilityQuery.isError ? (
            <div className="p-8 text-center">
              <p role="alert" className="text-sm text-foreground">
                Cost records could not be checked. This is not evidence that a
                job has zero costs.
              </p>
              <button
                type="button"
                onClick={() => void profitabilityQuery.refetch()}
                className="mt-3 min-h-11 rounded-lg px-3 text-sm font-semibold text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Try again
              </button>
            </div>
          ) : sortedFiltered.length === 0 ? (
            filterParam === "quoted" && !search.trim() ? (
              <EmptyState
                className="border-0 shadow-none"
                icon={<FolderOpen className="h-5 w-5" />}
                title="No quotes yet. Tap New Job to start one."
                description=""
                action={<NewJobButton />}
              />
            ) : (
              <div className="text-center py-12 px-4">
                <FolderOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">
                  {search.trim()
                    ? "No jobs match your search."
                    : archiveView
                      ? "No archived jobs yet."
                      : specialFilter
                        ? "No jobs match this dashboard filter."
                        : "No active jobs yet."}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {archiveView
                    ? "Jobs marked completed appear here. Reopen one any time to return it to active jobs."
                    : !specialFilter && !search.trim()
                      ? "New jobs and quotes will appear here as your work comes in."
                      : "Try changing your search or selecting another view."}
                </p>
              </div>
            )
          ) : (
            <div className="divide-y divide-border/50">
               {pageProjects.map((project) => {
                const pending = project.changeRequests.filter(
                  (c) => needsTradeResponse(c) || awaitingClientApproval(c),
                ).length;
                const resolved = project.changeRequests.filter(
                  (c) => c.status === "approved" || c.status === "declined",
                ).length;

                return (
                  <div
                    key={project.id}
                    className="flex min-w-0 flex-col gap-2 px-2 py-3 sm:px-4 sm:py-3.5"
                    data-testid={`project-row-${project.id}`}
                  >
                    <JobCard
                      project={project}
                      quote={latestQuoteByProject.get(project.id)}
                      status={jobDisplayStatus(project, latestQuoteByProject.get(project.id))}
                      className="min-w-0"
                      testId={`project-card-${project.id}`}
                    >
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-sm text-muted-foreground">
                        {pending > 0 && (
                          <span className="flex items-center gap-1 text-warning font-medium">
                            <GitBranch className="h-3.5 w-3.5 flex-shrink-0" />
                            {pending} pending
                          </span>
                        )}
                        {resolved > 0 && (
                          <span className="flex items-center gap-1">
                            <GitBranch className="h-3.5 w-3.5 flex-shrink-0" />
                            {resolved} resolved
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {profitabilityQuery.isLoading ? (
                          <span className="h-5 w-24 animate-pulse rounded bg-muted" aria-label="Loading job profitability" />
                        ) : profitabilityQuery.isError ? (
                          <span className="text-xs text-muted-foreground">Profitability unavailable</span>
                        ) : profitabilityById.has(project.id) ? (
                          (() => {
                            const item = profitabilityById.get(project.id)!;
                            const result = profitability(item, "quoted");
                            return (
                              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-foreground" data-testid={`profitability-badge-${project.id}`}>
                                {result.profit === null
                                  ? "Indicative profit · quote unavailable"
                                  : `Indicative profit · ${aud(result.profit)} · ${result.margin === null ? "—" : `${result.margin.toFixed(1)}%`}`}
                              </span>
                            );
                          })()
                        ) : (
                          <span className="text-xs text-muted-foreground">Profitability unavailable</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          Margin uses ex-GST revenue less confirmed costs inc GST. Costs may be incomplete.
                        </span>
                      </div>
                    </JobCard>
                    <div className="flex min-w-0 items-center justify-end gap-2">
                      {jobDisplayStatus(project, latestQuoteByProject.get(project.id)) !== "completed" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-1 min-h-10 shrink-0 gap-1.5 px-2 text-xs sm:px-3 sm:text-sm"
                        onClick={() => {
                          const status = jobDisplayStatus(project, latestQuoteByProject.get(project.id));
                          const tab = status === "in_progress" ? "costs" : status === "approved" ? "stages" : "quote";
                          navigate(`/manage/${project.id}?tab=${tab}`);
                        }}
                        aria-label={
                          jobDisplayStatus(project, latestQuoteByProject.get(project.id)) === "in_progress"
                            ? `Log costs for ${project.name}`
                            : jobDisplayStatus(project, latestQuoteByProject.get(project.id)) === "approved"
                              ? `Send deposit invoice for ${project.name}`
                              : `Send quote for ${project.name}`
                        }
                      >
                        {jobDisplayStatus(project, latestQuoteByProject.get(project.id)) === "in_progress"
                          ? "Log costs"
                          : jobDisplayStatus(project, latestQuoteByProject.get(project.id)) === "approved"
                            ? "Send deposit invoice"
                            : "Send quote"}
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring flex-shrink-0"
                          aria-label={`More actions for ${project.name}`}
                          data-testid={`button-project-menu-${project.id}`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52">
                        {project.status !== "completed" ? (
                          <DropdownMenuItem
                            className="gap-2"
                            onSelect={() => void changeArchiveStatus(project, "completed")}
                            data-testid={`menu-mark-completed-${project.id}`}
                          >
                            <CheckCircle2 className="w-4 h-4 text-approved" />
                            Mark as Completed
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            className="gap-2"
                            onSelect={() => void changeArchiveStatus(project, "in_progress")}
                            data-testid={`menu-mark-in-progress-${project.id}`}
                          >
                            <RotateCcw className="w-4 h-4" />
                            Mark as In Progress
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 text-destructive focus:text-destructive"
                          onSelect={() => {
                            setDeleteError(null);
                            setDeleteTarget(project);
                          }}
                          data-testid={`menu-delete-job-${project.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete job
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <ClientPageActions
                          layout="menu"
                          project={project}
                          onAddEmail={() => navigate(`/manage/${project.id}?client=edit`)}
                        />
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        {!loading && !projectsError && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <span>Showing {sortedFiltered.length === 0 ? 0 : (currentPage - 1) * 10 + 1}–{Math.min(currentPage * 10, sortedFiltered.length)} of {sortedFiltered.length} jobs</span>
            <div className="flex items-center gap-2">
              <button type="button" className="min-h-11 rounded-lg border border-border bg-card px-3 disabled:opacity-50" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
              <span className="tabular-nums" aria-label={`Page ${currentPage} of ${pageCount}`}>Page {currentPage} of {pageCount}</span>
              <button type="button" className="min-h-11 rounded-lg border border-border bg-card px-3 disabled:opacity-50" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
            </div>
          </div>
        )}
      </PageLayout>
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleteLock.current) {
            setDeleteTarget(null);
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive sm:mx-0">
              <AlertTriangle className="h-5 w-5" aria-hidden="true" />
            </div>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the job and its related deletable records. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
            <p className="font-semibold">Issued invoices and staff history are protected.</p>
            <p className="mt-1 text-muted-foreground">
              If this job has either, deletion may be blocked to preserve that history. Archive the job instead to remove it from active jobs without losing its records.
            </p>
          </div>
          {deleteError && (
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {deleteError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void confirmDelete();
              }}
              disabled={deletePending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="confirm-delete-job"
            >
              {deletePending ? "Deleting job…" : "Delete job permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
