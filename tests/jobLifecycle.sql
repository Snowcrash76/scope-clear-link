-- Synthetic-only: run in the isolated local PostgreSQL cluster, never hosted.
INSERT INTO public.projects(id,user_id,name,client_name,client_email,status) VALUES
 ('70000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Deletable fixture','Synthetic client','synthetic@example.invalid','draft');
INSERT INTO public.quotes(id,project_id,quote_number,status,subtotal,tax_rate,tax_amount,total)
 VALUES('71000000-0000-4000-8000-000000000001','70000000-0000-4000-8000-000000000001','DELETE-SYN','draft',100,10,10,110);
UPDATE public.projects SET active_quote_id='71000000-0000-4000-8000-000000000001' WHERE id='70000000-0000-4000-8000-000000000001';
INSERT INTO public.invoices(project_id,invoice_number,status,subtotal,tax_rate,tax_amount,total)
 VALUES('70000000-0000-4000-8000-000000000001','DELETE-SYN','draft',100,10,10,110);
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',false);
DO $$ DECLARE affected integer; BEGIN
  UPDATE public.projects SET status='completed' WHERE id='70000000-0000-4000-8000-000000000001';
  IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id='70000000-0000-4000-8000-000000000001' AND status='completed')
    OR NOT EXISTS(SELECT 1 FROM public.quotes WHERE id='71000000-0000-4000-8000-000000000001' AND total=110) THEN
    RAISE EXCEPTION 'FAIL: archive removed job or changed quote';
  END IF;
  UPDATE public.projects SET status='in_progress' WHERE id='70000000-0000-4000-8000-000000000001';
  DELETE FROM public.projects WHERE id='70000000-0000-4000-8000-000000000001' AND user_id=auth.uid();
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'FAIL: owner cannot delete unprotected job'; END IF;
  IF EXISTS(SELECT 1 FROM public.quotes WHERE id='71000000-0000-4000-8000-000000000001')
    OR EXISTS(SELECT 1 FROM public.invoices WHERE invoice_number='DELETE-SYN') THEN
    RAISE EXCEPTION 'FAIL: child rows did not cascade atomically';
  END IF;
END $$;
DO $$ DECLARE before_quotes integer; before_invoices integer; BEGIN
  SELECT count(*) INTO before_quotes FROM public.quotes;
  SELECT count(*) INTO before_invoices FROM public.invoices;
  BEGIN
    DELETE FROM public.projects WHERE id='20000000-0000-4000-8000-000000000001';
    RAISE EXCEPTION 'FAIL: protected job deleted';
  EXCEPTION WHEN foreign_key_violation OR insufficient_privilege THEN NULL;
    WHEN raise_exception THEN
      IF SQLERRM NOT LIKE 'Remove staff assignments before changing this appointment job%' THEN RAISE; END IF;
  END;
  IF NOT EXISTS(SELECT 1 FROM public.projects WHERE id='20000000-0000-4000-8000-000000000001')
    OR (SELECT count(*) FROM public.quotes)<>before_quotes
    OR (SELECT count(*) FROM public.invoices)<>before_invoices THEN
    RAISE EXCEPTION 'FAIL: failed delete partially erased work history';
  END IF;
  DELETE FROM public.projects WHERE user_id='10000000-0000-4000-8000-000000000004';
  IF FOUND THEN RAISE EXCEPTION 'FAIL: owner deleted another business job'; END IF;
END $$;
RESET ROLE;
