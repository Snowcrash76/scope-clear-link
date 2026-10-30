import type { Request, Response } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ZodError } from 'zod';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { jobCostClient, CostApiError } from './jobCostAccess';
import { defaultPermissions, type EmployeeRole, type OperationalPermissions } from '../shared/employeePortal';

export const safeJobColumns = 'id,name,client_name,client_address,client_phone,employee_notes';
export const safeEntryColumns = 'id,employee_id,project_id,work_date,started_at,ended_at,break_minutes,notes,status,paid_minutes,created_at';
export const safeDocumentColumns = 'id,project_id,file_name,display_name,file_type,purpose,caption,photo_stage,employee_visible,created_at';
export const safeEmployeeColumns = 'id,name,email,role,active,auth_user_id';
/** Never accept an employee ID from a browser when exposing an employee's rate. */
export async function ownEmployeeHourlyRate(db: SupabaseClient, actor: PortalActor): Promise<number | null> {
  const employee = requireEmployee(actor);
  const { data, error } = await db.from('employee_cost_rates').select('hourly_rate')
    .eq('employee_id', employee.id).eq('owner_id', actor.ownerId).maybeSingle();
  portalDbCheck(error);
  return data?.hourly_rate ?? null;
}
export function portalDbCheck(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (['42703','PGRST202','PGRST204'].includes(error.code ?? '') && /archived_at|revoked_auth_user_ids|portal_manage_employee/.test(error.message))
    throw new CostApiError(503, 'Team management database setup is required. Apply supabase/migrations/20261030000000_team_member_management.sql in Supabase, then retry.');
  if (['42P01','42703','PGRST202','PGRST204','PGRST205'].includes(error.code ?? '')) throw new CostApiError(503,
    'Employee portal database setup is required. Apply supabase/migrations/20261029000000_employee_portal.sql in Supabase, then retry.');
  if (error.code === '42501') throw new CostApiError(403, error.message);
  if (error.code === 'P0001') throw new CostApiError(409, error.message);
  if (error.code === '23505') throw new CostApiError(409, 'This record already exists. Refresh and try again.');
  if (['23514','22007','22008','22P02','23503','23502'].includes(error.code ?? '')) throw new CostApiError(400, 'Check the fields, dates, duration, unpaid break and job selection.');
  throw new CostApiError(502, 'The portal could not load or save this information. Please retry.');
}
export async function portalRows<T = any>(build: () => any): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await build().range(offset, offset + 499); portalDbCheck(error);
    result.push(...(data ?? []));
    if (!data || data.length < 500) return result;
  }
}
export type PortalActor = { userId: string; employee: any | null; ownerId: string; canManageTeam: boolean; setupRequired?: boolean };
export async function portalActor(db: SupabaseClient, userId: string): Promise<PortalActor> {
  const { data, error } = await db.from('employees').select('*').eq('auth_user_id', userId).maybeSingle();
  // Existing owner routes keep working before the additive migration. There
  // cannot yet be an enrolled employee when this table doesn't exist.
  if (error?.code === 'PGRST205' || error?.code === '42P01') return { userId, employee: null, ownerId: userId, canManageTeam: true, setupRequired: true };
  portalDbCheck(error);
  if (data && !data.active) throw new CostApiError(403, 'Your employee account is inactive. Contact your employer.');
  if (!data) {
    const revoked = await db.from('employees').select('id').contains('revoked_auth_user_ids', [userId]).limit(1);
    // Before the additive team update there cannot be any retired identities.
    if (!['42703','PGRST204'].includes(revoked.error?.code ?? '')) portalDbCheck(revoked.error);
    if (revoked.data?.length) throw new CostApiError(403, 'Your employee access has changed. Use the latest invitation from your employer.');
  }
  return { userId, employee: data, ownerId: data?.owner_id ?? userId, canManageTeam: !data || data.role === 'admin' };
}
export function requireEmployee(actor: PortalActor) {
  if (actor.setupRequired) portalDbCheck({ code: '42P01', message: '' });
  if (!actor.employee) throw new CostApiError(403, 'An active employee account is required.');
  return actor.employee;
}
export function requireTeam(actor: PortalActor) {
  if (actor.setupRequired) portalDbCheck({ code: '42P01', message: '' });
  if (!actor.canManageTeam) throw new CostApiError(403, 'Team administration is not permitted.');
}
export async function portalPermissions(db: SupabaseClient, ownerId: string, role: EmployeeRole): Promise<OperationalPermissions> {
  const { data, error } = await db.from('employee_role_permissions').select('permissions').eq('owner_id', ownerId).eq('role', role).maybeSingle();
  portalDbCheck(error);
  return { ...defaultPermissions[role], ...(data?.permissions ?? {}) };
}
export async function assignedJobs(db: SupabaseClient, actor: PortalActor): Promise<string[]> {
  const employee = requireEmployee(actor);
  const assignments = await portalRows(() => db.from('employee_assignments').select('project_id').eq('employee_id', employee.id).eq('owner_id', actor.ownerId));
  return [...new Set(assignments.map(a => a.project_id))];
}
export async function requireAssigned(db: SupabaseClient, actor: PortalActor, jobId: string) {
  const { data, error } = await db.rpc('portal_assigned', { p_employee: requireEmployee(actor).id, p_job: jobId });
  portalDbCheck(error);
  if (!data) throw new CostApiError(403, 'You are not currently assigned to this job.');
}
export async function portalMutate(db: SupabaseClient, actor: PortalActor, action: string, payload: unknown) {
  const { data, error } = await db.rpc('portal_mutate', { p_actor: actor.userId, p_action: action, p_payload: payload });
  portalDbCheck(error); return data;
}
type Handler = (req: Request, db: SupabaseClient, actor: PortalActor) => Promise<unknown>;
export const portalHandler = (handler: Handler) => async (req: Request, res: Response) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) throw new CostApiError(401, 'Please sign in.');
    const db = jobCostClient();
    const { data: { user }, error } = await db.auth.getUser(auth.slice(7));
    if (error || !user) throw new CostApiError(401, 'Your session has expired. Please sign in again.');
    const actor = await portalActor(db, user.id);
    res.setHeader('Cache-Control', 'no-store');
    res.json(await handler(req, db, actor));
  } catch (error) { portalError(res, error); }
};
export function portalError(res: Response, error: unknown) {
  res.setHeader('Cache-Control', 'no-store');
  if (error instanceof ZodError) return res.status(400).json({ error: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('. ') });
  if (error instanceof CostApiError) return res.status(error.status).json({ error: error.message });
  console.error('[employee-portal] request failed', error instanceof Error ? error.name : 'Unknown error');
  return res.status(500).json({ error: 'Unable to process this request. Please retry.' });
}
/** Authenticated download capabilities are re-authorised on every file request,
 * unlike Supabase signed URLs which survive assignment revocation until expiry. */
