import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assignmentDates } from '../shared/assignmentDates';
import { CostApiError } from './jobCostAccess';
import { portalDbCheck, portalMutate, requireTeam, type PortalActor } from './employeeAccess';

export const teamAssignmentBody = z.object({
  project_id: z.string().uuid(),
  employee_ids: z.array(z.string().uuid()).min(1).max(100).transform(ids => [...new Set(ids)].sort()),
  appointment_id: z.string().uuid().optional(),
  date: z.string().optional(),
  end_date: z.string().optional(),
  start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).optional(),
  end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).optional(),
  notes: z.string().trim().max(5000).optional(),
}).strict();

export async function createTeamAssignments(db: SupabaseClient, actor: PortalActor, input: unknown) {
  requireTeam(actor);
  const { end_date, ...body } = teamAssignmentBody.parse(input);
  if (body.appointment_id) {
    if (end_date) throw new CostApiError(400, 'An existing booking cannot be combined with a date range.');
    return portalMutate(db, actor, 'team_assign', body);
  }
  if (!body.date || !body.start_time || !body.end_time || body.end_time <= body.start_time) {
    throw new CostApiError(400, 'Enter a start date and a finish time after the start time.');
  }
  let dates: string[];
  try { dates = assignmentDates(body.date, end_date); }
  catch (error) { throw new CostApiError(400, (error as Error).message); }
  if (dates.length === 1) return portalMutate(db, actor, 'team_assign', body);
  const { data, error } = await db.rpc('portal_assign_days', {
    p_actor: actor.userId,
    p_payload: { ...body, dates },
  });
  if (error?.code === 'PGRST202' || error?.code === '42883') {
    throw new CostApiError(503, 'Multi-day assignments need the Supabase multi-day assignment setup. No bookings were saved.');
  }
  portalDbCheck(error);
  return data;
}
