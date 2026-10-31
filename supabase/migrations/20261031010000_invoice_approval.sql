-- Approval is separate from delivery. Preserve the existing enum and all legacy
-- invoices: draft + approved_at is an approved, unsent invoice.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_token uuid;

CREATE TABLE IF NOT EXISTS public.invoice_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  state text NOT NULL CHECK (state IN ('sending','uncertain','failed','sent')),
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invoice_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invoice_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_deliveries TO service_role;

CREATE OR REPLACE FUNCTION public.guard_invoice_workflow()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  trusted boolean := current_user = pg_catalog.pg_get_userbyid(
    (SELECT relowner FROM pg_catalog.pg_class WHERE oid = 'public.invoices'::regclass));
  financial_change boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.delivery_token IS NOT NULL THEN
      RAISE EXCEPTION 'Invoice delivery is in progress. Confirm delivery before deleting.' USING ERRCODE='P0001';
    END IF;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NOT trusted AND (NEW.status <> 'draft' OR NEW.approved_at IS NOT NULL
      OR NEW.approved_by IS NOT NULL OR NEW.delivery_token IS NOT NULL) THEN
      RAISE EXCEPTION 'New invoices must be reviewed and approved before sending.' USING ERRCODE='42501';
    END IF;
    RETURN NEW;
  END IF;
  financial_change := ROW(NEW.project_id,NEW.quote_id,NEW.stage_id,NEW.invoice_number,
    NEW.type,NEW.subtotal,NEW.tax_rate,NEW.tax_amount,NEW.total,NEW.due_date,NEW.notes,NEW.terms)
    IS DISTINCT FROM ROW(OLD.project_id,OLD.quote_id,OLD.stage_id,OLD.invoice_number,
    OLD.type,OLD.subtotal,OLD.tax_rate,OLD.tax_amount,OLD.total,OLD.due_date,OLD.notes,OLD.terms);
  -- Preserve existing ON DELETE SET NULL behaviour for source records. This is
  -- not permission to relink or alter an issued invoice's financial content.
  IF financial_change AND
    (NEW.quote_id IS NOT DISTINCT FROM OLD.quote_id OR
      (NEW.quote_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.quotes WHERE id=OLD.quote_id))) AND
    (NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id OR
      (NEW.stage_id IS NULL AND NOT EXISTS(SELECT 1 FROM public.project_stages WHERE id=OLD.stage_id))) AND
    ROW(NEW.project_id,NEW.invoice_number,NEW.type,NEW.subtotal,NEW.tax_rate,NEW.tax_amount,
      NEW.total,NEW.due_date,NEW.notes,NEW.terms) IS NOT DISTINCT FROM
    ROW(OLD.project_id,OLD.invoice_number,OLD.type,OLD.subtotal,OLD.tax_rate,OLD.tax_amount,
      OLD.total,OLD.due_date,OLD.notes,OLD.terms) THEN
    financial_change := false;
  END IF;
  IF OLD.status<>'draft' AND NEW.status='draft' THEN
    RAISE EXCEPTION 'Issued or cancelled invoices cannot be returned to pending approval.' USING ERRCODE='42501';
  END IF;
  IF NOT trusted AND ROW(NEW.approved_at,NEW.approved_by,NEW.delivery_token)
    IS DISTINCT FROM ROW(OLD.approved_at,OLD.approved_by,OLD.delivery_token) THEN
    RAISE EXCEPTION 'Use the invoice approval action.' USING ERRCODE='42501';
  END IF;
  IF financial_change AND (OLD.status <> 'draft' OR OLD.delivery_token IS NOT NULL) THEN
    RAISE EXCEPTION 'Issued invoices or invoices being delivered cannot be edited.' USING ERRCODE='P0001';
  END IF;
  IF OLD.delivery_token IS NOT NULL AND
    (financial_change OR NEW.status IS DISTINCT FROM OLD.status OR
     ROW(NEW.approved_at,NEW.approved_by) IS DISTINCT FROM ROW(OLD.approved_at,OLD.approved_by))
    AND NOT (trusted AND NEW.status = 'sent' AND NEW.delivery_token IS NULL AND NOT financial_change) THEN
    RAISE EXCEPTION 'Invoice delivery is in progress. Please retry delivery first.' USING ERRCODE='P0001';
  END IF;
  IF OLD.status = 'draft' AND NEW.status NOT IN ('draft','cancelled') THEN
    IF NOT (trusted AND NEW.status = 'sent' AND OLD.approved_at IS NOT NULL
      AND OLD.approved_by IS NOT NULL AND OLD.delivery_token IS NOT NULL AND NOT financial_change) THEN
      RAISE EXCEPTION 'Approve the invoice and use Send to client before marking it sent.' USING ERRCODE='42501';
    END IF;
  END IF;
  IF financial_change THEN
    NEW.approved_at := NULL;
    NEW.approved_by := NULL;
  END IF;
  NEW.revision := OLD.revision + 1;
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS invoice_workflow_guard ON public.invoices;
CREATE TRIGGER invoice_workflow_guard BEFORE INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_workflow();

