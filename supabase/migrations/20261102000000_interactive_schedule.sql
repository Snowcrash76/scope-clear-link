-- Extend the existing booking/crew model; standalone appointments are not jobs.
BEGIN;
ALTER TABLE public.employee_assignments ALTER COLUMN project_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.portal_assignment_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.appointments a
    JOIN public.employees e ON e.id=NEW.employee_id AND e.owner_id=NEW.owner_id AND e.active
    WHERE a.id=NEW.appointment_id AND a.user_id=NEW.owner_id
      AND a.project_id IS NOT DISTINCT FROM NEW.project_id
      AND (NEW.project_id IS NULL OR EXISTS(
        SELECT 1 FROM public.projects p WHERE p.id=NEW.project_id AND p.user_id=NEW.owner_id))
  ) THEN RAISE EXCEPTION 'Employee, appointment and optional job must belong to the same business' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;

-- All writes are atomic, owner-scoped and service-only. The browser cannot
-- supply an owner identity or call this function with another actor.
CREATE FUNCTION public.portal_schedule_booking(p_actor uuid,p_operation text,p_id uuid,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  business uuid; booking public.appointments; job uuid; crew uuid[];
  eid uuid; aid uuid; day date; start_at time; end_at time; finish timestamp;
  booking_conflicts jsonb; booking_title text; note text; overnight boolean;
BEGIN
  business:=public.portal_owner(p_actor);
  PERFORM pg_advisory_xact_lock(hashtextextended('schedule:'||business::text,0));
  IF p_operation NOT IN ('create','update','delete') OR p_operation IS NULL
    THEN RAISE EXCEPTION 'Invalid booking operation' USING ERRCODE='22023'; END IF;
  IF p_operation<>'create' THEN
    SELECT * INTO booking FROM public.appointments WHERE id=p_id AND user_id=business FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found or unavailable' USING ERRCODE='42501'; END IF;
  END IF;
  IF p_operation='delete' THEN
    PERFORM public.portal_audit(business,p_actor,NULL,booking.project_id,'booking.cancelled',
      jsonb_build_object('appointment_id',booking.id,'booking',to_jsonb(booking)));
    DELETE FROM public.appointments WHERE id=booking.id AND user_id=business;
    RETURN jsonb_build_object('id',booking.id);
  END IF;
  booking_title:=btrim(p_payload->>'title'); note:=coalesce(p_payload->>'notes','');
  day:=(p_payload->>'date')::date; start_at:=(p_payload->>'start_time')::time; end_at:=(p_payload->>'end_time')::time;
  job:=(p_payload->>'project_id')::uuid; overnight:=coalesce((p_payload->>'overnight')::boolean,false);
  IF booking_title IS NULL OR length(booking_title)=0 OR length(booking_title)>160 OR length(note)>4000 OR day IS NULL
     OR start_at IS NULL OR end_at IS NULL OR start_at=end_at OR (end_at<start_at)<>overnight
    THEN RAISE EXCEPTION 'Check the booking title, date and start/finish times' USING ERRCODE='23514'; END IF;
  IF job IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.projects WHERE id=job AND user_id=business)
    THEN RAISE EXCEPTION 'Job not found or unavailable' USING ERRCODE='42501'; END IF;
  IF jsonb_typeof(p_payload->'employee_ids') IS DISTINCT FROM 'array'
     OR jsonb_array_length(p_payload->'employee_ids')>100
    THEN RAISE EXCEPTION 'Choose a valid crew' USING ERRCODE='23514'; END IF;
  SELECT coalesce(array_agg(DISTINCT value::uuid),'{}'::uuid[]) INTO crew
    FROM jsonb_array_elements_text(p_payload->'employee_ids');
  IF EXISTS(SELECT 1 FROM unnest(crew) x WHERE NOT EXISTS(
    SELECT 1 FROM public.employees e WHERE e.id=x AND e.owner_id=business AND e.active AND e.archived_at IS NULL))
    THEN RAISE EXCEPTION 'Choose active team members from this business' USING ERRCODE='42501'; END IF;
  -- Compare local civil times, consistent with the calendar's Sydney display.
  -- Include adjacent days so overnight bookings and out-of-view conflicts count.
  finish:=day+end_at+CASE WHEN overnight THEN interval '1 day' ELSE interval '0' END;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'employee_name',e.name,'title',ap.title,'date',ap.date,'start_time',ap.start_time,'end_time',ap.end_time)
    ORDER BY ap.date,ap.start_time,e.name),'[]'::jsonb) INTO booking_conflicts
    FROM public.appointments ap
    JOIN public.employee_assignments a ON a.appointment_id=ap.id AND a.owner_id=business
    JOIN public.employees e ON e.id=a.employee_id AND e.owner_id=business
    WHERE ap.user_id=business AND a.employee_id=ANY(crew) AND ap.id IS DISTINCT FROM booking.id
      AND ap.date BETWEEN day-1 AND day+1
      AND tsrange(ap.date+ap.start_time,ap.date+ap.end_time+
        CASE WHEN ap.end_time<=ap.start_time THEN interval '1 day' ELSE interval '0' END,'[)')
        && tsrange(day+start_at,finish,'[)');
  IF jsonb_array_length(booking_conflicts)>0 AND NOT coalesce((p_payload->>'allow_conflicts')::boolean,false) THEN
    RETURN jsonb_build_object('requires_confirmation',true,'conflicts',booking_conflicts);
  END IF;
  IF p_operation='create' THEN
    INSERT INTO public.appointments(user_id,project_id,title,date,start_time,end_time,notes)
      VALUES(business,job,booking_title,day,start_at,end_at,note) RETURNING * INTO booking;
  ELSE
    -- The appointment guard intentionally forbids changing a linked job until
    -- old crew links are removed. This happens in the same transaction.
    IF booking.project_id IS DISTINCT FROM job THEN
      DELETE FROM public.employee_assignments WHERE appointment_id=booking.id AND owner_id=business;
    END IF;
    UPDATE public.appointments SET project_id=job,title=booking_title,date=day,start_time=start_at,end_time=end_at,notes=note
      WHERE id=booking.id AND user_id=business;
  END IF;
  DELETE FROM public.employee_assignments WHERE appointment_id=booking.id AND owner_id=business
    AND NOT (employee_id=ANY(crew));
  FOREACH eid IN ARRAY crew LOOP
    INSERT INTO public.employee_assignments(owner_id,employee_id,project_id,appointment_id)
      VALUES(business,eid,job,booking.id) ON CONFLICT(employee_id,appointment_id) DO NOTHING RETURNING id INTO aid;
    IF aid IS NOT NULL THEN
      PERFORM public.portal_notify(business,eid,job,'assignment:'||aid,'Booking assigned',
        booking_title||' — '||day::text||' '||start_at::text);
    END IF;
  END LOOP;
  PERFORM public.portal_audit(business,p_actor,NULL,job,'booking.'||CASE WHEN p_operation='create' THEN 'created' ELSE 'updated' END,
    jsonb_build_object('appointment_id',booking.id,'before',CASE WHEN p_operation='update' THEN to_jsonb(booking) ELSE NULL END,
      'after',p_payload-'allow_conflicts','conflicts_confirmed',jsonb_array_length(booking_conflicts)>0));
  RETURN jsonb_build_object('id',booking.id);
END $$;
REVOKE ALL ON FUNCTION public.portal_schedule_booking(uuid,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_schedule_booking(uuid,text,uuid,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
