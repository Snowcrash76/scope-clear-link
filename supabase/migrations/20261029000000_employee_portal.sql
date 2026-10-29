-- PHASE 1. Run in the Supabase SQL editor as postgres after the existing
-- appointments, job costing, receipt and addition-variation migrations.
-- IMPORTANT: This closes legacy anonymous table access. Deploy the matching
-- server/client code and resend client PROJECT links after applying.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Reuse the schedule model. Some existing installations have not yet applied
-- its original migration; create that same table here, not a parallel calendar.
CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL, date date NOT NULL, start_time time NOT NULL, end_time time NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  notes text, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='appointments' AND policyname='Users manage own appointments') THEN
    CREATE POLICY "Users manage own appointments" ON public.appointments FOR ALL TO authenticated
      USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
  END IF;
END $$;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.appointments TO authenticated;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS client_access_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS client_phone text,
  ADD COLUMN IF NOT EXISTS employee_notes text;
CREATE UNIQUE INDEX IF NOT EXISTS projects_client_access_token_key ON public.projects(client_access_token);
-- Snapshot pre-existing file references before closing public buckets. Legacy
-- images used an unscoped "uploads/" folder; future rows cannot mint claims.
CREATE TABLE public.portal_legacy_file_access (
  owner_id uuid NOT NULL REFERENCES auth.users(id), project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  bucket_id text NOT NULL, object_path text NOT NULL, PRIMARY KEY(project_id,bucket_id,object_path)
);
WITH references_before_migration AS (
  SELECT p.user_id owner_id,p.id project_id,'project-documents'::text bucket_id,d.file_url url
    FROM public.project_documents d JOIN public.projects p ON p.id=d.project_id
  UNION ALL
  SELECT p.user_id,p.id,'scope-images',u.url FROM public.scope_items s JOIN public.projects p ON p.id=s.project_id
    CROSS JOIN LATERAL unnest(coalesce(s.image_urls,ARRAY[]::text[])||ARRAY[s.image_url]) u(url)
  UNION ALL
  SELECT p.user_id,p.id,'scope-images',c.image_url FROM public.change_requests c JOIN public.projects p ON p.id=c.project_id
), paths AS (
  SELECT owner_id,project_id,bucket_id,
    CASE WHEN url LIKE '%/storage/v1/object/%' THEN split_part(split_part(url,'/'||bucket_id||'/',2),'?',1) ELSE url END object_path
    FROM references_before_migration WHERE url IS NOT NULL
)
INSERT INTO public.portal_legacy_file_access
  SELECT DISTINCT owner_id,project_id,bucket_id,object_path FROM paths x WHERE object_path<>''
    AND object_path NOT LIKE '%..%' AND object_path NOT LIKE 'http%'
    AND NOT EXISTS(SELECT 1 FROM paths y WHERE y.bucket_id=x.bucket_id AND y.object_path=x.object_path AND y.owner_id<>x.owner_id);
ALTER TABLE public.project_documents
  ADD COLUMN IF NOT EXISTS employee_visible boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'client_document',
  ADD COLUMN IF NOT EXISTS employee_id uuid,
  ADD COLUMN IF NOT EXISTS storage_bucket text NOT NULL DEFAULT 'project-documents',
  ADD COLUMN IF NOT EXISTS caption text,
  ADD COLUMN IF NOT EXISTS photo_stage text;

CREATE TABLE public.portal_business_settings (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'Australia/Sydney',
  CHECK (timezone = 'Australia/Sydney')
);
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auth_user_id uuid UNIQUE REFERENCES auth.users(id),
  email text NOT NULL CHECK (email = lower(trim(email))),
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 200),
  role text NOT NULL DEFAULT 'labourer' CHECK (role IN ('labourer','supervisor','admin')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id,email), UNIQUE(id,owner_id),
  CHECK (auth_user_id IS DISTINCT FROM owner_id)
);
CREATE TABLE public.employee_cost_rates (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  hourly_rate numeric(10,2) NOT NULL CHECK (hourly_rate BETWEEN 0 AND 100000),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(employee_id,owner_id) REFERENCES public.employees(id,owner_id)
);
CREATE TABLE public.employee_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(employee_id,owner_id) REFERENCES public.employees(id,owner_id)
);
CREATE TABLE public.employee_role_permissions (
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK(role IN ('labourer','supervisor','admin')),
  permissions jsonb NOT NULL,
  PRIMARY KEY(owner_id,role),
  CHECK (jsonb_typeof(permissions) = 'object')
);
CREATE TABLE public.employee_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(employee_id,owner_id) REFERENCES public.employees(id,owner_id),
  UNIQUE(employee_id,appointment_id)
);
CREATE INDEX employee_assignments_job_idx ON public.employee_assignments(project_id,employee_id);
CREATE TABLE public.employee_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id),
  work_date date NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  break_minutes integer NOT NULL DEFAULT 0 CHECK (break_minutes BETWEEN 0 AND 1439),
  notes text NOT NULL DEFAULT '' CHECK(length(notes) <= 5000),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved')),
  clock_in_gps jsonb, clock_out_gps jsonb,
  paid_minutes integer GENERATED ALWAYS AS
    (CASE WHEN ended_at IS NULL THEN NULL ELSE round(extract(epoch FROM (ended_at-started_at))/60)::integer - break_minutes END) STORED,
  rate_snapshot numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(employee_id,owner_id) REFERENCES public.employees(id,owner_id),
  CHECK (ended_at IS NULL OR (ended_at > started_at AND ended_at <= started_at + interval '24 hours')),
  CHECK (paid_minutes IS NULL OR paid_minutes > 0)
);
CREATE UNIQUE INDEX employee_single_running_timer ON public.employee_time_entries(employee_id) WHERE ended_at IS NULL;
CREATE INDEX employee_time_week ON public.employee_time_entries(owner_id,employee_id,work_date);
CREATE TABLE public.employee_week_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  week_start date NOT NULL CHECK (extract(isodow FROM week_start) = 1),
  status text NOT NULL DEFAULT 'submitted' CHECK(status IN ('submitted','approved','rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz, reviewed_by uuid REFERENCES auth.users(id),
  review_comment text CHECK(length(review_comment) <= 5000),
  FOREIGN KEY(employee_id,owner_id) REFERENCES public.employees(id,owner_id),
  UNIQUE(employee_id,week_start)
);
CREATE TABLE public.employee_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  actor_id uuid NOT NULL REFERENCES auth.users(id),
  employee_id uuid REFERENCES public.employees(id),
  project_id uuid REFERENCES public.projects(id),
  action text NOT NULL, detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.employee_job_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL,
  project_id uuid NOT NULL REFERENCES public.projects(id),
  employee_id uuid NOT NULL,
  body text NOT NULL CHECK(length(trim(body)) BETWEEN 1 AND 5000),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(employee_id,owner_id) REFERENCES public.employees(id,owner_id)
);
CREATE TABLE public.employee_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL, employee_id uuid NOT NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  event_key text NOT NULL, title text NOT NULL, body text NOT NULL,
  read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(employee_id,owner_id) REFERENCES public.employees(id,owner_id),
  UNIQUE(employee_id,event_key)
);
ALTER TABLE public.project_documents ADD CONSTRAINT project_documents_employee_fk
  FOREIGN KEY(employee_id) REFERENCES public.employees(id);
