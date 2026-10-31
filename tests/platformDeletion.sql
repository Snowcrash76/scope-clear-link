-- Isolated test cluster only. Never run these synthetic changes on hosted data.
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
INSERT INTO auth.users(id,email) VALUES
 ('61000000-0000-4000-8000-000000000001','deleted-owner@example.invalid'),
 ('61000000-0000-4000-8000-000000000002','kept-staff@example.invalid');
INSERT INTO public.projects(id,user_id,name,client_name,client_email,status) VALUES
 ('62000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','Retained job','Client','client@example.invalid','completed');
INSERT INTO public.employees(id,owner_id,auth_user_id,name,email,role,active) VALUES
 ('63000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000001','61000000-0000-4000-8000-000000000002','Staff','kept-staff@example.invalid','labourer',true);
DO $$
DECLARE state jsonb; root uuid:='90000000-0000-4000-8000-000000000001';
BEGIN
  state:=public.platform_prepare_deletion(root,'platform-admin@example.invalid','business','61000000-0000-4000-8000-000000000001','Synthetic deletion','deleted-owner@example.invalid');
  IF NOT (state->>'completed')::boolean THEN RAISE EXCEPTION 'FAIL: business deletion incomplete'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id='62000000-0000-4000-8000-000000000001')
    OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id='61000000-0000-4000-8000-000000000002' AND deleted_at IS NULL)
    OR EXISTS(SELECT 1 FROM public.employees WHERE id='63000000-0000-4000-8000-000000000001' AND active) THEN
    RAISE EXCEPTION 'FAIL: history lost or staff login deleted or membership retained';
  END IF;
  IF public.platform_check_business('61000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'FAIL: deleted business still accessible'; END IF;
  BEGIN
    PERFORM public.platform_change_access(root,'platform-admin@example.invalid','business','61000000-0000-4000-8000-000000000001','reactivate','Synthetic restore','deleted-owner@example.invalid');
    RAISE EXCEPTION 'FAIL: deleted business restored';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Deletion has started%' THEN RAISE; END IF; END;
  state:=public.platform_prepare_deletion(root,'platform-admin@example.invalid','account','61000000-0000-4000-8000-000000000001','Synthetic account deletion','deleted-owner@example.invalid');
  IF public.platform_check_access('61000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'FAIL: pending delete access allowed'; END IF;
  IF public.platform_finish_deletion(root,'platform-admin@example.invalid','61000000-0000-4000-8000-000000000001',(state->>'eventId')::uuid,false) THEN
    RAISE EXCEPTION 'FAIL: provider failure recorded as complete';
  END IF;
  UPDATE auth.users SET deleted_at=now() WHERE id='61000000-0000-4000-8000-000000000001';
  IF NOT public.platform_finish_deletion(root,'platform-admin@example.invalid','61000000-0000-4000-8000-000000000001',(state->>'eventId')::uuid,true) THEN RAISE EXCEPTION 'FAIL: retry did not finish'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id='62000000-0000-4000-8000-000000000001') THEN RAISE EXCEPTION 'FAIL: account deletion lost job history'; END IF;
  BEGIN
    PERFORM public.platform_prepare_deletion(root,'platform-admin@example.invalid','account',root,'Root protection','platform-admin@example.invalid');
    RAISE EXCEPTION 'FAIL: root deleted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'System administrator accounts are protected%' THEN RAISE; END IF; END;
END $$;
SET ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.platform_prepare_deletion('90000000-0000-4000-8000-000000000001','platform-admin@example.invalid','account','61000000-0000-4000-8000-000000000002','Unauthorized','kept-staff@example.invalid');
    RAISE EXCEPTION 'FAIL: ordinary user invoked system deletion';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
