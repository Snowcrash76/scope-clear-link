import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireTeam, portalDbCheck, type PortalActor } from './employeeAccess';
import { CostApiError } from './jobCostAccess';
import { scheduleRange } from './scheduleRead';

const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'Enter a valid time.');
export const bookingSchema = z.object({
  title: z.string().trim().min(1).max(160),
  project_id: z.string().uuid().nullable(),
  date: z.string(),
  start_time: clock,
  end_time: clock,
  notes: z.string().trim().max(4000).default(''),
  employee_ids: z.array(z.string().uuid()).max(100).refine(ids => new Set(ids).size === ids.length, 'Choose each team member once.'),
  overnight: z.boolean().default(false),
  allow_conflicts: z.boolean().default(false),
}).strict().superRefine((body, context) => {
  try { scheduleRange({ from: body.date, to: body.date }); }
  catch { context.addIssue({ code: 'custom', path: ['date'], message: 'Enter a valid date.' }); }
  if (body.start_time === body.end_time || ((body.end_time < body.start_time) !== body.overnight))
    context.addIssue({ code: 'custom', path: ['end_time'], message: 'Check the finish time and whether the booking finishes the next day.' });
});

export async function writeSchedule(db: SupabaseClient, actor: PortalActor, operation: 'create' | 'update' | 'delete', input: unknown, bookingId?: string) {
  requireTeam(actor);
  if (actor.assistance) throw new CostApiError(403, 'Employee portal preview is read-only.');
  const payload = operation === 'delete' ? {} : bookingSchema.parse(input);
  const id = operation === 'create' ? null : z.string().uuid().parse(bookingId);
  const { data, error } = await db.rpc('portal_schedule_booking', {
    p_actor: actor.userId, p_operation: operation, p_id: id, p_payload: payload,
  });
  if (error && ['42883', 'PGRST202'].includes(error.code ?? ''))
    throw new CostApiError(503, 'Interactive calendar database setup is required. Apply the interactive schedule migration in Supabase, then retry.');
  portalDbCheck(error);
  if (!data) throw new CostApiError(502, 'The booking was not saved. Please retry.');
  return data;
}
