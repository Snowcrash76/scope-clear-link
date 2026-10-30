import { useMemo, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Clock3, MoreHorizontal, X } from "lucide-react";
import { toast } from "sonner";
import { usePortal, useRefreshPortal, portalRequest } from "@/hooks/useEmployeePortal";
import { Button } from "@/components/ui/button";
import { TimesheetSummary } from "@/components/TimesheetSummary";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { EmployeeBootstrap, PortalTimeEntry } from "../../../shared/employeePortal";
import { localDateTimeToUtc, paidMinutes, weekStart } from "../../../shared/employeePortal";
import { timesheetTotals } from "../../../shared/timesheetTotals";
import { EmptyState, EntryCard, HoursCell, LockNotice, TimesheetStatusBadge, WeekSwitcher, formatDay, formatDuration, formatClock } from "@/components/timesheets";
import type { TimesheetStatus } from "@/components/timesheets";
import { card, primary, outline, field, today, datetimeForZone, getError } from "./portalShared";
import { LoadState } from "./LoadState";
import { PortalLayout } from "./PortalLayout";
import { PageTitle } from "./PageTitleView";
import { EmployeeReviewQueue } from "./EmployeeReviewQueue";

const statusFor = (value: string | undefined): TimesheetStatus =>
  value === "submitted" || value === "approved" || value === "rejected" ? value : "draft";

