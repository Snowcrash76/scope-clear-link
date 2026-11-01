-- Reuse the current, permission-checked assignment mutation. The entire RPC is
-- one transaction, including appointments, crew access, notifications and audit.
CREATE OR REPLACE FUNCTION public.portal_assign_days(p_actor uuid, p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  day_text text;
  saved_days integer := 0;
BEGIN
  IF p_actor IS NULL OR jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_payload->'dates') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Choose valid assignment dates' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_payload->'dates') NOT BETWEEN 1 AND 31
     OR p_payload->>'appointment_id' IS NOT NULL THEN
    RAISE EXCEPTION 'Choose up to 31 dates without an existing appointment' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p_payload->'dates'))
     <> jsonb_array_length(p_payload->'dates') THEN
    RAISE EXCEPTION 'Assignment dates must be unique' USING ERRCODE = '22023';
  END IF;
  FOR day_text IN SELECT value FROM jsonb_array_elements_text(p_payload->'dates') LOOP
    IF day_text IS NULL OR day_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
      RAISE EXCEPTION 'Choose valid assignment dates' USING ERRCODE = '22023';
    END IF;
    PERFORM day_text::date;
    PERFORM public.portal_mutate(
      p_actor, 'team_assign',
      (p_payload - 'dates' - 'end_date') || jsonb_build_object('date', day_text)
    );
    saved_days := saved_days + 1;
  END LOOP;
  RETURN jsonb_build_object('success', true, 'days', saved_days);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_assign_days(uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_assign_days(uuid,jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
