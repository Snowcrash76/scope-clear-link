BEGIN;
INSERT INTO auth.users(id,email) VALUES
 ('81000000-0000-4000-8000-000000000001','time-owner@example.test'),
 ('81000000-0000-4000-8000-000000000002','time-worker@example.test'),
 ('81000000-0000-4000-8000-000000000003','time-admin@example.test'),
 ('81000000-0000-4000-8000-000000000004','time-other-owner@example.test'),
 ('81000000-0000-4000-8000-000000000005','time-supervisor@example.test');
INSERT INTO public.projects(id,user_id,name,client_name,client_email) VALUES
 ('82000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','Time test job','Client','client@example.test'),
 ('82000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000004','Other time job','Client','client@example.test');
INSERT INTO public.employees(id,owner_id,auth_user_id,email,name,role) VALUES
 ('83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000002','time-worker@example.test','Time worker','labourer'),
 ('83000000-0000-4000-8000-000000000002','81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000003','time-admin@example.test','Time admin','admin'),
 ('83000000-0000-4000-8000-000000000003','81000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000005','time-supervisor@example.test','Time supervisor','supervisor');
SELECT public.portal_mutate('81000000-0000-4000-8000-000000000001','team_assign',
 jsonb_build_object('project_id','82000000-0000-4000-8000-000000000001',
 'employee_ids',jsonb_build_array('83000000-0000-4000-8000-000000000001'),
 'date',(now() AT TIME ZONE 'Australia/Sydney')::date,'start_time','07:00','end_time','15:00'));
INSERT INTO public.employee_cost_rates(employee_id,owner_id,hourly_rate)
 VALUES('83000000-0000-4000-8000-000000000001','81000000-0000-4000-8000-000000000001',30);

