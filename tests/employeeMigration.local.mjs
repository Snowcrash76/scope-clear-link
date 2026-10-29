import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
// Isolated disposable PostgreSQL cluster, NEVER the application's DATABASE_URL.
const args = ['-h','/tmp','-p','55439','-U','postgres','-d','portal_test','-v','ON_ERROR_STOP=1','-q'];
execFileSync('dropdb',['-h','/tmp','-p','55439','-U','postgres','--if-exists','portal_test']);
execFileSync('createdb',['-h','/tmp','-p','55439','-U','postgres','portal_test']);
function sql(content, name) {
  try { execFileSync('psql',args,{ input: content, stdio:['pipe','pipe','pipe'] }); }
  catch(e) { console.error(name, e.stderr?.toString().slice(-2500)); process.exit(1); }
}
sql(readFileSync('tests/employeeDbBootstrap.sql','utf8'),'platform stubs');
for (const name of readdirSync('supabase/migrations').filter(n => n.endsWith('.sql')).sort()) {
  let content = readFileSync(`supabase/migrations/${name}`,'utf8');
  // Supabase supplies pg_cron. Local PostgreSQL checks its call contract against
  // a stub instead; this test does NOT claim the remote cron job is installed.
  content = content.replace('CREATE EXTENSION IF NOT EXISTS pg_cron;','-- Supabase-only pg_cron extension');
  sql(content,name);
}
sql(readFileSync('tests/employeeTransactions.sql','utf8'),'employee transactions and RLS');
// Concurrent real database transactions, not simulated promise retries.
const run = promisify(execFile);
const clockSql = "SELECT public.portal_mutate('10000000-0000-4000-8000-000000000003','clock_in','{\"project_id\":\"20000000-0000-4000-8000-000000000001\"}')";
const clockResults = await Promise.allSettled(Array.from({length:4},()=>run('psql',[...args,'-c',clockSql])));
assert.equal(clockResults.filter(r=>r.status==='fulfilled').length,1,'exactly one concurrent timer starts');
sql("UPDATE public.employee_time_entries SET started_at=now()-interval '2 hours' WHERE employee_id='30000000-0000-4000-8000-000000000002' AND ended_at IS NULL;",'advance isolated timer');
sql("SELECT public.portal_mutate('10000000-0000-4000-8000-000000000003','clock_out',jsonb_build_object('id',(SELECT id FROM public.employee_time_entries WHERE employee_id='30000000-0000-4000-8000-000000000002' AND ended_at IS NULL),'break_minutes',15));",'stop timer');
const approveSql = "SELECT public.portal_review_week('10000000-0000-4000-8000-000000000001',(SELECT id FROM public.employee_week_submissions WHERE employee_id='30000000-0000-4000-8000-000000000001'),'approved','Concurrent retry')";
await Promise.all(Array.from({length:4},()=>run('psql',[...args,'-c',approveSql])));
sql("DO $$ BEGIN IF (SELECT count(*) FROM public.job_costs WHERE timesheet_entry_id IS NOT NULL)<>1 THEN RAISE EXCEPTION 'Concurrent approval duplicated labour'; END IF; END $$;",'concurrent approval dedupe');
console.log('Employee migration, transactions and RLS passed in isolated PostgreSQL.');
