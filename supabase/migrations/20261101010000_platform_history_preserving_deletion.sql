-- Explicit hosted-database approval required. No existing access changes on install.
BEGIN;
ALTER TABLE public.platform_controls
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deletion_state text CHECK(deletion_state IN ('pending','failed','completed')),
  ADD COLUMN deletion_email text,
  ADD COLUMN deletion_event_id uuid;

-- Retain the original audited access-control implementation, adding a terminal
-- deletion fence so a concurrent/replayed Restore cannot undo deletion.
ALTER FUNCTION public.platform_change_access(uuid,text,text,uuid,text,text,text)
  RENAME TO platform_change_access_before_deletion;
CREATE FUNCTION public.platform_change_access(p_actor uuid,p_admin_email text,p_kind text,p_target uuid,
  p_action text,p_reason text,p_confirmation text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE expected text; provider_email text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('platform:'||p_kind||':'||p_target::text,0));
  IF EXISTS(SELECT 1 FROM public.platform_controls WHERE kind=p_kind AND target_id=p_target AND deletion_state IS NOT NULL) THEN
    RAISE EXCEPTION 'Deletion has started. Retry deletion instead of restoring or changing this access.';
  END IF;
  SELECT email INTO provider_email FROM auth.users WHERE id=p_target;
  SELECT coalesce(deletion_email,provider_email) INTO expected FROM public.platform_controls WHERE kind='account' AND target_id=p_target;
  expected:=coalesce(expected,provider_email);
  IF lower(trim(p_confirmation)) IS DISTINCT FROM lower(expected) THEN RAISE EXCEPTION 'Type the account email to confirm'; END IF;
  PERFORM public.platform_change_access_before_deletion(p_actor,p_admin_email,p_kind,p_target,p_action,p_reason,provider_email);
END $$;
REVOKE ALL ON FUNCTION public.platform_change_access_before_deletion(uuid,text,text,uuid,text,text,text)
 FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.platform_change_access(uuid,text,text,uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_change_access(uuid,text,text,uuid,text,text,text) TO service_role;

CREATE FUNCTION public.platform_prepare_deletion(p_actor uuid,p_admin_email text,p_kind text,p_target uuid,p_reason text,p_confirmation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.platform_controls; expected text; event_id uuid; member record;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor AND lower(email)=lower(trim(p_admin_email))) THEN
    RAISE EXCEPTION 'System administrator required' USING ERRCODE='42501';
  END IF;
  IF p_kind NOT IN ('account','business') OR length(trim(p_reason)) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Invalid deletion request'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('platform:'||p_kind||':'||p_target::text,0));
  SELECT * INTO c FROM public.platform_controls WHERE kind=p_kind AND target_id=p_target FOR UPDATE;
  SELECT coalesce(c.deletion_email,
    (SELECT deletion_email FROM public.platform_controls WHERE kind='account' AND target_id=p_target),email)
    INTO expected FROM auth.users WHERE id=p_target;
  IF expected IS NULL THEN RAISE EXCEPTION 'Account identity not found'; END IF;
  IF p_target=p_actor OR lower(expected)=lower(trim(p_admin_email)) THEN RAISE EXCEPTION 'System administrator accounts are protected'; END IF;
  IF lower(trim(p_confirmation))<>lower(expected) THEN RAISE EXCEPTION 'Type the account email to confirm'; END IF;
  IF c.deletion_state='completed' THEN RETURN jsonb_build_object('completed',true,'eventId',c.deletion_event_id); END IF;
  FOR member IN SELECT id FROM public.employees WHERE
    (p_kind='business' AND owner_id=p_target OR p_kind='account' AND auth_user_id=p_target) ORDER BY id
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(member.id::text,0));
  END LOOP;
  IF EXISTS(SELECT 1 FROM public.employee_time_entries t JOIN public.employees e ON e.id=t.employee_id
      WHERE t.ended_at IS NULL AND (p_kind='business' AND t.owner_id=p_target OR p_kind='account' AND e.auth_user_id=p_target)) THEN
    RAISE EXCEPTION 'End running staff timers before deleting this account or business';
  END IF;
  IF c.deletion_state IS NULL THEN
    PERFORM public.platform_change_access(p_actor,p_admin_email,p_kind,p_target,'archive',p_reason,expected);
    event_id:=public.platform_record_event(p_actor,p_kind,p_target,'delete',trim(p_reason),'started');
  ELSE
    event_id:=c.deletion_event_id;
  END IF;
  UPDATE public.platform_controls SET deletion_state='pending',deletion_email=expected,
    deletion_event_id=event_id,updated_by=p_actor,updated_at=now() WHERE kind=p_kind AND target_id=p_target;
  -- Remove memberships, not work history or other businesses' authentication accounts.
  FOR member IN SELECT * FROM public.employees WHERE
    (p_kind='business' AND owner_id=p_target OR p_kind='account' AND auth_user_id=p_target)
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(member.id::text,0));
    UPDATE public.employees SET active=false,archived_at=coalesce(archived_at,now()),auth_user_id=NULL,
      revoked_auth_user_ids=CASE WHEN member.auth_user_id IS NULL THEN revoked_auth_user_ids
        ELSE array_append(revoked_auth_user_ids,member.auth_user_id) END WHERE id=member.id;
    UPDATE public.employee_invitations SET expires_at=now() WHERE employee_id=member.id AND accepted_at IS NULL AND expires_at>now();
  END LOOP;
  IF p_kind='business' THEN
    UPDATE public.platform_controls SET deleted_at=now(),deletion_state='completed' WHERE kind=p_kind AND target_id=p_target;
    UPDATE public.platform_admin_audit SET outcome='completed' WHERE id=event_id;
    RETURN jsonb_build_object('completed',true,'eventId',event_id);
  END IF;
  RETURN jsonb_build_object('completed',false,'eventId',event_id,
    'authDeleted',EXISTS(SELECT 1 FROM auth.users WHERE id=p_target AND deleted_at IS NOT NULL));
END $$;

CREATE FUNCTION public.platform_finish_deletion(p_actor uuid,p_admin_email text,p_target uuid,p_event uuid,p_success boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE c public.platform_controls;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_actor AND lower(email)=lower(trim(p_admin_email))) THEN
    RAISE EXCEPTION 'System administrator required' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('platform:account:'||p_target::text,0));
  SELECT * INTO c FROM public.platform_controls WHERE kind='account' AND target_id=p_target FOR UPDATE;
  IF c.deletion_state='completed' THEN RETURN true; END IF;
  IF c.deletion_event_id IS DISTINCT FROM p_event OR c.deletion_state IS NULL THEN RAISE EXCEPTION 'Deletion attempt does not match'; END IF;
  IF p_success AND NOT EXISTS(SELECT 1 FROM auth.users WHERE id=p_target AND deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Authentication deletion has not been verified';
  END IF;
  UPDATE public.platform_controls SET deletion_state=CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
    deleted_at=CASE WHEN p_success THEN now() ELSE NULL END,updated_at=now() WHERE kind='account' AND target_id=p_target;
  UPDATE public.platform_admin_audit SET outcome=CASE WHEN p_success THEN 'completed' ELSE 'unconfirmed' END WHERE id=p_event;
  RETURN p_success;
END $$;
REVOKE ALL ON FUNCTION public.platform_prepare_deletion(uuid,text,text,uuid,text,text),
 public.platform_finish_deletion(uuid,text,uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.platform_prepare_deletion(uuid,text,text,uuid,text,text),
 public.platform_finish_deletion(uuid,text,uuid,uuid,boolean) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
