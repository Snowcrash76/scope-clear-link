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
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
    CREATE TABLE public.projects(id uuid PRIMARY KEY,user_id uuid,active_quote_id uuid);
    CREATE TABLE public.quotes(id uuid PRIMARY KEY,project_id uuid,quote_number text,subtotal numeric,total numeric,tax_rate numeric);
    CREATE TABLE public.project_stages(id uuid PRIMARY KEY,project_id uuid,name text,status text,invoice_amount numeric,invoice_percentage numeric);
    CREATE TABLE public.invoices(
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid,quote_id uuid,stage_id uuid REFERENCES public.project_stages(id),
      invoice_number text,type text,status text,subtotal numeric,tax_rate numeric,tax_amount numeric,total numeric,
      due_date date,notes text,terms text,updated_at timestamptz DEFAULT now());
    CREATE TABLE public.invoice_line_items(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,description text,quantity numeric,
      unit_price numeric,total numeric,scope_item_id uuid,change_request_id uuid);
    CREATE TABLE public.scope_items(id uuid PRIMARY KEY,project_id uuid);
    CREATE TABLE public.change_requests(id uuid PRIMARY KEY,project_id uuid);
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
  sql(readFileSync('supabase/migrations/20261031010000_invoice_approval.sql', 'utf8'));
  sql(readFileSync('supabase/migrations/20261031020000_retain_invoice_history.sql', 'utf8'));
  sql(`UPDATE public.quotes SET subtotal=1000,total=1100 WHERE id='${quote}';
    GRANT SELECT,INSERT,UPDATE,DELETE ON public.invoices,public.invoice_line_items TO authenticated;
    GRANT USAGE ON SCHEMA auth TO authenticated;`);
  const reviewId = sql(asOwner(invocation(id(32))));
  const revision = () => Number(sql(`SELECT revision FROM public.invoices WHERE id='${reviewId}'`));
  const approve = (version = revision()) => `SELECT public.approve_invoice('${project}','${reviewId}',${version})`;
  const edit = (description = 'Edited milestone', version = revision()) =>
    `SELECT public.save_invoice_for_approval('${project}','${reviewId}',${version},
    'INV-EDIT','2026-11-12','New payment details','New terms',10,
    '[{"description":"${description}","quantity":2,"unit_price":125}]'::jsonb)`;
  const service = statement => `SET ROLE service_role; ${statement}`;
  const claim = (payload = '{"html":"original","to":["synthetic@example.test"]}') =>
    `SELECT public.claim_invoice_delivery('${project}','${reviewId}','${owner}',${revision()},'${payload}'::jsonb)`;
  const finish = (token, success, rejected = false) =>
    `SELECT public.finish_invoice_delivery('${reviewId}','${token}','${owner}',${success},${rejected})`;
  assert.throws(() => sql(approve()), /Command failed/, 'anonymous approval denied');
  assert.throws(() => sql(`SET request.jwt.claim.sub='${id(2)}'; SET ROLE authenticated; ${approve()}`), /Command failed/);
  assert.throws(() => sql(asOwner(`UPDATE public.invoices SET approved_at=now(),approved_by='${owner}' WHERE id='${reviewId}'`)), /Command failed/);
  assert.throws(() => sql(asOwner(claim())), /Command failed/, 'browser cannot call service delivery functions');
  assert.throws(() => sql(service(claim())), /Command failed/, 'unapproved delivery denied');
  const oldRevision = revision();
  sql(asOwner(approve()));
  assert.equal(sql(`SELECT approved_by FROM public.invoices WHERE id='${reviewId}'`), owner);
  assert.equal(sql(`SELECT status FROM public.invoices WHERE id='${reviewId}'`), 'draft', 'approval is not delivery');
  assert.throws(() => sql(asOwner(`UPDATE public.invoices SET status='sent' WHERE id='${reviewId}'`)), /Command failed/);
  assert.throws(() => sql(asOwner(edit('Stale edit', oldRevision))), /Command failed/, 'stale edits denied');
  sql(asOwner(edit()));
  assert.equal(sql(`SELECT approved_at IS NULL AND approved_by IS NULL FROM public.invoices WHERE id='${reviewId}'`), 't');
  assert.equal(sql(`SELECT subtotal||'|'||tax_amount||'|'||total FROM public.invoices WHERE id='${reviewId}'`), '250.00|25.00|275.00');
  assert.equal(sql(`SELECT stage_id||'|'||quote_id FROM public.invoices WHERE id='${reviewId}'`), `${id(32)}|${quote}`);
  assert.equal(sql(`SELECT invoice_percentage FROM public.project_stages WHERE id='${id(32)}'`), '20');
  assert.equal(sql(`SELECT subtotal FROM public.quotes WHERE id='${quote}'`), '1000');
  sql(asOwner(approve()));
  sql(`CREATE FUNCTION public.force_approval_line_failure() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.description='Force rollback' THEN RAISE EXCEPTION 'Synthetic failure'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER force_approval_line_failure BEFORE INSERT ON public.invoice_line_items
      FOR EACH ROW EXECUTE FUNCTION public.force_approval_line_failure();`);
  assert.throws(() => sql(asOwner(edit('Force rollback'))), /Command failed/);
  assert.equal(sql(`SELECT approved_at IS NOT NULL AND total=275 FROM public.invoices WHERE id='${reviewId}'`), 't', 'failed edit preserves approval and money atomically');
  assert.equal(sql(`SELECT description FROM public.invoice_line_items WHERE invoice_id='${reviewId}'`), 'Edited milestone');
  sql('DROP TRIGGER force_approval_line_failure ON public.invoice_line_items');
  const results = await Promise.allSettled([1, 2].map(() =>
    run(join(bin, 'psql'), [...psqlArgs, '-c', service(claim())], { env, encoding: 'utf8' })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const claimed = JSON.parse(results.find(result => result.status === 'fulfilled').value.stdout.trim());
  assert.throws(() => sql(asOwner(edit())), /Command failed/, 'edits locked during delivery');
  assert.throws(() => sql(asOwner(approve())), /Command failed/, 'approval locked during delivery');
  assert.throws(() => sql(asOwner(`DELETE FROM public.invoices WHERE id='${reviewId}'`)), /Command failed/);
  assert.throws(() => sql(asOwner(`UPDATE public.invoice_line_items SET unit_price=1 WHERE invoice_id='${reviewId}'`)), /Command failed/);
  sql(service(finish(claimed.token, false, true)));
  assert.equal(sql(`SELECT delivery_token IS NULL AND approved_at IS NOT NULL AND status='draft' FROM public.invoices WHERE id='${reviewId}'`), 't');
  const nextClaim = JSON.parse(sql(service(claim())));
  assert.notEqual(nextClaim.token, claimed.token, 'known rejected email can be retried after correction');
  sql(service(finish(nextClaim.token, false)));
  const safeRetry = JSON.parse(sql(service(claim('{"html":"should not replace original"}'))));
  assert.equal(safeRetry.token, nextClaim.token);
  assert.deepEqual(safeRetry.payload, nextClaim.payload, 'uncertain retries retain the exact payload and idempotency key');
  sql(service(finish(safeRetry.token, true)));
  assert.equal(sql(`SELECT status||'|'||(delivery_token IS NULL)::text FROM public.invoices WHERE id='${reviewId}'`), 'sent|true');
  assert.equal(JSON.parse(sql(service(claim()))).already_sent, true, 'repeated delivery does not send again');
  assert.throws(() => sql(asOwner(`DELETE FROM public.invoices WHERE id='${reviewId}'`)), /Command failed/, 'sent invoices cannot be deleted');
  assert.throws(() => sql(asOwner(edit())), /Command failed/, 'issued history cannot be edited');
  assert.throws(() => sql(asOwner(`UPDATE public.invoices SET status='draft' WHERE id='${reviewId}'`)), /Command failed/, 'issued invoices cannot bypass approval by downgrading');
  assert.throws(() => sql(asOwner(`UPDATE public.invoices SET total=1 WHERE id='${reviewId}'`)), /Command failed/);
  assert.throws(() => sql(asOwner(`UPDATE public.invoice_line_items SET unit_price=1 WHERE invoice_id='${reviewId}'`)), /Command failed/);
  sql(asOwner(`UPDATE public.invoices SET status='paid' WHERE id='${reviewId}'`));
  assert.equal(sql(`SELECT status FROM public.invoices WHERE id='${reviewId}'`), 'paid');
  assert.throws(() => sql(asOwner(`DELETE FROM public.invoices WHERE id='${reviewId}'`)), /Command failed/, 'paid invoices cannot be deleted');
  sql(asOwner(`UPDATE public.invoices SET status='overdue' WHERE id='${reviewId}'`));
  assert.throws(() => sql(asOwner(`DELETE FROM public.invoices WHERE id='${reviewId}'`)), /Command failed/, 'overdue invoices cannot be deleted');
  sql(asOwner(`UPDATE public.invoices SET status='cancelled' WHERE id='${reviewId}'`));
  assert.throws(() => sql(asOwner(`DELETE FROM public.invoices WHERE id='${reviewId}'`)), /Command failed/, 'cancelling an issued invoice does not permit deletion');
  assert.throws(() => sql(asOwner(`UPDATE public.invoices SET status='draft' WHERE id='${reviewId}'; DELETE FROM public.invoices WHERE id='${reviewId}'`)), /Command failed/, 'status-change then delete cannot erase history');
  assert.equal(sql(`SELECT count(*) FROM public.invoice_line_items WHERE invoice_id='${reviewId}'`), '1', 'blocked deletion retains line history');
  for (const status of ['sent','paid','overdue','cancelled']) {
    const legacyId = sql(`INSERT INTO public.invoices(project_id,invoice_number,type,status,subtotal,tax_rate,tax_amount,total)
      VALUES('${project}','INV-LEGACY-${status}','final','${status}',10,10,1,11) RETURNING id`);
    assert.throws(() => sql(asOwner(`DELETE FROM public.invoices WHERE id='${legacyId}'`)), /Command failed/, 'legacy issued history is retained without approval metadata');
  }
  const pendingId = sql(asOwner(`INSERT INTO public.invoices(project_id,invoice_number,type,status,subtotal,tax_rate,tax_amount,total)
    VALUES('${project}','INV-NEVER-ISSUED','final','draft',10,10,1,11) RETURNING id`));
  sql(asOwner(`INSERT INTO public.invoice_line_items(invoice_id,description,quantity,unit_price,total)
    VALUES('${pendingId}','Pending line',1,10,10); DELETE FROM public.invoices WHERE id='${pendingId}'`));
  assert.equal(sql(`SELECT count(*) FROM public.invoices WHERE id='${pendingId}'`), '0', 'never-issued invoices remain deletable');
  assert.equal(sql(`SELECT count(*) FROM public.invoice_line_items WHERE invoice_id='${pendingId}'`), '0');
  console.log('PASS isolated invoice approval SQL: edit/reapprove, persisted actor, stale writes, direct bypass denial, atomic rollback, delivery concurrency, safe retries and issued history');
} finally {
  if (started) execFileSync(join(bin, 'pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'], { stdio: 'pipe' });
  rmSync(dir, { recursive: true, force: true });
}
