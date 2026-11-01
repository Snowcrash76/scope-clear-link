// Explicit owner-approved, additive setup; credentials only enter the psql environment.
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

try {
  const sql = readFileSync(new URL('../supabase/migrations/20261104000000_multi_day_assignments.sql', import.meta.url), 'utf8');
  const url = new URL((process.env.SUPABASE_BACKUP_DATABASE_URL || '').replace(/\[(YOUR-PASSWORD|YOUR_PASSWORD)\]/gi, 'placeholder'));
  const project = new URL(process.env.VITE_SUPABASE_URL || 'https://aswmcyldowvpugmfmykf.supabase.co').hostname.split('.')[0];
  const user = decodeURIComponent(url.username);
  if (!process.env.SUPABASE_BACKUP_DATABASE_PASSWORD || !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !(url.hostname === `db.${project}.supabase.co` ||
        url.hostname.endsWith('.pooler.supabase.com') && user === `postgres.${project}`)) throw new Error('INVALID_TARGET');
  const binary = readdirSync('/nix/store').filter(name => /postgresql-\d/.test(name))
    .map(name => `/nix/store/${name}/bin/psql`).find(path => existsSync(path));
  if (!binary) throw new Error('PSQL_UNAVAILABLE');
  const expected = sql.split('AS $$')[1].split('$$;')[0].replace(/\r\n/g, '\n').trim();
  const tempFunction = sql.split('REVOKE ALL')[0]
    .replaceAll('public.portal_assign_days', 'pg_temp.portal_assign_days')
    .replaceAll('public.portal_mutate', 'pg_temp.portal_mutate');
  const check = `BEGIN READ ONLY;
    DO $guard$ DECLARE source text; BEGIN
      IF to_regprocedure('public.portal_mutate(uuid,text,jsonb)') IS NULL THEN
        RAISE EXCEPTION 'Existing assignment setup missing';
      END IF;
      SELECT prosrc INTO source FROM pg_proc WHERE oid=to_regprocedure('public.portal_assign_days(uuid,jsonb)');
      IF source IS NOT NULL AND trim(replace(source,E'\\r\\n',E'\\n')) <> $expected$${expected}$expected$ THEN
        RAISE EXCEPTION 'Existing multi-day function differs; stopped without overwriting';
      END IF;
    END $guard$; ROLLBACK;`;
  // Probe a temporary clone. No real appointments, crew, notifications or audit rows are used.
  const tests = `BEGIN;
    CREATE TEMP TABLE assignment_batch_probe(day date);
    CREATE FUNCTION pg_temp.portal_mutate(uuid,text,jsonb) RETURNS jsonb LANGUAGE plpgsql AS $stub$
    BEGIN
      IF $3->>'notes'='simulate failure' AND $3->>'date'='2026-10-03' THEN RAISE EXCEPTION 'Simulated day failure'; END IF;
      INSERT INTO pg_temp.assignment_batch_probe VALUES (($3->>'date')::date);
      RETURN '{"success":true}'::jsonb;
    END $stub$;
    ${tempFunction}
    DO $probe$ BEGIN
      IF (pg_temp.portal_assign_days('10000000-0000-4000-8000-000000000001',
        '{"dates":["2026-10-02","2026-10-03","2026-10-04"]}')->>'days')::integer <> 3 THEN
        RAISE EXCEPTION 'Wrong day count';
      END IF;
      IF (SELECT count(*) FROM pg_temp.assignment_batch_probe) <> 3 THEN RAISE EXCEPTION 'Missing daily rows'; END IF;
      TRUNCATE pg_temp.assignment_batch_probe;
      BEGIN
        PERFORM pg_temp.portal_assign_days('10000000-0000-4000-8000-000000000001',
          '{"dates":["2026-10-02","2026-10-03","2026-10-04"],"notes":"simulate failure"}');
        RAISE EXCEPTION 'Unexpected success' USING ERRCODE='XX000';
      EXCEPTION WHEN raise_exception THEN NULL;
      END;
      IF (SELECT count(*) FROM pg_temp.assignment_batch_probe) <> 0 THEN RAISE EXCEPTION 'Partial batch was not rolled back'; END IF;
    END $probe$;
    ROLLBACK;`;
  const apply = process.argv.includes('--apply')
    ? `BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'; ${sql} COMMIT;`
    : '';
  const permissions = `BEGIN READ ONLY; DO $acl$ BEGIN
    IF has_function_privilege('anon','public.portal_assign_days(uuid,jsonb)','EXECUTE')
       OR has_function_privilege('authenticated','public.portal_assign_days(uuid,jsonb)','EXECUTE')
       OR NOT has_function_privilege('service_role','public.portal_assign_days(uuid,jsonb)','EXECUTE') THEN
      RAISE EXCEPTION 'Invalid multi-day function grants';
    END IF;
    END $acl$; ROLLBACK;`;
  const result = spawnSync(binary, ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-f', '-'], {
    input: `${check}\n${tests}\n${apply}\n${permissions}`, encoding: 'utf8', timeout: 60000,
    env: { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGUSER: user,
      PGPASSWORD: process.env.SUPABASE_BACKUP_DATABASE_PASSWORD, PGDATABASE: url.pathname.slice(1) || 'postgres',
      PGSSLMODE: 'require', PGCONNECT_TIMEOUT: '15', PGAPPNAME: 'scope-multi-day-assignment-setup' },
  });
  if (result.status !== 0) {
    // Connection errors can contain sensitive configuration: print no raw stderr.
    console.error('Multi-day setup/check failed. Database connection details have been withheld.');
    process.exitCode = 1;
  } else console.log(`PASS: daily creation, atomic rollback and server-only permissions.${apply ? ' Additive multi-day setup applied; existing functions and customer records unchanged.' : ''}`);
} catch {
  console.error('Multi-day setup/check could not start. No credentials were logged.');
  process.exitCode = 1;
}
