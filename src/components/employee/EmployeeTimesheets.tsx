import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import {
  usePortal,
  useRefreshPortal,
  portalRequest,
} from "@/hooks/useEmployeePortal";

import { Button } from "@/components/ui/button";
import { TimesheetSummary } from "@/components/TimesheetSummary";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

import type {
  EmployeeBootstrap,
  PortalTimeEntry,
} from "../../../shared/employeePortal";
import {
  localDateTimeToUtc,
  paidMinutes,
  weekStart,
} from "../../../shared/employeePortal";
import {
  card,
  btn,
  primary,
  outline,
  field,
  today,
  fmtDate,
  fmtTime,
  datetimeForZone,
  mins,
  getError,
} from "./portalShared";
import { LoadState } from "./LoadState";
import { PortalLayout } from "./PortalLayout";
import { PageTitle } from "./PageTitleView";
import { Empty } from "./Empty";
import { EmployeeReviewQueue } from "./EmployeeReviewQueue";

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
  const [deleteTarget, setDeleteTarget] = useState<PortalTimeEntry | null>(
    null,
  );
  const data = q.data;
  const ws = selectedWeek ?? weekStart(data?.today ?? today());
  const entries = (data?.entries ?? [])
    .filter((e) => weekStart(e.work_date) === ws)
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
  const entryMinutes = (e: PortalTimeEntry) =>
    e.ended_at
      ? (e.paid_minutes ??
        Math.max(
          0,
          Math.round(
            (Date.parse(e.ended_at) - Date.parse(e.started_at)) / 60000,
          ) - e.break_minutes,
        ))
      : 0;
  const dayTotals = Array.from(new Set(entries.map((e) => e.work_date))).map(
    (day) => ({
      day,
      minutes: entries
        .filter((e) => e.work_date === day)
        .reduce((n, e) => n + entryMinutes(e), 0),
    }),
  );
  const jobTotals = (data?.jobs ?? [])
    .map((j) => ({
      name: j.name,
      minutes: entries
        .filter((e) => e.project_id === j.id)
        .reduce((n, e) => n + entryMinutes(e), 0),
    }))
    .filter((j) => j.minutes > 0);
  const total = entries.reduce((sum, e) => sum + entryMinutes(e), 0);
  function changeWeek(amount: number) {
    const date = new Date(`${ws}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + amount * 7);
    setSelectedWeek(weekStart(date.toISOString().slice(0, 10)));
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (!job) throw new Error("Choose a job first.");
      let started: string, ended: string;
      const tz = data?.timezone || "Australia/Sydney";
      if (mode === "duration") {
        const hours = Number(duration);
        if (!Number.isFinite(hours) || hours <= 0 || hours > 24)
          throw new Error("Enter a duration between 0 and 24 hours.");
        started = localDateTimeToUtc(start, tz);
        ended = new Date(Date.parse(started) + hours * 3600000).toISOString();
      } else {
        started = localDateTimeToUtc(start, tz);
        ended = localDateTimeToUtc(end, tz);
      }
      paidMinutes(started, ended, Number(breakMins));
      const payload = {
        project_id: job,
        started_at: started,
        ended_at: ended,
        break_minutes: Number(breakMins),
        notes,
      };
      await portalRequest(
        editingEntry ? `/employee/time/${editingEntry}` : "/employee/time",
        payload,
        editingEntry ? "PATCH" : "POST",
      );
      setStart("");
      setEnd("");
      setNotes("");
      setEditingEntry(null);
      await refresh();
      setMessage(
        editingEntry ? "Draft time entry updated." : "Time entry saved.",
      );
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  }
  function editEntry(entry: PortalTimeEntry) {
    if (entry.status !== "draft" || !entry.ended_at) return;
    const tz = data?.timezone || "Australia/Sydney";
    setEditingEntry(entry.id);
    setJob(entry.project_id);
    setMode("manual");
    setStart(datetimeForZone(entry.started_at, tz));
    setEnd(datetimeForZone(entry.ended_at, tz));
    setBreakMins(String(entry.break_minutes));
    setNotes(entry.notes);
    setError("");
    setMessage("");
    document
      .getElementById("employee-entry-form")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.getElementById("entry-start")?.focus();
  }
  async function submitWeek() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await portalRequest("/employee/submit", { week_start: ws });
      await refresh();
      setMessage("Timesheet submitted for review.");
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  }
  const submitted = data?.submissions.find((s) => s.week_start === ws);
  const weekLocked =
    submitted?.status === "submitted" || submitted?.status === "approved";
  async function remove() {
    if (!deleteTarget) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await portalRequest(`/employee/time/${deleteTarget.id}`, {}, "DELETE");
      setDeleteTarget(null);
      await refresh();
      setMessage("Draft time entry deleted.");
      window.setTimeout(
        () => document.getElementById("selected-week-title")?.focus(),
        0,
      );
    } catch (err) {
      setError(getError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <PortalLayout>
      <PageTitle
        eyebrow="Hours / your record"
        title="Timesheets"
        description="Record site hours, check your week and submit for review."
        action={
          <Link to="/employee/week" className={outline}>
            <CalendarDays className="h-4 w-4" />
            My schedule
          </Link>
        }
      />
      {q.isLoading ? (
        <LoadState retry={() => q.refetch()} />
      ) : q.error ? (
        <LoadState error={q.error} retry={() => q.refetch()} />
      ) : (
        data && (
          <>
            {error && (
              <p
                role="alert"
                className="mb-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground"
              >
                {error}
              </p>
            )}
            {message && (
              <p
                role="status"
                className="mb-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground"
              >
                {message}
              </p>
            )}
            <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_1.2fr]">
              <div className={`${card} p-4`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <small className="text-xs text-muted-foreground">
                      Selected week
                    </small>
                    <p className="portal-mono mt-1 text-lg font-bold">
                      {fmtDate(ws)}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {entries.length} recorded{" "}
                    {entries.length === 1 ? "entry" : "entries"}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    className={`${outline} !min-h-10 !px-3`}
                    onClick={() => changeWeek(-1)}
                  >
                    Previous week
                  </Button>
                  <label className="sr-only" htmlFor="employee-timesheet-week">
                    Select week
                  </label>
                  <input
                    id="employee-timesheet-week"
                    type="date"
                    className={`${field} !min-h-10 min-w-[145px] flex-1`}
                    value={ws}
                    onChange={(event) => {
                      if (event.target.value)
                        setSelectedWeek(weekStart(event.target.value));
                    }}
                  />
                  <Button
                    type="button"
                    className={`${outline} !min-h-10 !px-3`}
                    onClick={() => setSelectedWeek(weekStart(data.today))}
                  >
                    Current week
                  </Button>
                </div>
              </div>
              <div
                className={`${card} flex flex-wrap items-center justify-between gap-3 p-4`}
              >
                <div>
                  <small className="text-xs text-muted-foreground">
                    Week submission
                  </small>
                  <p className="mt-1 font-bold capitalize">
                    {submitted?.status ?? "Draft"}
                  </p>
                </div>
                {!submitted || submitted.status === "rejected" ? (
                  <Button
                    className={`${primary} !px-3`}
                    onClick={submitWeek}
                    disabled={busy || entries.length === 0}
                  >
                    {busy ? "Sending…" : "Submit week"}
                  </Button>
                ) : submitted.status === "submitted" ? (
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                    In review
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                    Approved
                  </span>
                )}
              </div>
            </div>
            <TimesheetSummary
              entries={entries}
              hourlyRate={data.hourly_rate}
              showRate
            />
            <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
              <form
                id="employee-entry-form"
                className={`${card} scroll-mt-24 p-5 sm:p-6`}
                onSubmit={save}
              >
                <h2 className="text-lg font-bold">
                  {editingEntry ? "Edit draft time" : "Add work time"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Use the business timezone: {data.timezone}.
                </p>
                <div className="mt-5 space-y-4">
                  <div>
                    <Label htmlFor="entry-job">Job</Label>
                    <select
                      id="entry-job"
                      className={`${field} mt-1.5`}
                      value={job}
                      onChange={(e) => setJob(e.target.value)}
                      required
                    >
                      <option value="">Choose assigned job</option>
                      {data.jobs.map((j) => (
                        <option key={j.id} value={j.id}>
                          {j.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 rounded-xl bg-muted p-1">
                    <button
                      type="button"
                      className={`min-h-10 rounded-lg text-sm font-semibold ${mode === "manual" ? "bg-background shadow-sm" : ""}`}
                      onClick={() => setMode("manual")}
                    >
                      Start & finish
                    </button>
                    <button
                      type="button"
                      className={`min-h-10 rounded-lg text-sm font-semibold ${mode === "duration" ? "bg-background shadow-sm" : ""}`}
                      onClick={() => setMode("duration")}
                    >
                      Duration
                    </button>
                  </div>
                  <div>
                    <Label htmlFor="entry-start">
                      Start · local date and time
                    </Label>
                    <Input
                      id="entry-start"
                      type="datetime-local"
                      className={`${field} mt-1.5`}
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      required
                    />
                  </div>
                  {mode === "manual" ? (
                    <div>
                      <Label htmlFor="entry-end">
                        Finish · local date and time
                      </Label>
                      <Input
                        id="entry-end"
                        type="datetime-local"
                        className={`${field} mt-1.5`}
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                        required
                      />
                    </div>
                  ) : (
                    <div>
                      <Label htmlFor="entry-duration">Hours from start</Label>
                      <Input
                        id="entry-duration"
                        type="number"
                        min="0.1"
                        max="24"
                        step=".25"
                        className={`${field} mt-1.5`}
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        required
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="entry-break">Unpaid break · minutes</Label>
                    <Input
                      id="entry-break"
                      type="number"
                      min="0"
                      step="1"
                      className={`${field} mt-1.5`}
                      value={breakMins}
                      onChange={(e) => setBreakMins(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="entry-notes">Work notes</Label>
                    <Textarea
                      id="entry-notes"
                      className={`${field} mt-1.5`}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="What did you work on?"
                    />
                  </div>
                  <Button className={`${primary} w-full`} disabled={busy}>
                    {busy
                      ? "Saving…"
                      : editingEntry
                        ? "Update draft"
                        : "Save time entry"}
                  </Button>
                  {editingEntry && (
                    <Button
                      type="button"
                      className={`${outline} w-full`}
                      disabled={busy}
                      onClick={() => {
                        setEditingEntry(null);
                        setStart("");
                        setEnd("");
                        setNotes("");
                      }}
                    >
                      Cancel edit
                    </Button>
                  )}
                </div>
              </form>
              <section className={`${card} p-5 sm:p-6`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2
                      id="selected-week-title"
                      tabIndex={-1}
                      className="text-lg font-bold"
                    >
                      Selected week
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {entries.length}{" "}
                      {entries.length === 1 ? "entry" : "entries"} ·{" "}
                      {mins(Math.round(total))} paid time
                    </p>
                  </div>
                  <span className="portal-mono text-xs text-muted-foreground">
                    {fmtDate(ws)}
                  </span>
                </div>
                {entries.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {dayTotals.map((d) => (
                      <span
                        key={d.day}
                        className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground"
                      >
                        {fmtDate(d.day)}{" "}
                        <b className="portal-mono ml-1">
                          {mins(Math.round(d.minutes))}
                        </b>
                      </span>
                    ))}
                    {jobTotals.map((j) => (
                      <span
                        key={j.name}
                        className="rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground"
                      >
                        {j.name}{" "}
                        <b className="portal-mono ml-1">
                          {mins(Math.round(j.minutes))}
                        </b>
                      </span>
                    ))}
                  </div>
                )}
                {entries.length ? (
                  <div className="mt-4 space-y-2">
                    {entries.map((e) => (
                      <div
                        key={e.id}
                        className="rounded-xl border border-border p-3"
                      >
                        <div className="flex flex-wrap justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold">
                              {data.jobs.find((j) => j.id === e.project_id)
                                ?.name ?? "Job"}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {fmtDate(e.work_date)} ·{" "}
                              {fmtTime(e.started_at, data.timezone)} –{" "}
                              {fmtTime(e.ended_at, data.timezone)} ·{" "}
                              {e.break_minutes}m unpaid break
                            </p>
                            {!e.ended_at && (
                              <p className="mt-1 text-xs font-medium text-muted-foreground">
                                Running clock · clock out before editing or
                                deleting.
                              </p>
                            )}
                            {e.notes && (
                              <p className="mt-2 text-sm text-muted-foreground">
                                {e.notes}
                              </p>
                            )}
                            {(e.status !== "draft" || weekLocked) && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                This week is locked. Ask your supervisor to
                                reopen it before corrections.
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold capitalize">
                              {e.status}
                            </span>
                            {e.status === "draft" &&
                              e.ended_at &&
                              !weekLocked && (
                                <div className="flex flex-wrap justify-end gap-2">
                                  <Button
                                    type="button"
                                    className={`${outline} !min-h-10 !px-3`}
                                    disabled={busy}
                                    onClick={() => editEntry(e)}
                                  >
                                    Edit time
                                  </Button>
                                  <Button
                                    type="button"
                                    className={`${btn} !min-h-10 !px-3 border border-border bg-muted text-muted-foreground hover:bg-muted`}
                                    disabled={busy}
                                    onClick={() => setDeleteTarget(e)}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4">
                    <Empty
                      title="No hours logged"
                      detail="Add your first time entry for this week. Only your team sees your hours and notes."
                    />
                  </div>
                )}
                <div className="mt-6 border-t border-border pt-5">
                  <h3 className="font-semibold">Review history</h3>
                  {data.submissions.length ? (
                    <div className="mt-2 space-y-2">
                      {data.submissions.map((s) => (
                        <div
                          key={s.id}
                          className="rounded-xl bg-muted p-3 text-sm"
                        >
                          <div className="flex justify-between">
                            <span>Week of {fmtDate(s.week_start)}</span>
                            <b className="capitalize">{s.status}</b>
                          </div>
                          {s.review_comment && (
                            <p className="mt-2 text-muted-foreground">
                              {s.review_comment}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      Nothing submitted yet.
                    </p>
                  )}
                </div>
              </section>
            </div>
            {deleteTarget && (
              <div
                role="presentation"
                className="fixed inset-0 z-50 grid place-items-center bg-muted/45 p-4"
                onMouseDown={(event) =>
                  event.target === event.currentTarget &&
                  !busy &&
                  setDeleteTarget(null)
                }
                onKeyDown={(event) =>
                  event.key === "Escape" && !busy && setDeleteTarget(null)
                }
              >
                <div
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="employee-delete-title"
                  aria-describedby="employee-delete-description"
                  className={`${card} w-full max-w-md p-5`}
                >
                  <h2 id="employee-delete-title" className="text-xl font-bold">
                    Delete draft entry?
                  </h2>
                  <p
                    id="employee-delete-description"
                    className="mt-2 text-sm leading-5 text-muted-foreground"
                  >
                    This removes your {fmtDate(deleteTarget.work_date)} time
                    entry from your timesheet. This cannot be undone.
                  </p>
                  {error && (
                    <p
                      role="alert"
                      className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground"
                    >
                      {error}
                    </p>
                  )}
                  <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      autoFocus
                      className={outline}
                      disabled={busy}
                      onClick={() => setDeleteTarget(null)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      className={`${btn} border border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90`}
                      disabled={busy}
                      onClick={() => void remove()}
                    >
                      {busy ? "Deleting…" : "Delete entry"}
                    </Button>
                  </div>
                </div>
              </div>
            )}
            <EmployeeReviewQueue
              enabled={data.permissions.review_timesheets}
              employeeId={data.employee.id}
              timezone={data.timezone}
            />
          </>
        )
      )}
    </PortalLayout>
  );
}
