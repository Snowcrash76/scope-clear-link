-- Stage-linked invoices are a single draft invoice per stage, regardless of entry point.
-- Existing invoices remain untouched. Preflight for duplicates before applying this
-- index; resolve any existing duplicates manually rather than deleting customer data.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_one_active_per_stage
  ON public.invoices (stage_id)
  WHERE stage_id IS NOT NULL AND status <> 'cancelled';

-- Remove the preview signature predating explicit stale-GST protection.
DROP FUNCTION IF EXISTS public.create_stage_invoice(uuid,uuid,uuid,numeric,numeric,numeric,date,text,text);
CREATE OR REPLACE FUNCTION public.create_stage_invoice(
  p_project_id uuid,
  p_stage_id uuid,
  p_expected_quote_id uuid,
  p_expected_percentage numeric,
  p_expected_amount numeric,
  p_expected_subtotal numeric,
  p_expected_tax_rate numeric,
  p_due_date date DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_terms text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_project public.projects%ROWTYPE;
  v_stage public.project_stages%ROWTYPE;
  v_quote public.quotes%ROWTYPE;
  v_rate numeric := 10;
  v_basis numeric;
  v_subtotal numeric;
  v_tax numeric;
  v_invoice uuid;
  v_label text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to create a stage invoice.' USING ERRCODE = '42501';
  END IF;
  -- Serialise simultaneous requests for this job. The unique index also protects
  -- the stage when another existing invoice path creates an invoice directly.
  SELECT * INTO v_project FROM public.projects
    WHERE id = p_project_id AND user_id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found or access denied.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_stage FROM public.project_stages
    WHERE id = p_stage_id AND project_id = p_project_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Stage not found for this job.' USING ERRCODE = '23503';
  END IF;
  SELECT id INTO v_invoice FROM public.invoices
    WHERE stage_id = p_stage_id AND status <> 'cancelled' LIMIT 1;
  IF v_invoice IS NOT NULL THEN RETURN v_invoice; END IF;

  IF v_project.active_quote_id IS DISTINCT FROM p_expected_quote_id
     OR v_stage.invoice_percentage IS DISTINCT FROM p_expected_percentage
     OR v_stage.invoice_amount IS DISTINCT FROM p_expected_amount THEN
    RAISE EXCEPTION 'The stage or active quote changed. Refresh and review the invoice again.'
      USING ERRCODE = 'P0001';
  END IF;
  IF v_project.active_quote_id IS NOT NULL THEN
    SELECT * INTO v_quote FROM public.quotes
      WHERE id = v_project.active_quote_id AND project_id = p_project_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Active quote is unavailable.' USING ERRCODE = 'P0001';
    END IF;
    v_rate := v_quote.tax_rate;
    IF v_rate IS NULL OR v_rate < 0 OR v_rate > 100 THEN
      RAISE EXCEPTION 'The saved quote has an invalid GST rate.' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF v_stage.invoice_amount IS NOT NULL THEN
    IF v_stage.invoice_amount <= 0
      OR v_stage.invoice_amount <> round(v_stage.invoice_amount, 2) THEN
      RAISE EXCEPTION 'The stage has an invalid fixed invoice amount.' USING ERRCODE = 'P0001';
    END IF;
    v_subtotal := v_stage.invoice_amount;
    v_label := 'Fixed stage amount';
  ELSIF v_stage.invoice_percentage IS NOT NULL THEN
    IF v_quote.id IS NULL OR v_stage.invoice_percentage <= 0
      OR v_stage.invoice_percentage > 100
      OR v_stage.invoice_percentage <> round(v_stage.invoice_percentage, 2) THEN
      RAISE EXCEPTION 'The stage percentage or saved quote is invalid.' USING ERRCODE = 'P0001';
    END IF;
    v_basis := CASE WHEN v_quote.subtotal > 0 THEN v_quote.subtotal
      WHEN v_quote.total > 0 THEN v_quote.total / (1 + v_rate / 100)
      ELSE NULL END;
    IF v_basis IS NULL OR v_basis <= 0 THEN
      RAISE EXCEPTION 'The saved quote amount is unavailable.' USING ERRCODE = 'P0001';
    END IF;
    v_subtotal := round(v_basis * v_stage.invoice_percentage / 100, 2);
    v_label := v_stage.invoice_percentage::text || '% of quote';
  ELSE
    RAISE EXCEPTION 'Add an invoice amount to this stage first.' USING ERRCODE = 'P0001';
  END IF;
  IF v_subtotal <= 0 OR v_subtotal IS DISTINCT FROM p_expected_subtotal
    OR v_rate IS DISTINCT FROM p_expected_tax_rate THEN
    RAISE EXCEPTION 'The stage amount changed. Refresh and review the invoice again.'
      USING ERRCODE = 'P0001';
  END IF;
  v_tax := round(v_subtotal * v_rate / 100, 2);

  INSERT INTO public.invoices
    (project_id, quote_id, stage_id, invoice_number, type, status,
     subtotal, tax_rate, tax_amount, total, due_date, notes, terms)
  VALUES
    (p_project_id, v_quote.id, v_stage.id,
     'INV-' || to_char(now(), 'YYYYMMDD') || '-' || upper(left(replace(gen_random_uuid()::text, '-', ''), 12)),
     'staged', 'draft', v_subtotal, v_rate, v_tax, v_subtotal + v_tax,
     p_due_date, p_notes, p_terms)
  RETURNING id INTO v_invoice;
  INSERT INTO public.invoice_line_items (invoice_id, description, quantity, unit_price, total)
  VALUES (v_invoice,
    'Stage Payment: ' || v_stage.name || ' (' || v_label ||
      CASE WHEN v_quote.id IS NOT NULL THEN ' ' || v_quote.quote_number ELSE '' END || ')',
    1, v_subtotal, v_subtotal);
  RETURN v_invoice;
END
$$;

REVOKE ALL ON FUNCTION public.create_stage_invoice(uuid,uuid,uuid,numeric,numeric,numeric,numeric,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_stage_invoice(uuid,uuid,uuid,numeric,numeric,numeric,numeric,date,text,text) TO authenticated;
