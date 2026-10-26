import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';

export class CostApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function jobCostClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new CostApiError(503, 'The cost service is not configured. Ask the app owner to check Supabase settings.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function checkDb(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (['42P01', '42703', 'PGRST205', 'PGRST204'].includes(error.code ?? ''))
    throw new CostApiError(503, 'Job costing needs database setup. Apply the job costing and receipt scanning migrations in Supabase, then retry.');
  throw new CostApiError(502, 'Unable to load or save job costs. Please try again.');
}
export async function ownJob(db: SupabaseClient, userId: string, jobId: string) {
  const { data, error } = await db.from('projects').select('id').eq('id', jobId).eq('user_id', userId).maybeSingle();
  checkDb(error);
  if (!data) throw new CostApiError(404, 'Job not found or access denied.');
}
export async function allRows<T>(build: () => any): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await build().range(offset, offset + 499);
    checkDb(error);
    result.push(...(data ?? []));
    if (!data || data.length < 500) return result;
  }
}
export type CostHandler = (req: Request, db: SupabaseClient, userId: string) => Promise<unknown>;
export function createCostHandler(createDb: () => SupabaseClient) {
  return (handler: CostHandler) => async (req: Request, res: Response) => {
    try {
      const auth = req.headers.authorization;
      if (!auth?.startsWith('Bearer ')) throw new CostApiError(401, 'Please sign in.');
      const db = createDb();
      const { data: { user }, error } = await db.auth.getUser(auth.slice(7));
      if (error || !user) throw new CostApiError(401, 'Your session has expired. Please sign in again.');
      res.json(await handler(req, db, user.id));
    } catch (error) {
      if (error instanceof ZodError) {
        res.status(400).json({ error: error.issues.map(i => i.message).join('. ') });
      } else if (error instanceof CostApiError) {
        res.status(error.status).json({ error: error.message });
      } else {
        console.error('[job-costs] request failed', error instanceof Error ? error.name : 'Unknown error');
        res.status(500).json({ error: 'Unable to process this request. Please try again.' });
      }
    }
  };
}
