import { useEffect, useMemo, useRef, useState, type MutableRefObject, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { addDays, format, parseISO } from "date-fns";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, ExternalLink, List, MapPin, Phone, Users, X } from "lucide-react";
import { localDate } from "../../../shared/employeePortal";
import { usePortal, usePortalSession } from "@/hooks/useEmployeePortal";
import { useAuth } from "@/hooks/useAuth";
import { PortalLayout } from "@/components/employee/PortalLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
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

function DetailDialog({ event, data, events, onClose, triggerRef }: {
  event: CalendarEvent; data: ScheduleData; events: CalendarEvent[]; onClose: () => void;
  triggerRef: MutableRefObject<HTMLElement | null>;
}) {
  const conflicts = appointmentConflicts(event, events);
  const address = event.job?.client_address;
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="sc-dialog !block" onCloseAutoFocus={(event) => {
      event.preventDefault();
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
      else document.getElementById("schedule-heading")?.focus();
    }}>
      <header className="sc-dialog-head"><div><span className="sc-eyebrow">SCHEDULE DETAIL</span><DialogTitle className="sc-modal-title">{event.appointment.title}</DialogTitle><DialogDescription className="sr-only">Read-only booking details for {format(parseISO(event.appointment.date), "EEEE, d MMMM yyyy")}.</DialogDescription></div></header>
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
      <footer className="sc-dialog-foot">
        {event.job ? <Link className="sc-manage-link" to={data.canManage ? `/team/jobs/${event.job.id}/staff` : `/employee/jobs/${event.job.id}`}>{data.canManage ? "Open job assignment management" : "Open job details"} <ArrowRight /></Link> : <span className="sc-readonly-note">Schedule details are read-only.</span>}
        <Button variant="outline" className="min-h-11" onClick={onClose}>Done</Button>
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
  const { user, loading: authLoading } = useAuth();
  const session = usePortalSession(!!user);
  const [searchParams] = useSearchParams();
  const [view, setView] = useState<ScheduleView>(() => window.matchMedia("(max-width: 767px)").matches ? "day" : "week");
  const [layout, setLayout] = useState<ScheduleLayout>(() => (localStorage.getItem("schedule-layout") as ScheduleLayout) || "team");
  const [listMode, setListMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => parseISO(localDate(new Date(), "Australia/Sydney")));
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const bookingTriggerRef = useRef<HTMLElement | null>(null);
  const jobFilter = searchParams.get("job");
  const range = useMemo(() => visibleDateRange(selectedDate, view), [selectedDate, view]);
  const query = usePortal<ScheduleData>(`/schedule?from=${range.from}&to=${range.to}`, !!user && !session.isLoading && !session.error && !!(session.data?.employee || session.data?.canManageTeam));

  useEffect(() => { localStorage.setItem("schedule-layout", layout); }, [layout]);
  const data = query.data;
  const events = useMemo(() => data ? toCalendarEvents(data) : [], [data]);
  const visibleEvents = useMemo(() => events.filter((event) => !jobFilter || event.appointment.project_id === jobFilter), [events, jobFilter]);
  const dates = range.dates;
  const todayKey = data ? new Intl.DateTimeFormat("en-CA", { timeZone: data.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()) : dateKey(new Date());
  const selectedDayEvents = visibleEvents.filter((event) => event.appointment.date === dateKey(selectedDate) || (event.appointment.date < dateKey(selectedDate) && event.endDate >= dateKey(selectedDate)));
  // The endpoint is range-scoped: this is only a view-local list, never a claim
  // that a job has no booking outside the dates currently loaded.
  const jobsWithoutBookingInView = data ? jobsWithoutBookingInRange(data.jobs, visibleEvents) : [];

  const openEvent = (event: CalendarEvent, trigger?: HTMLElement) => {
    if (trigger) bookingTriggerRef.current = trigger;
    setSelectedEvent(event);
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
      <div className="sc-readonly-badge"><span />Read-only calendar</div>
    </header>
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
        {data?.canManage && <div className="sc-segment sc-layout-toggle" aria-label="Group schedule by">{(["team", "job"] as const).map((item) => <button key={item} className={layout === item ? "is-active" : ""} onClick={() => setLayout(item)}>{item === "team" ? "By team" : "By job"}</button>)}</div>}
        {jobFilter && <Link className="sc-filter-chip" to="/schedule">Filtered job · {data?.jobs.find((job) => job.id === jobFilter)?.name ?? "Selected job"} <X /></Link>}
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
            : view === "day" ? <section className="sc-day-view"><div className="sc-day-title">{format(selectedDate, "EEEE, d MMMM")} <span>{selectedDayEvents.length} {selectedDayEvents.length === 1 ? "booking" : "bookings"}</span></div>{selectedDayEvents.length ? selectedDayEvents.map((event) => <EventCard key={event.appointment.id} event={event} data={data} onOpen={(trigger) => openEvent(event, trigger)} />) : <div className="sc-empty"><CalendarDays /><b>A clear day.</b><span>No bookings are scheduled.</span></div>}</section>
            : view === "month" ? <div className="sc-month-grid" role="grid" aria-label={`${rangeTitle(selectedDate, view)} month`}>
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => <div className="sc-month-weekday" key={label}>{label}</div>)}
              {dates.map((day) => <div className={`sc-month-cell${format(day, "M") !== format(selectedDate, "M") ? " is-outside" : ""}`} key={dateKey(day)} role="gridcell" tabIndex={0} aria-label={`${format(day, "EEEE d MMMM")}, ${allByDate(day).length} bookings`} onKeyDown={(event) => onCellKey(event, allByDate(day))}>
                <button className={`sc-month-date${dateKey(day) === todayKey ? " is-today" : ""}`} onClick={() => { setSelectedDate(day); setView("day"); }} aria-label={`View ${format(day, "EEEE d MMMM")}`}>{format(day, "d")}</button>
                {allByDate(day).slice(0, 3).map((event) => <EventCard key={event.appointment.id} event={event} data={data} compact onOpen={(trigger) => openEvent(event, trigger)} />)}
                {allByDate(day).length > 3 && <span className="sc-month-more">+{allByDate(day).length - 3} more</span>}
              </div>)}
            </div>
            : <div className={`sc-grid ${layout === "job" && data.canManage ? "by-job" : ""}`}>
              <div className="sc-grid-head"><span className="sc-row-label">{layout === "job" && data.canManage ? "JOB" : "TEAM"}</span>{dates.map((day) => <div key={dateKey(day)}>{dateHeader(day)}</div>)}</div>
              {(layout === "job" && data.canManage ? data.jobs.map((job) => ({ id: job.id, name: job.name })) : data.employees.map((person) => ({ id: person.id, name: person.name }))).map((row) => <div className="sc-grid-row" key={row.id}><div className="sc-row-label">{row.name}</div>{dates.map((day) => {
                const cellEvents = allByDate(day).filter((event) => layout === "job" && data.canManage ? event.appointment.project_id === row.id : event.assignments.some((assignment) => assignment.employee_id === row.id));
                return <div className="sc-grid-cell" key={dateKey(day)} tabIndex={0} aria-label={`${row.name}, ${format(day, "EEEE d MMMM")}, ${cellEvents.length} bookings`} onKeyDown={(event) => onCellKey(event, cellEvents)}>
                  {cellEvents.map((event) => <EventCard key={event.appointment.id} event={event} data={data} onOpen={(trigger) => openEvent(event, trigger)} />)}
                  {!cellEvents.length && <span className="sc-cell-empty">—</span>}
                </div>;
              })}</div>)}
              {data.employees.length === 0 && layout === "team" && <div className="sc-empty">No team members are available for this schedule.</div>}
            </div>}
        </section>
        <aside className="sc-unscheduled"><div className="sc-panel-heading"><div><span className="sc-eyebrow">CURRENT DATE RANGE</span><h2>Jobs without a booking in this view</h2></div><span>{jobsWithoutBookingInView.length}</span></div><p className="sc-panel-intro">A read-only job list for this date range. Jobs may have bookings outside the dates shown.</p>
          {jobsWithoutBookingInView.length ? <ul>{jobsWithoutBookingInView.map((job) => <li key={job.id}><span className="sc-job-dot" style={{ background: jobColor(job.id).foreground }} /><div><b>{job.name}</b>{job.client_name && <small>{job.client_name}</small>}<Link to={data.canManage ? `/team/jobs/${job.id}/staff` : `/employee/jobs/${job.id}`}>Open job assignment details <ArrowRight /></Link></div></li>)}</ul> : <div className="sc-empty-small">Each listed job has a booking in this range.</div>}
          <p className="sc-panel-foot">Schedule creation and changes remain in existing assignment management.</p>
        </aside>
      </div>
      <div className="sc-mobile-management"><span>Read-only view</span><Link to={data.canManage ? (jobFilter ? `/team/assignments?job=${jobFilter}` : "/team/assignments") : "/employee"}>{data.canManage ? "Open assignment management" : "Back to employee home"} <ArrowRight /></Link></div>
      <footer className="sc-legend"><span className="sc-legend-mark" />Stable job colour · “BOOKING” label · crew initials when available</footer>
    </>}
      {selectedEvent && data && <DetailDialog event={selectedEvent} data={data} events={visibleEvents} onClose={() => setSelectedEvent(null)} triggerRef={bookingTriggerRef} />}
  </main>;
  return session.data.employee ? <PortalLayout>{calendar}</PortalLayout> : calendar;
}
