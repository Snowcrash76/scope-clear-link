import { Router, type Request, type Response } from 'express';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { z, ZodError } from 'zod';
import { jobCostInputSchema, MAX_RECEIPT_BYTES, RECEIPT_BUCKET, RECEIPT_TYPES, type JobCost } from '../shared/jobCosting';
import { summarizeJobs } from './jobCostData';

class CostApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function client() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new CostApiError(503, 'The cost service is not configured. Ask the app owner to check Supabase settings.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
const uuid = z.string().uuid();
function normalizeCost(row: JobCost): JobCost {
  return { ...row, amount_ex_gst: Number(row.amount_ex_gst), gst_amount: Number(row.gst_amount), amount_inc_gst: Number(row.amount_inc_gst) };
}
function checkDb(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (['42P01', 'PGRST205', 'PGRST204'].includes(error.code ?? ''))
    throw new CostApiError(503, 'Job costing needs database setup. Apply the job costing migration in Supabase, then retry.');
  throw new CostApiError(502, 'Unable to load or save job costs. Please try again.');
}
async function ownJob(db: SupabaseClient, userId: string, jobId: string) {
  const { data, error } = await db.from('projects').select('id').eq('id', jobId).eq('user_id', userId).maybeSingle();
  checkDb(error);
  if (!data) throw new CostApiError(404, 'Job not found or access denied.');
}
async function ownCost(db: SupabaseClient, userId: string, id: string) {
  const { data, error } = await db.from('job_costs').select('*').eq('id', id).maybeSingle();
  checkDb(error);
  if (!data) throw new CostApiError(404, 'Cost not found or access denied.');
  await ownJob(db, userId, data.job_id);
  return data as JobCost;
}

// Supabase defaults to 1,000 rows per request. Reports must not silently truncate.
async function allRows<T>(build: () => any): Promise<T[]> {
  const result: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await build().range(offset, offset + 499);
    checkDb(error);
    result.push(...(data ?? []));
    if (!data || data.length < 500) return result;
  }
}