CREATE OR REPLACE FUNCTION public.guard_invoice_line_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  parent public.invoices%ROWTYPE;
  parent_id uuid := CASE WHEN TG_OP='DELETE' THEN OLD.invoice_id ELSE NEW.invoice_id END;
BEGIN
  IF TG_OP='UPDATE' AND NEW.invoice_id IS DISTINCT FROM OLD.invoice_id THEN
    RAISE EXCEPTION 'Invoice line items cannot be moved between invoices.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO parent FROM public.invoices WHERE id=parent_id FOR UPDATE;
  -- Cascading deletion of the parent has already passed its own guard.
  IF NOT FOUND AND TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF parent.status <> 'draft' OR parent.delivery_token IS NOT NULL THEN
    RAISE EXCEPTION 'Issued invoices or invoices being delivered cannot be edited.' USING ERRCODE='P0001';
  END IF;
  IF auth.uid() IS NOT NULL AND NOT EXISTS(
    SELECT 1 FROM public.projects WHERE id=parent.project_id AND user_id=auth.uid()) THEN
    RAISE EXCEPTION 'Invoice access denied.' USING ERRCODE='42501';
  END IF;
  UPDATE public.invoices SET approved_at=NULL,approved_by=NULL WHERE id=parent_id;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS invoice_line_workflow_guard ON public.invoice_line_items;
CREATE TRIGGER invoice_line_workflow_guard BEFORE INSERT OR UPDATE OR DELETE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_line_workflow();

CREATE OR REPLACE FUNCTION public.save_invoice_for_approval(
  p_project_id uuid,p_invoice_id uuid,p_expected_revision integer,
  p_invoice_number text,p_due_date date,p_notes text,p_terms text,
  p_tax_rate numeric,p_line_items jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  inv public.invoices%ROWTYPE;
  item jsonb;
  line_total numeric;
  v_subtotal numeric := 0;
  tax numeric;
BEGIN
  SELECT i.* INTO inv FROM public.invoices i JOIN public.projects p ON p.id=i.project_id
    WHERE i.id=p_invoice_id AND p.id=p_project_id AND p.user_id=auth.uid() FOR UPDATE OF i;
  IF NOT FOUND OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Invoice not found or access denied.' USING ERRCODE='42501';
  END IF;
  IF inv.revision IS DISTINCT FROM p_expected_revision OR inv.status <> 'draft'
    OR inv.delivery_token IS NOT NULL THEN
    RAISE EXCEPTION 'This invoice changed or is being sent. Refresh before editing.' USING ERRCODE='P0001';
  END IF;
  IF p_invoice_number IS NULL OR btrim(p_invoice_number)='' OR length(p_invoice_number)>120
    OR p_tax_rate IS NULL OR p_tax_rate<0 OR p_tax_rate>100
    OR p_tax_rate::text IN ('NaN','Infinity','-Infinity')
    OR length(coalesce(p_notes,''))>50000 OR length(coalesce(p_terms,''))>50000 THEN
    RAISE EXCEPTION 'Check the invoice reference, GST rate, notes and terms.' USING ERRCODE='P0001';
  END IF;
  IF p_line_items IS NULL OR jsonb_typeof(p_line_items)<>'array'
    OR jsonb_array_length(p_line_items) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'Include between 1 and 200 line items.' USING ERRCODE='P0001';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_line_items) LOOP
    IF jsonb_typeof(item->'description') IS DISTINCT FROM 'string'
      OR btrim(regexp_replace(item->>'description','<[^>]*>','','g'))=''
      OR length(item->>'description')>10000
      OR jsonb_typeof(item->'quantity') IS DISTINCT FROM 'number'
      OR jsonb_typeof(item->'unit_price') IS DISTINCT FROM 'number' THEN
      RAISE EXCEPTION 'Check the line descriptions, quantities and prices.' USING ERRCODE='P0001';
    END IF;
    IF (item->>'quantity')::numeric<=0 OR (item->>'quantity')::numeric>1000000
      OR (item->>'unit_price')::numeric<0 OR (item->>'unit_price')::numeric>1000000000 THEN
      RAISE EXCEPTION 'Check the line quantities and prices.' USING ERRCODE='P0001';
    END IF;
    IF (item->>'scope_item_id') IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.scope_items WHERE id=(item->>'scope_item_id')::uuid AND project_id=p_project_id) THEN
      RAISE EXCEPTION 'A linked scope item is not part of this job.' USING ERRCODE='42501';
    END IF;
    IF (item->>'change_request_id') IS NOT NULL AND NOT EXISTS(
      SELECT 1 FROM public.change_requests WHERE id=(item->>'change_request_id')::uuid AND project_id=p_project_id) THEN
      RAISE EXCEPTION 'A linked variation is not part of this job.' USING ERRCODE='42501';
    END IF;
    line_total := round((item->>'quantity')::numeric*(item->>'unit_price')::numeric,2);
    v_subtotal := v_subtotal+line_total;
  END LOOP;
  IF v_subtotal<=0 OR v_subtotal>1000000000000 THEN
    RAISE EXCEPTION 'The invoice subtotal is invalid.' USING ERRCODE='P0001';
  END IF;
  tax := round(v_subtotal*p_tax_rate/100,2);
  DELETE FROM public.invoice_line_items WHERE invoice_id=inv.id;
  INSERT INTO public.invoice_line_items
    (invoice_id,description,quantity,unit_price,total,scope_item_id,change_request_id)
    SELECT inv.id,x.description,x.quantity,x.unit_price,round(x.quantity*x.unit_price,2),
      x.scope_item_id,x.change_request_id
    FROM jsonb_to_recordset(p_line_items) AS
      x(description text,quantity numeric,unit_price numeric,scope_item_id uuid,change_request_id uuid);
  UPDATE public.invoices SET invoice_number=btrim(p_invoice_number),due_date=p_due_date,
    notes=p_notes,terms=p_terms,tax_rate=p_tax_rate,subtotal=v_subtotal,tax_amount=tax,total=v_subtotal+tax,
    approved_at=NULL,approved_by=NULL WHERE id=inv.id;
  RETURN inv.id;
