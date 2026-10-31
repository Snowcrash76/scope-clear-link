import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'platform-security-')), data = join(dir, 'pg');
const env = { ...process.env, PGHOST: dir, PGPORT: '55469', PGUSER: 'postgres', PGDATABASE: 'postgres', PGSSLMODE: 'disable', PGPASSWORD: '' };
let started = false;
const sql = (input, label) => {
  try { return execFileSync('psql', ['-X', '-v', 'ON_ERROR_STOP=1', '-q'], { input, env, stdio: ['pipe', 'pipe', 'pipe'] }).toString(); }
  catch (e) { throw new Error(`${label}: ${e.stderr?.toString().slice(-2200)}`); }
};
try {
  execFileSync('initdb', ['-D', data, '-A', 'trust', '-U', 'postgres', '--locale=C', '-E', 'UTF8'], { stdio: 'pipe' });
  execFileSync('pg_ctl', ['-D', data, '-l', join(dir, 'log'), '-o', `-k ${dir} -p 55469 -h ''`, '-w', 'start'], { stdio: 'pipe' }); started = true;
  sql(readFileSync('tests/employeeDbBootstrap.sql', 'utf8'), 'Supabase stubs');
  for (const file of readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort()) {
    sql(readFileSync(`supabase/migrations/${file}`, 'utf8').replace('CREATE EXTENSION IF NOT EXISTS pg_cron;', '-- Supabase cron stub'), file);
  }
  sql(readFileSync('tests/employeeTransactions.sql', 'utf8'), 'Existing employee/RLS regressions');
  sql(readFileSync('tests/platformAdministration.sql', 'utf8'), 'Platform controls');
  console.log('Isolated PostgreSQL: migrations, real restrictive RLS, current-session access, storage, tenant isolation, membership removal, confirmations and audit passed.');
} finally {
  if (started) execFileSync('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop'], { stdio: 'pipe' });
  rmSync(dir, { recursive: true, force: true });
}
