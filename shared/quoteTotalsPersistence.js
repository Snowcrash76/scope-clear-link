import { calculateStoredQuoteTotals } from './quoteTotals.js';

export async function readAll(makeQuery) {
  const rows = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await makeQuery().order('id').range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data) throw new Error('Quote repair read returned no data');
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

// The current project scope is not a historical snapshot. Never use it to
// overwrite superseded quotes, even if their shareable links still exist.
export async function refreshActiveQuoteTotals(client, projectId) {
  const { data: project, error: projectError } = await client.from('projects')
    .select('active_quote_id').eq('id', projectId).single();
  if (projectError) throw projectError;
  if (!project) throw new Error('Project unavailable during quote repair');
  if (!project.active_quote_id) return false;
  const { data: quote, error: quoteError } = await client.from('quotes')
    .select('id, subtotal, tax_amount, total, tax_rate, updated_at')
    .eq('id', project.active_quote_id).eq('project_id', projectId).single();
  if (quoteError) throw quoteError;
  if (!quote) throw new Error('Active quote unavailable during quote repair');
  const [scope, items, changes] = await Promise.all([
    readAll(() => client.from('scope_items')
      .select('id, title, category, cost').eq('project_id', projectId)),
    readAll(() => client.from('quote_line_items')
      .select('id, title, cost, is_variation').eq('quote_id', quote.id)),
    readAll(() => client.from('change_requests')
      .select('id, status, cost_impact').eq('project_id', projectId).eq('status', 'approved')),
  ]);
  const totals = calculateStoredQuoteTotals(scope, items, changes, quote.tax_rate);
  const sameMoney = (a, b) => a != null && Math.round(a * 100) === Math.round(b * 100);
  if (Object.entries(totals).every(([field, value]) => sameMoney(quote[field], value))) return false;
  const { data, error } = await client.from('quotes').update(totals)
    .eq('id', quote.id).eq('project_id', projectId).eq('updated_at', quote.updated_at).select('id');
  if (error) throw error;
  if (data?.length !== 1) throw new Error('Quote changed during totals repair; rerun the repair');
  return true;
}
