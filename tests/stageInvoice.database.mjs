// Disposable local PostgreSQL cluster: never reads or writes customer data.
import assert from 'node:assert/strict';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const bin = process.env.POSTGRES_TEST_BIN || '/nix/store/269nimkimaaivb4z46bjc1rnjv9jpc0l-postgresql-17.6/bin';
const dir = mkdtempSync(join(tmpdir(), 'stage-invoice-test-'));
const data = join(dir, 'data');
const env = {
  ...process.env, PGHOST: dir, PGPORT: '55472', PGUSER: 'stage_test',
  PGDATABASE: 'postgres', PGSSLMODE: 'disable', PGPASSWORD: '',
};
const psqlArgs = ['-XqAt', '-v', 'ON_ERROR_STOP=1'];
const sql = text => execFileSync(join(bin, 'psql'), [...psqlArgs, '-c', text], { env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const owner = id(1), project = id(10), quote = id(20);
const invocation = (stage = id(30), percentage = 20, subtotal = 200, rate = 10) =>
  `SELECT public.create_stage_invoice('${project}','${stage}','${quote}',${percentage},NULL,${subtotal},${rate})`;
const asOwner = statement => `SET request.jwt.claim.sub='${owner}'; SET ROLE authenticated; ${statement}`;
let started = false;
try {
  execFileSync(join(bin, 'initdb'), ['-D', data, '-A', 'trust', '-U', 'stage_test'], { stdio: 'pipe' });
  execFileSync(join(bin, 'pg_ctl'), ['-D', data, '-l', join(dir, 'log'), '-o', `-k ${dir} -p 55472 -h ''`, '-w', 'start'], { stdio: 'pipe' });
  started = true;
  sql(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    CREATE TABLE public.projects(id uuid PRIMARY KEY,user_id uuid,active_quote_id uuid);
    CREATE TABLE public.quotes(id uuid PRIMARY KEY,project_id uuid,quote_number text,subtotal numeric,total numeric,tax_rate numeric);
    CREATE TABLE public.project_stages(id uuid PRIMARY KEY,project_id uuid,name text,status text,invoice_amount numeric,invoice_percentage numeric);
    CREATE TABLE public.invoices(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid,quote_id uuid,stage_id uuid REFERENCES public.project_stages(id),
      invoice_number text,type text,status text,subtotal numeric,tax_rate numeric,tax_amount numeric,total numeric,due_date date,notes text,terms text);
    CREATE TABLE public.invoice_line_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,description text,quantity numeric,unit_price numeric,total numeric);
    INSERT INTO public.projects VALUES('${project}','${owner}','${quote}'),('${id(11)}','${owner}',NULL);
    INSERT INTO public.quotes VALUES('${quote}','${project}','QT-TEST',1000,1100,10);
    INSERT INTO public.project_stages VALUES
      ('${id(30)}','${project}','Preparation','upcoming',NULL,20),
      ('${id(31)}','${project}','Failure','current',NULL,30),
      ('${id(32)}','${project}','Stale','completed',NULL,20),
      ('${id(33)}','${id(11)}','Fixed','upcoming',125,NULL);
    ${readFileSync('supabase/migrations/20261031000000_stage_invoice_atomic.sql', 'utf8')}
  `);
  assert.throws(() => sql(invocation()), /Command failed/, 'unauthenticated requests denied');
  assert.throws(() => sql(`SET request.jwt.claim.sub='${id(2)}'; SET ROLE authenticated; ${invocation()}`), /Command failed/, 'another owner denied');
  assert.throws(() => sql(asOwner(invocation(id(33)))), /Command failed/, 'stage from another project denied');
  const run = promisify(execFile);
  const simultaneous = await Promise.all([1, 2].map(() =>
    run(join(bin, 'psql'), [...psqlArgs, '-c', asOwner(invocation())], { env, encoding: 'utf8' })));
  const first = simultaneous[0].stdout.trim();
  assert.equal(first, simultaneous[1].stdout.trim(), 'concurrent requests return the same invoice');
  assert.equal(sql(`SELECT count(*) FROM public.invoices WHERE stage_id='${id(30)}'`), '1');
  assert.equal(sql(`SELECT count(*) FROM public.invoice_line_items WHERE invoice_id='${first}'`), '1');
  assert.equal(sql(`SELECT subtotal||'|'||tax_amount||'|'||total FROM public.invoices WHERE id='${first}'`), '200.00|20.00|220.00');
  assert.equal(sql(`SELECT status FROM public.project_stages WHERE id='${id(30)}'`), 'upcoming');
  assert.equal(sql(`SELECT subtotal||'|'||total FROM public.quotes WHERE id='${quote}'`), '1000|1100');
  assert.throws(() => sql(asOwner(invocation(id(32), 20, 200, 5))), /Command failed/, 'stale GST preview denied');
  assert.throws(() => sql(asOwner(invocation(id(32), 10, 100))), /Command failed/, 'stale allocation denied');
  assert.equal(sql(`SELECT count(*) FROM public.invoices WHERE stage_id='${id(32)}'`), '0');
  sql(`CREATE FUNCTION public.fail_test_line() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Synthetic line failure'; END $$;
    CREATE TRIGGER fail_line BEFORE INSERT ON public.invoice_line_items
      FOR EACH ROW EXECUTE FUNCTION public.fail_test_line();`);
  assert.throws(() => sql(asOwner(invocation(id(31), 30, 300))), /Command failed/);
  assert.equal(sql(`SELECT count(*) FROM public.invoices WHERE stage_id='${id(31)}'`), '0', 'line failure rolls header back');
  sql('DROP TRIGGER fail_line ON public.invoice_line_items');
  const retry = sql(asOwner(invocation(id(31), 30, 300)));
  assert.ok(retry);
  sql(`UPDATE public.invoices SET status='cancelled' WHERE id='${first}'`);
  const replacement = sql(asOwner(invocation()));
  assert.notEqual(replacement, first);
  assert.equal(sql(`SELECT status FROM public.invoices WHERE id='${first}'`), 'cancelled');
  sql(`DELETE FROM public.invoices WHERE id='${replacement}'`);
  assert.notEqual(sql(asOwner(invocation())), replacement, 'deleted draft releases the stage');
  const fixed = sql(asOwner(`SELECT public.create_stage_invoice('${id(11)}','${id(33)}',NULL,NULL,125,125,10)`));
  assert.equal(sql(`SELECT total FROM public.invoices WHERE id='${fixed}'`), '137.50');
  sql(`UPDATE public.quotes SET subtotal=0,total=0 WHERE id='${quote}'`);
  assert.throws(() => sql(asOwner(invocation(id(32)))), /Command failed/, 'invalid saved quote must not use live scope');
  console.log('PASS isolated stage invoice SQL: ownership, concurrency, amounts, stale previews, atomic rollback, cancellation, deletion, fixed amounts');
} finally {
  if (started) execFileSync(join(bin, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'], { stdio: 'pipe' });
  rmSync(dir, { recursive: true, force: true });
}