export function createJobCostRouter(createDb: () => SupabaseClient = client) {
  const router = Router();
  const route = (handler: (req: Request, db: SupabaseClient, userId: string) => Promise<unknown>) =>
    async (req: Request, res: Response) => {
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

  router.get('/job-costs', route(async (req, db, userId) => {
    const jobId = uuid.parse(req.query.jobId);
    await ownJob(db, userId, jobId);
    const costs = await allRows<JobCost>(() => db.from('job_costs').select('*').eq('job_id', jobId).order('cost_date', { ascending: false }).order('id'));
    const { data: quotes, error } = await db.from('quotes').select('id, quote_number').eq('project_id', jobId);
    checkDb(error);
    const quoteLineItems: { id: string; title: string; quote_number: string }[] = [];
    for (const quote of quotes ?? []) {
      const items = await allRows<{ id: string; title: string }>(() => db.from('quote_line_items').select('id, title').eq('quote_id', quote.id).order('id'));
      quoteLineItems.push(...items.map(item => ({ ...item, quote_number: quote.quote_number })));
    }
    return { costs: costs.map(normalizeCost), quoteLineItems };
  }));

  async function writeCost(req: Request, db: SupabaseClient, userId: string, id?: string) {
    const input = jobCostInputSchema.parse(req.body);
    await ownJob(db, userId, input.job_id);
    if (id) {
      const original = await ownCost(db, userId, id);
      if (original.job_id !== input.job_id) throw new CostApiError(400, 'A cost cannot be moved to another job.');
    }
    if (input.quote_line_item_id) {
      const { data: item, error } = await db.from('quote_line_items').select('quote_id').eq('id', input.quote_line_item_id).maybeSingle();
      checkDb(error);
      if (!item) throw new CostApiError(400, 'Quote line item not found.');
      const { data: quote, error: quoteError } = await db.from('quotes').select('project_id').eq('id', item.quote_id).maybeSingle();
      checkDb(quoteError);
      if (quote?.project_id !== input.job_id) throw new CostApiError(400, 'Choose a quote line from this job.');
    }
    if (input.receipt_image_url) {
      const path = input.receipt_image_url;
      const prefix = `${userId}/${input.job_id}/`;
      if (!path.startsWith(prefix) || !/^[0-9a-f-]+\.(jpg|png|webp|pdf)$/.test(path.slice(prefix.length)))
        throw new CostApiError(400, 'Receipt must belong to this job.');
      const { error } = await db.storage.from(RECEIPT_BUCKET).createSignedUrl(path, 60);
      if (error) throw new CostApiError(400, 'Receipt is unavailable. Please upload it again.');
    }
    const query = id
      ? db.from('job_costs').update(input).eq('id', id).eq('job_id', input.job_id)
      : db.from('job_costs').insert({ ...input, created_by: userId });
    const { data, error } = await query.select('*').single();
    checkDb(error);
    return normalizeCost(data);
  }

  router.post('/job-costs', route((req, db, userId) => writeCost(req, db, userId)));
  router.put('/job-costs/:id', route((req, db, userId) => writeCost(req, db, userId, uuid.parse(req.params.id))));
  router.delete('/job-costs/:id', route(async (req, db, userId) => {
    const id = uuid.parse(req.params.id);
    const cost = await ownCost(db, userId, id);
    const { error } = await db.from('job_costs').delete().eq('id', id).eq('job_id', cost.job_id);
    checkDb(error);
    return { success: true };
  }));

  router.post('/job-costs/receipt-upload', route(async (req, db, userId) => {
    const input = z.object({
      job_id: uuid, content_type: z.enum(RECEIPT_TYPES),
      size: z.number().int().positive().max(MAX_RECEIPT_BYTES, 'Receipt must be smaller than 10 MB'),
    }).strict().parse(req.body);
    await ownJob(db, userId, input.job_id);
    const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
    const path = `${userId}/${input.job_id}/${randomUUID()}.${extensions[input.content_type]}`;
    const { data, error } = await db.storage.from(RECEIPT_BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw new CostApiError(503, 'Receipt storage is unavailable. Check that the job costing migration has been applied.');
    return { path, token: data.token };
  }));
  router.get('/job-costs/:id/receipt', route(async (req, db, userId) => {
    const cost = await ownCost(db, userId, uuid.parse(req.params.id));
    if (!cost.receipt_image_url) throw new CostApiError(404, 'No receipt attached.');
    const { data, error } = await db.storage.from(RECEIPT_BUCKET).createSignedUrl(cost.receipt_image_url, 300);
    if (error || !data) throw new CostApiError(404, 'Receipt is unavailable.');
    return { url: data.signedUrl };
  }));

  router.get('/job-profitability', route(async (req, db, userId) => {
    const jobId = req.query.jobId === undefined ? undefined : uuid.parse(req.query.jobId);
    const projects = await allRows<Parameters<typeof summarizeJobs>[0][number]>(() => {
      const query = db.from('projects').select('id, name, client_name, status, active_quote_id').eq('user_id', userId).order('id');
      return jobId ? query.eq('id', jobId) : query;
    });
    if (jobId && projects.length === 0) throw new CostApiError(404, 'Job not found or access denied.');
    if (projects.length === 0) return [];
    const summaries = [];
    // Keep URL filters bounded for accounts with many jobs.
    for (let offset = 0; offset < projects.length; offset += 100) {
      const batch = projects.slice(offset, offset + 100);
      const ids = batch.map(p => p.id);
      const [quotes, invoices, changes, costs] = await Promise.all([
        allRows<Parameters<typeof summarizeJobs>[1][number]>(() => db.from('quotes').select('id, project_id, status, subtotal, created_at').in('project_id', ids).order('id')),
        allRows<Parameters<typeof summarizeJobs>[2][number]>(() => db.from('invoices').select('id, project_id, status, subtotal').in('project_id', ids).order('id')),
        allRows<Parameters<typeof summarizeJobs>[3][number]>(() => db.from('change_requests').select('id, project_id, status, cost_impact').in('project_id', ids).order('id')),
        allRows<JobCost>(() => db.from('job_costs').select('*').in('job_id', ids).order('id')),
      ]);
      summaries.push(...summarizeJobs(batch, quotes, invoices, changes, costs));
    }
    return summaries;
  }));
  return router;
}
