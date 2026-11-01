import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { CostApiError } from './jobCostAccess';
import { portalRows, requireEmployee, requireTeam, safeJobColumns, type PortalActor } from './employeeAccess';
import { localDate } from '../shared/employeePortal';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Enter a valid calendar date.');

export function scheduleRange(input: unknown) {
  const range = z.object({ from: day, to: day }).parse(input);
  const start = new Date(`${range.from}T12:00:00Z`);
  const finish = new Date(`${range.to}T12:00:00Z`);
  if (finish < start || finish.getTime() - start.getTime() > 61 * 86400000)
    throw new CostApiError(400, 'Choose a visible range of up to 62 days.');
  start.setUTCDate(start.getUTCDate() - 1);
  return { ...range, previous: start.toISOString().slice(0, 10) };
}

const appointmentColumns = 'id,project_id,title,date,start_time,end_time,notes';
const assignmentColumns = 'id,employee_id,project_id,appointment_id';

/** Owner-only operational backlog. Deliberately has no calendar-range input. */
export async function readUnscheduledJobs(db: SupabaseClient, actor: PortalActor, now = new Date()) {
  requireTeam(actor);
  const timezone = 'Australia/Sydney';
  const today = localDate(now, timezone);
  const jobs = await portalRows(() => db.from('projects')
    .select('id,name,client_name,status').eq('user_id', actor.ownerId).order('name').order('id'));
  const quotes: { project_id: string; status: string; created_at: string }[] = [];
  for (let index = 0; index < jobs.length; index += 100) {
    quotes.push(...await portalRows(() => db.from('quotes')
      .select('project_id,status,created_at')
      .in('project_id', jobs.slice(index, index + 100).map(job => job.id))));
  }
  // Match the job list's displayed lifecycle: acknowledged means Approved;
  // otherwise its latest non-declined quote can establish approval.
  quotes.sort((a, b) => Number(a.status === 'declined') - Number(b.status === 'declined') ||
    b.created_at.localeCompare(a.created_at));
  const currentQuotes = new Map<string, string>();
  for (const quote of quotes) if (!currentQuotes.has(quote.project_id)) currentQuotes.set(quote.project_id, quote.status);
  const activeJobs = jobs.filter(job => job.status === 'in_progress' || job.status === 'acknowledged' ||
    job.status === 'approved' || (job.status !== 'completed' && currentQuotes.get(job.id) === 'approved'));
  if (!activeJobs.length) return { today, timezone, jobs: [] };
  const bookings = await portalRows(() => db.from('appointments').select('project_id')
    .eq('user_id', actor.ownerId).gte('date', today).order('id'));
  const booked = new Set(bookings.map(booking => booking.project_id).filter(Boolean));
  return {
    today, timezone,
    jobs: activeJobs.filter(job => !booked.has(job.id)).map(job => ({
      id: job.id, name: job.name, client_name: job.client_name,
      client_address: null, client_phone: null,
    })),
  };
}

async function byIds(db: SupabaseClient, table: string, columns: string, field: string, ids: string[], ownerField: string, owner: string) {
  const rows: any[] = [];
  for (let index = 0; index < ids.length; index += 100) {
    rows.push(...await portalRows(() => db.from(table).select(columns).eq(ownerField, owner).in(field, ids.slice(index, index + 100))));
  }
  return rows;
}

/** Read only. Identity and business scope come exclusively from the authenticated actor. */
export async function readSchedule(db: SupabaseClient, actor: PortalActor, input: unknown) {
  const range = scheduleRange(input);
  if (actor.canManageTeam) requireTeam(actor);
  else requireEmployee(actor);
  const ownAssignments = actor.canManageTeam ? [] : await portalRows(() =>
    db.from('employee_assignments').select(assignmentColumns).eq('owner_id', actor.ownerId).eq('employee_id', actor.employee.id));
  const loadAppointments = (ids?: string[]) => portalRows(() => {
    let query = db.from('appointments').select(appointmentColumns).eq('user_id', actor.ownerId)
      .gte('date', range.previous).lte('date', range.to).order('date').order('start_time');
    if (ids) query = query.in('id', ids);
    return query;
  });
  let appointments: any[] = [];
  if (actor.canManageTeam) appointments = await loadAppointments();
  else {
    const ids = [...new Set(ownAssignments.map(row => row.appointment_id))];
    for (let index = 0; index < ids.length; index += 100)
      appointments.push(...await loadAppointments(ids.slice(index, index + 100)));
  }
  appointments = appointments.filter(row => row.date >= range.from || row.end_time <= row.start_time);
  const appointmentIds = new Set(appointments.map(row => row.id));
  const assignments = actor.canManageTeam
    ? await byIds(db, 'employee_assignments', assignmentColumns, 'appointment_id', [...appointmentIds], 'owner_id', actor.ownerId)
    : ownAssignments.filter(row => appointmentIds.has(row.appointment_id));
  const jobs = actor.canManageTeam
    ? await portalRows(() => db.from('projects').select(safeJobColumns).eq('user_id', actor.ownerId))
    : await byIds(db, 'projects', safeJobColumns, 'id', [...new Set(ownAssignments.map(row => row.project_id).filter((id): id is string => typeof id === 'string'))], 'user_id', actor.ownerId);
  const employees = actor.canManageTeam
    ? await portalRows(() => db.from('employees').select('id,name,active').eq('owner_id', actor.ownerId).is('archived_at', null))
    : [{ id: actor.employee.id, name: actor.employee.name }];
  return {
    timezone: 'Australia/Sydney', canManage: actor.canManageTeam, jobs, employees, appointments,
    assignments: assignments.flatMap(row => {
      const appointment = appointments.find(item => item.id === row.appointment_id);
      return appointment ? [{ ...row, date: appointment.date, start_time: appointment.start_time,
        end_time: appointment.end_time, notes: appointment.notes,
        employee_name: employees.find(employee => employee.id === row.employee_id)?.name }] : [];
    }),
  };
}
