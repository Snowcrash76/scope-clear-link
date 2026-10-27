import { z } from 'zod';

export const COST_CATEGORIES = ['Materials', 'Subcontractor', 'Plant/Equipment', 'Labour', 'Other'] as const;
export const MARGIN_THRESHOLDS = { low: 15, loss: 0 } as const;
export const GST_RATE = 0.1;
export const RECEIPT_BUCKET = 'job-cost-receipts';
export const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;
export const RECEIPT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export type CostCategory = typeof COST_CATEGORIES[number];
export type RevenueBasis = 'quoted' | 'invoiced';
export const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function calculateGst(amount: number, basis: 'ex' | 'inc', applies: boolean) {
  const ex = basis === 'inc' && applies ? money(amount / (1 + GST_RATE)) : money(amount);
  const gst = applies ? (basis === 'inc' ? money(amount - ex) : money(ex * GST_RATE)) : 0;
  return { amount_ex_gst: ex, gst_amount: gst, amount_inc_gst: money(ex + gst) };
}

/** Complete a blank review subtotal without replacing a printed or entered amount. */
export function completeMissingCostSubtotal(exGst: string, incGst: string, gst: string, gstApplies: boolean) {
  const unchanged = { amount_ex_gst: exGst, gst_amount: gst };
  if (exGst.trim() || !incGst.trim()) return unchanged;
  const total = Number(incGst);
  if (!Number.isFinite(total) || total < 0 || total > 999999999.99) return unchanged;
  if (gst.trim()) {
    const tax = Number(gst);
    if (!Number.isFinite(tax) || tax < 0 || tax > total) return unchanged;
    return { amount_ex_gst: money(total - tax).toFixed(2), gst_amount: gst };
  }
  const calculated = calculateGst(total, 'inc', gstApplies);
  return { amount_ex_gst: calculated.amount_ex_gst.toFixed(2), gst_amount: calculated.gst_amount.toFixed(2) };
}

const amountSchema = z.number().finite().min(0).max(999999999.99)
  .refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.0001, 'Use no more than two decimal places');
export const costDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine(value => {
    const date = new Date(value + 'T00:00:00Z');
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, 'Enter a valid date');

export const receiptLineItemSchema = z.object({
  description: z.string().max(2000).nullable(),
  quantity: z.number().finite().min(-1000000).max(1000000).nullable(),
  unit_price: z.number().finite().min(-999999999).max(999999999).nullable(),
  amount: z.number().finite().min(-999999999).max(999999999).nullable(),
}).strict();
export type ReceiptLineItem = z.infer<typeof receiptLineItemSchema>;

export const jobCostInputSchema = z.object({
  job_id: z.string().uuid(),
  supplier: z.string().trim().min(1, 'Enter a supplier').max(200),
  description: z.string().trim().min(1, 'Enter a description').max(5000),
  cost_date: costDateSchema,
  category: z.enum(COST_CATEGORIES),
  amount_ex_gst: amountSchema,
  gst_amount: amountSchema,
  amount_inc_gst: amountSchema,
  gst_applies: z.boolean(),
  reference_number: z.string().trim().max(200).default(''),
  receipt_image_url: z.string().max(500).nullable().default(null),
  status: z.enum(['draft', 'confirmed']),
  notes: z.string().trim().max(10000).default(''),
  quote_line_item_id: z.string().uuid().nullable().default(null),
  // Optional for backwards-compatible manual saves before the scan migration.
  receipt_line_items: z.array(receiptLineItemSchema).max(200).optional(),
  receipt_confidence: z.enum(['high', 'medium', 'low']).nullable().optional(),
  receipt_abn: z.string().trim().max(50).nullable().optional(),
  receipt_currency: z.string().regex(/^[A-Z]{3}$/, 'Use a three-letter currency code').nullable().optional(),
}).strict().superRefine((value, ctx) => {
  if (value.receipt_currency !== undefined && value.receipt_currency !== null && value.receipt_currency !== 'AUD')
    ctx.addIssue({ code: 'custom', path: ['receipt_currency'], message: 'Job costs must be in AUD. Foreign receipts cannot be saved as AUD without separate conversion.' });
  if (value.receipt_confidence && !value.receipt_currency)
    ctx.addIssue({ code: 'custom', path: ['receipt_currency'], message: 'Confirm the receipt currency is AUD before saving' });
  if (Math.abs(money(value.amount_ex_gst + value.gst_amount) - value.amount_inc_gst) > 0.011)
    ctx.addIssue({ code: 'custom', path: ['amount_inc_gst'], message: 'Ex-GST plus GST must equal the total' });
  const expected = value.gst_applies ? money(value.amount_ex_gst * GST_RATE) : 0;
  if (value.receipt_confidence ? (!value.gst_applies && value.gst_amount !== 0) : Math.abs(expected - value.gst_amount) > 0.011)
    ctx.addIssue({ code: 'custom', path: ['gst_amount'], message: 'GST must be 10% of the ex-GST amount, or zero for GST-free costs' });
});

export type JobCostInput = z.input<typeof jobCostInputSchema>;
export type JobCost = z.output<typeof jobCostInputSchema> & {
  id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};
export interface QuoteCostLink { id: string; title: string; quote_number: string }
export interface JobCostList { costs: JobCost[]; quoteLineItems: QuoteCostLink[] }
export interface JobProfitability {
  jobId: string;
  jobName: string;
  clientName: string;
  status: string;
  quotedExGst: number | null;
  invoicedExGst: number;
  approvedVariationsExGst: number;
  confirmedCostsExGst: number;
  draftCostsExGst: number;
  costsByCategory: Record<CostCategory, number>;
}
export const aud = (value: number) => new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(value);
export function profitability(job: JobProfitability, basis: RevenueBasis) {
  const revenue = basis === 'quoted' ? job.quotedExGst : job.invoicedExGst;
  const profit = revenue === null ? null : money(revenue - job.confirmedCostsExGst);
  const margin = revenue !== null && revenue > 0 ? (profit! / revenue) * 100 : null;
  const health = profit !== null && profit < MARGIN_THRESHOLDS.loss ? 'loss'
    : margin !== null && margin < MARGIN_THRESHOLDS.low ? 'low'
    : margin !== null ? 'healthy' : 'unknown';
  return { revenue, profit, margin, health };
}
