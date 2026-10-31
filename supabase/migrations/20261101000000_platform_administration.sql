-- REVIEW / EXPLICIT APPROVAL REQUIRED BEFORE APPLYING TO THE HOSTED DATABASE.
-- Transactional, history-preserving controls. No accounts or businesses are restricted by installation.
BEGIN;
CREATE TABLE public.platform_controls (
  kind text NOT NULL CHECK (kind IN ('account','business')),
  target_id uuid NOT NULL,
  status text NOT NULL CHECK (status IN ('active','suspended','archived')),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 5 AND 500),
  updated_by uuid NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(kind,target_id)
);
CREATE TABLE public.platform_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('account','business','membership')),
  target_id uuid NOT NULL, action text NOT NULL, reason text NOT NULL,
  outcome text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX platform_admin_audit_recent ON public.platform_admin_audit(created_at DESC);
CREATE INDEX platform_admin_audit_target ON public.platform_admin_audit(target_id,action,created_at DESC);
ALTER TABLE public.platform_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_controls, public.platform_admin_audit FROM anon,authenticated;
GRANT ALL ON public.platform_controls, public.platform_admin_audit TO service_role;

CREATE FUNCTION public.platform_check_business(p_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT p_owner IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.platform_controls WHERE kind='business' AND target_id=p_owner AND status<>'active'
  )
