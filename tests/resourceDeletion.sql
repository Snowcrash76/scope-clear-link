-- Isolated synthetic PostgreSQL only. Apply all migrations first.
BEGIN;
DO $$
DECLARE
  owner_id uuid:=gen_random_uuid(); other_owner uuid:=gen_random_uuid();
  job uuid:=gen_random_uuid(); other_job uuid:=gen_random_uuid();
  quote uuid:=gen_random_uuid(); invoice uuid:=gen_random_uuid();
  staff uuid:=gen_random_uuid(); entry uuid:=gen_random_uuid();
  result jsonb; n integer;
BEGIN
  INSERT INTO auth.users(id,email) VALUES(owner_id,'delete-owner@example.invalid'),(other_owner,'delete-other@example.invalid');
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  INSERT INTO public.projects(id,user_id,name,client_name,client_email)
    VALUES(job,owner_id,'Synthetic wipe job','Synthetic wipe client','wipe@example.invalid'),
      (other_job,other_owner,'Other business job','Same client email','wipe@example.invalid');
  INSERT INTO public.quotes(id,project_id,quote_number,status,subtotal,tax_amount,total)
    VALUES(quote,job,'SYN-DELETE-Q','approved',100,10,110);
  UPDATE public.projects SET active_quote_id=quote WHERE id=job;
  INSERT INTO public.quote_line_items(quote_id,title,cost)
    VALUES(quote,'Synthetic material',100);
  INSERT INTO public.invoices(id,project_id,quote_id,invoice_number,status,subtotal,tax_amount,total)
    VALUES(invoice,job,quote,'SYN-DELETE-I','draft',100,10,110);
  INSERT INTO public.invoice_line_items(invoice_id,description,quantity,unit_price,total)
    VALUES(invoice,'Synthetic invoice material',1,100,100);
  UPDATE public.invoices SET approved_at=now(),approved_by=owner_id,delivery_token=gen_random_uuid() WHERE id=invoice;
  UPDATE public.invoices SET status='sent',delivery_token=NULL WHERE id=invoice;
  UPDATE public.invoices SET status='paid' WHERE id=invoice;
  -- Existing ordinary DELETE protection must still hold.
  BEGIN
    DELETE FROM public.invoices WHERE id=invoice;
    RAISE EXCEPTION 'ordinary paid invoice deletion unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM public.owner_delete_resources(other_owner,'invoice',invoice,NULL,'DELETE');
    RAISE EXCEPTION 'cross-business deletion unexpectedly succeeded';
  EXCEPTION WHEN no_data_found THEN NULL;
  END;
  BEGIN
    PERFORM public.owner_delete_resources(owner_id,'client',NULL,'wipe@example.invalid','yes');
    RAISE EXCEPTION 'unconfirmed deletion unexpectedly succeeded';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;
  -- Standalone quote deletion preserves issued invoice and job, clears links.
  result:=public.owner_delete_resources(owner_id,'quote',quote,NULL,'DELETE');
  IF result->>'deleted'<>'true' OR EXISTS(SELECT 1 FROM public.quotes WHERE id=quote)
    OR NOT EXISTS(SELECT 1 FROM public.invoices WHERE id=invoice AND quote_id IS NULL AND total=110)
    OR NOT EXISTS(SELECT 1 FROM public.projects WHERE id=job AND active_quote_id IS NULL) THEN
    RAISE EXCEPTION 'standalone quote boundary failed';
  END IF;
  result:=public.owner_delete_resources(owner_id,'invoice',invoice,NULL,'DELETE');
  IF EXISTS(SELECT 1 FROM public.invoices WHERE id=invoice)
    OR NOT EXISTS(SELECT 1 FROM public.projects WHERE id=job) THEN
    RAISE EXCEPTION 'standalone invoice boundary failed';
  END IF;
  -- Full wipe includes immutable staff audit, approved time, generated labour,
  -- restrictive staff FKs, paid invoice and private file references.
  INSERT INTO public.employees(id,owner_id,email,name) VALUES(staff,owner_id,'staff@example.invalid','Synthetic staff');
  INSERT INTO public.employee_time_entries(id,owner_id,employee_id,project_id,work_date,started_at,ended_at,status)
    VALUES(entry,owner_id,staff,job,'2026-10-01','2026-10-01 08:00+00','2026-10-01 09:00+00','approved');
  PERFORM set_config('portal.labour_write','yes',true);
  INSERT INTO public.job_costs(job_id,supplier,description,cost_date,category,amount_ex_gst,gst_amount,amount_inc_gst,gst_applies,status,timesheet_entry_id)
    VALUES(job,'Synthetic staff','Synthetic approved labour','2026-10-01','Labour',40,0,40,false,'confirmed',entry);
  PERFORM set_config('portal.labour_write','',true);
  INSERT INTO public.employee_audit_events(owner_id,actor_id,employee_id,project_id,action)
    VALUES(owner_id,owner_id,staff,job,'synthetic.approved');
  INSERT INTO public.employee_job_notes(owner_id,employee_id,project_id,body)
    VALUES(owner_id,staff,job,'Synthetic private note');
  INSERT INTO public.project_documents(project_id,file_name,file_url,file_type,file_size)
    VALUES(job,'synthetic.jpg',job::text||'/synthetic.jpg','image/jpeg',1);
  INSERT INTO public.invoices(id,project_id,invoice_number,status,subtotal,tax_amount,total)
    VALUES(invoice,job,'SYN-WIPE-I','paid',100,10,110);
  -- Unexpected dependency: transaction must roll back every attempted child delete.
  CREATE SCHEMA deletion_test;
  CREATE TABLE deletion_test.wipe_blocker(id uuid PRIMARY KEY,project_id uuid REFERENCES public.projects(id));
  INSERT INTO deletion_test.wipe_blocker VALUES(gen_random_uuid(),job);
  BEGIN
    PERFORM public.owner_delete_resources(owner_id,'client',NULL,'wipe@example.invalid','DELETE');
    RAISE EXCEPTION 'wipe with unknown external dependency unexpectedly succeeded';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
  IF NOT EXISTS(SELECT 1 FROM public.invoices WHERE id=invoice)
    OR NOT EXISTS(SELECT 1 FROM public.employee_time_entries WHERE id=entry)
    OR NOT EXISTS(SELECT 1 FROM public.employee_audit_events WHERE project_id=job) THEN
    RAISE EXCEPTION 'failed wipe partially deleted history';
  END IF;
  DROP TABLE deletion_test.wipe_blocker;
  DROP SCHEMA deletion_test;
  result:=public.owner_delete_resources(owner_id,'client',NULL,'wipe@example.invalid','DELETE');
  IF EXISTS(SELECT 1 FROM public.projects WHERE id=job)
    OR EXISTS(SELECT 1 FROM public.invoices WHERE id=invoice)
    OR EXISTS(SELECT 1 FROM public.employee_time_entries WHERE id=entry)
    OR EXISTS(SELECT 1 FROM public.job_costs WHERE job_id=job)
    OR EXISTS(SELECT 1 FROM public.employee_audit_events WHERE project_id=job)
    OR EXISTS(SELECT 1 FROM public.project_documents WHERE project_id=job)
    OR EXISTS(SELECT 1 FROM public.employee_job_notes WHERE project_id=job)
    OR NOT EXISTS(SELECT 1 FROM public.employees WHERE id=staff)
    OR NOT EXISTS(SELECT 1 FROM public.projects WHERE id=other_job)
    OR result->>'cleanupId' IS NULL THEN
    RAISE EXCEPTION 'full wipe scope or durable attachment queue failed';
  END IF;
  SELECT count(*) INTO n FROM deletion_private.targets WHERE transaction_id=txid_current();
  IF n<>0 THEN RAISE EXCEPTION 'deletion authorization leaked beyond operation'; END IF;
END $$;
-- API roles cannot call the service-only operation or manufacture authorisation.
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  BEGIN
    PERFORM public.owner_delete_resources(gen_random_uuid(),'client',NULL,'anything','DELETE');
    RAISE EXCEPTION 'authenticated role can call destructive RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN
    INSERT INTO deletion_private.targets VALUES(txid_current(),'public.projects'::regclass,gen_random_uuid());
    RAISE EXCEPTION 'authenticated role can authorize arbitrary deletion';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
ROLLBACK;
