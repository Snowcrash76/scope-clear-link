import { addDays, addMonths, addWeeks, format, parseISO, startOfMonth, startOfWeek } from "date-fns";

export type ScheduleView = "day" | "week" | "month";
export type ScheduleLayout = "team" | "job";
export type ScheduleAppointment = {
  id: string;
  project_id: string | null;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
  notes?: string | null;
};
export type ScheduleAssignment = {
  id: string;
  employee_id: string;
  project_id: string;
  appointment_id: string;
  date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  employee_name?: string;
};
export type ScheduleJob = {
  id: string;
  name: string;
  client_name?: string;
  client_address: string | null;
  client_phone: string | null;
};
export type ScheduleData = {
  timezone: string;
  canManage: boolean;
  jobs: ScheduleJob[];
  employees: { id: string; name: string }[];
  appointments: ScheduleAppointment[];
  assignments: ScheduleAssignment[];
};
export type CalendarEvent = {
  appointment: ScheduleAppointment;
  job: ScheduleJob | undefined;
  assignments: ScheduleAssignment[];
  endDate: string;
};

export function dateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function shiftDate(date: Date, view: ScheduleView, direction: number): Date {
  if (view === "day") return addDays(date, direction);
  if (view === "week") return addWeeks(date, direction);
  return addMonths(date, direction);
}

export function visibleDateRange(date: Date, view: ScheduleView): { from: string; to: string; dates: Date[] } {
  let start: Date;
  let count: number;
  if (view === "day") {
    start = date;
    count = 1;
  } else if (view === "week") {
    start = startOfWeek(date, { weekStartsOn: 1 });
    count = 7;
  } else {
    start = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
    const last = startOfWeek(addDays(addMonths(startOfMonth(date), 1), -1), { weekStartsOn: 1 });
    count = Math.round((last.getTime() - start.getTime()) / 86400000) + 7;
  }
  const dates = Array.from({ length: count }, (_, index) => addDays(start, index));
  return { from: dateKey(dates[0]), to: dateKey(dates[dates.length - 1]), dates };
}

export function eventEndDate(appointment: ScheduleAppointment): string {
  const start = appointment.start_time.slice(0, 5);
  const end = appointment.end_time.slice(0, 5);
  return end <= start ? dateKey(addDays(parseISO(appointment.date), 1)) : appointment.date;
}

export function toCalendarEvents(data: ScheduleData): CalendarEvent[] {
  return data.appointments.map((appointment) => ({
    appointment,
    job: data.jobs.find((job) => job.id === appointment.project_id),
    assignments: data.assignments.filter((assignment) => assignment.appointment_id === appointment.id),
    endDate: eventEndDate(appointment),
  }));
}

/** Returns only jobs with no appointment in the supplied visible range. */
export function jobsWithoutBookingInRange(jobs: ScheduleJob[], events: CalendarEvent[]): ScheduleJob[] {
  return jobs.filter((job) => !events.some((event) => event.appointment.project_id === job.id));
}

const JOB_COLORS = [
  ["hsl(var(--primary-soft))", "hsl(var(--primary))"],
  ["hsl(var(--warning-soft))", "hsl(var(--warning))"],
  ["hsl(var(--success-soft))", "hsl(var(--success))"],
  ["hsl(var(--purple-soft))", "hsl(var(--purple))"],
  ["hsl(var(--muted))", "hsl(var(--foreground))"],
  ["hsl(var(--destructive)/.08)", "hsl(var(--destructive))"],
  ["hsl(var(--primary)/.05)", "hsl(var(--primary))"],
  ["hsl(var(--purple)/.05)", "hsl(var(--purple))"],
  ["hsl(var(--success)/.05)", "hsl(var(--success))"],
];
export function jobColor(jobId: string): { background: string; foreground: string } {
  let hash = 0;
  for (const char of jobId) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const [background, foreground] = JOB_COLORS[Math.abs(hash) % JOB_COLORS.length];
  return { background, foreground };
}

export function timeLabel(time: string): string {
  const [hourText, minuteText] = time.split(":");
  const hour = Number(hourText);
  return `${hour % 12 || 12}:${minuteText.slice(0, 2)} ${hour >= 12 ? "pm" : "am"}`;
}

export function appointmentConflicts(
  event: CalendarEvent,
  events: CalendarEvent[],
): { employee: string; appointment: string; time: string }[] {
  // Compare business-local wall-clock values on a neutral UTC minute axis. This
  // avoids changing overlap results when a viewer's browser is in another zone.
  const wallClockMinute = (date: string, time: string) => {
    const [year, month, day] = date.split("-").map(Number);
    const [hour, minute] = time.split(":").map(Number);
    return Date.UTC(year, month - 1, day, hour, minute) / 60000;
  };
  const startAt = (item: CalendarEvent) => wallClockMinute(item.appointment.date, item.appointment.start_time);
  const endAt = (item: CalendarEvent) => wallClockMinute(item.endDate, item.appointment.end_time);
  const result: { employee: string; appointment: string; time: string }[] = [];
  for (const own of event.assignments) {
    for (const other of events) {
      if (other.appointment.id === event.appointment.id) continue;
      const common = other.assignments.find((assignment) => assignment.employee_id === own.employee_id);
      if (common && startAt(event) < endAt(other) && endAt(event) > startAt(other)) {
        result.push({
          employee: own.employee_name ?? common.employee_name ?? "Team member",
          appointment: other.appointment.title,
          time: `${timeLabel(other.appointment.start_time)}–${timeLabel(other.appointment.end_time)}`,
        });
      }
    }
  }
  return result;
}

export function rangeTitle(date: Date, view: ScheduleView): string {
  if (view === "day") return format(date, "EEEE, d MMMM yyyy");
  if (view === "month") return format(date, "MMMM yyyy");
  const { dates } = visibleDateRange(date, "week");
  return `${format(dates[0], "d MMM")} – ${format(dates[6], "d MMM yyyy")}`;
}
