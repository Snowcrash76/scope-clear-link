import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, FileText, Users } from "lucide-react";
import type { Project } from "@/types/project";
import type { TeamBootstrap } from "../../../shared/employeePortal";
import { usePortal, usePortalSession } from "@/hooks/useEmployeePortal";
import { Button } from "@/components/ui/button";
import { awaitingClientApproval, needsTradeResponse } from "@/lib/variationStatus";
import { JobHoursSummary } from "@/components/team/JobHoursSummary";
import { aud } from "@/hooks/useJobCosts";
import { useJobProfitability } from "@/hooks/useJobCosts";
import { KpiCard } from "@/components/KpiCard";

type DocumentItem = {
  id: string;
  display_name: string | null;
  file_name: string;
  created_at: string;
};

export function ProjectOverview({
  project,
  documents,
  overdueInvoiceCount,
  quoteSubtotal,
  quoteLoading,
  quoteError,
  quoteExists,
  quoteWaitingOnClient,
  onChangeTab,
}: {
  project: Project;
  documents: DocumentItem[];
  overdueInvoiceCount: number;
  quoteSubtotal: number | null;
  quoteLoading: boolean;
  quoteError: boolean;
  quoteExists: boolean;
  quoteWaitingOnClient: boolean;
  onChangeTab: (tab: string) => void;
}) {
  const portalSession = usePortalSession();
  const canManageTeam = !!portalSession.data?.canManageTeam;
  const teamQuery = usePortal<TeamBootstrap>(`/team/bootstrap?job_id=${encodeURIComponent(project.id)}`, canManageTeam);
  const profitabilityQuery = useJobProfitability(project.id);
  const jobProfitability = profitabilityQuery.data?.find((job) => job.jobId === project.id);
  const stages = project.stages ?? [];
  const currentIndex = stages.findIndex((stage) => stage.status === "current");
  const completedStages = stages.filter((stage) => stage.status === "completed").length;
  const pendingForTrade = project.changeRequests.filter(needsTradeResponse);
  const awaitingClient = project.changeRequests.filter(awaitingClientApproval);
  const actionableVariationCount = pendingForTrade.length + awaitingClient.length;
  const nextAction = pendingForTrade.length
    ? { title: "Variation needs your response", detail: `${pendingForTrade.length} client request${pendingForTrade.length === 1 ? "" : "s"} to review`, tab: "changes" }
    : overdueInvoiceCount > 0
      ? { title: "Invoice overdue", detail: `${overdueInvoiceCount} invoice${overdueInvoiceCount === 1 ? "" : "s"} need follow-up`, tab: "invoices" }
      : quoteWaitingOnClient
        ? { title: "Quote waiting on client", detail: "The client has the quote link and can review it online.", tab: "quote" }
        : quoteExists && project.status === "draft"
          ? { title: "Quote ready to send", detail: "Review the quote and share it with your client.", tab: "quote" }
          : null;
  const progress = stages.length ? Math.round((completedStages / stages.length) * 100) : 0;
  const recentDocuments = [...documents].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);
  const variations = [...project.changeRequests].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 3);
  const upcomingAssignments = useMemo(() => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
    return (teamQuery.data?.assignments ?? [])
      .filter((assignment) => assignment.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
      .slice(0, 3);
  }, [teamQuery.data]);

  const quoteValue = quoteLoading
    ? "Loading…"
    : quoteError
      ? "Unavailable"
      : quoteExists && quoteSubtotal !== null
        ? aud(quoteSubtotal)
        : "No quote";
  const costValue = profitabilityQuery.isLoading
    ? "Loading…"
    : profitabilityQuery.error
      ? "Unavailable"
      : jobProfitability
        ? aud(jobProfitability.confirmedCostsIncGst)
        : "Unavailable";

  return (
    <section className="w-full min-w-0 space-y-4" aria-label="Job overview">
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Quote total"
          value={quoteValue}
          description={quoteError ? "Quote could not be loaded" : quoteExists ? "Saved quote · ex GST" : "No saved quote"}
          definition="The active saved quote subtotal before GST. Approved variations already included in the saved quote are not added a second time."
          onClick={() => onChangeTab("quote")}
          tone="primary"
        />
        <KpiCard
          label="Costs so far"
          value={costValue}
          description={profitabilityQuery.error ? "Cost data could not be loaded" : "Confirmed costs · inc GST"}
          definition="Confirmed costs only, using the existing job profitability data. Draft costs are excluded."
          onClick={() => onChangeTab("costs")}
          tone="neutral"
        />
        <KpiCard
          label="Variations needing action"
          value={actionableVariationCount}
          description={`${pendingForTrade.length} for you · ${awaitingClient.length} with client`}
          definition="Open variation requests that need a trade response or client approval."
          onClick={() => onChangeTab("changes")}
          tone={actionableVariationCount ? "warning" : "neutral"}
        />
        <KpiCard
          label="Stage progress"
          value={stages.length ? `${completedStages} / ${stages.length}` : "Add stages"}
          description={stages.length ? (currentIndex >= 0 ? stages[currentIndex].name : completedStages === stages.length ? "All stages complete" : "No current stage") : "Set up a job schedule"}
          definition="Progress is based on completed stages in this job."
          onClick={() => onChangeTab("stages")}
          tone="primary"
        />
      </div>

      {nextAction && (
        <article className="flex min-w-0 flex-col gap-3 rounded-xl border border-primary/20 bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next action</p>
            <h2 className="mt-1 font-semibold">{nextAction.title}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{nextAction.detail}</p>
          </div>
          <Button type="button" variant="link" className="min-h-11 shrink-0 justify-start gap-2 px-0 text-primary sm:justify-center sm:px-2" onClick={() => onChangeTab(nextAction.tab)}>
            Open <ArrowRight className="h-4 w-4" />
          </Button>
        </article>
      )}

      <div className="grid min-w-0 gap-3 lg:grid-cols-2">
        <article className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">Variations</h2>
            <span className="text-sm tabular-nums text-muted-foreground">{project.changeRequests.length}</span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{pendingForTrade.length} need your response · {awaitingClient.length} awaiting client</p>
          {variations.length ? (
            <ul className="mt-3 space-y-2">
              {variations.map((variation) => <li key={variation.id} className="flex min-w-0 justify-between gap-3 text-sm"><span className="truncate">{variation.title}</span><span className="shrink-0 text-muted-foreground">{variation.status.replace(/_/g, " ")}</span></li>)}
            </ul>
          ) : <p className="mt-3 text-sm text-muted-foreground">No variations yet.</p>}
          <Button type="button" variant="link" className="mt-2 min-h-11 gap-1 px-0" onClick={() => onChangeTab("changes")}>View all variations <ArrowRight className="h-4 w-4" /></Button>
        </article>

        <article className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Stages</h2><CalendarDays className="h-4 w-4 text-muted-foreground" /></div>
          {stages.length ? (
            <>
              <p className="mt-2 text-sm font-medium">{currentIndex >= 0 ? stages[currentIndex].name : completedStages === stages.length ? "All stages complete" : "No current stage"}</p>
              <p className="mt-1 text-sm text-muted-foreground">{completedStages} of {stages.length} complete</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Stage progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
            </>
          ) : <p className="mt-2 text-sm text-muted-foreground">No stages set up yet.</p>}
          <Button type="button" variant="link" className="mt-2 min-h-11 gap-1 px-0" onClick={() => onChangeTab("stages")}>{stages.length ? "View all stages" : "Add stages"} <ArrowRight className="h-4 w-4" /></Button>
        </article>

        <article className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Documents</h2><FileText className="h-4 w-4 text-muted-foreground" /></div>
          <p className="mt-1 text-sm text-muted-foreground">{documents.length} saved document{documents.length === 1 ? "" : "s"}</p>
          {recentDocuments.length ? <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{recentDocuments.map((doc) => <li key={doc.id} className="truncate">{doc.display_name || doc.file_name}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No documents added yet.</p>}
          <Button type="button" variant="link" className="mt-2 min-h-11 gap-1 px-0" onClick={() => onChangeTab("documents")}>{documents.length ? "View all documents" : "Add a document"} <ArrowRight className="h-4 w-4" /></Button>
        </article>

        <article className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Team & schedule</h2><Users className="h-4 w-4 text-muted-foreground" /></div>
          {portalSession.isLoading || teamQuery.isLoading ? (
            <div className="mt-3 h-12 animate-pulse rounded-lg bg-muted" aria-label="Loading the team schedule" />
          ) : portalSession.error ? (
            <div className="mt-2 flex flex-wrap items-center gap-2"><p className="text-sm text-muted-foreground">Team access could not be verified.</p><Button type="button" variant="link" className="min-h-11 px-2" onClick={() => void portalSession.refetch()}>Retry</Button></div>
          ) : !canManageTeam ? (
            <p className="mt-2 text-sm text-muted-foreground">Team schedule details are available to managers.</p>
          ) : teamQuery.error ? (
            <div className="mt-2 flex flex-wrap items-center gap-2"><p className="text-sm text-muted-foreground">Team assignments could not be loaded.</p><Button type="button" variant="link" className="min-h-11 px-2" onClick={() => void teamQuery.refetch()}>Retry</Button></div>
          ) : upcomingAssignments.length ? (
            <ul className="mt-2 space-y-2">
              {upcomingAssignments.map((assignment) => {
                const employee = teamQuery.data?.employees.find((item) => item.id === assignment.employee_id);
                return <li key={assignment.id} className="flex min-w-0 justify-between gap-3 text-sm"><span className="truncate font-medium">{employee?.name ?? "Team member"}</span><span className="shrink-0 text-muted-foreground">{new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(new Date(`${assignment.date}T12:00:00`))} · {assignment.start_time}</span></li>;
              })}
            </ul>
          ) : <p className="mt-2 text-sm text-muted-foreground">No upcoming assignments scheduled.</p>}
          {portalSession.isLoading || teamQuery.isLoading ? (
            <div className="mt-3 h-14 animate-pulse rounded-lg bg-muted" aria-label="Loading logged hours" />
          ) : !canManageTeam ? null : portalSession.error || teamQuery.error ? (
            <p role="status" className="mt-2 text-sm text-muted-foreground">Logged hours unavailable.</p>
          ) : teamQuery.data && <div className="mt-3 border-t border-border pt-3"><JobHoursSummary entries={teamQuery.data.entries} jobId={project.id} /></div>}
          <div className="mt-2 flex flex-wrap items-center gap-x-4">
            <Button type="button" variant="link" className="min-h-11 gap-1 px-0" onClick={() => onChangeTab("staff")}>View all team <ArrowRight className="h-4 w-4" /></Button>
            <Link to={`/schedule?job=${encodeURIComponent(project.id)}`} className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary hover:underline">Open schedule <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </article>
      </div>
    </section>
  );
}