ALTER TABLE public.job_costs ADD COLUMN timesheet_entry_id uuid UNIQUE REFERENCES public.employee_time_entries(id),
  ADD COLUMN timesheet_submission_id uuid REFERENCES public.employee_week_submissions(id);

CREATE OR REPLACE FUNCTION public.portal_is_employee()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.employees WHERE auth_user_id = auth.uid())
$$;
CREATE FUNCTION public.portal_owner(p_actor uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE e public.employees;
BEGIN
  SELECT * INTO e FROM public.employees WHERE auth_user_id=p_actor;
  IF FOUND THEN
    IF NOT e.active OR e.role<>'admin' THEN RAISE EXCEPTION 'Team administration is not permitted' USING ERRCODE='42501'; END IF;
    RETURN e.owner_id;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
  RETURN p_actor;
END $$;
CREATE FUNCTION public.portal_permission(p_owner uuid,p_role text,p_permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public,pg_temp AS $$
  SELECT coalesce((SELECT (permissions->>p_permission)::boolean FROM public.employee_role_permissions
    WHERE owner_id=p_owner AND role=p_role),
    CASE WHEN p_permission='review_timesheets' THEN p_role IN ('supervisor','admin') ELSE p_permission IN ('view_scope','view_variations','view_documents','add_photos','add_notes') END)
$$;
CREATE FUNCTION public.portal_assigned(p_employee uuid,p_job uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.employee_assignments a JOIN public.employees e ON e.id=a.employee_id
    JOIN public.appointments ap ON ap.id=a.appointment_id
    JOIN public.projects p ON p.id=a.project_id
    WHERE e.id=p_employee AND e.active AND a.project_id=p_job
      AND a.owner_id=e.owner_id AND p.user_id=e.owner_id AND ap.user_id=e.owner_id AND ap.project_id=p.id)
$$;
CREATE FUNCTION public.portal_file_allowed(p_owner uuid,p_job uuid,p_bucket text,p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id=p_bucket AND o.name=p_path)
    AND position('..' IN p_path)=0 AND (
      p_path LIKE p_job::text||'/%' OR p_path LIKE p_owner::text||'/'||p_job::text||'/%'
      OR p_bucket='scope-images' AND p_path LIKE p_owner::text||'/%'
      OR EXISTS(SELECT 1 FROM public.portal_legacy_file_access a WHERE a.owner_id=p_owner AND a.project_id=p_job AND a.bucket_id=p_bucket AND a.object_path=p_path))
$$;
CREATE FUNCTION public.portal_audit(p_owner uuid,p_actor uuid,p_employee uuid,p_job uuid,p_action text,p_detail jsonb DEFAULT '{}')
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public,pg_temp AS $$
  INSERT INTO public.employee_audit_events(owner_id,actor_id,employee_id,project_id,action,detail)
    VALUES(p_owner,p_actor,p_employee,p_job,p_action,p_detail)
$$;
CREATE FUNCTION public.portal_notify(p_owner uuid,p_employee uuid,p_job uuid,p_key text,p_title text,p_body text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public,pg_temp AS $$
  INSERT INTO public.employee_notifications(owner_id,employee_id,project_id,event_key,title,body)
    VALUES(p_owner,p_employee,p_job,p_key,p_title,p_body) ON CONFLICT(employee_id,event_key) DO NOTHING
$$;

-- Database-enforced business/job/appointment consistency, also for direct owner writes.
CREATE FUNCTION public.portal_assignment_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.projects p JOIN public.appointments a ON a.project_id=p.id
    JOIN public.employees e ON e.id=NEW.employee_id AND e.owner_id=NEW.owner_id AND e.active
    WHERE p.id=NEW.project_id AND p.user_id=NEW.owner_id AND a.id=NEW.appointment_id AND a.user_id=NEW.owner_id)
  THEN RAISE EXCEPTION 'Employee, appointment and job must belong to the same business'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER portal_assignment_guard BEFORE INSERT OR UPDATE ON public.employee_assignments
  FOR EACH ROW EXECUTE FUNCTION public.portal_assignment_guard();
CREATE FUNCTION public.portal_appointment_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE a record;
BEGIN
  IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM public.employee_assignments x WHERE x.appointment_id=OLD.id
      AND (x.project_id IS DISTINCT FROM NEW.project_id OR x.owner_id IS DISTINCT FROM NEW.user_id))
  THEN RAISE EXCEPTION 'Remove staff assignments before changing this appointment job'; END IF;
  IF TG_OP='UPDATE' THEN
    FOR a IN SELECT * FROM public.employee_assignments WHERE appointment_id=NEW.id LOOP
      PERFORM public.portal_notify(a.owner_id,a.employee_id,a.project_id,
        'schedule:'||NEW.id||':'||md5(row_to_json(NEW)::text),'Schedule updated',
        NEW.title||' — '||NEW.date||' '||NEW.start_time);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER portal_appointment_guard BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.portal_appointment_guard();
CREATE FUNCTION public.portal_assignment_removed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.employees WHERE id=OLD.employee_id) THEN
    PERFORM public.portal_notify(OLD.owner_id,OLD.employee_id,NULL,'unassign:'||OLD.id,
      'Assignment removed','Your job assignment has been removed.');
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER portal_assignment_removed AFTER DELETE ON public.employee_assignments
  FOR EACH ROW EXECUTE FUNCTION public.portal_assignment_removed();

