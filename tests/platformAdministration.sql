-- Synthetic local database only. Never run this fixture against a live database.
INSERT INTO auth.users(id,email) VALUES('90000000-0000-4000-8000-000000000001','platform-admin@example.invalid');
INSERT INTO public.quotes(id,project_id,quote_number,status,subtotal,tax_rate,tax_amount,total,quote_token)
  VALUES('80000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
  'SYNTHETIC-PLATFORM','sent',1000,10,100,1100,'80000000-0000-4000-8000-000000000002');
INSERT INTO storage.objects(bucket_id,name,owner) VALUES('project-documents',
  '20000000-0000-4000-8000-000000000001/platform-fixture.pdf','10000000-0000-4000-8000-000000000001');
CREATE POLICY platform_fixture_file_read ON storage.objects FOR SELECT TO authenticated USING(owner=auth.uid());
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
DO $$ BEGIN IF (SELECT count(*) FROM storage.objects WHERE name LIKE '%platform-fixture.pdf')<>1 THEN RAISE EXCEPTION 'FAIL: file fixture not accessible before restriction'; END IF; END $$;
RESET ROLE;
DO $$
DECLARE owner uuid:='10000000-0000-4000-8000-000000000001'; admin uuid:='90000000-0000-4000-8000-000000000001';
  staff uuid:='10000000-0000-4000-8000-000000000002'; email text;
BEGIN
  SELECT u.email INTO email FROM auth.users u WHERE id=owner;
  PERFORM public.platform_change_access(admin,'platform-admin@example.invalid','business',owner,'suspend','Synthetic business restriction',email);
  IF public.platform_check_access(owner) OR public.platform_check_access(staff) OR public.platform_check_business(owner) THEN
    RAISE EXCEPTION 'FAIL: business restriction did not cover owner and staff';
  END IF;
  IF NOT public.platform_check_access(admin) THEN RAISE EXCEPTION 'FAIL: unrelated administrator restricted'; END IF;
  BEGIN
    PERFORM public.platform_change_access(admin,'platform-admin@example.invalid','account',admin,'suspend','Self lockout test','platform-admin@example.invalid');
    RAISE EXCEPTION 'FAIL: self lockout allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.platform_change_access(admin,'platform-admin@example.invalid','business',owner,'reactivate','Wrong confirmation test','wrong@example.invalid');
    RAISE EXCEPTION 'FAIL: confirmation bypassed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
END $$;
-- A root administrator's membership in another business must not provide an
-- indirect self-lockout path through a business-level restriction.
INSERT INTO public.employees(id,owner_id,auth_user_id,email,name,role,active)
 VALUES('90000000-0000-4000-8000-000000000099','10000000-0000-4000-8000-000000000004',
 '90000000-0000-4000-8000-000000000001','platform-admin@example.invalid','Root membership','labourer',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.platform_change_access('90000000-0000-4000-8000-000000000001','platform-admin@example.invalid',
      'business','10000000-0000-4000-8000-000000000004','suspend','Test indirect lockout',
      (SELECT email FROM auth.users WHERE id='10000000-0000-4000-8000-000000000004'));
    RAISE EXCEPTION 'FAIL: root administrator can indirectly disable their account';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'System administrator accounts are protected%' THEN RAISE; END IF;
  END;
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.projects) THEN RAISE EXCEPTION 'FAIL: existing JWT can read suspended business'; END IF;
  IF EXISTS(SELECT 1 FROM public.profiles) THEN RAISE EXCEPTION 'FAIL: suspended owner can read direct profile'; END IF;
  IF EXISTS(SELECT 1 FROM storage.objects WHERE name LIKE '%platform-fixture.pdf') THEN RAISE EXCEPTION 'FAIL: existing JWT can read suspended private storage'; END IF;
  BEGIN
    PERFORM public.platform_change_access('90000000-0000-4000-8000-000000000001','platform-admin@example.invalid','business',
      '10000000-0000-4000-8000-000000000001','reactivate','Direct SDK bypass','owner@example.invalid');
    RAISE EXCEPTION 'FAIL: authenticated caller can invoke service-only controls';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM id FROM public.platform_admin_audit;
    RAISE EXCEPTION 'FAIL: ordinary account reads global audit';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.approve_invoice('20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000003',0);
    RAISE EXCEPTION 'FAIL: suspended JWT can approve invoices through security definer RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.create_stage_invoice('20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000003',NULL,NULL,NULL,NULL,NULL);
    RAISE EXCEPTION 'FAIL: suspended JWT can create stage invoices through security definer RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.__platform_core_approve_invoice('20000000-0000-4000-8000-000000000001','80000000-0000-4000-8000-000000000003',0);
    RAISE EXCEPTION 'FAIL: internal invoice implementation callable directly';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM public.respond_to_quote_by_token('80000000-0000-4000-8000-000000000002','approved',NULL);
    RAISE EXCEPTION 'FAIL: anonymous client can approve suspended business quote through direct RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000004',false);
