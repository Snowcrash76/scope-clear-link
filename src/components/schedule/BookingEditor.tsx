import { useEffect, useState, type MutableRefObject } from "react";
import { AlertTriangle, CalendarDays, Clock3, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { portalRequest } from "@/hooks/useEmployeePortal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { dateKey, type CalendarEvent, type ScheduleData } from "./scheduleUtils";

type BookingPayload = {
  title: string;
  project_id: string | null;
  date: string;
  start_time: string;
  end_time: string;
  notes: string;
  employee_ids: string[];
  overnight: boolean;
  allow_conflicts: boolean;
};
type ConflictResponse = { requires_confirmation: true; conflicts: { employee_name: string; title: string; date: string; start_time: string; end_time: string }[] };

export function BookingEditor({ data, event, initialDate, initialJobId, initialEmployeeId, onClose, onSaved, triggerRef }: {
  data: ScheduleData;
  event?: CalendarEvent | null;
  initialDate?: string;
  initialJobId?: string | null;
  onClose: () => void;
  onSaved: (id: string) => void;
  triggerRef: MutableRefObject<HTMLElement | null>;
  initialEmployeeId?: string | null;
}) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState<string>("");
  const [date, setDate] = useState(dateKey(new Date()));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [employeeIds, setEmployeeIds] = useState<string[]>([]);
  const [overnight, setOvernight] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [conflicts, setConflicts] = useState<ConflictResponse["conflicts"]>([]);
  const [confirming, setConfirming] = useState(false);
  const editing = Boolean(event);

  // Editing any fields invalidates the previous overlap acknowledgement.
  useEffect(() => {
    setConfirming(false);
    setConflicts([]);
  }, [title, projectId, date, startTime, endTime, notes, employeeIds, overnight]);

  useEffect(() => {
    if (!event) {
      setTitle("");
      setProjectId(initialJobId ?? "");
      setDate(initialDate ?? dateKey(new Date()));
      setStartTime("09:00");
      setEndTime("10:00");
      setNotes("");
      setEmployeeIds(initialEmployeeId ? [initialEmployeeId] : []);
      setOvernight(false);
      setError("");
      setConflicts([]);
      setConfirming(false);
      return;
    }
    setTitle(event.appointment.title);
    setProjectId(event.appointment.project_id ?? "");
    setDate(event.appointment.date);
    setStartTime(event.appointment.start_time.slice(0, 5));
    setEndTime(event.appointment.end_time.slice(0, 5));
    setNotes(event.appointment.notes ?? "");
    setEmployeeIds(event.assignments.map((assignment) => assignment.employee_id));
    setOvernight(event.endDate !== event.appointment.date);
    setError("");
    setConflicts([]);
    setConfirming(false);
  }, [event, initialDate, initialJobId, initialEmployeeId]);

  const invalid = !title.trim() || !date || !startTime || !endTime || (!overnight && endTime <= startTime) || (overnight && endTime >= startTime);
  const toggleEmployee = (id: string) => setEmployeeIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const submit = async (allowConflicts = false) => {
    if (invalid || pending) return;
    setPending(true);
    setError("");
    try {
      const body: BookingPayload = {
        title: title.trim(), project_id: projectId || null, date, start_time: startTime, end_time: endTime,
        notes: notes.trim(), employee_ids: employeeIds, overnight, allow_conflicts: allowConflicts,
      };
      const path = editing ? `/schedule/bookings/${event!.appointment.id}` : "/schedule/bookings";
      const result = await portalRequest<{ id?: string } | ConflictResponse>(path, body, editing ? "PATCH" : "POST");
      if ("requires_confirmation" in result && result.requires_confirmation) {
        setConflicts(result.conflicts ?? []);
        setConfirming(true);
        return;
      }
      if (!("id" in result) || !result.id) throw new Error("The booking could not be confirmed. Refresh the calendar before retrying.");
      onSaved(result.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The booking could not be saved. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return <Dialog open onOpenChange={(open) => { if (!open && !pending) onClose(); }}>
    <DialogContent className="sc-dialog sc-booking-dialog" onCloseAutoFocus={(e) => {
      e.preventDefault();
      if (triggerRef.current?.isConnected) triggerRef.current.focus();
      else document.getElementById("schedule-heading")?.focus();
    }}>
      <header className="sc-dialog-head">
        <div><span className="sc-eyebrow">{editing ? "UPDATE SCHEDULE" : "NEW SCHEDULE ITEM"}</span>
          <DialogTitle className="sc-modal-title">{editing ? "Edit booking" : "Add booking"}</DialogTitle>
          <DialogDescription>{editing ? "Change the booking details, crew, or timing." : "Give the team a clear plan for the work ahead."}</DialogDescription>
        </div>
      </header>
      <form className="sc-booking-form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
        <label className="sc-field sc-field-wide"><span>Booking title</span><input autoFocus aria-label="Booking title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} placeholder="e.g. Install kitchen cabinetry" /></label>
        <label className="sc-field"><span>Date</span><span className="sc-input-icon"><CalendarDays /><input aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></span></label>
        <label className="sc-field"><span>Job</span><select aria-label="Job" value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Standalone appointment</option>{data.jobs.map((job) => <option key={job.id} value={job.id}>{job.name}</option>)}</select></label>
        <label className="sc-field"><span>Start time</span><span className="sc-input-icon"><Clock3 /><input aria-label="Start time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required /></span></label>
        <label className="sc-field"><span>End time</span><span className="sc-input-icon"><Clock3 /><input aria-label="End time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} required /></span></label>
        <label className="sc-overnight"><input type="checkbox" checked={overnight} onChange={(e) => setOvernight(e.target.checked)} /><span><b>Finishes next day</b><small>Use this for work that continues past midnight.</small></span></label>
        <fieldset className="sc-crew-picker"><legend><Users /> Crew <small>Optional</small></legend>
          {data.employees.length ? <div className="sc-crew-options">{data.employees.map((person) => <label key={person.id}><input type="checkbox" checked={employeeIds.includes(person.id)} disabled={person.active === false && !employeeIds.includes(person.id)} onChange={() => toggleEmployee(person.id)} /><span>{person.name}{person.active === false ? " (inactive)" : ""}</span></label>)}</div> : <p>No team members are available.</p>}
        </fieldset>
        <label className="sc-field sc-field-wide"><span>Notes</span><textarea aria-label="Notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} placeholder="Access details, materials, or anything the crew should know" /></label>
        {!overnight && endTime && startTime && endTime <= startTime && <p className="sc-form-hint sc-form-error" role="alert">End time must be after start time. For an overnight booking, choose “Finishes next day”.</p>}
        {overnight && endTime && startTime && endTime >= startTime && <p className="sc-form-hint sc-form-error" role="alert">For a next-day finish, end time must be earlier than the start time.</p>}
        {error && <p className="sc-form-error sc-form-message" role="alert">{error}</p>}
        {confirming && <aside className="sc-conflict sc-server-conflict" role="alert">
          <b><AlertTriangle /> Crew overlap needs your review</b>
          <p>One or more selected team members already have a booking during this time. Review the overlaps, then choose Save anyway to keep this booking.</p>
          {conflicts.map((item, index) => <p key={`${item.employee_name}-${item.date}-${index}`}><strong>{item.employee_name}</strong> · {item.title} · {format(parseISO(item.date), "d MMM")} · {item.start_time.slice(0, 5)}–{item.end_time.slice(0, 5)}</p>)}
        </aside>}
        <footer className="sc-dialog-foot">
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>
          {confirming ? <Button type="button" disabled={pending} onClick={() => void submit(true)}>{pending ? "Saving…" : "Save anyway"}</Button> : <Button type="submit" disabled={pending || invalid}>{pending ? "Saving…" : editing ? "Save changes" : "Save booking"}</Button>}
        </footer>
      </form>
    </DialogContent>
  </Dialog>;
}