CREATE FUNCTION public.portal_approved_variation_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE a record;
BEGIN
  IF NEW.status='approved' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    FOR a IN SELECT DISTINCT e.* FROM public.employee_assignments x JOIN public.employees e ON e.id=x.employee_id
      WHERE x.project_id=NEW.project_id AND e.active LOOP
      IF public.portal_permission(a.owner_id,a.role,'view_variations') THEN
        PERFORM public.portal_notify(a.owner_id,a.id,NEW.project_id,
          'variation:'||NEW.id||':'||coalesce(NEW.resolved_at::text,now()::text),'Variation approved',NEW.title);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER portal_approved_variation_notify AFTER INSERT OR UPDATE ON public.change_requests
  FOR EACH ROW EXECUTE FUNCTION public.portal_approved_variation_notify();

-- All operational writes go through one service-only transaction boundary.
-- Employee advisory locks serialize timer, manual entry, submission and review.
CREATE FUNCTION public.portal_mutate(p_actor uuid,p_action text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE
  e public.employees; target public.employees; entry public.employee_time_entries;
  sub public.employee_week_submissions; inv public.employee_invitations;
  owner uuid; job uuid; eid uuid; apid uuid; nid uuid; target_id uuid; week date;
  start_at timestamptz; finish_at timestamptz; tz text; rate numeric; result jsonb;
  permission text; decision text; a record; old_data jsonb; active_week public.employee_week_submissions;
BEGIN
  IF p_actor IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501'; END IF;
  SELECT * INTO e FROM public.employees WHERE auth_user_id=p_actor;
  IF FOUND AND NOT e.active THEN RAISE EXCEPTION 'Employee account is inactive' USING ERRCODE='42501'; END IF;
  IF p_action LIKE 'team_%' THEN owner:=public.portal_owner(p_actor);
  ELSE
    IF e.id IS NULL THEN RAISE EXCEPTION 'Employee access required' USING ERRCODE='42501'; END IF;
    owner:=e.owner_id;
  END IF;
  SELECT coalesce((SELECT timezone FROM public.portal_business_settings WHERE owner_id=owner),'Australia/Sydney') INTO tz;

  IF p_action='team_employee' THEN
    IF p_payload ? 'id' THEN
      SELECT * INTO target FROM public.employees WHERE id=(p_payload->>'id')::uuid AND owner_id=owner FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found' USING ERRCODE='42501'; END IF;
      IF target.auth_user_id=p_actor THEN RAISE EXCEPTION 'An administrator cannot change their own role or access'; END IF;
      UPDATE public.employees SET name=coalesce(p_payload->>'name',name),role=coalesce(p_payload->>'role',role),
        active=coalesce((p_payload->>'active')::boolean,active) WHERE id=target.id RETURNING * INTO target;
    ELSE
      INSERT INTO public.employees(owner_id,email,name,role,active)
        VALUES(owner,lower(trim(p_payload->>'email')),trim(p_payload->>'name'),p_payload->>'role',coalesce((p_payload->>'active')::boolean,true))
        RETURNING * INTO target;
    END IF;
    IF p_payload ? 'hourly_rate' THEN
      IF p_payload->'hourly_rate'='null'::jsonb THEN DELETE FROM public.employee_cost_rates WHERE employee_id=target.id;
      ELSE INSERT INTO public.employee_cost_rates(employee_id,owner_id,hourly_rate)
        VALUES(target.id,owner,(p_payload->>'hourly_rate')::numeric)
        ON CONFLICT(employee_id) DO UPDATE SET hourly_rate=EXCLUDED.hourly_rate,updated_at=now();
      END IF;
    END IF;
    PERFORM public.portal_audit(owner,p_actor,target.id,NULL,'employee.updated',jsonb_build_object('role',target.role,'active',target.active));
    RETURN to_jsonb(target);
  ELSIF p_action='team_invite' THEN
    SELECT * INTO target FROM public.employees WHERE id=(p_payload->>'employee_id')::uuid AND owner_id=owner AND active FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Active employee not found' USING ERRCODE='42501'; END IF;
    IF target.email=(SELECT lower(email) FROM auth.users WHERE id=owner) THEN RAISE EXCEPTION 'The business owner cannot be an employee'; END IF;
    UPDATE public.employee_invitations SET expires_at=now() WHERE employee_id=target.id AND accepted_at IS NULL;
    INSERT INTO public.employee_invitations(employee_id,owner_id,token_hash,expires_at)
      VALUES(target.id,owner,p_payload->>'token_hash',now()+interval '7 days') RETURNING * INTO inv;
    PERFORM public.portal_audit(owner,p_actor,target.id,NULL,'invitation.created',jsonb_build_object('invitation_id',inv.id));
    RETURN jsonb_build_object('email',target.email,'name',target.name,'invitation_id',inv.id);
  ELSIF p_action='team_assign' THEN
    job:=(p_payload->>'project_id')::uuid;
    IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id=job AND user_id=owner) THEN RAISE EXCEPTION 'Job not found' USING ERRCODE='42501'; END IF;
    apid:=(p_payload->>'appointment_id')::uuid;
    IF apid IS NULL THEN
      INSERT INTO public.appointments(user_id,project_id,title,date,start_time,end_time,notes)
        VALUES(owner,job,(SELECT name FROM public.projects WHERE id=job),(p_payload->>'date')::date,
          (p_payload->>'start_time')::time,(p_payload->>'end_time')::time,coalesce(p_payload->>'notes','')) RETURNING id INTO apid;
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.appointments WHERE id=apid AND user_id=owner AND project_id=job AND end_time>start_time)
      THEN RAISE EXCEPTION 'Choose a matching job appointment with a valid start and finish'; END IF;
    FOR eid IN SELECT x.value::uuid FROM jsonb_array_elements_text(p_payload->'employee_ids') AS x(value) LOOP
      SELECT * INTO target FROM public.employees WHERE id=eid AND owner_id=owner AND active FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Active employee not found' USING ERRCODE='42501'; END IF;
      INSERT INTO public.employee_assignments(owner_id,employee_id,project_id,appointment_id) VALUES(owner,eid,job,apid)
        ON CONFLICT(employee_id,appointment_id) DO NOTHING RETURNING id INTO nid;
      IF nid IS NOT NULL THEN
        PERFORM public.portal_notify(owner,eid,job,'assignment:'||nid,'Job assigned',
          (SELECT name FROM public.projects WHERE id=job)||' — '||(SELECT date::text||' '||start_time::text FROM public.appointments WHERE id=apid));
        PERFORM public.portal_audit(owner,p_actor,eid,job,'assignment.created',jsonb_build_object('assignment_id',nid,'appointment_id',apid));
      END IF;
    END LOOP;
  ELSIF p_action='team_reschedule' THEN
    SELECT * INTO a FROM public.employee_assignments WHERE id=(p_payload->>'id')::uuid AND owner_id=owner FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found' USING ERRCODE='42501'; END IF;
    IF (p_payload->>'end_time')::time <= (p_payload->>'start_time')::time THEN RAISE EXCEPTION 'Finish must be after start'; END IF;
    UPDATE public.appointments SET date=(p_payload->>'date')::date,start_time=(p_payload->>'start_time')::time,
      end_time=(p_payload->>'end_time')::time,notes=coalesce(p_payload->>'notes',notes)
      WHERE id=a.appointment_id AND user_id=owner AND project_id=a.project_id;
    PERFORM public.portal_audit(owner,p_actor,a.employee_id,a.project_id,'assignment.rescheduled',
      jsonb_build_object('appointment_id',a.appointment_id,'schedule',p_payload));
  ELSIF p_action='team_unassign' THEN
    SELECT * INTO a FROM public.employee_assignments WHERE id=(p_payload->>'id')::uuid AND owner_id=owner FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignment not found' USING ERRCODE='42501'; END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(a.employee_id::text,0));
    DELETE FROM public.employee_assignments WHERE id=a.id;
    PERFORM public.portal_notify(owner,a.employee_id,a.project_id,'unassign:'||a.id,'Assignment removed','Your access to this job has changed.');
    PERFORM public.portal_audit(owner,p_actor,a.employee_id,a.project_id,'assignment.removed',jsonb_build_object('assignment_id',a.id));
  ELSIF p_action='team_permissions' THEN
    IF EXISTS(SELECT 1 FROM jsonb_each(p_payload->'permissions') x WHERE jsonb_typeof(x.value)<>'boolean'
      OR x.key NOT IN ('view_scope','view_variations','view_documents','add_photos','add_notes','review_timesheets'))
      THEN RAISE EXCEPTION 'Invalid operational permission'; END IF;
    INSERT INTO public.employee_role_permissions(owner_id,role,permissions)
      VALUES(owner,p_payload->>'role',p_payload->'permissions')
      ON CONFLICT(owner_id,role) DO UPDATE SET permissions=EXCLUDED.permissions;
    PERFORM public.portal_audit(owner,p_actor,NULL,NULL,'permissions.updated',p_payload);
  ELSIF p_action='team_job' THEN
    job:=(p_payload->>'id')::uuid;
    UPDATE public.projects SET client_phone=p_payload->>'client_phone',employee_notes=p_payload->>'employee_notes' WHERE id=job AND user_id=owner;
    IF NOT FOUND THEN RAISE EXCEPTION 'Job not found' USING ERRCODE='42501'; END IF;
    PERFORM public.portal_audit(owner,p_actor,NULL,job,'job.employee_details.updated','{}');
  ELSIF p_action='team_visibility' THEN
    UPDATE public.project_documents d SET employee_visible=(p_payload->>'employee_visible')::boolean
      WHERE d.id=(p_payload->>'id')::uuid AND d.purpose<>'employee_photo'
        AND EXISTS(SELECT 1 FROM public.projects p WHERE p.id=d.project_id AND p.user_id=owner)
      RETURNING project_id INTO job;
    IF NOT FOUND THEN RAISE EXCEPTION 'Document not found' USING ERRCODE='42501'; END IF;
    PERFORM public.portal_audit(owner,p_actor,NULL,job,'document.visibility.updated',p_payload);
  ELSIF p_action IN ('clock_in','clock_out','time_save','time_delete','submit') THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(e.id::text,0));
    IF p_action='submit' THEN
      week:=(p_payload->>'week_start')::date;
      IF extract(isodow FROM week)<>1 OR week>(now() AT TIME ZONE tz)::date THEN RAISE EXCEPTION 'Choose a valid Monday week'; END IF;
      IF EXISTS(SELECT 1 FROM public.employee_time_entries WHERE employee_id=e.id AND work_date>=week AND work_date<week+7 AND ended_at IS NULL)
        THEN RAISE EXCEPTION 'Clock out before submitting this week'; END IF;
      IF NOT EXISTS(SELECT 1 FROM public.employee_time_entries WHERE employee_id=e.id AND work_date>=week AND work_date<week+7)
        THEN RAISE EXCEPTION 'There are no time entries for this week'; END IF;
      SELECT * INTO sub FROM public.employee_week_submissions WHERE employee_id=e.id AND week_start=week FOR UPDATE;
      IF sub.status IN ('submitted','approved') THEN RETURN jsonb_build_object('success',true); END IF;
      INSERT INTO public.employee_week_submissions(owner_id,employee_id,week_start) VALUES(owner,e.id,week)
        ON CONFLICT(employee_id,week_start) DO UPDATE SET status='submitted',submitted_at=now(),reviewed_at=NULL,reviewed_by=NULL,review_comment=NULL
        RETURNING * INTO sub;
      UPDATE public.employee_time_entries SET status='submitted',updated_at=now() WHERE employee_id=e.id AND work_date>=week AND work_date<week+7;
      PERFORM public.portal_audit(owner,p_actor,e.id,NULL,'week.submitted',jsonb_build_object('submission_id',sub.id,'week_start',week));
      RETURN jsonb_build_object('success',true);
    END IF;
    IF p_payload ? 'id' THEN
      SELECT * INTO entry FROM public.employee_time_entries WHERE id=(p_payload->>'id')::uuid AND employee_id=e.id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Time entry not found' USING ERRCODE='42501'; END IF;
      IF entry.status<>'draft' THEN RAISE EXCEPTION 'This week is locked. Ask a manager to reopen it for correction'; END IF;
    END IF;
    job:=coalesce((p_payload->>'project_id')::uuid,entry.project_id);
    IF NOT public.portal_assigned(e.id,job) THEN RAISE EXCEPTION 'Current job assignment required' USING ERRCODE='42501'; END IF;
    IF p_action='time_delete' THEN
      DELETE FROM public.employee_time_entries WHERE id=entry.id;
      PERFORM public.portal_audit(owner,p_actor,e.id,job,'time.deleted',to_jsonb(entry));
      RETURN jsonb_build_object('success',true);
    END IF;
    start_at:=CASE WHEN p_action='clock_in' THEN now() WHEN p_action='clock_out' THEN entry.started_at ELSE (p_payload->>'started_at')::timestamptz END;
    finish_at:=CASE WHEN p_action='clock_in' THEN NULL WHEN p_action='clock_out' THEN now() ELSE (p_payload->>'ended_at')::timestamptz END;
    IF p_action='clock_out' AND entry.ended_at IS NOT NULL THEN RAISE EXCEPTION 'This timer has already stopped'; END IF;
    IF start_at IS NULL OR start_at>now()+interval '1 minute' OR (finish_at IS NOT NULL AND finish_at>now()+interval '1 minute')
      THEN RAISE EXCEPTION 'Time cannot be recorded in the future'; END IF;
    week:=date_trunc('week',start_at AT TIME ZONE tz)::date;
    SELECT * INTO active_week FROM public.employee_week_submissions WHERE employee_id=e.id AND week_start=week;
    IF active_week.status IN ('submitted','approved') THEN RAISE EXCEPTION 'This week is locked. Ask a manager to reopen it'; END IF;
    IF entry.id IS NOT NULL AND date_trunc('week',entry.started_at AT TIME ZONE tz)::date<>week THEN
      SELECT * INTO active_week FROM public.employee_week_submissions WHERE employee_id=e.id AND week_start=date_trunc('week',entry.started_at AT TIME ZONE tz)::date;
      IF active_week.status IN ('submitted','approved') THEN RAISE EXCEPTION 'Original week is locked'; END IF;
    END IF;
    IF EXISTS(SELECT 1 FROM public.employee_time_entries t WHERE t.employee_id=e.id
      AND t.id IS DISTINCT FROM entry.id AND tstzrange(t.started_at,t.ended_at,'[)') && tstzrange(start_at,finish_at,'[)'))
      THEN RAISE EXCEPTION 'This overlaps another entry or running timer'; END IF;
    old_data:=to_jsonb(entry);
    IF entry.id IS NULL THEN
      INSERT INTO public.employee_time_entries(owner_id,employee_id,project_id,work_date,started_at,ended_at,break_minutes,notes,clock_in_gps)
        VALUES(owner,e.id,job,(start_at AT TIME ZONE tz)::date,start_at,finish_at,
          coalesce((p_payload->>'break_minutes')::integer,0),coalesce(p_payload->>'notes',''),
          CASE WHEN p_action='clock_in' THEN p_payload->'gps' ELSE NULL END) RETURNING * INTO entry;
    ELSE
      UPDATE public.employee_time_entries SET project_id=job,work_date=(start_at AT TIME ZONE tz)::date,
        started_at=start_at,ended_at=finish_at,break_minutes=coalesce((p_payload->>'break_minutes')::integer,0),
        notes=coalesce(p_payload->>'notes',''),clock_out_gps=CASE WHEN p_action='clock_out' THEN p_payload->'gps' ELSE clock_out_gps END,updated_at=now()
        WHERE id=entry.id RETURNING * INTO entry;
    END IF;
    PERFORM public.portal_audit(owner,p_actor,e.id,job,'time.'||p_action,jsonb_build_object('before',old_data,'after',to_jsonb(entry)));
  ELSIF p_action='note' THEN
    job:=(p_payload->>'project_id')::uuid;
    IF NOT public.portal_assigned(e.id,job) OR NOT public.portal_permission(owner,e.role,'add_notes')
      THEN RAISE EXCEPTION 'Job notes are not permitted' USING ERRCODE='42501'; END IF;
    INSERT INTO public.employee_job_notes(owner_id,project_id,employee_id,body) VALUES(owner,job,e.id,trim(p_payload->>'body')) RETURNING id INTO nid;
    PERFORM public.portal_audit(owner,p_actor,e.id,job,'note.created',jsonb_build_object('note_id',nid));
  ELSIF p_action='photo' THEN
    job:=(p_payload->>'job_id')::uuid;
    IF NOT public.portal_assigned(e.id,job) OR NOT public.portal_permission(owner,e.role,'add_photos')
      THEN RAISE EXCEPTION 'Job photos are not permitted' USING ERRCODE='42501'; END IF;
    IF p_payload->>'path' NOT LIKE owner::text||'/'||job::text||'/'||e.id::text||'/%' OR position('..' IN p_payload->>'path')>0
      THEN RAISE EXCEPTION 'Invalid photo path'; END IF;
    IF EXISTS(SELECT 1 FROM public.project_documents WHERE storage_bucket='employee-photos' AND file_url=p_payload->>'path')
      THEN RETURN jsonb_build_object('success',true); END IF;
    INSERT INTO public.project_documents(project_id,file_name,display_name,file_url,file_type,file_size,employee_visible,purpose,employee_id,storage_bucket,caption,photo_stage)
      VALUES(job,p_payload->>'file_name',p_payload->>'file_name',p_payload->>'path',p_payload->>'file_type',
        (p_payload->>'file_size')::bigint,true,'employee_photo',e.id,'employee-photos',p_payload->>'caption',p_payload->>'stage') RETURNING id INTO nid;
    PERFORM public.portal_audit(owner,p_actor,e.id,job,'photo.created',jsonb_build_object('document_id',nid));
  ELSIF p_action='read_notification' THEN
    UPDATE public.employee_notifications SET read_at=coalesce(read_at,now()) WHERE id=(p_payload->>'id')::uuid AND employee_id=e.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Notification not found' USING ERRCODE='42501'; END IF;
  ELSE RAISE EXCEPTION 'Unknown operation';
  END IF;
  RETURN jsonb_build_object('success',true);