$$;
CREATE FUNCTION public.platform_check_access(p_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT p_user IS NOT NULL
    AND NOT EXISTS(SELECT 1 FROM public.platform_controls WHERE kind='account' AND target_id=p_user AND status<>'active')
    AND public.platform_check_business(p_user)
    AND NOT EXISTS(SELECT 1 FROM public.employees e WHERE e.auth_user_id=p_user
      AND e.active AND e.archived_at IS NULL AND NOT public.platform_check_business(e.owner_id))
$$;
CREATE FUNCTION public.platform_current_access()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
  SELECT public.platform_check_access(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.platform_check_business(uuid), public.platform_check_access(uuid),
  public.platform_current_access() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_check_business(uuid), public.platform_check_access(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_current_access() TO authenticated;

-- Existing JWTs are checked against current controls on every direct DB/storage request.
-- Restrictive policies intersect with, and never replace or widen, existing tenant policies.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public'
    AND tablename NOT IN ('platform_controls','platform_admin_audit')
  LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname=t.tablename AND c.relrowsecurity) THEN
      RAISE EXCEPTION 'Review required: public table % does not have row security enabled',t.tablename;
    END IF;
    EXECUTE format('CREATE POLICY platform_access_fence ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.platform_current_access()) WITH CHECK (public.platform_current_access())',t.tablename);
  END LOOP;
END $$;
CREATE POLICY platform_storage_fence ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
  USING(public.platform_current_access()) WITH CHECK(public.platform_current_access());
-- Qualify the outer object name: inside the project subquery, bare "name"
-- otherwise resolves to the project's name instead of the stored object's path.
ALTER POLICY private_project_files ON storage.objects
  USING(storage.objects.bucket_id NOT IN ('project-documents','scope-images','employee-photos')
    OR storage.objects.bucket_id='scope-images' AND (storage.foldername(storage.objects.name))[1]=auth.uid()::text
    OR EXISTS(SELECT 1 FROM public.portal_legacy_file_access a WHERE a.owner_id=auth.uid()
      AND a.bucket_id=storage.objects.bucket_id AND a.object_path=storage.objects.name)
    OR EXISTS(SELECT 1 FROM public.projects p WHERE p.user_id=auth.uid()
      AND (p.id::text=(storage.foldername(storage.objects.name))[1]
        OR p.user_id::text=(storage.foldername(storage.objects.name))[1]
          AND p.id::text=(storage.foldername(storage.objects.name))[2])))
  WITH CHECK(storage.objects.bucket_id NOT IN ('project-documents','scope-images','employee-photos')
    OR storage.objects.bucket_id='scope-images' AND (storage.foldername(storage.objects.name))[1]=auth.uid()::text
    OR EXISTS(SELECT 1 FROM public.projects p WHERE p.user_id=auth.uid()
      AND (p.id::text=(storage.foldername(storage.objects.name))[1]
        OR p.user_id::text=(storage.foldername(storage.objects.name))[1]
          AND p.id::text=(storage.foldername(storage.objects.name))[2])));

-- RLS does not constrain SECURITY DEFINER RPCs. Keep their existing argument/
-- return contracts, but put an access check in front of each direct financial RPC.
-- The original implementation becomes callable only by trusted server/definer roles.
DO $migration$
DECLARE f record; core_name text; positional text; gate text;
BEGIN
  FOR f IN SELECT p.oid,p.proname,p.pronargs,
      pg_get_function_identity_arguments(p.oid) AS identity_args,
      pg_get_function_arguments(p.oid) AS full_args,
      pg_get_function_result(p.oid) AS result_type,
      has_function_privilege('anon',p.oid,'EXECUTE') AS allow_anon,
      has_function_privilege('authenticated',p.oid,'EXECUTE') AS allow_authenticated
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname IN
      ('create_stage_invoice','save_invoice_for_approval','approve_invoice','respond_to_quote_by_token')
  LOOP
    core_name:='__platform_core_'||f.proname;
    SELECT string_agg('$'||i,',' ORDER BY i) INTO positional FROM generate_series(1,f.pronargs) AS i;
    IF f.proname='respond_to_quote_by_token' THEN
      gate:='IF EXISTS(SELECT 1 FROM public.quotes q JOIN public.projects p ON p.id=q.project_id
        WHERE q.quote_token=$1 AND NOT public.platform_check_business(p.user_id))
        THEN RAISE EXCEPTION ''This business is restricted'' USING ERRCODE=''42501''; END IF;';
    ELSE
      gate:='IF NOT public.platform_current_access() THEN RAISE EXCEPTION ''This account or business is restricted'' USING ERRCODE=''42501''; END IF;';
    END IF;
    EXECUTE format('ALTER FUNCTION public.%I(%s) RENAME TO %I',f.proname,f.identity_args,core_name);
    EXECUTE format('CREATE FUNCTION public.%I(%s) RETURNS %s LANGUAGE plpgsql SECURITY DEFINER SET search_path='''' AS $body$ BEGIN %s RETURN public.%I(%s); END $body$',
      f.proname,f.full_args,f.result_type,gate,core_name,positional);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC,anon,authenticated',core_name,f.identity_args);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC,anon,authenticated',f.proname,f.identity_args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',core_name,f.identity_args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO service_role',f.proname,f.identity_args);
    IF f.allow_anon THEN EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon',f.proname,f.identity_args); END IF;
    IF f.allow_authenticated THEN EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO authenticated',f.proname,f.identity_args); END IF;
  END LOOP;
END $migration$;

CREATE FUNCTION public.platform_record_event(p_actor uuid,p_kind text,p_target uuid,p_action text,p_reason text,p_outcome text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result uuid;
BEGIN
  INSERT INTO public.platform_admin_audit(actor_id,target_kind,target_id,action,reason,outcome)
    VALUES(p_actor,p_kind,p_target,p_action,p_reason,p_outcome) RETURNING id INTO result;
  RETURN result;
END $$;
CREATE FUNCTION public.platform_finish_event(p_id uuid,p_outcome text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
  UPDATE public.platform_admin_audit SET outcome=p_outcome WHERE id=p_id AND outcome='started';
  IF NOT FOUND THEN RAISE EXCEPTION 'Audit event not found or already completed'; END IF;
END $$;

CREATE FUNCTION public.platform_change_access(p_actor uuid,p_admin_email text,p_kind text,p_target uuid,
  p_action text,p_reason text,p_confirmation text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE target_email text; new_status text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor AND lower(email)=lower(trim(p_admin_email))) THEN
    RAISE EXCEPTION 'System administrator required' USING ERRCODE='42501';
  END IF;
  IF p_kind NOT IN ('account','business') OR p_action NOT IN ('suspend','reactivate','archive') THEN
    RAISE EXCEPTION 'Unsupported control action';
  END IF;
  IF length(trim(p_reason)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Enter a reason'; END IF;
  SELECT email INTO target_email FROM auth.users WHERE id=p_target;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target account not found'; END IF;
  IF p_actor=p_target OR lower(target_email)=lower(trim(p_admin_email)) THEN
    RAISE EXCEPTION 'System administrator accounts are protected';
  END IF;
  IF p_kind='business' AND p_action<>'reactivate' AND EXISTS(
    SELECT 1 FROM public.employees e WHERE e.owner_id=p_target AND e.auth_user_id=p_actor
      AND e.active AND e.archived_at IS NULL) THEN
    RAISE EXCEPTION 'System administrator accounts are protected: this business includes your active membership';
  END IF;
  IF lower(trim(p_confirmation))<>lower(coalesce(nullif(target_email,''),p_target::text)) THEN
    RAISE EXCEPTION 'Type the account email to confirm';
  END IF;
  IF p_kind='business' AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE user_id=p_target)
    AND NOT EXISTS(SELECT 1 FROM public.projects WHERE user_id=p_target)
    AND NOT EXISTS(SELECT 1 FROM public.employees WHERE owner_id=p_target) THEN
    RAISE EXCEPTION 'Business not found';
  END IF;
  new_status:=CASE p_action WHEN 'suspend' THEN 'suspended' WHEN 'archive' THEN 'archived' ELSE 'active' END;
  INSERT INTO public.platform_controls(kind,target_id,status,reason,updated_by)
    VALUES(p_kind,p_target,new_status,trim(p_reason),p_actor)
    ON CONFLICT(kind,target_id) DO UPDATE SET status=excluded.status,reason=excluded.reason,updated_by=excluded.updated_by,updated_at=now();
  PERFORM public.platform_record_event(p_actor,p_kind,p_target,p_action,trim(p_reason),'completed');
END $$;

CREATE FUNCTION public.platform_remove_membership(p_actor uuid,p_admin_email text,p_member uuid,p_reason text,p_confirmation text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE member public.employees;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor AND lower(email)=lower(trim(p_admin_email))) THEN
    RAISE EXCEPTION 'System administrator required' USING ERRCODE='42501';
  END IF;
  IF length(trim(p_reason)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Enter a reason'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_member::text,0));
  SELECT * INTO member FROM public.employees WHERE id=p_member FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Team membership not found'; END IF;
  IF member.auth_user_id=p_actor THEN RAISE EXCEPTION 'Cannot remove your own access'; END IF;
  IF lower(trim(p_confirmation))<>lower(member.email) THEN RAISE EXCEPTION 'Type the member email to confirm'; END IF;
  IF EXISTS(SELECT 1 FROM public.employee_time_entries WHERE employee_id=member.id AND ended_at IS NULL) THEN
    RAISE EXCEPTION 'This member has a running timer. Clock out before removing access.';
  END IF;
  UPDATE public.employees SET active=false,archived_at=coalesce(archived_at,now()),auth_user_id=NULL,
    revoked_auth_user_ids=CASE WHEN member.auth_user_id IS NULL THEN revoked_auth_user_ids
      ELSE array_append(revoked_auth_user_ids,member.auth_user_id) END WHERE id=member.id;
  UPDATE public.employee_invitations SET expires_at=now()
    WHERE employee_id=member.id AND accepted_at IS NULL AND expires_at>now();
  PERFORM public.platform_record_event(p_actor,'membership',member.id,'remove',trim(p_reason),'completed');
END $$;
REVOKE ALL ON FUNCTION public.platform_record_event(uuid,text,uuid,text,text,text),
  public.platform_finish_event(uuid,text),
  public.platform_change_access(uuid,text,text,uuid,text,text,text),
  public.platform_remove_membership(uuid,text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_record_event(uuid,text,uuid,text,text,text),
  public.platform_finish_event(uuid,text),
  public.platform_change_access(uuid,text,text,uuid,text,text,text),
  public.platform_remove_membership(uuid,text,uuid,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
