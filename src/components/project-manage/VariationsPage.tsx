import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, GitBranch } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PageLayout } from "@/components/PageLayout";
import { LoadErrorState } from "@/components/LoadErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { SearchFilterButton, SearchOverlay } from "@/components/ui/search-overlay";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterTabs } from "@/components/ui/filter-tabs";
import { useProjects } from "@/hooks/useProjects";
import { awaitingClientApproval, needsTradeResponse } from "@/lib/variationStatus";
import type { ChangeRequest, Project } from "@/types/project";

type VariationRow = { project: Project; variation: ChangeRequest };
const filters = [
  { id: "all", label: "All variations" },
  { id: "needs-action", label: "Needs action" },
  { id: "needs-response", label: "Needs your response" },
  { id: "awaiting-client", label: "Awaiting client" },
  { id: "approved", label: "Approved" },
  { id: "declined", label: "Declined" },
] as const;

export function VariationsPage() {
  const { projects, loading, error, refetch } = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = searchParams.get("filter") ?? "all";
  const [filter, setFilter] = useState<string>(filters.some((item) => item.id === initial) ? initial : "all");
  const [jobFilter, setJobFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const rows = useMemo<VariationRow[]>(
    () => projects.flatMap((project) => project.changeRequests.map((variation) => ({ project, variation })))
      .sort((a, b) => b.variation.createdAt.getTime() - a.variation.createdAt.getTime()),
    [projects],
  );
  const visibleRows = rows.filter(({ project, variation }) => {
    const matchesFilter = filter === "needs-action" ? needsTradeResponse(variation) || awaitingClientApproval(variation)
      : filter === "needs-response" ? needsTradeResponse(variation)
      : filter === "awaiting-client" ? awaitingClientApproval(variation)
        : filter === "approved" ? variation.status === "approved"
          : filter === "declined" ? variation.status === "declined" : true;
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [project.name, project.clientName, variation.title].some((value) => value.toLowerCase().includes(term));
    return matchesFilter && matchesSearch && (jobFilter === "all" || project.id === jobFilter);
  });
  const setFilterValue = (value: string) => {
    setFilter(value);
    setSearchParams(value === "all" ? {} : { filter: value }, { replace: true });
  };
  const money = (amount: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(amount);
  const badge = (variation: ChangeRequest) =>
    needsTradeResponse(variation)
      ? { status: "pending", label: "Needs your response" }
      : awaitingClientApproval(variation)
        ? { status: "awaiting_client", label: "Awaiting client" }
        : variation.status === "approved"
          ? { status: "approved", label: "Approved" }
          : { status: "declined", label: "Declined" };

  return (
    <AppShell>
      <PageLayout title="Variations" description="Every saved change request across your jobs, with the next decision made clear.">
        {loading ? (
          <div className="space-y-3" aria-label="Loading variations">{[0, 1, 2, 3].map((item) => <Skeleton key={item} className="h-24 w-full rounded-xl" />)}</div>
        ) : error ? (
          <LoadErrorState title="Variations could not be loaded" description="A failed jobs request is not an empty variation list." onRetry={refetch} />
        ) : (
          <div className="space-y-4">
            <FilterTabs
              label="Filter variations"
              value={filter}
              onChange={setFilterValue}
              options={filters.map((item) => ({
                value: item.id,
                label: item.label,
                count: item.id === "all" ? rows.length : rows.filter(({ variation }) => item.id === "needs-action" ? needsTradeResponse(variation) || awaitingClientApproval(variation) : item.id === "needs-response" ? needsTradeResponse(variation) : item.id === "awaiting-client" ? awaitingClientApproval(variation) : variation.status === item.id).length,
              }))}
            />
            <div className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-[1fr_auto]">
              <SearchFilterButton onClick={() => setSearchOpen(true)} />
              <label className="flex min-h-11 items-center gap-2 text-sm"><span className="font-medium">Job</span><select className="h-11 min-w-44 rounded-md border border-input bg-background px-3" value={jobFilter} onChange={(event) => setJobFilter(event.target.value)}><option value="all">All jobs</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            </div>
            {visibleRows.length ? (
              <ul className="space-y-2">
                {visibleRows.map(({ project, variation }) => {
                  const status = badge(variation);
                  return (
                    <li key={variation.id}>
                      <Link to={`/manage/${project.id}?tab=changes&variation=${encodeURIComponent(variation.id)}`} className="group flex min-h-20 flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/50 hover:bg-primary/[0.025] focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring sm:flex-row sm:items-center">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><GitBranch className="h-5 w-5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{variation.title || "Untitled variation"}</span>
                          <span className="mt-1 block truncate text-sm text-muted-foreground">{project.name} · {project.clientName}</span>
                        </span>
                        <span className="flex flex-wrap items-center gap-3 sm:justify-end">
                          <span className="font-semibold tabular-nums">{money(variation.costImpact)}</span>
                          <StatusBadge status={status.status} labelOverride={status.label} size="sm" />
                          <time className="text-sm text-muted-foreground" dateTime={variation.createdAt.toISOString()}>{new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" }).format(variation.createdAt)}</time>
                          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                icon={<GitBranch className="h-5 w-5" />}
                title={rows.length ? "No variations match this view" : "No variations yet"}
                description={rows.length ? "Try another status, job or search term." : "Variations from your jobs will appear here."}
                action={rows.length > 0 ? <Button type="button" variant="outline" onClick={() => { setFilterValue("all"); setJobFilter("all"); setSearch(""); }}>Clear filters</Button> : undefined}
              />
            )}
          </div>
        )}
      </PageLayout>
      <SearchOverlay
        open={searchOpen}
        onOpenChange={setSearchOpen}
        value={search}
        onValueChange={setSearch}
        resultSummary={`${visibleRows.length} matching ${visibleRows.length === 1 ? "variation" : "variations"}`}
      >
        {visibleRows.slice(0, 20).map(({ project, variation }) => (
          <Link
            key={variation.id}
            to={`/manage/${project.id}?tab=changes&variation=${encodeURIComponent(variation.id)}`}
            onClick={() => setSearchOpen(false)}
            className="flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{variation.title || "Untitled variation"}</span>
              <span className="block truncate text-sm text-muted-foreground">{project.name} · {project.clientName}</span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
        {visibleRows.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No variations match this search.</p>}
      </SearchOverlay>
    </AppShell>
  );
}
