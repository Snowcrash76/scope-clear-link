INSERT INTO auth.users(id,email) VALUES
 ('10000000-0000-4000-8000-000000000001','owner@example.test'),
 ('10000000-0000-4000-8000-000000000002','worker@example.test'),
 ('10000000-0000-4000-8000-000000000003','supervisor@example.test'),
 ('10000000-0000-4000-8000-000000000004','other-owner@example.test'),
 ('10000000-0000-4000-8000-000000000005','other-worker@example.test');
INSERT INTO public.projects(id,user_id,name,client_name,client_email) VALUES
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Test Job','Client','client@example.test'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','Other Job','Other Client','other@example.test');
INSERT INTO public.employees(id,owner_id,auth_user_id,email,name,role) VALUES
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','worker@example.test','Test Worker','labourer'),
 ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000003','supervisor@example.test','Test Supervisor','supervisor'),
 ('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000005','other-worker@example.test','Other Worker','labourer');
SELECT public.portal_mutate('10000000-0000-4000-8000-000000000001','team_assign',
 '{"project_id":"20000000-0000-4000-8000-000000000001","employee_ids":["30000000-0000-4000-8000-000000000001","30000000-0000-4000-8000-000000000002"],"date":"2026-10-26","start_time":"08:00","end_time":"16:00"}');
SELECT public.portal_mutate('10000000-0000-4000-8000-000000000001','team_employee',
 '{"id":"30000000-0000-4000-8000-000000000001","hourly_rate":42.50}');
SELECT public.portal_mutate('10000000-0000-4000-8000-000000000002','time_save',
 '{"project_id":"20000000-0000-4000-8000-000000000001","started_at":"2026-10-25T21:00:00Z","ended_at":"2026-10-26T05:00:00Z","break_minutes":30,"notes":"Work"}');
DO $$ BEGIN
  BEGIN
    PERFORM public.portal_mutate('10000000-0000-4000-8000-000000000002','time_save',
      '{"project_id":"20000000-0000-4000-8000-000000000001","started_at":"2026-10-25T22:00:00Z","ended_at":"2026-10-26T01:00:00Z","break_minutes":0}');
    RAISE EXCEPTION 'FAIL: overlapping entry accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.portal_mutate('10000000-0000-4000-8000-000000000002','time_save',
      '{"project_id":"20000000-0000-4000-8000-000000000002","started_at":"2026-10-26T21:00:00Z","ended_at":"2026-10-27T01:00:00Z","break_minutes":0}');
    RAISE EXCEPTION 'FAIL: cross-business time accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT public.portal_mutate('10000000-0000-4000-8000-000000000002','submit','{"week_start":"2026-10-26"}');
