import { Router } from 'express';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CostApiError, createCostHandler, jobCostClient } from './jobCostAccess';
import { RECEIPT_BUCKET } from '../shared/jobCosting';

const deletionInput = z.object({
  kind: z.enum(['client', 'quote', 'invoice']),
  id: z.string().uuid().optional(),
  clientKey: z.string().trim().max(500).optional(),
  confirmation: z.literal('DELETE'),
}).refine(value => value.kind === 'client' ? value.clientKey !== undefined : !!value.id, 'Select a record to delete.');

/** The DB outbox survives restarts. An attachment failure must not be presented
 * as a failed DB transaction or encourage a second destructive request. */
export async function cleanDeletedFiles(db: SupabaseClient, cleanupId?: string): Promise<boolean> {
  let query = db.from('deletion_file_cleanup').select('id,owner_id,files').order('created_at').limit(20);
  if (cleanupId) query = query.eq('id', cleanupId);
  const { data, error } = await query;
  if (error) return false;
  let complete = true;
  for (const row of data ?? []) {
    const groups = new Map<string, Set<string>>();
    let safe = true;
    for (const file of row.files as Array<{ url: string; jobId: string; bucket?: string }>) {
      let bucket = file.bucket ?? RECEIPT_BUCKET;
      let path = file.url;
      if (/^https?:\/\//i.test(path)) {
        const url = new URL(path);
        if (url.origin !== new URL(process.env.VITE_SUPABASE_URL!).origin) continue; // Not an app-owned upload.
        const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/);
        if (!match) { safe = false; continue; }
        bucket = decodeURIComponent(match[1]);
        path = decodeURIComponent(match[2]);
      }
      // A stored URL is not authority to delete another business's object.
      if (!file.jobId || !(path.startsWith(`${row.owner_id}/${file.jobId}/`) ||
          path.startsWith(`${file.jobId}/`)) || path.split('/').includes('..')) {
        safe = false; continue;
      }
      if (!groups.has(bucket)) groups.set(bucket, new Set());
      groups.get(bucket)!.add(path);
    }
    for (const [bucket, paths] of groups) {
      const values = [...paths];
      for (let offset = 0; offset < values.length; offset += 100) {
        const { error: storageError } = await db.storage.from(bucket).remove(values.slice(offset, offset + 100));
        if (storageError) safe = false;
      }
    }
    if (safe) {
      const { error: removeError } = await db.from('deletion_file_cleanup').delete().eq('id', row.id);
      if (removeError) complete = false;
    } else complete = false;
  }
  return complete;
}

export function createResourceDeletionRouter(createDb = jobCostClient) {
  const router = Router();
  const route = createCostHandler(createDb);
  router.post('/owner/delete-resource', route(async (req, db, ownerId) => {
    const input = deletionInput.parse(req.body);
    const { data, error } = await db.rpc('owner_delete_resources', {
      p_actor: ownerId, p_kind: input.kind, p_id: input.id ?? null,
      p_client_key: input.clientKey ?? null, p_confirmation: input.confirmation,
    });
    if (error) {
      if (['PGRST202', '42883'].includes(error.code)) {
        throw new CostApiError(503, 'Deletion needs database setup. Apply the owner resource deletion migration in Supabase, then retry.');
      }
      const expected = ['22023', '42501', 'P0002', '55000', '23503'].includes(error.code);
      throw new CostApiError(expected ? 409 : 502, expected ? error.message : 'Deletion could not be confirmed. Refresh the list before retrying.');
    }
    if (!data?.deleted || !data.recordsDeleted) throw new CostApiError(409, 'Deletion was not confirmed. Refresh before retrying.');
    let filesPending = false;
    if (data.cleanupId) {
      try { filesPending = !(await cleanDeletedFiles(db, data.cleanupId)); }
      catch { filesPending = true; }
    }
    return { ...data, filesPending };
  }));
  return router;
}

/** One managed application process owns this retry loop; no extra workflow. */
export function startDeletionFileCleanup() {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await cleanDeletedFiles(jobCostClient()); }
    catch { /* Keep the durable outbox for the next attempt. */ }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(tick, 60_000);
  timer.unref();
}
