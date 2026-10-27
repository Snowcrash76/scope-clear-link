import type { Router } from 'express';
import {
  duplicateRequestSchema, normalizeSupplier, receiptWarnings, scanRequestSchema,
  type ReceiptDuplicate,
} from '../shared/receiptScanning';
import { MAX_RECEIPT_BYTES, RECEIPT_BUCKET } from '../shared/jobCosting';
import { allRows, checkDb, CostApiError, ownJob, type createCostHandler } from './jobCostAccess';
import type { ReceiptExtractor } from './receiptExtraction';

export function detectReceiptType(bytes: Buffer): string | null {
  if (bytes.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}
export function decodeReceiptImage(data: string, mediaType: string): Buffer {
  if (data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data))
    throw new CostApiError(400, 'The photo data is invalid. Choose the image again.');
  const bytes = Buffer.from(data, 'base64');
  if (bytes.length > 5 * 1024 * 1024 || detectReceiptType(bytes) !== mediaType)
    throw new CostApiError(400, 'The photo is too large or does not match its file type. Try a JPEG photo.');
  return bytes;
}

export function mountReceiptRoutes(router: Router, route: ReturnType<typeof createCostHandler>, extract: ReceiptExtractor) {
  // Limits protect the shared API key from accidental repeated clicks.
  const scans = new Map<string, { count: number; until: number; active: boolean }>();
  router.post('/receipts/extract', route(async (req, db, userId) => {
    const input = scanRequestSchema.parse(req.body);
    await ownJob(db, userId, input.job_id);
    const prefix = `${userId}/${input.job_id}/`;
    if (!input.receipt_path.startsWith(prefix) || !/^[0-9a-f-]+\.(jpg|png|webp|pdf)$/.test(input.receipt_path.slice(prefix.length)))
      throw new CostApiError(400, 'Choose a receipt uploaded to this job.');
    // Verify schema setup before spending any money on extraction.
    const { error: setupError } = await db.from('job_costs').select('receipt_line_items, receipt_confidence, receipt_abn, receipt_currency').eq('job_id', input.job_id).limit(0);
    checkDb(setupError);
    const now = Date.now();
    for (const [key, entry] of scans) if (entry.until < now && !entry.active) scans.delete(key);
    const state = scans.get(userId) ?? { count: 0, until: now + 60000, active: false };
    if (state.active) throw new CostApiError(429, 'A receipt is already being scanned. Please wait for it to finish.');
    if (state.count >= 6 && state.until > now) throw new CostApiError(429, 'Please wait a minute before scanning more receipts.');
    if (state.until <= now) { state.count = 0; state.until = now + 60000; }
    state.count++;
    state.active = true;
    scans.set(userId, state);
    try {
      const { data: original, error } = await db.storage.from(RECEIPT_BUCKET).download(input.receipt_path);
      if (error || !original) throw new CostApiError(400, 'The uploaded receipt could not be found. Please upload it again.');
      if (!original.size || original.size > MAX_RECEIPT_BYTES) throw new CostApiError(400, 'Choose a receipt smaller than 10 MB.');
      const bytes = Buffer.from(await original.arrayBuffer());
      const originalType = detectReceiptType(bytes);
      const extensions: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };
      if (!originalType || extensions[input.receipt_path.split('.').pop()!] !== originalType)
        throw new CostApiError(400, 'The receipt contents do not match its file type. Try a JPEG photo or a valid PDF.');
      if ((originalType === 'application/pdf') !== (input.media_type === 'application/pdf'))
        throw new CostApiError(400, 'Choose the same file type as the uploaded receipt.');
      const extractionBytes = input.media_type === 'application/pdf' ? bytes : decodeReceiptImage(input.data!, input.media_type);
      const extraction = await extract({ mediaType: input.media_type, base64: extractionBytes.toString('base64') });
      return { extraction, warnings: receiptWarnings(extraction), receipt_path: input.receipt_path };
    } finally { state.active = false; }
  }));

  router.post('/job-costs/duplicates', route(async (req, db, userId) => {
    const input = duplicateRequestSchema.parse(req.body);
    await ownJob(db, userId, input.job_id);
    const projects = await allRows<{ id: string; name: string }>(() => db.from('projects').select('id, name').eq('user_id', userId).order('id'));
    const duplicates: ReceiptDuplicate[] = [];
    for (let offset = 0; offset < projects.length; offset += 100) {
      const batch = projects.slice(offset, offset + 100);
      const names = new Map(batch.map(project => [project.id, project.name]));
      const entries = await allRows<Omit<ReceiptDuplicate, 'job_name'>>(() =>
        db.from('job_costs').select('id, job_id, supplier, cost_date, amount_inc_gst, reference_number')
          .in('job_id', batch.map(p => p.id)).eq('cost_date', input.cost_date).eq('amount_inc_gst', input.amount_inc_gst).order('id'));
      duplicates.push(...entries.filter(cost =>
        cost.id !== input.exclude_cost_id && normalizeSupplier(cost.supplier) === normalizeSupplier(input.supplier))
        .map(cost => ({ ...cost, amount_inc_gst: Number(cost.amount_inc_gst), job_name: names.get(cost.job_id)! })));
    }
    return { duplicates };
  }));
}