CREATE FUNCTION pg_temp.time_denied(actor uuid,entry_id uuid,action text,payload jsonb,expected text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE actual text;
BEGIN
  BEGIN PERFORM public.portal_manage_time_entry(actor,entry_id,action,payload);
  EXCEPTION WHEN OTHERS THEN GET STACKED DIAGNOSTICS actual=RETURNED_SQLSTATE; END;
  IF actual IS DISTINCT FROM expected THEN RAISE EXCEPTION 'Expected rejection %, got %',expected,actual; END IF;
END $$;

DO $$
DECLARE owner_id uuid:='81000000-0000-4000-8000-000000000001';
 worker_id uuid:='81000000-0000-4000-8000-000000000002';
 admin_id uuid:='81000000-0000-4000-8000-000000000003';
 member_id uuid:='83000000-0000-4000-8000-000000000001';
 job_id uuid:='82000000-0000-4000-8000-000000000001';
 target uuid; overlap_id uuid; running_id uuid; submission uuid;
 week date:=date_trunc('week',now() AT TIME ZONE 'Australia/Sydney')::date-7;
 start_at timestamptz; payload jsonb;
BEGIN
 start_at:=(week+time '08:00') AT TIME ZONE 'Australia/Sydney';
 INSERT INTO public.employee_time_entries(owner_id,employee_id,project_id,work_date,started_at,ended_at)
 VALUES(owner_id,member_id,job_id,week,start_at,start_at+interval '1 hour') RETURNING id INTO target;
 payload:=jsonb_build_object('project_id',job_id,'started_at',start_at,'ended_at',start_at+interval '2 hours','break_minutes',0,'notes','Corrected','reason','Missed finish time');
 PERFORM public.portal_manage_time_entry(worker_id,target,'update',payload);
 IF (SELECT paid_minutes FROM public.employee_time_entries WHERE id=target)<>120 THEN RAISE EXCEPTION 'Employee edit did not persist'; END IF;
 PERFORM public.portal_manage_time_entry(owner_id,target,'update',payload);
 PERFORM public.portal_manage_time_entry(admin_id,target,'update',payload);
 IF NOT EXISTS(SELECT 1 FROM public.employee_audit_events WHERE actor_id=admin_id AND action='time.corrected' AND detail->'before'->>'id'=target::text) THEN RAISE EXCEPTION 'Admin correction is not attributed to admin'; END IF;
 PERFORM pg_temp.time_denied('81000000-0000-4000-8000-000000000004',target,'delete','{}','42501');
 PERFORM pg_temp.time_denied('81000000-0000-4000-8000-000000000005',target,'update',payload,'42501');
 PERFORM pg_temp.time_denied(worker_id,target,'submit','{}','42501');
 PERFORM pg_temp.time_denied(admin_id,target,'update',payload||'{"project_id":"82000000-0000-4000-8000-000000000002"}','42501');
 PERFORM pg_temp.time_denied(owner_id,target,'update',payload||'{"break_minutes":999}','P0001');
 INSERT INTO public.employee_time_entries(owner_id,employee_id,project_id,work_date,started_at,ended_at)
 VALUES(owner_id,member_id,job_id,week,start_at+interval '4 hours',start_at+interval '5 hours') RETURNING id INTO overlap_id;
 PERFORM pg_temp.time_denied(owner_id,target,'update',payload||jsonb_build_object('started_at',start_at+interval '4 hours','ended_at',start_at+interval '6 hours'),'P0001');
 DELETE FROM public.employee_time_entries WHERE id=overlap_id;
 INSERT INTO public.employee_time_entries(owner_id,employee_id,project_id,work_date,started_at)
 VALUES(owner_id,member_id,job_id,(now() AT TIME ZONE 'Australia/Sydney')::date,now()-interval '1 hour') RETURNING id INTO running_id;
 PERFORM pg_temp.time_denied(owner_id,running_id,'delete','{}','P0001');
 PERFORM pg_temp.time_denied(worker_id,running_id,'update',payload,'P0001');
 DELETE FROM public.employee_time_entries WHERE id=running_id;
 INSERT INTO public.employee_week_submissions(owner_id,employee_id,week_start,status)
 VALUES(owner_id,member_id,week+7,'approved');
 PERFORM pg_temp.time_denied(owner_id,target,'update',payload||jsonb_build_object('started_at',start_at+interval '7 days','ended_at',start_at+interval '7 days 2 hours'),'P0001');
 DELETE FROM public.employee_week_submissions WHERE employee_id=member_id;
 PERFORM public.portal_manage_time_entry(admin_id,target,'submit','{}');
 PERFORM public.portal_manage_time_entry(admin_id,target,'submit','{}');
 SELECT id INTO submission FROM public.employee_week_submissions WHERE employee_id=member_id AND week_start=week;
 PERFORM pg_temp.time_denied(worker_id,target,'update',payload,'P0001');
 PERFORM pg_temp.time_denied(admin_id,target,'delete','{}','P0001');
 BEGIN
   PERFORM public.portal_review_week(worker_id,submission,'approved','Self approval');
   RAISE EXCEPTION 'Self approval succeeded';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM public.portal_review_week(owner_id,submission,'rejected','Please correct finish time');
 IF (SELECT status FROM public.employee_time_entries WHERE id=target)<>'draft' THEN RAISE EXCEPTION 'Denial did not unlock corrections'; END IF;
 PERFORM public.portal_manage_time_entry(worker_id,target,'update',payload);
 PERFORM public.portal_mutate(worker_id,'submit',jsonb_build_object('week_start',week));
 PERFORM public.portal_review_week(owner_id,submission,'approved','Checked');
 IF (SELECT amount_ex_gst FROM public.job_costs WHERE timesheet_entry_id=target)<>60 THEN RAISE EXCEPTION 'Approval did not post corrected labour'; END IF;
 PERFORM pg_temp.time_denied(admin_id,target,'delete','{}','P0001');
 PERFORM public.portal_review_week(owner_id,submission,'reopen','Correcting approved hours');
 IF EXISTS(SELECT 1 FROM public.job_costs WHERE timesheet_entry_id=target) THEN RAISE EXCEPTION 'Reopen did not reverse posted labour'; END IF;
 PERFORM public.portal_manage_time_entry(admin_id,target,'update',payload||jsonb_build_object('ended_at',start_at+interval '90 minutes'));
 UPDATE public.employees SET active=false WHERE id=member_id;
 PERFORM public.portal_manage_time_entry(admin_id,target,'submit','{}');
 PERFORM public.portal_review_week(owner_id,submission,'approved','Corrected and checked');
 IF (SELECT amount_ex_gst FROM public.job_costs WHERE timesheet_entry_id=target)<>45 THEN RAISE EXCEPTION 'Reapproval did not recalculate labour'; END IF;
 PERFORM public.portal_review_week(owner_id,submission,'reopen','Removing duplicate entry');
 PERFORM public.portal_manage_time_entry(admin_id,target,'delete','{"reason":"Duplicate"}');
 IF EXISTS(SELECT 1 FROM public.employee_time_entries WHERE id=target) THEN RAISE EXCEPTION 'Admin deletion failed'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.employee_audit_events WHERE actor_id=admin_id AND action='time.deleted' AND detail->'before'->>'id'=target::text AND detail->>'reason'='Duplicate') THEN RAISE EXCEPTION 'Deletion audit is missing'; END IF;
 IF has_function_privilege('anon','public.portal_manage_time_entry(uuid,uuid,text,jsonb)','EXECUTE')
 OR has_function_privilege('authenticated','public.portal_manage_time_entry(uuid,uuid,text,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Privileged RPC is publicly callable'; END IF;
END $$;
ROLLBACK;
