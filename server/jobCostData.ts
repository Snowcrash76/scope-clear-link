import { COST_CATEGORIES, money, type JobCost, type JobProfitability } from '../shared/jobCosting';

export interface RevenueProject { id: string; name: string; client_name: string; status: string; active_quote_id?: string | null }
export interface RevenueQuote { id: string; project_id: string; status: string; subtotal: number | string | null; created_at: string }
export interface RevenueInvoice { project_id: string; status: string; subtotal: number | string | null }
export interface RevenueChange { project_id: string; status: string; cost_impact: number | string | null }

export function summarizeJobs(
  projects: RevenueProject[], quotes: RevenueQuote[], invoices: RevenueInvoice[],
  changes: RevenueChange[], costs: JobCost[],
): JobProfitability[] {
  return projects.map(project => {
    // Multiple quotes are alternatives/revisions, never additive.
    const accepted = quotes.filter(q => q.project_id === project.id && q.status === 'approved')
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const quote = accepted.find(q => q.id === project.active_quote_id) ?? accepted[0];
    const jobCosts = costs.filter(c => c.job_id === project.id);
    const confirmed = jobCosts.filter(c => c.status === 'confirmed');
    const sumCosts = (list: JobCost[]) => money(list.reduce((sum, c) => sum + Number(c.amount_ex_gst), 0));
    return {
      jobId: project.id, jobName: project.name, clientName: project.client_name, status: project.status,
      quotedExGst: quote ? money(Number(quote.subtotal) || 0) : null,
      invoicedExGst: money(invoices.filter(i => i.project_id === project.id && ['sent', 'paid', 'overdue'].includes(i.status))
        .reduce((sum, invoice) => sum + (Number(invoice.subtotal) || 0), 0)),
      // Informational: the existing quote subtotal already incorporates approved variations.
      approvedVariationsExGst: money(changes.filter(c => c.project_id === project.id && c.status === 'approved')
        .reduce((sum, change) => sum + (Number(change.cost_impact) || 0), 0)),
      confirmedCostsExGst: sumCosts(confirmed),
      draftCostsExGst: sumCosts(jobCosts.filter(c => c.status === 'draft')),
      costsByCategory: Object.fromEntries(COST_CATEGORIES.map(category =>
        [category, sumCosts(confirmed.filter(c => c.category === category))])) as JobProfitability['costsByCategory'],
    };
  });
}
