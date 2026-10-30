BEGIN;

-- Existing approval/reopen transactions remain the only way to change locked
-- weeks and their posted labour. Corrections retain the actual actor in audit.
CREATE OR REPLACE FUNCTION public.portal_manage_time_entry(p_actor uuid,p_entry uuid,p_action text,p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor public.employees; entry public.employee_time_entries;
  owner uuid; manager boolean; job uuid; start_at timestamptz; finish_at timestamptz;
  work_day date; original_week date; target_week date; breaks integer; old_data jsonb;
  submission public.employee_week_submissions;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('update','delete','submit') THEN RAISE EXCEPTION 'Invalid time action'; END IF;
  SELECT * INTO actor FROM public.employees WHERE auth_user_id=p_actor;
  IF actor.id IS NULL THEN owner:=public.portal_owner(p_actor); manager:=true;
  ELSE
    IF NOT actor.active OR actor.archived_at IS NOT NULL THEN RAISE EXCEPTION 'Employee access is inactive' USING ERRCODE='42501'; END IF;
    owner:=actor.owner_id; manager:=actor.role='admin';
  END IF;
  SELECT * INTO entry FROM public.employee_time_entries WHERE id=p_entry AND owner_id=owner;
  IF NOT FOUND OR (NOT manager AND entry.employee_id IS DISTINCT FROM actor.id) THEN
    RAISE EXCEPTION 'Time entry access denied' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(entry.employee_id::text,0));
  -- Recheck access after waiting on approval, clocks or identity changes.
  IF manager THEN PERFORM public.portal_owner(p_actor);
  ELSIF NOT EXISTS(SELECT 1 FROM public.employees WHERE id=actor.id AND auth_user_id=p_actor AND active AND archived_at IS NULL) THEN
    RAISE EXCEPTION 'Employee access has changed' USING ERRCODE='42501';
  END IF;
  SELECT * INTO entry FROM public.employee_time_entries WHERE id=p_entry AND owner_id=owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Time entry no longer exists' USING ERRCODE='42501'; END IF;
  original_week:=date_trunc('week',entry.work_date::timestamp)::date;
  IF p_action='submit' THEN
    IF NOT manager THEN RAISE EXCEPTION 'Admin access is required to submit another timesheet' USING ERRCODE='42501'; END IF;
    SELECT * INTO submission FROM public.employee_week_submissions
      WHERE employee_id=entry.employee_id AND week_start=original_week FOR UPDATE;
    IF submission.status IN ('submitted','approved') THEN RETURN jsonb_build_object('success',true); END IF;
    IF EXISTS(SELECT 1 FROM public.employee_time_entries WHERE employee_id=entry.employee_id
      AND work_date>=original_week AND work_date<original_week+7 AND ended_at IS NULL) THEN
      RAISE EXCEPTION 'Clock out before submitting this week';
    END IF;
    IF EXISTS(SELECT 1 FROM public.employee_time_entries t JOIN public.job_costs c ON c.timesheet_entry_id=t.id
      WHERE t.employee_id=entry.employee_id AND t.work_date>=original_week AND t.work_date<original_week+7) THEN
      RAISE EXCEPTION 'Reopen the approved week before submitting corrections';
    END IF;
    INSERT INTO public.employee_week_submissions(owner_id,employee_id,week_start,status)
      VALUES(owner,entry.employee_id,original_week,'submitted')
      ON CONFLICT(employee_id,week_start) DO UPDATE SET status='submitted',submitted_at=now(),
        reviewed_at=NULL,reviewed_by=NULL,review_comment=NULL RETURNING * INTO submission;
    UPDATE public.employee_time_entries SET status='submitted',updated_at=now()
      WHERE employee_id=entry.employee_id AND work_date>=original_week AND work_date<original_week+7;
    PERFORM public.portal_audit(owner,p_actor,entry.employee_id,NULL,'week.submitted',
      jsonb_build_object('submission_id',submission.id,'week_start',original_week,'by_admin',true));
    RETURN jsonb_build_object('success',true);
  END IF;
  IF entry.ended_at IS NULL THEN RAISE EXCEPTION 'Clock out before editing or deleting a running entry'; END IF;
  IF entry.status<>'draft' OR EXISTS(SELECT 1 FROM public.employee_week_submissions
    WHERE employee_id=entry.employee_id AND week_start=original_week AND status IN ('submitted','approved'))
    OR EXISTS(SELECT 1 FROM public.job_costs WHERE timesheet_entry_id=entry.id) THEN
    RAISE EXCEPTION 'Reopen this week before editing or deleting its entries';
  END IF;
  old_data:=to_jsonb(entry);
  IF NOT manager AND NOT public.portal_assigned(actor.id,entry.project_id) THEN
    RAISE EXCEPTION 'Ask an admin to correct time for a job you are no longer assigned to' USING ERRCODE='42501';
  END IF;
  IF length(coalesce(p_payload->>'reason',''))>5000 THEN RAISE EXCEPTION 'Correction reason is too long'; END IF;
  IF p_action='delete' THEN
    DELETE FROM public.employee_time_entries WHERE id=entry.id;
  ELSE
    job:=(p_payload->>'project_id')::uuid;
    IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id=job AND user_id=owner)
      OR (NOT manager AND NOT public.portal_assigned(actor.id,job)) THEN
      RAISE EXCEPTION 'Job access denied' USING ERRCODE='42501';
    END IF;
    start_at:=(p_payload->>'started_at')::timestamptz;
    finish_at:=(p_payload->>'ended_at')::timestamptz;
    breaks:=coalesce((p_payload->>'break_minutes')::integer,0);
    IF start_at IS NULL OR finish_at IS NULL OR start_at>now()+interval '1 minute' OR finish_at>now()+interval '1 minute'
      OR finish_at<=start_at OR finish_at>start_at+interval '24 hours'
      OR breaks<0 OR breaks>1439 OR round(extract(epoch FROM(finish_at-start_at))/60)::integer<=breaks
      OR length(coalesce(p_payload->>'notes',''))>5000 THEN RAISE EXCEPTION 'Check the start, finish, unpaid breaks and notes'; END IF;
    work_day:=(start_at AT TIME ZONE 'Australia/Sydney')::date;
    target_week:=date_trunc('week',work_day::timestamp)::date;
    IF EXISTS(SELECT 1 FROM public.employee_week_submissions WHERE employee_id=entry.employee_id
      AND week_start=target_week AND status IN ('submitted','approved')) THEN RAISE EXCEPTION 'The destination week is locked. Reopen it before moving time'; END IF;
    IF EXISTS(SELECT 1 FROM public.employee_time_entries t WHERE t.employee_id=entry.employee_id AND t.id<>entry.id
      AND tstzrange(t.started_at,t.ended_at,'[)') && tstzrange(start_at,finish_at,'[)')) THEN
      RAISE EXCEPTION 'This overlaps another entry or running timer';
    END IF;
    UPDATE public.employee_time_entries SET project_id=job,work_date=work_day,started_at=start_at,ended_at=finish_at,
      break_minutes=breaks,notes=coalesce(p_payload->>'notes',''),rate_snapshot=NULL,updated_at=now()
      WHERE id=entry.id;
  END IF;
  PERFORM public.portal_audit(owner,p_actor,entry.employee_id,entry.project_id,
    CASE WHEN p_action='delete' THEN 'time.deleted' ELSE 'time.corrected' END,
    jsonb_build_object('before',old_data,'after',(SELECT to_jsonb(t) FROM public.employee_time_entries t WHERE id=p_entry),
      'reason',coalesce(p_payload->>'reason',''),'by_admin',manager));
  RETURN jsonb_build_object('success',true);
END $$;
REVOKE ALL ON FUNCTION public.portal_manage_time_entry(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_manage_time_entry(uuid,uuid,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
