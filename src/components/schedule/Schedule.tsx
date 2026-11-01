import { useEffect, useMemo, useRef, useState, type MutableRefObject, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { addDays, format, parseISO } from "date-fns";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, ExternalLink, List, MapPin, Phone, Plus, Users, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { localDate } from "../../../shared/employeePortal";
import { portalRequest, usePortal, usePortalSession } from "@/hooks/useEmployeePortal";
import { useAuth } from "@/hooks/useAuth";
import { useEmployeeAssistance } from "@/hooks/useEmployeeAssistance";
import { PortalLayout } from "@/components/employee/PortalLayout";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { BookingEditor } from "./BookingEditor";
import {
  appointmentConflicts, dateKey, jobColor, jobsWithoutBookingInRange, rangeTitle, shiftDate, timeLabel, toCalendarEvents,
  visibleDateRange, type CalendarEvent, type ScheduleData, type ScheduleLayout, type ScheduleView,
} from "./scheduleUtils";
import "./schedule.css";

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function ScheduleSkeleton() {
  return <div className="sc-skeleton" aria-label="Loading schedule">{Array.from({ length: 5 }, (_, i) => <i key={i} />)}</div>;
}

function DetailDialog({ event, data, events, onClose, triggerRef, previewMemberId, href, canManage, onEdit, onStartCancel, onConfirmCancel, onAbortCancel, cancelConfirm, cancelPending, cancelError }: {
  event: CalendarEvent; data: ScheduleData; events: CalendarEvent[]; onClose: () => void;
  triggerRef: MutableRefObject<HTMLElement | null>;
  previewMemberId?: string | null; href: (path: string) => string;
  canManage: boolean; onEdit: () => void; onStartCancel: () => void; onConfirmCancel: () => void; onAbortCancel: () => void;
  cancelConfirm: boolean; cancelPending: boolean; cancelError: string;
}) {
  const conflicts = appointmentConflicts(event, events);
  const address = event.job?.client_address;
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="sc-dialog !block" onCloseAutoFocus={(event) => {
      event.preventDefault();
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
      else document.getElementById("schedule-heading")?.focus();
    }}>
      <header className="sc-dialog-head"><div><span className="sc-eyebrow">SCHEDULE DETAIL</span><DialogTitle className="sc-modal-title">{event.appointment.title}</DialogTitle><DialogDescription className="sr-only">Booking details for {format(parseISO(event.appointment.date), "EEEE, d MMMM yyyy")}.</DialogDescription></div></header>
      <div className="sc-dialog-body">
        <p className="sc-detail-line"><CalendarDays />{format(parseISO(event.appointment.date), "EEEE, d MMMM yyyy")}</p>
        <p className="sc-detail-line"><Clock3 />{timeLabel(event.appointment.start_time)} – {timeLabel(event.appointment.end_time)}{event.endDate !== event.appointment.date ? " (next day)" : ""}</p>
        {event.job && <p className="sc-detail-line"><span className="sc-job-dot" style={{ background: jobColor(event.job.id).foreground }} />{event.job.name}</p>}
        <div className="sc-detail-block"><b><Users /> Crew</b>{event.assignments.length ? <div className="sc-crew-list">{event.assignments.map((assignment) => <span key={assignment.id}>{assignment.employee_name ?? data.employees.find((person) => person.id === assignment.employee_id)?.name ?? "Team member"}</span>)}</div> : <p>No crew assigned.</p>}</div>
        {address && <p className="sc-detail-line"><MapPin /><a href={`https://maps.google.com/?q=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">{address}<ExternalLink className="sc-link-icon" /></a></p>}
        {event.job?.client_phone && <p className="sc-detail-line"><Phone /><a href={`tel:${event.job.client_phone}`}>{event.job.client_phone}</a></p>}
        {event.appointment.notes && <div className="sc-notes">{event.appointment.notes}</div>}
        {conflicts.length > 0 && <aside className="sc-conflict"><b>Possible schedule overlap · local times</b><p>These displayed wall-clock times overlap. Repeated or missing times at daylight-saving transitions are not resolved to UTC in this read-only view.</p>{conflicts.map((conflict, index) => <p key={`${conflict.appointment}-${index}`}>{conflict.employee} is also assigned to {conflict.appointment} at {conflict.time}.</p>)}</aside>}
      </div>
      {cancelConfirm && <div className="sc-cancel-confirm" role="alertdialog" aria-labelledby="sc-cancel-title">
        <b id="sc-cancel-title">Cancel this booking?</b><p>This removes the booking and its crew assignments from the schedule.</p>
        {cancelError && <p className="sc-form-error" role="alert">{cancelError}</p>}
        <div><Button variant="outline" disabled={cancelPending} onClick={onAbortCancel}>Keep booking</Button><Button variant="destructive" disabled={cancelPending} onClick={onConfirmCancel}>{cancelPending ? "Cancelling…" : "Confirm cancellation"}</Button></div>
      </div>}
      <footer className="sc-dialog-foot">
        {canManage ? <div className="sc-detail-actions">{!cancelConfirm && <><Button variant="outline" className="min-h-11" onClick={onEdit}>Edit booking</Button><Button variant="destructive" className="min-h-11" onClick={onStartCancel}>Cancel booking</Button></>}</div> : event.job && (!previewMemberId || event.assignments.some((assignment) => assignment.employee_id === previewMemberId)) ? <Link className="sc-manage-link" to={href(`/employee/jobs/${event.job.id}`)}>Open job details <ArrowRight /></Link> : <span className="sc-readonly-note">Your schedule is view-only.</span>}
        <Button variant="outline" className="min-h-11" onClick={onClose} disabled={cancelPending}>Done</Button>
      </footer>
    </DialogContent>
  </Dialog>;
}

function EventCard({ event, data, onOpen, compact = false }: {
  event: CalendarEvent; data: ScheduleData; onOpen: (trigger: HTMLButtonElement) => void; compact?: boolean;
}) {
  const color = jobColor(event.appointment.project_id ?? event.appointment.id);
  return <button type="button" className={`sc-event${compact ? " is-compact" : ""}`} style={{ background: color.background, color: color.foreground, borderLeftColor: color.foreground }} onClick={(e) => onOpen(e.currentTarget)} aria-label={`${event.appointment.title}, ${timeLabel(event.appointment.start_time)} to ${timeLabel(event.appointment.end_time)}, ${event.assignments.length} crew`}>
    <span className="sc-event-kind">BOOKING</span><b>{event.job?.name ?? event.appointment.title}</b>
    <span>{timeLabel(event.appointment.start_time)} – {timeLabel(event.appointment.end_time)}{event.endDate !== event.appointment.date ? " · next day" : ""}</span>
    {!compact && <span className="sc-event-crew">{event.assignments.length ? event.assignments.map((assignment) => <i key={assignment.id} title={assignment.employee_name}>{initials(assignment.employee_name ?? data.employees.find((p) => p.id === assignment.employee_id)?.name ?? "?")}</i>) : <small>No crew</small>}</span>}
  </button>;
}

export default function Schedule() {
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const session = usePortalSession(!!user);
  const assistance = useEmployeeAssistance();
  const preview = assistance.active;
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<ScheduleView>(() => window.matchMedia("(max-width: 767px)").matches ? "day" : "week");
  const [layout, setLayout] = useState<ScheduleLayout>(() => (localStorage.getItem("schedule-layout") as ScheduleLayout) || "team");
  const [listMode, setListMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => parseISO(localDate(new Date(), "Australia/Sydney")));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [editorEvent, setEditorEvent] = useState<CalendarEvent | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorDate, setEditorDate] = useState<string | undefined>();
  const [editorJobId, setEditorJobId] = useState<string | null>(null);
  const [editorEmployeeId, setEditorEmployeeId] = useState<string | null>(null);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const bookingTriggerRef = useRef<HTMLElement | null>(null);
  const jobFilter = searchParams.get("job");
  const range = useMemo(() => visibleDateRange(selectedDate, view), [selectedDate, view]);
  const query = usePortal<ScheduleData>(`/schedule?from=${range.from}&to=${range.to}`, !!user && !session.isLoading && !session.error && !!(session.data?.employee || session.data?.canManageTeam));

  useEffect(() => { localStorage.setItem("schedule-layout", layout); }, [layout]);
  const data = query.data;
  const isManager = Boolean(data?.canManage && !preview);
  const ownEmployeeId = preview ? assistance.memberId : session.data?.employee?.id;
  const events = useMemo(() => data ? toCalendarEvents(data).filter((event) => isManager || Boolean(ownEmployeeId && event.assignments.some((assignment) => assignment.employee_id === ownEmployeeId))) : [], [data, isManager, ownEmployeeId]);
  const visibleEvents = useMemo(() => events.filter((event) => !jobFilter || event.appointment.project_id === jobFilter), [events, jobFilter]);
  const dates = range.dates;
  const todayKey = data ? new Intl.DateTimeFormat("en-CA", { timeZone: data.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) : dateKey(new Date());
  const selectedDayEvents = visibleEvents.filter((event) => event.appointment.date === dateKey(selectedDate) || (event.appointment.date < dateKey(selectedDate) && event.endDate >= dateKey(selectedDate)));
  // The endpoint is range-scoped: this is only a view-local list, never a claim
  // that a job has no booking outside the dates currently loaded.
  const jobsWithoutBookingInView = data ? jobsWithoutBookingInRange(data.jobs, visibleEvents).filter((job) => isManager || Boolean(ownEmployeeId && data.assignments.some((assignment) => assignment.employee_id === ownEmployeeId && assignment.project_id === job.id))) : [];

  const openEvent = (event: CalendarEvent, trigger?: HTMLElement) => {
    if (trigger) bookingTriggerRef.current = trigger;
    setCancelConfirm(false);
    setCancelError("");
    setSelectedEvent(event);
  };
  const openEditor = (trigger?: HTMLElement, options: { date?: string; jobId?: string | null; employeeId?: string | null; event?: CalendarEvent | null } = {}) => {
    if (trigger) bookingTriggerRef.current = trigger;
    setEditorEvent(options.event ?? null);
    if (options.event) setSelectedEvent(null);
    setEditorDate(options.date);
    setEditorJobId(options.jobId ?? null);
    setEditorEmployeeId(options.employeeId ?? null);
    setEditorOpen(true);
  };
  const refreshSchedule = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["employee-portal"] }),
      queryClient.invalidateQueries({ predicate: (cached) => cached.queryKey.some((part) => typeof part === "string" && part.toLowerCase().includes("appointment")) }),
    ]);
    await query.refetch();
  };
  const removeBooking = async () => {
    if (!selectedEvent || cancelPending) return;
    setCancelPending(true);
    setCancelError("");
    try {
      await portalRequest(`/schedule/bookings/${selectedEvent.appointment.id}`, {}, "DELETE");
      setCancelConfirm(false);
      setSelectedEvent(null);
      await refreshSchedule();
    } catch (cause) {
      setCancelError(cause instanceof Error ? cause.message : "The booking could not be cancelled. Please retry.");
    } finally {
      setCancelPending(false);
    }
  };
  const allByDate = (day: Date) => visibleEvents.filter((event) => event.appointment.date === dateKey(day) || (event.appointment.date < dateKey(day) && event.endDate >= dateKey(day)));
  const onCellKey = (event: KeyboardEvent<HTMLDivElement>, bookings: CalendarEvent[]) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" && bookings[0]) {
      event.preventDefault();
      openEvent(bookings[0], event.currentTarget);
      return;
    }
    const offsets: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const selector = event.currentTarget.classList.contains("sc-month-cell") ? ".sc-month-cell" : ".sc-grid-cell";
    const cells = Array.from(event.currentTarget.closest(".sc-calendar")?.querySelectorAll<HTMLElement>(selector) ?? []);
    cells[cells.indexOf(event.currentTarget) + offsets[event.key]]?.focus();
  };
  const dateHeader = (day: Date) => <span className={`sc-date-heading${dateKey(day) === todayKey ? " is-today" : ""}`}><small>{format(day, "EEE")}</small><b>{format(day, "d")}</b></span>;

  if (authLoading || (user && session.isLoading)) return <div className="sc-page"><ScheduleSkeleton /></div>;
  if (!user) return <div className="sc-denied"><h1>Sign in to view your schedule</h1><Link to="/login">Continue to sign in</Link></div>;
  if (session.error) return <div className="sc-denied" role="alert"><h1>Unable to verify schedule access</h1><p>{session.error.message}</p><Button variant="outline" onClick={() => session.refetch()}>Retry access check</Button></div>;
  if (!session.data?.employee && !session.data?.canManageTeam) return <div className="sc-denied"><h1>Schedule unavailable</h1><p>Your account does not have access to this schedule.</p><Link to="/dashboard">Back to dashboard</Link></div>;

  const calendar = <main className="sc-page">
    <header className="sc-page-heading">
      <div><div className="sc-eyebrow">FIELD OPERATIONS</div><h1 id="schedule-heading" tabIndex={-1}>Schedule</h1><p>One clear view of the work ahead.</p></div>
      {isManager ? <Button className="sc-add-booking" onClick={(event) => openEditor(event.currentTarget, { date: dateKey(selectedDate), jobId: jobFilter })}><Plus />Add booking</Button> : <div className="sc-readonly-badge"><span />Your assignments</div>}
    </header>
    <section className="sc-kpi-strip" aria-label="Schedule overview">
      <article><span>Appointments in this view</span><b>{query.isLoading ? "—" : query.error ? "Unavailable" : visibleEvents.length}</b><small>Scheduled items in the selected date range</small></article>
      <article><span>Team members scheduled</span><b>{query.isLoading ? "—" : query.error ? "Unavailable" : new Set(visibleEvents.flatMap((event) => event.assignments.map((assignment) => assignment.employee_id))).size}</b><small>Distinct assigned team members in this view</small></article>
      <article><span>Jobs without a booking in this view</span><b>{query.isLoading ? "—" : query.error ? "Unavailable" : jobsWithoutBookingInView.length}</b><small>View-local list only · other dates are not included</small></article>
    </section>
    <section className="sc-toolbar" aria-label="Schedule controls">
      <div className="sc-date-controls">
        <button className="sc-today" onClick={() => setSelectedDate(parseISO(localDate(new Date(), data?.timezone ?? "Australia/Sydney")))}>Today</button>
        <button className="sc-icon-button" aria-label="Previous date range" onClick={() => setSelectedDate((date) => shiftDate(date, view, -1))}><ArrowLeft /></button>
        <button className="sc-icon-button" aria-label="Next date range" onClick={() => setSelectedDate((date) => shiftDate(date, view, 1))}><ArrowRight /></button>
        <h2>{rangeTitle(selectedDate, view)}</h2>
        <input aria-label="Choose date" type="date" value={dateKey(selectedDate)} onChange={(event) => event.target.value && setSelectedDate(parseISO(event.target.value))} />
      </div>
      <div className="sc-view-actions">
        <div className="sc-segment" aria-label="Calendar view">{(["day", "week", "month"] as const).map((item) => <button key={item} className={view === item ? "is-active" : ""} onClick={() => setView(item)}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>
        <button className={`sc-list-toggle${listMode ? " is-active" : ""}`} aria-label="Toggle list view" aria-pressed={listMode} onClick={() => setListMode((current) => !current)}><List />List</button>
      </div>
      <div className="sc-toolbar-bottom"><span className="sc-zone"><Clock3 />{data?.timezone ?? "Australia/Sydney"} · local business time</span>
        {isManager && <div className="sc-segment sc-layout-toggle" aria-label="Group schedule by">{(["team", "job"] as const).map((item) => <button key={item} className={layout === item ? "is-active" : ""} onClick={() => setLayout(item)}>{item === "team" ? "By team" : "By job"}</button>)}</div>}
        {jobFilter && <Link className="sc-filter-chip" to={assistance.href("/schedule")}>Filtered job · {data?.jobs.find((job) => job.id === jobFilter)?.name ?? "Selected job"} <X /></Link>}
      </div>
    </section>

    {query.isLoading ? <ScheduleSkeleton /> : query.error ? <section className="sc-error" role="alert"><CalendarDays /><h2>Schedule could not load</h2><p>{query.error.message}</p><Button onClick={() => query.refetch()}>Retry</Button></section> : data && <>
      <div className="sc-content-grid">
        <section className="sc-calendar" aria-label={`${rangeTitle(selectedDate, view)} calendar`}>
          {view === "day" && <nav className="sc-day-strip" aria-label="Choose a day">{Array.from({ length: 9 }, (_, i) => addDays(selectedDate, i - 4)).map((day) => <button key={dateKey(day)} className={dateKey(day) === dateKey(selectedDate) ? "is-selected" : ""} onClick={() => setSelectedDate(day)} aria-label={`${format(day, "EEEE d MMMM")}, ${dateKey(day) === dateKey(selectedDate) ? `${allByDate(day).length} bookings` : "load bookings"}`}>{dateHeader(day)}<small>{dateKey(day) === dateKey(selectedDate) ? allByDate(day).length : "View"}</small></button>)}</nav>}
          {listMode ? <div className="sc-list-view">{dates.flatMap((day) => {
            const dayEvents = allByDate(day);
            return dayEvents.map((event) => <div className="sc-list-row" key={`${dateKey(day)}-${event.appointment.id}`}><span>{format(day, "EEE d MMM")}</span><EventCard event={event} data={data} onOpen={(trigger) => openEvent(event, trigger)} /></div>);
          })}{visibleEvents.length === 0 && <div className="sc-empty">Nothing scheduled in this range.</div>}</div>
             : view === "day" ? <section className="sc-day-view"><div className="sc-day-title">{format(selectedDate, "EEEE, d MMMM")} <span>{selectedDayEvents.length} {selectedDayEvents.length === 1 ? "booking" : "bookings"}</span></div>{selectedDayEvents.length ? selectedDayEvents.map((event) => <EventCard key={event.appointment.id} event={event} data={data} onOpen={(trigger) => openEvent(event, trigger)} />) : <div className="sc-empty"><CalendarDays /><b>A clear day.</b><span>No bookings are scheduled.</span>{isManager && <Button onClick={(event) => openEditor(event.currentTarget, { date: dateKey(selectedDate), jobId: jobFilter })}><Plus />Add booking</Button>}</div>}</section>
            : view === "month" ? <div className="sc-month-grid" role="grid" aria-label={`${rangeTitle(selectedDate, view)} month`}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => <div className="sc-month-weekday" key={label}>{label}</div>)}
               {dates.map((day) => <div className={`sc-month-cell${format(day, "M") !== format(selectedDate, "M") ? " is-outside" : ""}`} key={dateKey(day)} role="gridcell" tabIndex={0} aria-label={`${format(day, "EEEE d MMMM")}, ${allByDate(day).length} bookings`} onClick={(event) => { if (isManager && event.target === event.currentTarget) openEditor(event.currentTarget, { date: dateKey(day), jobId: jobFilter }); }} onKeyDown={(event) => { if (isManager && event.key === "Enter" && allByDate(day).length === 0) { event.preventDefault(); openEditor(event.currentTarget, { date: dateKey(day), jobId: jobFilter }); return; } onCellKey(event, allByDate(day)); }}>
                <button className={`sc-month-date${dateKey(day) === todayKey ? " is-today" : ""}`} onClick={(event) => { if (isManager) openEditor(event.currentTarget, { date: dateKey(day), jobId: jobFilter }); else { setSelectedDate(day); setView("day"); } }} aria-label={`${isManager ? "Add booking on" : "View"} ${format(day, "EEEE d MMMM")}`}>{format(day, "d")}</button>
                {allByDate(day).slice(0, 3).map((event) => <EventCard key={event.appointment.id} event={event} data={data} compact onOpen={(trigger) => openEvent(event, trigger)} />)}
                {allByDate(day).length > 3 && <span className="sc-month-more">+{allByDate(day).length - 3} more</span>}
              </div>)}
            </div>
            : <div className={`sc-grid ${layout === "job" && isManager ? "by-job" : ""}`}>
              <div className="sc-grid-head"><span className="sc-row-label">{layout === "job" && isManager ? "JOB" : "TEAM"}</span>{dates.map((day) => <div key={dateKey(day)}>{dateHeader(day)}</div>)}</div>
              {(layout === "job" && isManager ? [...data.jobs.map((job) => ({ id: job.id, name: job.name })), { id: "standalone", name: "Standalone appointments" }] : [...data.employees.filter((person) => !preview || person.id === assistance.memberId).map((person) => ({ id: person.id, name: person.name })), ...(isManager ? [{ id: "unassigned", name: "Unassigned bookings" }] : [])]).map((row) => <div className="sc-grid-row" key={row.id}><div className="sc-row-label">{row.name}</div>{dates.map((day) => {
                const cellEvents = allByDate(day).filter((event) => row.id === "standalone" ? event.appointment.project_id === null : row.id === "unassigned" ? event.assignments.length === 0 : layout === "job" && isManager ? event.appointment.project_id === row.id : event.assignments.some((assignment) => assignment.employee_id === row.id));
                 return <div className={`sc-grid-cell${!cellEvents.length && isManager ? " is-addable" : ""}`} key={dateKey(day)} tabIndex={0} aria-label={`${row.name}, ${format(day, "EEEE d MMMM")}, ${cellEvents.length} bookings${!cellEvents.length && isManager ? ", add booking" : ""}`} onClick={(event) => { if (isManager && !cellEvents.length) openEditor(event.currentTarget, { date: dateKey(day), jobId: layout === "job" && isManager && row.id !== "standalone" ? row.id : jobFilter, employeeId: layout === "team" && row.id !== "unassigned" ? row.id : null }); }} onKeyDown={(event) => { if (isManager && event.key === "Enter" && !cellEvents.length) { event.preventDefault(); openEditor(event.currentTarget, { date: dateKey(day), jobId: layout === "job" && isManager && row.id !== "standalone" ? row.id : jobFilter, employeeId: layout === "team" && row.id !== "unassigned" ? row.id : null }); return; } onCellKey(event, cellEvents); }}>
                  {cellEvents.map((event) => <EventCard key={event.appointment.id} event={event} data={data} onOpen={(trigger) => openEvent(event, trigger)} />)}
                  {!cellEvents.length && <span className="sc-cell-empty">—</span>}
                </div>;
              })}</div>)}
              {data.employees.length === 0 && layout === "team" && <div className="sc-empty">No team members are available for this schedule.</div>}
            </div>}
        </section>
        <aside className="sc-unscheduled"><div className="sc-panel-heading"><div><span className="sc-eyebrow">CURRENT DATE RANGE</span><h2>Jobs without a booking in this view</h2></div><span>{jobsWithoutBookingInView.length}</span></div><p className="sc-panel-intro">A read-only job list for this date range. Jobs may have bookings outside the dates shown.</p>
           {jobsWithoutBookingInView.length ? <ul>{jobsWithoutBookingInView.map((job) => <li key={job.id}><span className="sc-job-dot" style={{ background: jobColor(job.id).foreground }} /><div><b>{job.name}</b>{job.client_name && <small>{job.client_name}</small>}{isManager ? <button type="button" className="sc-job-add" onClick={(event) => openEditor(event.currentTarget, { date: dateKey(selectedDate), jobId: job.id })}>Add booking for this job <ArrowRight /></button> : <Link to={assistance.href(`/employee/jobs/${job.id}`)}>Open job assignment details <ArrowRight /></Link>}</div></li>)}</ul> : <div className="sc-empty-small">Each listed job has a booking in this range.</div>}
           <p className="sc-panel-foot">{isManager ? "Select a job to start a booking with it already linked." : "Your schedule shows only your own assignments."}</p>
        </aside>
      </div>
       <div className="sc-mobile-management">{isManager ? <><span>Manage the team schedule</span><Button onClick={(event) => openEditor(event.currentTarget, { date: dateKey(selectedDate), jobId: jobFilter })}><Plus />Add booking</Button></> : <><span>Your assignments</span><Link to={assistance.href("/employee")}>Back to employee home <ArrowRight /></Link></>}</div>
      <footer className="sc-legend"><span className="sc-legend-mark" />Stable job colour · “BOOKING” label · crew initials when available</footer>
    </>}
       {selectedEvent && data && <DetailDialog event={selectedEvent} data={{ ...data, canManage: isManager }} events={visibleEvents} onClose={() => setSelectedEvent(null)} triggerRef={bookingTriggerRef} previewMemberId={preview ? assistance.memberId : null} href={assistance.href} canManage={isManager} onEdit={() => openEditor(undefined, { event: selectedEvent })} onStartCancel={() => { setCancelError(""); setCancelConfirm(true); }} onConfirmCancel={() => void removeBooking()} onAbortCancel={() => setCancelConfirm(false)} cancelConfirm={cancelConfirm} cancelPending={cancelPending} cancelError={cancelError} />}
       {editorOpen && data && isManager && <BookingEditor data={data} event={editorEvent} initialDate={editorDate} initialJobId={editorJobId} initialEmployeeId={editorEmployeeId} triggerRef={bookingTriggerRef} onClose={() => { setEditorOpen(false); setEditorEvent(null); setSelectedEvent(null); }} onSaved={async () => { setEditorOpen(false); setEditorEvent(null); setSelectedEvent(null); await refreshSchedule(); }} />}
  </main>;
  return preview || session.data.employee
    ? <PortalLayout>{calendar}</PortalLayout>
    : <AppShell>{calendar}</AppShell>;
}
