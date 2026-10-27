import { z } from 'zod';
import { COST_CATEGORIES, costDateSchema, receiptLineItemSchema, money } from './jobCosting';

const receiptAmount = z.number().finite().min(0).max(999999999.99).nullable();
export const receiptExtractionSchema = z.object({
  supplier: z.string().max(200).nullable(),
  abn: z.string().max(50).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  date: costDateSchema.nullable(),
  reference_number: z.string().max(200).nullable(),
  line_items: z.array(receiptLineItemSchema).max(200).nullable(),
  subtotal_ex_gst: receiptAmount,
  gst: receiptAmount,
  total_inc_gst: receiptAmount,
  suggested_category: z.enum(COST_CATEGORIES).nullable(),
  confidence: z.enum(['high', 'medium', 'low']),
}).strict();
export type ReceiptExtraction = z.infer<typeof receiptExtractionSchema>;
// All receipt costs use AUD by user policy; raw extraction remains unchanged.
export function receiptCurrencyForReview(_detectedCurrency?: ReceiptExtraction['currency']): 'AUD' {
  return 'AUD';
}
export interface ReceiptScanResult {
  extraction: ReceiptExtraction;
  warnings: string[];
  receipt_path: string;
}
export interface ReceiptDuplicate {
  id: string;
  job_id: string;
  job_name: string;
  supplier: string;
  cost_date: string;
  amount_inc_gst: number;
  reference_number: string;
}
export function parseReceiptExtraction(text: string): ReceiptExtraction {
  try {
    const json = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    return receiptExtractionSchema.parse(JSON.parse(json));
  } catch {
    throw new Error('The receipt reader returned an unreadable result. Try a clearer photo or enter the cost manually.');
  }
}
export function receiptWarnings(receipt: ReceiptExtraction): string[] {
  const warnings: string[] = [];
  const { subtotal_ex_gst: ex, gst, total_inc_gst: total } = receipt;
  const items = receipt.line_items ?? [];
  let reconcile = false;
  const tolerance = Math.max(0.05, items.length * 0.01);
  if (ex !== null && gst !== null && total !== null && Math.abs(ex + gst - total) > tolerance)
    reconcile = true;
  if (items.length && ex !== null && items.every(item => item.amount !== null)) {
    if (Math.abs(items.reduce((sum, item) => sum + item.amount!, 0) - ex) > tolerance)
      reconcile = true;
  }
  if (reconcile) warnings.push("Totals don't reconcile, please check");
  const missing = [
    !receipt.supplier && 'supplier', !receipt.abn && 'ABN', !receipt.date && 'receipt date',
    !receipt.reference_number && 'receipt number', !receipt.currency && 'currency',
    !items.length && 'line items', ex === null && 'subtotal', gst === null && 'GST', total === null && 'total',
  ].filter(Boolean);
  if (missing.length) warnings.push(`Missing or unreadable: ${missing.join(', ')}. Check the original; do not guess.`);
  if (items.some(item => !item.description || item.amount === null || item.quantity === null || item.unit_price === null))
    warnings.push('Some line item fields could not be read. Please check them against the original receipt.');
  if (receipt.currency && receipt.currency !== 'AUD')
    warnings.push('Job costing is in AUD. Convert this receipt separately before recording an AUD cost; no currency conversion is performed automatically.');
  if (receipt.confidence === 'low') warnings.push('Low-confidence scan. Check every field against the original receipt.');
  return warnings;
}
export function receiptDescription(receipt: ReceiptExtraction): string {
  return (receipt.line_items ?? []).map(item => {
    const quantity = item.quantity === null ? '' : `${item.quantity} × `;
    return `${quantity}${item.description ?? ''}`;
  }).join('; ').slice(0, 5000);
}
export function normalizeSupplier(supplier: string): string {
  return supplier.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-AU');
}
export const scanRequestSchema = z.object({
  job_id: z.string().uuid(),
  receipt_path: z.string().max(500),
  media_type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  data: z.string().min(4).max(7 * 1024 * 1024).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.media_type !== 'application/pdf' && !value.data)
    ctx.addIssue({ code: 'custom', path: ['data'], message: 'Choose a receipt image to scan.' });
  if (value.media_type === 'application/pdf' && value.data)
    ctx.addIssue({ code: 'custom', path: ['data'], message: 'PDFs must be read from the uploaded original.' });
});
export const duplicateRequestSchema = z.object({
  job_id: z.string().uuid(), supplier: z.string().trim().min(1).max(200),
  cost_date: costDateSchema, amount_inc_gst: z.number().finite().nonnegative().max(999999999.99),
  exclude_cost_id: z.string().uuid().optional(),
}).strict();
export const roundReceiptAmount = (value: number | null) => value === null ? null : money(value);
