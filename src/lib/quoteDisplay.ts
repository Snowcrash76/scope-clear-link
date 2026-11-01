import type { Project } from '@/types/project';

export type QuoteDisplayStatus = 'draft' | 'sent' | 'approved' | 'declined' | 'expired';
export const JOB_PIPELINE_STATUSES = ['quoted', 'approved', 'in_progress', 'completed'] as const;
export type JobDisplayStatus = typeof JOB_PIPELINE_STATUSES[number];

export interface QuoteSummary {
  id: string;
  project_id: string;
  quote_number: string;
  reference?: string | null;
  status: string;
  subtotal: number | null;
  total: number | null;
  tax_amount: number | null;
  created_at: string;
  updated_at?: string;
  approved_at?: string | null;
  declined_at?: string | null;
  valid_until?: string | null;
}

export function quoteDisplayStatus(quote?: Pick<QuoteSummary, 'status' | 'valid_until'> | null): QuoteDisplayStatus | null {
  if (!quote) return null;
  if (quote.status === 'sent' && quote.valid_until && new Date(quote.valid_until).getTime() < Date.now()) return 'expired';
  if (quote.status === 'revised') return 'draft';
  if (['draft', 'sent', 'approved', 'declined'].includes(quote.status)) return quote.status as QuoteDisplayStatus;
  return null;
}

export function jobDisplayStatus(project: Pick<Project, 'status'>, quote?: Pick<QuoteSummary, 'status' | 'valid_until'> | null): JobDisplayStatus {
  if (project.status === 'completed') return 'completed';
  if (project.status === 'in_progress') return 'in_progress';
  if (project.status === 'acknowledged') return 'approved';
  const quoteStatus = quoteDisplayStatus(quote);
  if (quoteStatus === 'approved') return 'approved';
  // Quoted is a job pipeline state, not a quote delivery/approval state.
  // Draft, revised, sent, expired, declined and not-yet-created quotes all start here.
  return 'quoted';
}

export function isActiveJob(project: Pick<Project, 'status'>, quote?: Pick<QuoteSummary, 'status' | 'valid_until'> | null): boolean {
  return jobDisplayStatus(project, quote) !== 'completed';
}

/** A sent quote remains awaiting response after expiry, until its status changes. */
export function awaitingQuoteResponse(project: Pick<Project, 'status'>, quote?: Pick<QuoteSummary, 'status' | 'valid_until'> | null): boolean {
  return jobDisplayStatus(project, quote) === 'quoted' && quote?.status === 'sent';
}

