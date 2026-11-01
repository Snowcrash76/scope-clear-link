BEGIN;
INSERT INTO auth.users(id,email) VALUES
 ('91000000-0000-4000-8000-000000000001','calendar-owner@example.invalid'),
 ('91000000-0000-4000-8000-000000000002','calendar-staff@example.invalid'),
 ('91000000-0000-4000-8000-000000000003','calendar-other@example.invalid');
INSERT INTO public.employees(id,owner_id,auth_user_id,email,name,role) VALUES
 ('92000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','calendar-staff@example.invalid','Calendar Worker','labourer');
INSERT INTO public.projects(id,user_id,name,client_name,client_email) VALUES
 ('93000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','Calendar job','Client','client@example.invalid');
DO $$
DECLARE
  owner uuid:='91000000-0000-4000-8000-000000000001'; staff uuid:='91000000-0000-4000-8000-000000000002';
  worker uuid:='92000000-0000-4000-8000-000000000001'; ap uuid; second_ap uuid; response jsonb; n integer; old_assignment uuid;
  body jsonb:=jsonb_build_object('title','Inspection','date','2026-11-01','start_time','23:00','end_time','02:00',
    'overnight',true,'project_id',NULL,'notes','Initial','employee_ids',jsonb_build_array('92000000-0000-4000-8000-000000000001'));
BEGIN
  response:=public.portal_schedule_booking(owner,'create',NULL,body); ap:=(response->>'id')::uuid;
  IF ap IS NULL OR NOT EXISTS(SELECT 1 FROM employee_assignments WHERE appointment_id=ap AND project_id IS NULL)
    THEN RAISE EXCEPTION 'Standalone crew booking not saved'; END IF;
  SELECT id INTO old_assignment FROM employee_assignments WHERE appointment_id=ap;
  BEGIN
    PERFORM public.portal_schedule_booking(staff,'create',NULL,body);
    RAISE EXCEPTION 'Employee created booking';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    PERFORM public.portal_schedule_booking('91000000-0000-4000-8000-000000000003','delete',ap,'{}');
    RAISE EXCEPTION 'Foreign business deleted booking';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  SELECT count(*) INTO n FROM appointments;
  response:=public.portal_schedule_booking(owner,'create',NULL,body||'{"date":"2026-11-02","start_time":"01:00","end_time":"03:00","overnight":false}');
  IF NOT coalesce((response->>'requires_confirmation')::boolean,false) OR (SELECT count(*) FROM appointments)<>n
    THEN RAISE EXCEPTION 'Overlap must warn without writing'; END IF;
  response:=public.portal_schedule_booking(owner,'create',NULL,body||'{"date":"2026-11-02","start_time":"01:00","end_time":"03:00","overnight":false,"allow_conflicts":true}');
  second_ap:=(response->>'id')::uuid;
  IF second_ap IS NULL THEN RAISE EXCEPTION 'Confirmed overlap not saved'; END IF;
  body:=body||'{"allow_conflicts":true}';
  PERFORM public.portal_schedule_booking(owner,'update',ap,body||'{"title":"Edited inspection","notes":"Edited"}');
  IF (SELECT title FROM appointments WHERE id=ap)<>'Edited inspection'
     OR NOT EXISTS(SELECT 1 FROM employee_assignments WHERE id=old_assignment)
    THEN RAISE EXCEPTION 'Edit must retain unchanged crew identity'; END IF;
  PERFORM public.portal_schedule_booking(owner,'update',ap,body||jsonb_build_object('project_id','93000000-0000-4000-8000-000000000001'));
  IF NOT EXISTS(SELECT 1 FROM employee_assignments WHERE appointment_id=ap AND project_id='93000000-0000-4000-8000-000000000001')
    THEN RAISE EXCEPTION 'Linked job and crew not synchronized'; END IF;
  BEGIN
    PERFORM public.portal_schedule_booking(owner,'update',ap,body||'{"employee_ids":["92000000-0000-4000-8000-000000000009"]}');
    RAISE EXCEPTION 'Foreign crew allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  PERFORM public.portal_schedule_booking(owner,'delete',ap,'{}');
  IF EXISTS(SELECT 1 FROM appointments WHERE id=ap) OR EXISTS(SELECT 1 FROM employee_assignments WHERE appointment_id=ap)
    THEN RAISE EXCEPTION 'Cancel left booking/crew behind'; END IF;
  IF EXISTS(SELECT 1 FROM employee_time_entries WHERE owner_id=owner)
    THEN RAISE EXCEPTION 'Calendar created timesheets'; END IF;
  IF NOT EXISTS(SELECT 1 FROM employee_audit_events WHERE owner_id=owner AND action='booking.cancelled')
    THEN RAISE EXCEPTION 'Cancellation not audited'; END IF;
  IF has_function_privilege('authenticated','public.portal_schedule_booking(uuid,text,uuid,jsonb)','EXECUTE')
     OR has_function_privilege('anon','public.portal_schedule_booking(uuid,text,uuid,jsonb)','EXECUTE')
    THEN RAISE EXCEPTION 'Browser can call privileged function'; END IF;
END $$;
ROLLBACK;
