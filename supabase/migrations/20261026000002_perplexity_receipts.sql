-- Add only receipt-review metadata. Apply after the two job-costing migrations.
begin;
alter table public.job_costs
  add column if not exists receipt_abn text,
  add column if not exists receipt_currency text;
do $$
declare old_check record;
begin
  if not exists (select 1 from pg_constraint where conname = 'job_costs_receipt_abn_length' and conrelid = 'public.job_costs'::regclass) then
    alter table public.job_costs add constraint job_costs_receipt_abn_length
      check (receipt_abn is null or length(receipt_abn) <= 50);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'job_costs_receipt_currency_aud' and conrelid = 'public.job_costs'::regclass) then
    alter table public.job_costs add constraint job_costs_receipt_currency_aud
      check (receipt_currency is null or receipt_currency = 'AUD');
  end if;
  -- A reviewed receipt may contain both taxable and GST-free purchases.
  -- Keep the manual calculator rule, but preserve printed tax on reviewed scans.
  for old_check in
    select conname from pg_constraint
    where conrelid = 'public.job_costs'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%gst_applies%'
      and pg_get_constraintdef(oid) like '%round(%'
      and conname <> 'job_costs_reviewed_receipt_gst'
  loop
    execute format('alter table public.job_costs drop constraint %I', old_check.conname);
  end loop;
  if not exists (select 1 from pg_constraint where conname = 'job_costs_reviewed_receipt_gst' and conrelid = 'public.job_costs'::regclass) then
    alter table public.job_costs add constraint job_costs_reviewed_receipt_gst check (
      (receipt_confidence is not null and (gst_applies or gst_amount = 0))
      or abs(gst_amount - case when gst_applies then round(amount_ex_gst * 0.10, 2) else 0 end) <= 0.01
    );
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
