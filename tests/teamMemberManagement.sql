-- Run only in the disposable local cluster, after employeeTransactions.sql.
BEGIN;
DO $$
DECLARE owner_id uuid:='10000000-0000-4000-8000-000000000001';
  member_id uuid:='30000000-0000-4000-8000-000000000001';
  other_owner uuid:='10000000-0000-4000-8000-000000000004';
  history_count integer; cost_count integer; old_identity uuid; mistaken_id uuid;
BEGIN
  SELECT auth_user_id INTO old_identity FROM public.employees WHERE id=member_id;
  SELECT count(*) INTO history_count FROM public.employee_time_entries WHERE employee_id=member_id;
  SELECT count(*) INTO cost_count FROM public.job_costs WHERE timesheet_entry_id IS NOT NULL;
  PERFORM public.portal_mutate(owner_id,'team_invite',
    jsonb_build_object('employee_id',member_id,'token_hash','local-old-email-test'));
  PERFORM public.portal_manage_employee(owner_id,member_id,'update',
    '{"email":" CORRECTED@example.invalid ","name":"Corrected Worker"}');
  IF NOT EXISTS(SELECT 1 FROM public.employees WHERE id=member_id AND email='corrected@example.invalid'
      AND auth_user_id IS NULL AND revoked_auth_user_ids @> ARRAY[old_identity]) THEN
    RAISE EXCEPTION 'FAIL: email update did not revoke the previous identity';
  END IF;
  BEGIN
    PERFORM public.portal_owner(old_identity);
    RAISE EXCEPTION 'FAIL: former employee became an owner';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub',old_identity::text,true);
  IF NOT public.portal_is_employee() THEN RAISE EXCEPTION 'FAIL: former employee lost raw access fence'; END IF;
  IF EXISTS(SELECT 1 FROM public.employee_invitations WHERE token_hash='local-old-email-test' AND expires_at>now()) THEN
    RAISE EXCEPTION 'FAIL: old invitation survived email change';
  END IF;
  INSERT INTO auth.users(id,email) VALUES ('10000000-0000-4000-8000-000000000099','corrected@example.invalid');
  PERFORM public.portal_mutate(owner_id,'team_invite',
    jsonb_build_object('employee_id',member_id,'token_hash','local-corrected-email-test'));
  PERFORM public.portal_accept_invitation('local-corrected-email-test','10000000-0000-4000-8000-000000000099');
  IF NOT EXISTS(SELECT 1 FROM public.employees WHERE id=member_id
      AND auth_user_id='10000000-0000-4000-8000-000000000099') THEN
    RAISE EXCEPTION 'FAIL: corrected address could not accept a fresh invitation';
  END IF;
  -- A running shift blocks removal rather than inventing or discarding hours.
  INSERT INTO public.employee_time_entries(owner_id,employee_id,project_id,work_date,started_at)
    VALUES(owner_id,member_id,'20000000-0000-4000-8000-000000000001',current_date,now()-interval '1 hour');
  BEGIN
    PERFORM public.portal_manage_employee(owner_id,member_id,'remove');
    RAISE EXCEPTION 'FAIL: running shift was abandoned by removal';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  DELETE FROM public.employee_time_entries WHERE employee_id=member_id AND ended_at IS NULL;
  BEGIN
    PERFORM public.portal_manage_employee(other_owner,member_id,'remove');
    RAISE EXCEPTION 'FAIL: cross-business removal allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.portal_manage_employee(owner_id,member_id,'remove');
  PERFORM public.portal_manage_employee(owner_id,member_id,'remove');
  IF NOT EXISTS(SELECT 1 FROM public.employees WHERE id=member_id AND NOT active AND archived_at IS NOT NULL
      AND auth_user_id IS NULL AND revoked_auth_user_ids @> ARRAY['10000000-0000-4000-8000-000000000099'::uuid]) THEN
    RAISE EXCEPTION 'FAIL: removal did not archive the member';
  END IF;
  IF history_count<>(SELECT count(*) FROM public.employee_time_entries WHERE employee_id=member_id)
     OR cost_count<>(SELECT count(*) FROM public.job_costs WHERE timesheet_entry_id IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL: work or cost history changed';
  END IF;
  IF (SELECT count(*) FROM public.employee_audit_events WHERE employee_id=member_id AND action='employee.removed')<>1 THEN
    RAISE EXCEPTION 'FAIL: repeated removal added duplicate events';
  END IF;
  BEGIN
    PERFORM public.portal_manage_employee(owner_id,member_id,'update','{"active":true}');
    RAISE EXCEPTION 'FAIL: removed member was reactivated';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.portal_mutate(owner_id,'team_employee',jsonb_build_object('id',member_id,'active',true));
    RAISE EXCEPTION 'FAIL: legacy endpoint reactivated a removed member';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  PERFORM public.portal_mutate(owner_id,'team_employee',
    '{"email":"corrected@example.invalid","name":"Re-added Member","role":"labourer"}');
  IF NOT EXISTS(SELECT 1 FROM public.employees WHERE email='corrected@example.invalid' AND archived_at IS NULL AND id<>member_id) THEN
    RAISE EXCEPTION 'FAIL: removed email could not be reused for a new member';
  END IF;
  mistaken_id:=(public.portal_mutate(owner_id,'team_employee',
    '{"email":"owner@example.test","name":"Mistaken owner entry","role":"labourer"}')->>'id')::uuid;
  PERFORM public.portal_manage_employee(owner_id,mistaken_id,'remove');
  IF NOT EXISTS(SELECT 1 FROM public.employees WHERE id=mistaken_id AND archived_at IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL: mistaken owner-email entry could not be removed';
  END IF;
  IF has_function_privilege('authenticated','public.portal_manage_employee(uuid,uuid,text,jsonb)','EXECUTE')
    OR has_function_privilege('anon','public.portal_manage_employee(uuid,uuid,text,jsonb)','EXECUTE')
    OR has_function_privilege('service_role','public.portal_mutate_core(uuid,text,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'FAIL: management function grants are unsafe';
  END IF;
END $$;
ROLLBACK;