export function EmployeeTimesheets() {
  const q = usePortal<EmployeeBootstrap>("/employee/bootstrap");
  const refresh = useRefreshPortal();
  const [mode, setMode] = useState<"manual" | "duration">("manual");
  const [job, setJob] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [duration, setDuration] = useState("8");
  const [breakMins, setBreakMins] = useState("30");
  const [notes, setNotes] = useState("");
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<string[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<PortalTimeEntry | null>(null);
  const [clockOutOpen, setClockOutOpen] = useState(false);
  const [clockOutBreak, setClockOutBreak] = useState("30");
  const [clockOutNote, setClockOutNote] = useState("");
  const data = q.data;
  const ws = selectedWeek ?? weekStart(data?.today ?? today());
  const entries = (data?.entries ?? [])
    .filter((entry) => weekStart(entry.work_date) === ws)
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
  const groups = useMemo(() => {
    const grouped = new Map<string, PortalTimeEntry[]>();
    entries.forEach((entry) => grouped.set(entry.work_date, [...(grouped.get(entry.work_date) ?? []), entry]));
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [entries]);
  const total = timesheetTotals(entries).paidMinutes;
  const submitted = data?.submissions.find((submission) => submission.week_start === ws);
  const weekLocked = submitted?.status === "submitted" || submitted?.status === "approved";
  const canSubmit = (!submitted || submitted.status === "rejected") && entries.length > 0 && !entries.some((entry) => !entry.ended_at);
  const running = data?.entries.find((entry) => !entry.ended_at);
  const runningJob = data?.jobs.find((item) => item.id === running?.project_id)?.name ?? "Current job";
  function changeWeek(week: string) {
    setSelectedWeek(week);
  }
  function focusTrap(event: KeyboardEvent<HTMLDivElement>, close: () => void) {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const elements = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[href]')).filter((element) => element.getClientRects().length);
    if (!elements.length) return;
    const first = elements[0]; const last = elements[elements.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  function openForm(entry?: PortalTimeEntry) {
    setError(""); setMessage("");
    if (entry) {
      if (entry.status !== "draft" || !entry.ended_at || weekLocked) return;
      const timezone = data?.timezone || "Australia/Sydney";
      setEditingEntry(entry.id); setJob(entry.project_id); setMode("manual");
      setStart(datetimeForZone(entry.started_at, timezone)); setEnd(datetimeForZone(entry.ended_at, timezone));
      setBreakMins(String(entry.break_minutes)); setNotes(entry.notes);
    } else {
      setEditingEntry(null); setJob(data?.jobs[0]?.id ?? ""); setMode("manual");
      setStart(""); setEnd(""); setDuration("8"); setBreakMins("30"); setNotes("");
    }
    setFormOpen(true);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setError(""); setMessage("");
    if (!data) return;
    setBusy(true);
    try {
      if (!job) throw new Error("Choose a job first.");
      const timezone = data.timezone || "Australia/Sydney";
      let started: string; let ended: string;
      if (mode === "duration") {
        const hours = Number(duration);
        if (!Number.isFinite(hours) || hours <= 0 || hours > 24) throw new Error("Enter a duration between 0 and 24 hours.");
        started = localDateTimeToUtc(start, timezone);
        ended = new Date(Date.parse(started) + hours * 3600000).toISOString();
      } else {
        started = localDateTimeToUtc(start, timezone);
        ended = localDateTimeToUtc(end, timezone);
      }
      paidMinutes(started, ended, Number(breakMins));
      await portalRequest(editingEntry ? `/employee/time/${editingEntry}` : "/employee/time", {
        project_id: job, started_at: started, ended_at: ended, break_minutes: Number(breakMins), notes,
      }, editingEntry ? "PATCH" : "POST");
      setFormOpen(false); setEditingEntry(null); await refresh();
      toast.success(editingEntry ? "Draft time entry updated." : "Time entry saved.");
      setMessage(editingEntry ? "Draft time entry updated." : "Time entry saved.");
    } catch (err) { setError(getError(err)); }
    finally { setBusy(false); }
  }
  async function submitWeek() {
    setBusy(true); setError(""); setMessage("");
    try {
      await portalRequest("/employee/submit", { week_start: ws });
      await refresh(); setMessage("Timesheet submitted for review."); toast.success("Timesheet submitted for review.");
    } catch (err) { setError(getError(err)); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!deleteTarget) return;
    setBusy(true); setError("");
    try {
      await portalRequest(`/employee/time/${deleteTarget.id}`, {}, "DELETE");
      setDeleteTarget(null); await refresh(); toast.success("Draft time entry deleted.");
    } catch (err) { setError(getError(err)); }
    finally { setBusy(false); }
  }
  async function clockOut(event: FormEvent) {
    event.preventDefault(); if (!running) return;
    const break_minutes = Number(clockOutBreak);
    if (!Number.isInteger(break_minutes) || break_minutes < 0) { setError("Enter a whole number of break minutes, zero or more."); return; }
    setBusy(true); setError("");
    try {
      await portalRequest("/employee/clock-out", { entry_id: running.id, break_minutes, notes: clockOutNote });
      await refresh(); setClockOutOpen(false); setClockOutBreak("30"); setClockOutNote("");
      toast.success("Clocked out. Your time is ready to review.");
    } catch (err) { setError(getError(err)); }
    finally { setBusy(false); }
  }
  const toggleNote = (id: string) => setExpandedNotes((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return (
    <PortalLayout>
      <PageTitle eyebrow="Hours / your record" title="Timesheets" description="Record site hours, check your week and submit for review." action={<Link to="/employee/week" className={outline}><CalendarDays className="h-4 w-4" />My schedule</Link>} />
      {q.isLoading ? <LoadState retry={() => q.refetch()} /> : q.error ? <LoadState error={q.error} retry={() => q.refetch()} /> : data && <>
        {running && <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/30 bg-warning/10 p-4" aria-label="Running clock"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-full bg-background text-warning"><Clock3 className="h-5 w-5" /></span><div><p className="font-semibold">Clock is running · {runningJob}</p><p className="text-sm text-muted-foreground">Started {formatClock(running.started_at, data.timezone)}. Paid hours appear after clock-out.</p></div></div><Button type="button" className={primary} onClick={() => { setError(""); setClockOutOpen(true); }}>Clock out</Button></section>}
        {message && <p role="status" className="mb-4 rounded-xl bg-muted p-3 text-sm">{message}</p>}
        {error && !formOpen && !deleteTarget && !clockOutOpen && <p role="alert" className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <section className={`${card} mb-5 p-4 sm:p-5`} aria-label="Selected timesheet week">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <WeekSwitcher value={ws} onChange={changeWeek} today={weekStart(data.today)} id="employee-timesheet-week" />
            <div className="flex flex-wrap items-center justify-between gap-4 lg:justify-end">
              <div><p className="text-sm text-muted-foreground">Week total</p><p className="text-3xl font-bold tabular-nums"><HoursCell minutes={total} /></p></div>
              <TimesheetStatusBadge status={statusFor(submitted?.status)} />
              {canSubmit && <Button className={primary} disabled={busy} onClick={() => void submitWeek()}>{busy ? "Sending…" : "Submit week"}</Button>}
              {submitted?.status === "submitted" && <span className="text-sm text-muted-foreground">In review</span>}
            </div>
          </div>
          <details className="mt-4 border-t border-border pt-3" open={detailsOpen} onToggle={(event) => setDetailsOpen(event.currentTarget.open)}>
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-muted-foreground">Details <span className="ml-2 font-normal">Break, paid hours and approved pay</span></summary>
            <div className="mt-2"><TimesheetSummary entries={entries} hourlyRate={data.hourly_rate} showPay={data.hourly_rate != null} /></div>
          </details>
        </section>
        {weekLocked && <div className="mb-4"><LockNotice> This week is locked. Ask your supervisor to reopen it before making corrections.</LockNotice></div>}
        <section className="space-y-4 pb-24 sm:pb-0" aria-label="Daily time entries">
          {groups.length ? groups.map(([day, dayEntries]) => {
            const dayMinutes = timesheetTotals(dayEntries).paidMinutes;
            return <section key={day} className={`${card} overflow-hidden`} aria-labelledby={`day-heading-${day}`}>
              <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted/50 px-4 py-3 sm:px-5">
                <h2 id={`day-heading-${day}`} className="font-bold">{formatDay(day)}</h2>
                <span className="text-sm text-muted-foreground">Day total <strong className="ml-1 text-foreground">{formatDuration(dayMinutes)}</strong></span>
              </header>
              <div className="divide-y divide-border">
                {dayEntries.map((entry) => {
                  const editable = entry.status === "draft" && !!entry.ended_at && !weekLocked;
                  const noteExpanded = expandedNotes.includes(entry.id);
                  return <EntryCard key={entry.id}>
                    <div data-testid={`timesheet-entry-${entry.id}`} className="-m-4 rounded-xl p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold">{data.jobs.find((item) => item.id === entry.project_id)?.name ?? "Job"}</h3><TimesheetStatusBadge status={entry.ended_at ? statusFor(entry.status) : "running"} /></div>
                          <p className="mt-1 text-sm text-muted-foreground">{formatClock(entry.started_at, data.timezone)} – {formatClock(entry.ended_at, data.timezone)} · {entry.break_minutes} min break</p>
                          <p className="mt-1 text-sm font-semibold"><HoursCell minutes={timesheetTotals([entry]).paidMinutes} /> paid</p>
                          {entry.notes && <div className="mt-2"><p className={`whitespace-pre-wrap text-sm text-muted-foreground ${noteExpanded ? "" : "line-clamp-2"}`}>{entry.notes}</p>{entry.notes.length > 110 && <button type="button" className="mt-1 min-h-11 text-sm font-semibold text-foreground underline underline-offset-2" aria-expanded={noteExpanded} onClick={() => toggleNote(entry.id)}>{noteExpanded ? "Show less" : "Read full note"}</button>}</div>}
                        </div>
                        {editable && <div className="flex shrink-0 items-center gap-1"><Button type="button" variant="outline" className="h-11" onClick={() => openForm(entry)}>Edit time</Button><div className="relative"><Button type="button" variant="ghost" className="h-11 w-11 p-0" aria-label="Entry actions" onClick={(event) => { const menu = event.currentTarget.nextElementSibling; if (menu) menu.classList.toggle("hidden"); }}><MoreHorizontal className="h-5 w-5" /></Button><div className="absolute right-0 top-full z-10 hidden min-w-36 rounded-xl border border-border bg-background p-1 shadow-elevated"><button type="button" className="min-h-11 w-full rounded-lg px-3 text-left text-sm hover:bg-muted" onClick={() => setDeleteTarget(entry)}>Delete entry</button></div></div></div>}
                      </div>
                    </div>
                  </EntryCard>;
                })}
              </div>
            </section>;
          }) : <div className={`${card}`}><EmptyState title="No hours logged" detail="Add your first time entry for this week. Only your team sees your hours and notes." onJump={undefined} /></div>}
        </section>
        <section className={`${card} mt-6 p-4 sm:p-5`}>
          <h2 className="font-bold">Review history</h2>
          {data.submissions.length ? <div className="mt-3 space-y-2">{data.submissions.map((submission) => <div key={submission.id} className="rounded-xl bg-muted p-3"><div className="flex flex-wrap justify-between gap-2 text-sm"><span>Week of {formatDay(submission.week_start)}</span><TimesheetStatusBadge status={statusFor(submission.status)} /></div>{submission.review_comment && <p className="mt-2 text-sm text-muted-foreground">{submission.review_comment}</p>}</div>)}</div> : <p className="mt-2 text-sm text-muted-foreground">Nothing submitted yet.</p>}
        </section>
        <Button type="button" className={`${primary} fixed bottom-4 left-4 right-4 z-20 shadow-elevated sm:hidden`} onClick={() => openForm()}><span className="text-lg leading-none">+</span>Add time</Button>
        <Button type="button" className={`${primary} fixed bottom-6 right-8 z-20 hidden shadow-elevated sm:inline-flex`} onClick={() => openForm()}>Add time</Button>
        <EmployeeReviewQueue enabled={data.permissions.review_timesheets} employeeId={data.employee.id} timezone={data.timezone} />
        {formOpen && <div className="fixed inset-0 z-40 bg-foreground/35" onMouseDown={(event) => event.target === event.currentTarget && !busy && setFormOpen(false)} onKeyDown={(event) => focusTrap(event, () => !busy && setFormOpen(false))}>
          <section role="dialog" aria-modal="true" aria-labelledby="employee-form-title" className="absolute inset-x-0 bottom-0 top-8 flex flex-col overflow-hidden rounded-t-2xl border border-border bg-background shadow-elevated sm:inset-y-8 sm:left-1/2 sm:right-auto sm:w-full sm:max-w-xl sm:-translate-x-1/2 sm:rounded-2xl">
            <header className="flex items-center justify-between border-b border-border p-4"><div><h2 id="employee-form-title" className="text-lg font-bold">{editingEntry ? "Edit draft time" : "Add work time"}</h2><p className="text-sm text-muted-foreground">Business timezone: {data.timezone}</p></div><Button type="button" variant="ghost" className="h-11 w-11 p-0" aria-label="Close entry form" onClick={() => setFormOpen(false)}><X className="h-5 w-5" /></Button></header>
            <form id="employee-entry-form" className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" onSubmit={save}>
              {error && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
              <div><Label htmlFor="entry-job">Job</Label><select id="entry-job" className={`${field} mt-1.5`} value={job} onChange={(event) => setJob(event.target.value)} required><option value="">Choose assigned job</option>{data.jobs.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
              <div className="grid grid-cols-2 rounded-xl bg-muted p-1"><button type="button" aria-pressed={mode === "manual"} className={`min-h-11 rounded-lg text-sm font-semibold ${mode === "manual" ? "bg-background shadow-soft" : ""}`} onClick={() => setMode("manual")}>Start &amp; finish</button><button type="button" aria-pressed={mode === "duration"} className={`min-h-11 rounded-lg text-sm font-semibold ${mode === "duration" ? "bg-background shadow-soft" : ""}`} onClick={() => setMode("duration")}>Duration</button></div>
              <div><Label htmlFor="entry-start">Start · local date and time</Label><Input id="entry-start" type="datetime-local" className={`${field} mt-1.5`} value={start} onChange={(event) => setStart(event.target.value)} required /></div>
              {mode === "manual" ? <div><Label htmlFor="entry-end">Finish · local date and time</Label><Input id="entry-end" type="datetime-local" className={`${field} mt-1.5`} value={end} onChange={(event) => setEnd(event.target.value)} required /></div> : <div><Label htmlFor="entry-duration">Hours from start</Label><Input id="entry-duration" type="number" min="0.1" max="24" step=".25" className={`${field} mt-1.5`} value={duration} onChange={(event) => setDuration(event.target.value)} required /></div>}
              <fieldset><legend className="text-sm font-medium">Unpaid break · minutes</legend><div className="mt-2 flex flex-wrap gap-2">{[0, 15, 30, 45, 60].map((amount) => <button key={amount} type="button" className={`min-h-11 min-w-12 rounded-lg border px-3 text-sm font-semibold ${breakMins === String(amount) ? "border-foreground bg-muted" : "border-border"}`} aria-pressed={breakMins === String(amount)} onClick={() => setBreakMins(String(amount))}>{amount}</button>)}</div><Label htmlFor="entry-break" className="mt-3 block">Custom break</Label><Input id="entry-break" type="number" min="0" step="1" className={`${field} mt-1.5`} value={breakMins} onChange={(event) => setBreakMins(event.target.value)} required /></fieldset>
              <div><Label htmlFor="entry-notes">Work notes <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="entry-notes" className={`${field} mt-1.5 min-h-24`} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What did you work on?" /></div>
              <div className="sticky bottom-0 flex gap-2 border-t border-border bg-background py-3"><Button className={`${primary} flex-1`} disabled={busy}>{busy ? "Saving…" : editingEntry ? "Update draft" : "Save time entry"}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setFormOpen(false)}>Cancel</Button></div>
            </form>
          </section>
        </div>}
        {clockOutOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4" onKeyDown={(event) => focusTrap(event, () => setClockOutOpen(false))}><form role="dialog" aria-modal="true" aria-labelledby="clock-out-title" className={`${card} w-full max-w-md p-5`} onSubmit={clockOut}><h2 id="clock-out-title" className="text-xl font-bold">Clock out</h2><p className="mt-1 text-sm text-muted-foreground">{runningJob} · {running && formatClock(running.started_at, data.timezone)}</p>{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}<Label htmlFor="clock-out-break" className="mt-4 block">Unpaid break · minutes</Label><Input id="clock-out-break" type="number" min="0" step="1" className={`${field} mt-1.5`} value={clockOutBreak} onChange={(event) => setClockOutBreak(event.target.value)} required /><Label htmlFor="clock-out-note" className="mt-4 block">Shift note <span className="font-normal text-muted-foreground">(optional)</span></Label><Textarea id="clock-out-note" className={`${field} mt-1.5`} value={clockOutNote} onChange={(event) => setClockOutNote(event.target.value)} /><div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setClockOutOpen(false)}>Cancel</Button><Button className={primary} disabled={busy}>{busy ? "Clocking out…" : "Clock out"}</Button></div></form></div>}
        {deleteTarget && <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 p-4" onKeyDown={(event) => focusTrap(event, () => setDeleteTarget(null))}><div role="alertdialog" aria-modal="true" aria-labelledby="employee-delete-title" className={`${card} w-full max-w-md p-5`}><h2 id="employee-delete-title" className="text-xl font-bold">Delete draft entry?</h2><p className="mt-2 text-sm text-muted-foreground">This removes your {formatDay(deleteTarget.work_date)} time entry from your timesheet. This cannot be undone.</p>{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}<div className="mt-5 flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button><Button type="button" variant="destructive" disabled={busy} onClick={() => void remove()}>{busy ? "Deleting…" : "Delete entry"}</Button></div></div></div>}
      </>}
    </PortalLayout>
  );
}
