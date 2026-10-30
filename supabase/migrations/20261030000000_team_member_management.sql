BEGIN;

ALTER TABLE public.employees ADD COLUMN archived_at timestamptz,
  ADD COLUMN revoked_auth_user_ids uuid[] NOT NULL DEFAULT '{}';
CREATE INDEX employee_revoked_identity_idx ON public.employees USING gin(revoked_auth_user_ids);
ALTER TABLE public.employees DROP CONSTRAINT employees_owner_id_email_key;
CREATE UNIQUE INDEX employees_current_email_key ON public.employees(owner_id,email) WHERE archived_at IS NULL;

-- Retired identities remain staff identities, never new business owners.
CREATE OR REPLACE FUNCTION public.portal_is_employee()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM public.employees
    WHERE auth_user_id=auth.uid() OR revoked_auth_user_ids @> ARRAY[auth.uid()])
$$;
CREATE OR REPLACE FUNCTION public.portal_owner(p_actor uuid)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE e public.employees;
BEGIN
  SELECT * INTO e FROM public.employees WHERE auth_user_id=p_actor;
  IF FOUND THEN
    IF NOT e.active OR e.archived_at IS NOT NULL OR e.role<>'admin' THEN
      RAISE EXCEPTION 'Team administration is not permitted' USING ERRCODE='42501';
    END IF;
    RETURN e.owner_id;
  END IF;
  IF EXISTS(SELECT 1 FROM public.employees WHERE revoked_auth_user_ids @> ARRAY[p_actor]) THEN
    RAISE EXCEPTION 'Employee access was revoked. Use the latest invitation from your employer.' USING ERRCODE='42501';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor) THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE='42501';
  END IF;
  RETURN p_actor;
END $$;

-- Acquire the same employee lock before reading actor access, not afterwards.
-- This prevents a queued clock request from surviving an email/access change.
ALTER FUNCTION public.portal_mutate(uuid,text,jsonb) RENAME TO portal_mutate_core;
CREATE FUNCTION public.portal_mutate(p_actor uuid,p_action text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE employee_id uuid;
BEGIN
  SELECT id INTO employee_id FROM public.employees WHERE auth_user_id=p_actor;
  IF employee_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(employee_id::text,0));
  END IF;
  IF p_action='team_employee' AND p_payload ? 'id'
    AND EXISTS(SELECT 1 FROM public.employees WHERE id=(p_payload->>'id')::uuid AND archived_at IS NOT NULL) THEN
    RAISE EXCEPTION 'This team member has been removed';
  END IF;
  RETURN public.portal_mutate_core(p_actor,p_action,p_payload);
END $$;

CREATE FUNCTION public.portal_manage_employee(p_actor uuid,p_employee uuid,p_action text,p_payload jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE business uuid; member public.employees; new_email text; result jsonb;
BEGIN
  business:=public.portal_owner(p_actor);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_employee::text,0));
  SELECT * INTO member FROM public.employees WHERE id=p_employee AND owner_id=business FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team member not found' USING ERRCODE='42501'; END IF;
  IF member.auth_user_id=p_actor THEN
    RAISE EXCEPTION 'An administrator cannot remove or change their own access' USING ERRCODE='42501';
  END IF;
  IF p_action NOT IN ('update','remove') THEN RAISE EXCEPTION 'Invalid team action'; END IF;
  IF member.archived_at IS NOT NULL THEN
    IF p_action='remove' THEN RETURN jsonb_build_object('success',true); END IF;
    RAISE EXCEPTION 'This team member has been removed';
  END IF;
  new_email:=CASE WHEN p_payload ? 'email' THEN lower(trim(p_payload->>'email')) ELSE member.email END;
  IF p_action='update' THEN
    IF new_email IS NULL OR new_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
      RAISE EXCEPTION 'Enter a valid email address';
    END IF;
    IF new_email<>member.email AND new_email=(SELECT lower(email) FROM auth.users WHERE id=business) THEN
      RAISE EXCEPTION 'Use the employee email, not the business owner email';
    END IF;
  END IF;
  IF (p_action='remove' OR new_email<>member.email) AND EXISTS(
    SELECT 1 FROM public.employee_time_entries WHERE employee_id=member.id AND ended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'This member has a running timer. Have them clock out before changing their email or removing them.';
  END IF;
  IF p_action='remove' THEN
    UPDATE public.employees SET active=false,archived_at=now(),auth_user_id=NULL,
      revoked_auth_user_ids=CASE WHEN member.auth_user_id IS NULL THEN revoked_auth_user_ids
        ELSE array_append(revoked_auth_user_ids,member.auth_user_id) END
      WHERE id=member.id;
    UPDATE public.employee_invitations SET expires_at=now()
      WHERE employee_id=member.id AND accepted_at IS NULL AND expires_at>now();
    PERFORM public.portal_audit(business,p_actor,member.id,NULL,'employee.removed',
      jsonb_build_object('history_retained',true));
    RETURN jsonb_build_object('success',true);
  END IF;
  -- Role, cost and email changes commit together, including audit and revocation.
  result:=public.portal_mutate(p_actor,'team_employee',(p_payload-'email')||jsonb_build_object('id',member.id));
  IF new_email<>member.email THEN
    UPDATE public.employee_invitations SET expires_at=now()
      WHERE employee_id=member.id AND accepted_at IS NULL AND expires_at>now();
    UPDATE public.employees SET email=new_email,auth_user_id=NULL,
      revoked_auth_user_ids=CASE WHEN member.auth_user_id IS NULL THEN revoked_auth_user_ids
        ELSE array_append(revoked_auth_user_ids,member.auth_user_id) END
      WHERE id=member.id;
    PERFORM public.portal_audit(business,p_actor,member.id,NULL,'employee.email_changed',
      jsonb_build_object('old_email',member.email,'new_email',new_email,'invitation_required',true));
  END IF;
  SELECT to_jsonb(e)-'revoked_auth_user_ids' INTO result FROM public.employees e WHERE id=member.id;
  RETURN result;
END $$;

REVOKE ALL ON FUNCTION public.portal_mutate_core(uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.portal_mutate(uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.portal_manage_employee(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.portal_mutate(uuid,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.portal_manage_employee(uuid,uuid,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