DO $$ DECLARE s uuid; BEGIN
  SELECT id INTO s FROM public.employee_week_submissions WHERE employee_id='30000000-0000-4000-8000-000000000001';
  BEGIN
    PERFORM public.portal_review_week('10000000-0000-4000-8000-000000000002',s,'approved','');
    RAISE EXCEPTION 'FAIL: self approval accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.portal_review_week('10000000-0000-4000-8000-000000000004',s,'approved','');
    RAISE EXCEPTION 'FAIL: cross-business review accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.portal_review_week('10000000-0000-4000-8000-000000000003',s,'approved','Checked');
  PERFORM public.portal_review_week('10000000-0000-4000-8000-000000000003',s,'approved','Retry');
  IF (SELECT count(*) FROM public.job_costs WHERE timesheet_submission_id=s)<>1 THEN RAISE EXCEPTION 'FAIL: duplicate labour'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.job_costs WHERE timesheet_submission_id=s AND amount_ex_gst=318.75 AND amount_inc_gst=318.75 AND gst_amount=0 AND NOT gst_applies) THEN RAISE EXCEPTION 'FAIL: incorrect paid time/rate/GST'; END IF;
  IF (SELECT rate_snapshot FROM public.employee_time_entries WHERE employee_id='30000000-0000-4000-8000-000000000001')<>42.50 THEN RAISE EXCEPTION 'FAIL: missing rate snapshot'; END IF;
  BEGIN
    PERFORM public.portal_mutate('10000000-0000-4000-8000-000000000002','time_delete',
      jsonb_build_object('id',(SELECT id FROM public.employee_time_entries WHERE employee_id='30000000-0000-4000-8000-000000000001')));
    RAISE EXCEPTION 'FAIL: approved edit allowed';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  PERFORM public.portal_review_week('10000000-0000-4000-8000-000000000001',s,'reopen','Correct duration');
  IF EXISTS(SELECT 1 FROM public.job_costs WHERE timesheet_submission_id=s) THEN RAISE EXCEPTION 'FAIL: reversal missing'; END IF;
  PERFORM public.portal_mutate('10000000-0000-4000-8000-000000000002','submit','{"week_start":"2026-10-26"}');
  PERFORM public.portal_review_week('10000000-0000-4000-8000-000000000001',s,'approved','Corrected');
  IF (SELECT count(*) FROM public.job_costs WHERE timesheet_submission_id=s)<>1 THEN RAISE EXCEPTION 'FAIL: reapproval duplicated'; END IF;
END $$;
-- A raw authenticated SDK call must not return a project or a private rate.
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',false);
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM public.projects) THEN RAISE EXCEPTION 'FAIL: employee project RLS bypass'; END IF;
  IF EXISTS(SELECT 1 FROM public.employee_cost_rates) THEN RAISE EXCEPTION 'FAIL: employee rates RLS bypass'; END IF;
  BEGIN
    PERFORM public.portal_mutate('10000000-0000-4000-8000-000000000001','team_permissions','{}');
    RAISE EXCEPTION 'FAIL: employee called service RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.projects)<>1 THEN RAISE EXCEPTION 'FAIL: owner tenant fence'; END IF;
END $$;
RESET ROLE;
SET ROLE anon;
DO $$ BEGIN
  BEGIN
    PERFORM id FROM public.projects LIMIT 1;
    RAISE EXCEPTION 'FAIL: anonymous project read allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
DO $$ BEGIN
  BEGIN
    UPDATE public.employee_audit_events SET action='tampered';
    RAISE EXCEPTION 'FAIL: mutable audit';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
END $$;
DO $$ BEGIN
  BEGIN
    UPDATE public.job_costs SET notes='Changed outside timesheets' WHERE timesheet_entry_id IS NOT NULL;
    RAISE EXCEPTION 'FAIL: direct labour ledger edit accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; END;
  UPDATE public.employees SET active=false WHERE id='30000000-0000-4000-8000-000000000001';
  BEGIN
    PERFORM public.portal_mutate('10000000-0000-4000-8000-000000000002','clock_in','{"project_id":"20000000-0000-4000-8000-000000000001"}');
    RAISE EXCEPTION 'FAIL: inactive employee clocked in';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  UPDATE public.employees SET active=true WHERE id='30000000-0000-4000-8000-000000000001';
END $$;
INSERT INTO public.employee_invitations(employee_id,owner_id,token_hash,expires_at)
  VALUES('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','expired-fixture',now()-interval '1 hour'),
  ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','valid-fixture',now()+interval '1 hour');
DO $$ BEGIN
  BEGIN
    PERFORM public.portal_accept_invitation('expired-fixture','10000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'FAIL: expired invitation accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.portal_accept_invitation('valid-fixture','10000000-0000-4000-8000-000000000003');
    RAISE EXCEPTION 'FAIL: wrong-email invitation accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.portal_accept_invitation('valid-fixture','10000000-0000-4000-8000-000000000002');
  BEGIN
    PERFORM public.portal_accept_invitation('valid-fixture','10000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'FAIL: invitation replay accepted';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
