-- Keep issued and cancelled financial records, including legacy invoices without
-- approval metadata. Cancellation must not become a route to deleting history.
-- Only prepared, never-issued invoices (stored status draft) may be deleted.
CREATE OR REPLACE FUNCTION public.retain_invoice_history()
RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM 'draft' THEN
    RAISE EXCEPTION 'Issued and cancelled invoices are retained for financial history and cannot be deleted.'
      USING ERRCODE='42501';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS invoice_history_retention ON public.invoices;
CREATE TRIGGER invoice_history_retention BEFORE DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.retain_invoice_history();
