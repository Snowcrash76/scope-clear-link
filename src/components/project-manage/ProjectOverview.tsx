import { useMemo } from "react";
import { ArrowRight, CalendarDays, FileText, Receipt, Users } from "lucide-react";
import type { Project } from "@/types/project";
import type { TeamBootstrap } from "../../../shared/employeePortal";
import { usePortal } from "@/hooks/useEmployeePortal";
import { Button } from "@/components/ui/button";
import { ClientDetailsCard, type ClientEditValues } from "./ClientDetailsCard";
import { awaitingClientApproval, needsTradeResponse } from "@/lib/variationStatus";

type DocumentItem = {
  id: string;
  display_name: string | null;
  file_name: string;
  created_at: string;
};

export function ProjectOverview({
  project,
  documents,
  unpaidInvoiceCount,
  originalQuoteTotal,
  approvedVariationTotal,
  onSaveClient,
  onChangeTab,
}: {
  project: Project;
  documents: DocumentItem[];
  unpaidInvoiceCount: number;
  originalQuoteTotal: number;
  approvedVariationTotal: number;
  onSaveClient: (values: ClientEditValues, applyToAll: boolean) => Promise<boolean>;
  onChangeTab: (tab: string) => void;
}) {
  const teamQuery = usePortal<TeamBootstrap>(`/team/bootstrap?job_id=${encodeURIComponent(project.id)}`);
  const stages = project.stages ?? [];
  const currentIndex = stages.findIndex((stage) => stage.status === "current");
  const completedStages = stages.filter((stage) => stage.status === "completed").length;
  const pendingForTrade = project.changeRequests.filter(needsTradeResponse);
  const awaitingClient = project.changeRequests.filter(awaitingClientApproval);
  const nextAction = pendingForTrade.length
    ? { title: "Client variation request", detail: `${pendingForTrade.length} need your response`, tab: "changes" }
    : awaitingClient.length
      ? { title: "Waiting for client approval", detail: `${awaitingClient.length} variation${awaitingClient.length === 1 ? "" : "s"} awaiting a response`, tab: "changes" }
      : unpaidInvoiceCount > 0
        ? { title: "Follow up on invoices", detail: `${unpaidInvoiceCount} invoice${unpaidInvoiceCount === 1 ? "" : "s"} awaiting payment`, tab: "invoices" }
        : project.status === "draft"
          ? { title: "Quote is ready to send", detail: "Send the secure client page when you’re ready.", tab: "quote" }
          : { title: "No urgent job actions", detail: "Your saved job information is up to date.", tab: "activity" };
  const progress = stages.length ? Math.round((completedStages / stages.length) * 100) : 0;
  const recentDocuments = [...documents].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 3);
  const variations = [...project.changeRequests].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 3);
  const money = (value: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(value);
  const upcomingAssignments = useMemo(() => {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
    return (teamQuery.data?.assignments ?? [])
      .filter((assignment) => assignment.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date) || a.start_time.localeCompare(b.start_time))
      .slice(0, 3);
  }, [teamQuery.data]);

  return (
    <section className="space-y-5" aria-label="Job overview">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(19rem,.8fr)]">
        <ClientDetailsCard project={project} onSave={onSaveClient} />
        <article className="rounded-xl border border-warning/30 bg-warning/10 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Next action</p>
          <h2 className="mt-2 text-lg font-bold">{nextAction.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{nextAction.detail}</p>
          <Button type="button" variant="outline" className="mt-3 min-h-11 gap-2" onClick={() => onChangeTab(nextAction.tab)}>
            Open action <ArrowRight className="h-4 w-4" />
          </Button>
        </article>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button type="button" onClick={() => onChangeTab("stages")} className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Stage progress</span>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </div>
          {stages.length ? (
            <>
              <p className="mt-2 font-semibold">{currentIndex >= 0 ? stages[currentIndex].name : completedStages === stages.length ? "All stages complete" : "No current stage"}</p>
              <p className="mt-1 text-sm tabular-nums text-muted-foreground">{completedStages} / {stages.length} complete</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted" aria-label={`${progress}% of stages complete`}>
                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
            </>
          ) : <p className="mt-2 text-sm text-muted-foreground">Stages not set up yet. Add stages to track job progress.</p>}
        </button>
        <button type="button" onClick={() => onChangeTab("changes")} className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Variations</span><span className="rounded-full bg-muted px-2 py-1 text-xs tabular-nums">{project.changeRequests.length}</span></div>
          <p className="mt-2 text-sm text-muted-foreground">{pendingForTrade.length} need your response · {awaitingClient.length} awaiting client</p>
          {variations.length ? <ul className="mt-3 space-y-2">{variations.map((variation) => <li key={variation.id} className="flex min-w-0 justify-between gap-2 text-sm"><span className="truncate">{variation.title}</span><span className="shrink-0 text-muted-foreground">{variation.status.replace(/_/g, " ")}</span></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">No variations on this job.</p>}
        </button>
        <button type="button" onClick={() => onChangeTab("documents")} className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Documents</span><FileText className="h-4 w-4 text-muted-foreground" /></div>
          <p className="mt-2 font-semibold">{documents.length} saved document{documents.length === 1 ? "" : "s"}</p>
          {recentDocuments.length ? <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{recentDocuments.map((doc) => <li key={doc.id} className="truncate">{doc.display_name || doc.file_name}</li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Add plans, photos or reports to this job.</p>}
        </button>
        <button type="button" onClick={() => onChangeTab("quote")} className="rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Quote value</span><Receipt className="h-4 w-4 text-muted-foreground" /></div>
          <p className="mt-2 text-sm text-muted-foreground">Original quote <strong className="text-foreground">{money(originalQuoteTotal)}</strong></p>
          <p className="mt-1 text-sm text-muted-foreground">Approved variations <strong className="text-foreground">{money(approvedVariationTotal)}</strong></p>
          <p className="mt-2 border-t border-border pt-2 font-semibold">Current total {money(originalQuoteTotal + approvedVariationTotal)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Costs so far are shown separately and may be partial.</p>
        </button>
      </div>
      <div className="rounded-xl border border-border bg-muted/40 p-4">
        <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /><h2 className="font-semibold">Team and schedule</h2></div>
        {teamQuery.isLoading ? (
          <div className="mt-3 h-12 animate-pulse rounded-lg bg-muted" aria-label="Loading the team schedule" />
        ) : teamQuery.error ? (
          <div className="mt-2 flex flex-wrap items-center gap-2"><p className="text-sm text-muted-foreground">Team assignments could not be loaded.</p><Button type="button" variant="link" className="min-h-11 px-2" onClick={() => void teamQuery.refetch()}>Retry</Button></div>
        ) : upcomingAssignments.length ? (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {upcomingAssignments.map((assignment) => {
              const employee = teamQuery.data?.employees.find((item) => item.id === assignment.employee_id);
              return <li key={assignment.id} className="rounded-lg border border-border bg-card p-3"><p className="font-semibold">{employee?.name ?? "Team member"}</p><p className="mt-1 text-sm text-muted-foreground">{new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short" }).format(new Date(`${assignment.date}T12:00:00`))} · {assignment.start_time}–{assignment.end_time}</p></li>;
            })}
          </ul>
        ) : <p className="mt-1 text-sm text-muted-foreground">No upcoming assignments are scheduled for this job.</p>}
        <Button type="button" variant="outline" className="mt-3 min-h-11 gap-2" onClick={() => onChangeTab("staff")}>Open team <ArrowRight className="h-4 w-4" /></Button>
      </div>
      <article className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Costs so far</p>
        <p className="mt-2 text-sm text-muted-foreground">Job costs are estimates until all receipts and labour are recorded. View costs and margin details.</p>
        <Button type="button" variant="outline" className="mt-3 min-h-11 gap-2" onClick={() => onChangeTab("costs")}>View costs <ArrowRight className="h-4 w-4" /></Button>
      </article>
    </section>
  );
}