export function fileCapability(actorId: string, documentId: string, employeeOnly = false): string {
  const key = process.env.SESSION_SECRET;
  if (!key) throw new CostApiError(503, 'Private file access is not configured.');
  const payload = Buffer.from(JSON.stringify({ actorId, documentId, employeeOnly, exp: Date.now() + 5 * 60 * 1000 })).toString('base64url');
  return `${payload}.${createHmac('sha256', key).update(payload).digest('base64url')}`;
}
export function verifyFileCapability(token: string): { actorId: string; documentId: string; employeeOnly: boolean } {
  const key = process.env.SESSION_SECRET;
  if (!key || token.length > 1500) throw new CostApiError(403, 'File link is invalid or expired.');
  const [payload, supplied, extra] = token.split('.');
  const expected = createHmac('sha256', key).update(payload || '').digest();
  const signature = Buffer.from(supplied || '', 'base64url');
  if (extra || signature.length !== expected.length || !timingSafeEqual(signature, expected)) throw new CostApiError(403, 'File link is invalid or expired.');
  let data: any;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { throw new CostApiError(403, 'File link is invalid or expired.'); }
  if (data.exp < Date.now() || typeof data.actorId !== 'string' || typeof data.documentId !== 'string') throw new CostApiError(403, 'File link is invalid or expired.');
  return data;
}