END $$;

CREATE OR REPLACE FUNCTION public.approve_invoice(
  p_project_id uuid,p_invoice_id uuid,p_expected_revision integer
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  inv public.invoices%ROWTYPE;
  line_sum numeric;
  valid boolean;
BEGIN
  SELECT i.* INTO inv FROM public.invoices i JOIN public.projects p ON p.id=i.project_id
    WHERE i.id=p_invoice_id AND p.id=p_project_id AND p.user_id=auth.uid() FOR UPDATE OF i;
  IF NOT FOUND OR auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Invoice not found or access denied.' USING ERRCODE='42501';
  END IF;
  IF inv.revision IS DISTINCT FROM p_expected_revision OR inv.status<>'draft'
    OR inv.delivery_token IS NOT NULL THEN
    RAISE EXCEPTION 'This invoice changed or is being sent. Refresh before approving.' USING ERRCODE='P0001';
  END IF;
  SELECT sum(round(quantity*unit_price,2)),
    bool_and(coalesce(quantity>0 AND quantity<=1000000 AND unit_price>=0 AND unit_price<=1000000000 AND
      quantity::text NOT IN ('NaN','Infinity','-Infinity') AND unit_price::text NOT IN ('NaN','Infinity','-Infinity') AND
      btrim(regexp_replace(description,'<[^>]*>','','g'))<>'' AND round(total,2)=round(quantity*unit_price,2),false))
    INTO line_sum,valid FROM public.invoice_line_items WHERE invoice_id=inv.id;
  IF valid IS DISTINCT FROM true OR line_sum IS NULL OR line_sum<=0
    OR inv.tax_rate IS NULL OR inv.tax_rate<0 OR inv.tax_rate>100
    OR inv.tax_rate::text IN ('NaN','Infinity','-Infinity')
    OR line_sum IS DISTINCT FROM round(inv.subtotal,2)
    OR round(line_sum*inv.tax_rate/100,2) IS DISTINCT FROM round(inv.tax_amount,2)
    OR round(line_sum+inv.tax_amount,2) IS DISTINCT FROM round(inv.total,2)
    OR coalesce(btrim(inv.invoice_number),'')='' THEN
    RAISE EXCEPTION 'Edit the invoice to fix its line items and totals before approving.' USING ERRCODE='P0001';
  END IF;
  UPDATE public.invoices SET approved_at=clock_timestamp(),approved_by=auth.uid() WHERE id=inv.id;
  RETURN inv.id;
END $$;

-- Only the authenticated backend can claim/finalise delivery. A persisted payload
-- and provider idempotency key make an ambiguous email response safely retryable.
CREATE OR REPLACE FUNCTION public.claim_invoice_delivery(
  p_project_id uuid,p_invoice_id uuid,p_actor_id uuid,p_expected_revision integer,p_payload jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  inv public.invoices%ROWTYPE;
  attempt public.invoice_deliveries%ROWTYPE;
BEGIN
  SELECT i.* INTO inv FROM public.invoices i JOIN public.projects p ON p.id=i.project_id
    WHERE i.id=p_invoice_id AND p.id=p_project_id AND p.user_id=p_actor_id FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice access denied.' USING ERRCODE='42501'; END IF;
  IF inv.status IN ('sent','overdue') THEN RETURN jsonb_build_object('already_sent',true); END IF;
  IF inv.status<>'draft' OR inv.approved_at IS NULL OR inv.approved_by IS NULL THEN
    RAISE EXCEPTION 'Approve this invoice before sending it to the client.' USING ERRCODE='P0001';
  END IF;
  IF inv.delivery_token IS NOT NULL THEN
    SELECT * INTO attempt FROM public.invoice_deliveries WHERE id=inv.delivery_token FOR UPDATE;
    IF NOT FOUND OR attempt.created_at<now()-interval '23 hours' THEN
      RAISE EXCEPTION 'Delivery needs manual confirmation before another email can be sent.' USING ERRCODE='P0001';
    END IF;
    IF attempt.state='sending' AND attempt.started_at>now()-interval '90 seconds' THEN
      RAISE EXCEPTION 'Delivery is already in progress. Retry shortly.' USING ERRCODE='P0001';
    END IF;
    UPDATE public.invoice_deliveries SET state='sending',started_at=clock_timestamp() WHERE id=attempt.id;
  ELSE
    IF inv.revision IS DISTINCT FROM p_expected_revision THEN
      RAISE EXCEPTION 'This invoice changed. Refresh and review it before sending.' USING ERRCODE='P0001';
    END IF;
    IF p_payload IS NULL OR jsonb_typeof(p_payload)<>'object' THEN
      RAISE EXCEPTION 'Invoice email could not be prepared.' USING ERRCODE='P0001';
    END IF;
    INSERT INTO public.invoice_deliveries(invoice_id,payload,state) VALUES(inv.id,p_payload,'sending')
      RETURNING * INTO attempt;
    UPDATE public.invoices SET delivery_token=attempt.id WHERE id=inv.id;
  END IF;
  RETURN jsonb_build_object('already_sent',false,'token',attempt.id,'payload',attempt.payload);
END $$;

CREATE OR REPLACE FUNCTION public.finish_invoice_delivery(
  p_invoice_id uuid,p_token uuid,p_actor_id uuid,p_success boolean,p_rejected boolean DEFAULT false
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE inv public.invoices%ROWTYPE;
BEGIN
  SELECT i.* INTO inv FROM public.invoices i JOIN public.projects p ON p.id=i.project_id
    WHERE i.id=p_invoice_id AND p.user_id=p_actor_id FOR UPDATE OF i;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice access denied.' USING ERRCODE='42501'; END IF;
  IF inv.delivery_token IS DISTINCT FROM p_token THEN
    IF inv.status='sent' AND EXISTS(SELECT 1 FROM public.invoice_deliveries
      WHERE id=p_token AND invoice_id=inv.id AND state='sent') THEN RETURN true; END IF;
    RAISE EXCEPTION 'Invoice delivery confirmation does not match.' USING ERRCODE='P0001';
  END IF;
  IF p_success THEN
    UPDATE public.invoices SET status='sent',delivery_token=NULL WHERE id=inv.id;
    UPDATE public.invoice_deliveries SET state='sent' WHERE id=p_token;
  ELSIF p_rejected THEN
    UPDATE public.invoices SET delivery_token=NULL WHERE id=inv.id;
    UPDATE public.invoice_deliveries SET state='failed' WHERE id=p_token;
  ELSE
    UPDATE public.invoice_deliveries SET state='uncertain' WHERE id=p_token;
  END IF;
  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.save_invoice_for_approval(uuid,uuid,integer,text,date,text,text,numeric,jsonb) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.approve_invoice(uuid,uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_invoice_for_approval(uuid,uuid,integer,text,date,text,text,numeric,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_invoice(uuid,uuid,integer) TO authenticated;
REVOKE ALL ON FUNCTION public.claim_invoice_delivery(uuid,uuid,uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.finish_invoice_delivery(uuid,uuid,uuid,boolean,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_invoice_delivery(uuid,uuid,uuid,integer,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_invoice_delivery(uuid,uuid,uuid,boolean,boolean) TO service_role;