END $$;

CREATE FUNCTION public.portal_accept_invitation(p_hash text,p_user uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE i public.employee_invitations; e public.employees;
BEGIN
  SELECT * INTO i FROM public.employee_invitations WHERE token_hash=p_hash FOR UPDATE;
  IF NOT FOUND OR i.accepted_at IS NOT NULL OR i.expires_at<=now() THEN RAISE EXCEPTION 'Invitation is invalid or expired' USING ERRCODE='42501'; END IF;
  SELECT * INTO e FROM public.employees WHERE id=i.employee_id FOR UPDATE;
  IF NOT e.active OR e.email IS DISTINCT FROM (SELECT lower(email) FROM auth.users WHERE id=p_user)
    OR e.auth_user_id IS NOT NULL AND e.auth_user_id<>p_user OR e.owner_id=p_user
    OR EXISTS(SELECT 1 FROM public.projects WHERE user_id=p_user)
    OR EXISTS(SELECT 1 FROM public.employees WHERE owner_id=p_user)
    THEN RAISE EXCEPTION 'Invitation does not match an eligible employee account' USING ERRCODE='42501'; END IF;
  UPDATE public.employees SET auth_user_id=p_user WHERE id=e.id;
  UPDATE public.employee_invitations SET accepted_at=now() WHERE id=i.id;
  PERFORM public.portal_audit(e.owner_id,p_user,e.id,NULL,'invitation.accepted',jsonb_build_object('invitation_id',i.id));
  RETURN jsonb_build_object('success',true);
END $$;

CREATE FUNCTION public.portal_review_week(p_actor uuid,p_submission uuid,p_decision text,p_comment text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE s public.employee_week_submissions; e public.employees; reviewer public.employees;
  t public.employee_time_entries; r numeric; amount numeric; old_status text;
BEGIN
  SELECT * INTO s FROM public.employee_week_submissions WHERE id=p_submission;
  IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(s.employee_id::text,0));
  SELECT * INTO s FROM public.employee_week_submissions WHERE id=p_submission FOR UPDATE;
  SELECT * INTO e FROM public.employees WHERE id=s.employee_id;
  SELECT * INTO reviewer FROM public.employees WHERE auth_user_id=p_actor;
  IF e.auth_user_id=p_actor THEN RAISE EXCEPTION 'You cannot approve or reject your own time' USING ERRCODE='42501'; END IF;
  IF p_actor<>s.owner_id THEN
    IF reviewer.id IS NULL OR NOT reviewer.active OR reviewer.owner_id<>s.owner_id
      OR NOT public.portal_permission(s.owner_id,reviewer.role,'review_timesheets')
      OR reviewer.role NOT IN ('supervisor','admin')
      OR (reviewer.role<>'admin' AND EXISTS(SELECT 1 FROM public.employee_time_entries
        WHERE employee_id=e.id AND work_date>=s.week_start AND work_date<s.week_start+7 AND NOT public.portal_assigned(reviewer.id,project_id)))
      THEN RAISE EXCEPTION 'Timesheet review is not permitted' USING ERRCODE='42501'; END IF;
  END IF;
  IF p_decision NOT IN ('approved','rejected','reopen') THEN RAISE EXCEPTION 'Invalid decision'; END IF;
  IF p_decision IN ('rejected','reopen') AND length(trim(coalesce(p_comment,'')))=0 THEN RAISE EXCEPTION 'A review comment is required'; END IF;
  IF p_decision=s.status THEN RETURN jsonb_build_object('success',true); END IF;
  IF s.status='approved' AND p_decision<>'reopen' THEN RAISE EXCEPTION 'Reopen the approved week before changing it'; END IF;
  IF s.status<>'submitted' AND p_decision<>'reopen' THEN RAISE EXCEPTION 'This week must be submitted before review'; END IF;
  old_status:=s.status;
  PERFORM set_config('portal.labour_write','yes',true);
  IF p_decision='approved' THEN
    SELECT hourly_rate INTO r FROM public.employee_cost_rates WHERE employee_id=e.id FOR SHARE;
    IF r IS NULL THEN RAISE EXCEPTION 'Set the employee hourly cost rate before approving'; END IF;
    FOR t IN SELECT * FROM public.employee_time_entries WHERE employee_id=e.id AND work_date>=s.week_start AND work_date<s.week_start+7 FOR UPDATE LOOP
      IF t.ended_at IS NULL OR t.paid_minutes IS NULL OR t.paid_minutes<=0 THEN RAISE EXCEPTION 'Clock out and check all entries before approval'; END IF;
      amount:=round(t.paid_minutes*r/60,2);
      INSERT INTO public.job_costs(job_id,supplier,description,cost_date,category,amount_ex_gst,gst_amount,amount_inc_gst,gst_applies,status,created_by,timesheet_entry_id,timesheet_submission_id,notes)
        VALUES(t.project_id,e.name,'Approved employee labour — '||t.paid_minutes||' paid minutes',t.work_date,'Labour',amount,0,amount,false,'confirmed',s.owner_id,t.id,s.id,'Posted by timesheet approval. Correct through timesheets.')
        ON CONFLICT(timesheet_entry_id) DO NOTHING;
      UPDATE public.employee_time_entries SET status='approved',rate_snapshot=r,updated_at=now() WHERE id=t.id;
    END LOOP;
  ELSE
    DELETE FROM public.job_costs WHERE timesheet_submission_id=s.id;
    UPDATE public.employee_time_entries SET status='draft',updated_at=now()
      WHERE employee_id=e.id AND work_date>=s.week_start AND work_date<s.week_start+7;
  END IF;
  UPDATE public.employee_week_submissions SET status=CASE WHEN p_decision='reopen' THEN 'rejected' ELSE p_decision END,
    reviewed_at=now(),reviewed_by=p_actor,review_comment=p_comment WHERE id=s.id;
  PERFORM public.portal_audit(s.owner_id,p_actor,e.id,NULL,'week.'||p_decision,
    jsonb_build_object('submission_id',s.id,'week_start',s.week_start,'previous_status',old_status,'comment',p_comment,'hourly_rate',r,
      'entries',(SELECT jsonb_agg(to_jsonb(x)) FROM public.employee_time_entries x WHERE employee_id=e.id AND work_date>=s.week_start AND work_date<s.week_start+7)));
  PERFORM public.portal_notify(s.owner_id,e.id,NULL,'review:'||s.id||':'||p_decision||':'||now()::text,
    CASE WHEN p_decision='approved' THEN 'Timesheet approved' ELSE 'Timesheet needs changes' END,s.week_start||' — '||coalesce(p_comment,'Approved'));
  RETURN jsonb_build_object('success',true);
END $$;
CREATE FUNCTION public.portal_labour_guard()
RETURNS trigger LANGUAGE plpgsql SET search_path = public,pg_temp AS $$
BEGIN
  IF (TG_OP<>'INSERT' AND OLD.timesheet_entry_id IS NOT NULL OR TG_OP<>'DELETE' AND NEW.timesheet_entry_id IS NOT NULL)
    AND coalesce(current_setting('portal.labour_write',true),'')<>'yes'
    THEN RAISE EXCEPTION 'Approved labour costs can only be corrected through timesheets'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER portal_labour_guard BEFORE INSERT OR UPDATE OR DELETE ON public.job_costs FOR EACH ROW EXECUTE FUNCTION public.portal_labour_guard();
CREATE FUNCTION public.portal_audit_immutable()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit records are immutable'; END $$;
CREATE TRIGGER portal_audit_immutable BEFORE UPDATE OR DELETE ON public.employee_audit_events FOR EACH ROW EXECUTE FUNCTION public.portal_audit_immutable();

-- Persisted event keys make retries/restarts safe. Supabase Cron runs this
-- independently of the web server or any open browser.
CREATE FUNCTION public.portal_weekly_reminders()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public,pg_temp AS $$
DECLARE e record; w date; today date; tz text;
BEGIN
  FOR e IN SELECT * FROM public.employees WHERE active AND auth_user_id IS NOT NULL LOOP
    tz:=coalesce((SELECT timezone FROM public.portal_business_settings WHERE owner_id=e.owner_id),'Australia/Sydney');
    today:=(now() AT TIME ZONE tz)::date;
    -- Only previous Monday-Sunday weeks, within the last four weeks, which had
    -- an assignment or recorded work and have not been submitted/approved.
    FOR w IN SELECT generate_series(date_trunc('week',today)::date-28,date_trunc('week',today)::date-7,'7 days')::date LOOP
      IF (EXISTS(SELECT 1 FROM public.employee_time_entries WHERE employee_id=e.id AND work_date>=w AND work_date<w+7)
        OR EXISTS(SELECT 1 FROM public.employee_assignments a JOIN public.appointments ap ON ap.id=a.appointment_id
          WHERE a.employee_id=e.id AND ap.date>=w AND ap.date<w+7))
        AND NOT EXISTS(SELECT 1 FROM public.employee_week_submissions WHERE employee_id=e.id AND week_start=w AND status IN ('submitted','approved'))
      THEN PERFORM public.portal_notify(e.owner_id,e.id,NULL,'missing-week:'||w,'Timesheet reminder','Please submit the week starting '||w); END IF;
    END LOOP;
  END LOOP;
END $$;

-- RLS: staff never receive commercial database rows, even by bypassing this
-- application's browser/API. Staff/admin access is via verified projections.
DO $$
DECLARE t record; predicate text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.tablename);
    EXECUTE format('CREATE POLICY employee_direct_access_fence ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.portal_is_employee()) WITH CHECK (NOT public.portal_is_employee())',t.tablename);
  END LOOP;
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public'
    AND tablename IN ('portal_business_settings','portal_legacy_file_access','employees','employee_cost_rates','employee_invitations','employee_role_permissions',
      'employee_assignments','employee_time_entries','employee_week_submissions','employee_audit_events','employee_job_notes','employee_notifications') LOOP
    EXECUTE format('CREATE POLICY owner_read_portal ON public.%I FOR SELECT TO authenticated USING (owner_id=auth.uid())',t.tablename);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t.tablename);
  END LOOP;
  -- Existing permissive historical client policies must not expose another
  -- business to any authenticated owner. Client access uses the server gateway.
  FOR t IN SELECT * FROM (VALUES
    ('projects','user_id=auth.uid()'),
    ('profiles','user_id=auth.uid()'),
    ('appointments','user_id=auth.uid()'),
    ('quotes','EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_id AND p.user_id=auth.uid())'),
    ('invoices','EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_id AND p.user_id=auth.uid())'),
    ('scope_items','EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_id AND p.user_id=auth.uid())'),
    ('change_requests','EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_id AND p.user_id=auth.uid())'),
    ('project_stages','EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_id AND p.user_id=auth.uid())'),
    ('project_documents','EXISTS(SELECT 1 FROM public.projects p WHERE p.id=project_id AND p.user_id=auth.uid())'),
    ('quote_line_items','EXISTS(SELECT 1 FROM public.quotes q JOIN public.projects p ON p.id=q.project_id WHERE q.id=quote_id AND p.user_id=auth.uid())'),
    ('quote_line_item_history','EXISTS(SELECT 1 FROM public.quotes q JOIN public.projects p ON p.id=q.project_id WHERE q.id=quote_id AND p.user_id=auth.uid())'),
    ('invoice_line_items','EXISTS(SELECT 1 FROM public.invoices i JOIN public.projects p ON p.id=i.project_id WHERE i.id=invoice_id AND p.user_id=auth.uid())')
  ) x(tablename,predicate) LOOP
    IF to_regclass('public.'||t.tablename) IS NOT NULL THEN
      EXECUTE format('CREATE POLICY business_boundary ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (%s) WITH CHECK (%s)',t.tablename,t.predicate,t.predicate);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC,anon;
