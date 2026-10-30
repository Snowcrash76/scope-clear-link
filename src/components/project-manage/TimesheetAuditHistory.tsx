import { useMemo, useState } from "react";
import { History, Search } from "lucide-react";
import type { TeamBootstrap } from "../../../shared/employeePortal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  auditActorName,
  auditBusinessDate,
  auditEmployeeId,
  auditLabel,
  formatAuditTimestamp,
  reviewAuditForPersonWeek,
  type AuditRow,
} from "./timesheetAudit";

export function TimesheetAuditHistory({
  rows,
  employees,
  timezone,
  personId,
  personName,
  week,
  open,
  onOpenChange,
  onRestoreFocus,
}: {
  rows: AuditRow[];
  employees: TeamBootstrap["employees"];
  timezone: string;
  personId?: string;
  personName?: string;
  week?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRestoreFocus?: () => void;
}) {
  const [showAllWeek, setShowAllWeek] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(personId ?? "");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(0);
  const isFocusedWeek = Boolean(personId && week);
  const candidates = useMemo(() => {
    if (isFocusedWeek) return reviewAuditForPersonWeek(rows, personId!, week!);
    return rows
      .filter((row) => auditLabel(row) !== null)
      .filter((row) => !selectedPerson || auditEmployeeId(row) === selectedPerson)
      .filter((row) => !fromDate || auditBusinessDate(row.created_at, timezone) >= fromDate)
      .filter((row) => !toDate || auditBusinessDate(row.created_at, timezone) <= toDate)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [rows, isFocusedWeek, personId, week, selectedPerson, fromDate, toDate, timezone]);
  const pageSize = isFocusedWeek ? (showAllWeek ? 10_000 : 10) : 20;
  const visible = isFocusedWeek ? candidates.slice(0, pageSize) : candidates.slice(page * pageSize, (page + 1) * pageSize);
  const hasMore = isFocusedWeek ? candidates.length > visible.length : candidates.length > (page + 1) * pageSize;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(event) => {
          if (onRestoreFocus) {
            event.preventDefault();
            onRestoreFocus();
          }
        }}
        className="max-h-[min(90dvh,52rem)] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" />Review history</DialogTitle>
          <DialogDescription>
            {isFocusedWeek ? `${personName ?? "Team member"} · week of ${week}` : "Filter the loaded history by team member and date range."}
          </DialogDescription>
        </DialogHeader>
        {!isFocusedWeek && (
          <div className="grid gap-3 rounded-xl bg-muted/50 p-3 sm:grid-cols-3">
            <div className="space-y-1"><Label htmlFor="audit-person">Person</Label><select id="audit-person" className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm" value={selectedPerson} onChange={(event) => { setSelectedPerson(event.target.value); setPage(0); }}><option value="">Everyone</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></div>
            <div className="space-y-1"><Label htmlFor="audit-from">From</Label><Input id="audit-from" type="date" value={fromDate} onChange={(event) => { setFromDate(event.target.value); setPage(0); }} /></div>
            <div className="space-y-1"><Label htmlFor="audit-to">To</Label><Input id="audit-to" type="date" value={toDate} onChange={(event) => { setToDate(event.target.value); setPage(0); }} /></div>
          </div>
        )}
        {isFocusedWeek && (
          <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            Showing activity tied to this person and week, including saved entry snapshots when an entry was later removed or moved.
          </p>
        )}
        {visible.length ? (
          <ol className="divide-y divide-border rounded-xl border border-border">
            {visible.map((row) => {
              const mapped = auditLabel(row);
              if (!mapped) return null;
              const timestamp = formatAuditTimestamp(row.created_at, timezone);
              return (
                <li key={row.id} className="flex gap-3 p-4">
                  <span aria-hidden="true" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{mapped.label}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {auditActorName(row, employees)} · <time dateTime={timestamp.dateTime}>{timestamp.text}</time>
                    </p>
                    {mapped.note && <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{mapped.note}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Search className="mx-auto h-5 w-5 text-muted-foreground" />
            <p className="mt-2 font-semibold">No review activity for this week yet.</p>
            {!isFocusedWeek && <p className="mt-1 text-sm text-muted-foreground">Try a different person or date range.</p>}
          </div>
        )}
        <p className="text-xs text-muted-foreground">History is limited to the audit records loaded for this view.</p>
        {hasMore && isFocusedWeek && <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => setShowAllWeek(true)}>Show more</Button>}
        {!isFocusedWeek && (page > 0 || hasMore) && <div className="flex justify-between gap-2"><Button type="button" variant="outline" disabled={page === 0} className="min-h-11" onClick={() => setPage((current) => Math.max(0, current - 1))}>Previous</Button><span className="self-center text-sm text-muted-foreground">Page {page + 1}</span><Button type="button" variant="outline" disabled={!hasMore} className="min-h-11" onClick={() => setPage((current) => current + 1)}>Next</Button></div>}
      </DialogContent>
    </Dialog>
  );
}
