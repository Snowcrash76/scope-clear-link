import { createClient } from '@supabase/supabase-js';
import { pathToFileURL } from 'node:url';
import { readAll, refreshActiveQuoteTotals } from '../shared/quoteTotalsPersistence.js';
export { readAll } from '../shared/quoteTotalsPersistence.js';

export async function repairQuoteTotals(client) {
  const approved = await readAll(() => client.from('change_requests')
    .select('id, project_id, status, cost_impact').eq('status', 'approved'));
  const projectIds = [...new Set(approved.map(change => change.project_id))];
  let updated = 0;
  for (const projectId of projectIds) {
    if (await refreshActiveQuoteTotals(client, projectId)) updated++;
  }
  return { projects: projectIds.length, updated };
}

async function main() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Quote totals repair requires Supabase URL and service role configuration');
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await repairQuoteTotals(client);
  console.log(`Quote totals repair: checked ${result.projects} projects; corrected ${result.updated} quotes.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    // Never log database responses, quote contents or credentials.
    console.error('Quote totals repair failed. Check Supabase access and rerun scripts/repair-quote-totals.mjs.');
    process.exitCode = 1;
  });
}