-- Legacy security-definer RPCs must not bypass the new table fences.
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_is_employee() TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('employee-photos','employee-photos',false,10485760,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=10485760,allowed_mime_types=EXCLUDED.allowed_mime_types;
UPDATE storage.buckets SET public=false WHERE id IN ('project-documents','scope-images');
CREATE POLICY employee_storage_fence ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING(NOT public.portal_is_employee()) WITH CHECK(NOT public.portal_is_employee());
CREATE POLICY private_project_files ON storage.objects AS RESTRICTIVE FOR ALL TO public
  USING(bucket_id NOT IN ('project-documents','scope-images','employee-photos')
    OR bucket_id='scope-images' AND (storage.foldername(name))[1]=auth.uid()::text
    OR EXISTS(SELECT 1 FROM public.portal_legacy_file_access a WHERE a.owner_id=auth.uid() AND a.bucket_id=storage.objects.bucket_id AND a.object_path=storage.objects.name)
    OR EXISTS(SELECT 1 FROM public.projects p WHERE p.user_id=auth.uid()
      AND (p.id::text=(storage.foldername(name))[1] OR
        (p.user_id::text=(storage.foldername(name))[1] AND p.id::text=(storage.foldername(name))[2]))))
  WITH CHECK(bucket_id NOT IN ('project-documents','scope-images','employee-photos')
    OR bucket_id='scope-images' AND (storage.foldername(name))[1]=auth.uid()::text
    OR EXISTS(SELECT 1 FROM public.projects p WHERE p.user_id=auth.uid()
      AND (p.id::text=(storage.foldername(name))[1] OR
        (p.user_id::text=(storage.foldername(name))[1] AND p.id::text=(storage.foldername(name))[2]))));

-- pg_cron is supplied by Supabase; enabling it requires the SQL editor/admin.
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT cron.schedule('employee-weekly-reminders','0 * * * *','SELECT public.portal_weekly_reminders()');
NOTIFY pgrst,'reload schema';
COMMIT;