DO $$ BEGIN IF (SELECT count(*) FROM public.projects)<>1 THEN RAISE EXCEPTION 'FAIL: suspension affected another business'; END IF; END $$;
RESET ROLE;
DO $$
DECLARE owner uuid:='10000000-0000-4000-8000-000000000001'; admin uuid:='90000000-0000-4000-8000-000000000001';
  staff uuid:='10000000-0000-4000-8000-000000000002'; email text; staff_email text;
BEGIN
  SELECT u.email INTO email FROM auth.users u WHERE id=owner;
  SELECT u.email INTO staff_email FROM auth.users u WHERE id=staff;
  PERFORM public.platform_change_access(admin,'platform-admin@example.invalid','account',staff,'suspend','Separate individual restriction',staff_email);
  PERFORM public.platform_change_access(admin,'platform-admin@example.invalid','business',owner,'reactivate','Restore business only',email);
  IF NOT public.platform_check_access(owner) OR public.platform_check_access(staff) THEN
    RAISE EXCEPTION 'FAIL: restoring business restored separately restricted account';
  END IF;
  PERFORM public.platform_change_access(admin,'platform-admin@example.invalid','account',staff,'reactivate','Restore employee account',staff_email);
  IF NOT public.platform_check_access(staff) THEN RAISE EXCEPTION 'FAIL: employee account not restored'; END IF;
END $$;
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
DO $$ BEGIN IF (SELECT count(*) FROM public.projects)<>1 THEN RAISE EXCEPTION 'FAIL: restored owner lost tenant isolation'; END IF; END $$;
DO $$
DECLARE invoice_id uuid; version integer;
BEGIN
  INSERT INTO public.invoices(project_id,invoice_number,status,subtotal,tax_rate,tax_amount,total)
    VALUES('20000000-0000-4000-8000-000000000001','PLATFORM-SYNTHETIC','draft',100,10,10,110)
    RETURNING id,revision INTO invoice_id,version;
  invoice_id:=public.save_invoice_for_approval(
    '20000000-0000-4000-8000-000000000001',invoice_id,version,'PLATFORM-SYNTHETIC',current_date+7,NULL,NULL,10,
    '[{"description":"Synthetic work","quantity":1,"unit_price":100}]'::jsonb);
  SELECT revision INTO version FROM public.invoices WHERE id=invoice_id;
  PERFORM public.approve_invoice('20000000-0000-4000-8000-000000000001',invoice_id,version);
  IF NOT EXISTS(SELECT 1 FROM public.invoices WHERE id=invoice_id AND approved_at IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL: invoice contracts changed for unrestricted owner';
  END IF;
END $$;
RESET ROLE;
DO $$
DECLARE admin uuid:='90000000-0000-4000-8000-000000000001'; member uuid:='30000000-0000-4000-8000-000000000001';
  email text; history_count int; jobs_count int;
BEGIN
  SELECT e.email INTO email FROM public.employees e WHERE id=member;
  SELECT count(*) INTO history_count FROM public.employee_time_entries WHERE employee_id=member;
  SELECT count(*) INTO jobs_count FROM public.projects;
  PERFORM public.platform_remove_membership(admin,'platform-admin@example.invalid',member,'Remove synthetic team access',email);
  IF EXISTS(SELECT 1 FROM public.employees WHERE id=member AND (active OR archived_at IS NULL OR auth_user_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'FAIL: membership still active';
  END IF;
  IF (SELECT count(*) FROM public.employee_time_entries WHERE employee_id=member)<>history_count
    OR (SELECT count(*) FROM public.projects)<>jobs_count THEN RAISE EXCEPTION 'FAIL: history erased'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.platform_admin_audit WHERE actor_id=admin AND target_id=member AND action='remove') THEN
    RAISE EXCEPTION 'FAIL: removal audit not attributed to actual system administrator';
  END IF;
END $$;
