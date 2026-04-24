-- Secure SECURITY DEFINER function for token-based quote response.
-- Unauthenticated clients call this instead of updating the quotes table
-- directly, so the token is validated at the database level.
--
-- Updates are atomic: the status guard in the WHERE clause of each UPDATE
-- prevents a TOCTOU race (two concurrent calls both passing the initial check
-- and then both updating the same row).
CREATE OR REPLACE FUNCTION public.respond_to_quote_by_token(
  p_token UUID,
  p_status TEXT,
  p_comment TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote_id   UUID;
  v_project_id UUID;
  v_rows       INTEGER;
BEGIN
  -- Validate requested transition before touching any rows
  IF p_status NOT IN ('approved', 'declined') THEN
    RETURN FALSE;
  END IF;

  -- Resolve token → quote id + project id
  SELECT id, project_id
  INTO v_quote_id, v_project_id
  FROM quotes
  WHERE quote_token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF p_status = 'approved' THEN
    -- Atomic: only succeeds if status is still 'sent' at update time
    UPDATE quotes
    SET
      status         = 'approved',
      approved_at    = now(),
      client_comment = p_comment
    WHERE id = v_quote_id
      AND status = 'sent';

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
      -- Quote was not in 'sent' state (already actioned or concurrently changed)
      RETURN FALSE;
    END IF;

    -- Advance project to in_progress (best-effort; non-fatal if already updated)
    UPDATE projects
    SET status = 'in_progress'
    WHERE id = v_project_id
      AND status IN ('draft', 'sent');
  ELSE
    UPDATE quotes
    SET
      status         = 'declined',
      declined_at    = now(),
      client_comment = p_comment
    WHERE id = v_quote_id
      AND status = 'sent';

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
      RETURN FALSE;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$;

-- Grant execute to anon role so unauthenticated clients can call it
GRANT EXECUTE ON FUNCTION public.respond_to_quote_by_token(UUID, TEXT, TEXT) TO anon;
