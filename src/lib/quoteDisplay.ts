import type { Project } from '@/types/project';

export type QuoteDisplayStatus = 'draft' | 'sent' | 'approved' | 'declined' | 'expired';
export type JobDisplayStatus = 'lead' | 'quoted' | 'approved' | 'in_progress' | 'completed';

export interface QuoteSummary {
  id: string;
  project_id: string;
  quote_number: string;
  status: string;
  subtotal: number | null;
  total: number | null;
  tax_amount: number | null;
  created_at: string;
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
  if (quoteStatus === 'sent' || quoteStatus === 'expired') return 'quoted';
  if (quoteStatus) return 'lead';
  if (project.status === 'sent') return 'quoted';
  return 'lead';
}

