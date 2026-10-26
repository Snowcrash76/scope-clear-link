-- Job costing only: no changes to existing quotes, invoices, clients or jobs.
BEGIN;

DO $$ BEGIN
  CREATE TYPE public.job_cost_category AS ENUM ('Materials', 'Subcontractor', 'Plant/Equipment', 'Labour', 'Other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  CREATE TYPE public.job_cost_status AS ENUM ('draft', 'confirmed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.job_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  supplier text NOT NULL CHECK (length(trim(supplier)) BETWEEN 1 AND 200),
  description text NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 5000),
  cost_date date NOT NULL,
  category public.job_cost_category NOT NULL,
  amount_ex_gst numeric(11,2) NOT NULL CHECK (amount_ex_gst >= 0),
  gst_amount numeric(11,2) NOT NULL CHECK (gst_amount >= 0),
  amount_inc_gst numeric(11,2) NOT NULL CHECK (amount_inc_gst >= 0),
  gst_applies boolean NOT NULL DEFAULT true,
  reference_number text NOT NULL DEFAULT '' CHECK (length(reference_number) <= 200),
  -- Private bucket object path, never a public or expiring signed URL.
  receipt_image_url text CHECK (length(receipt_image_url) <= 500),
  status public.job_cost_status NOT NULL DEFAULT 'confirmed',
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 10000),
  quote_line_item_id uuid REFERENCES public.quote_line_items(id) ON DELETE SET NULL,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (abs(amount_inc_gst - amount_ex_gst - gst_amount) <= 0.01),
  CHECK (abs(gst_amount - CASE WHEN gst_applies THEN round(amount_ex_gst * 0.10, 2) ELSE 0 END) <= 0.01)
);

CREATE INDEX IF NOT EXISTS job_costs_job_date_idx ON public.job_costs(job_id, cost_date DESC);
CREATE INDEX IF NOT EXISTS job_costs_creator_idx ON public.job_costs(created_by);

CREATE OR REPLACE FUNCTION public.validate_job_cost()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW.job_id IS DISTINCT FROM OLD.job_id OR
    NEW.created_by IS DISTINCT FROM OLD.created_by OR
    NEW.created_at IS DISTINCT FROM OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Job and creator cannot be changed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.projects p WHERE p.id = NEW.job_id AND p.user_id = NEW.created_by
  ) THEN
    RAISE EXCEPTION 'Cost creator must own this job';
  END IF;
  IF NEW.quote_line_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.quote_line_items li JOIN public.quotes q ON q.id = li.quote_id
    WHERE li.id = NEW.quote_line_item_id AND q.project_id = NEW.job_id
  ) THEN
    RAISE EXCEPTION 'Quote line item must belong to this job';
  END IF;
  IF NEW.receipt_image_url IS NOT NULL AND (
    NEW.receipt_image_url NOT LIKE NEW.created_by::text || '/' || NEW.job_id::text || '/%'
    OR NEW.receipt_image_url LIKE '%..%'
  ) THEN
    RAISE EXCEPTION 'Receipt must belong to this job';
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validate_job_cost_trigger ON public.job_costs;
CREATE TRIGGER validate_job_cost_trigger BEFORE INSERT OR UPDATE ON public.job_costs
FOR EACH ROW EXECUTE FUNCTION public.validate_job_cost();

ALTER TABLE public.job_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Owners can view job costs" ON public.job_costs;
CREATE POLICY "Owners can view job costs" ON public.job_costs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = job_id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS "Owners can add job costs" ON public.job_costs;
CREATE POLICY "Owners can add job costs" ON public.job_costs FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = job_id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS "Owners can edit job costs" ON public.job_costs;
CREATE POLICY "Owners can edit job costs" ON public.job_costs FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = job_id AND p.user_id = auth.uid()))
WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = job_id AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS "Owners can delete job costs" ON public.job_costs;
CREATE POLICY "Owners can delete job costs" ON public.job_costs FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = job_id AND p.user_id = auth.uid()));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_costs TO authenticated;
GRANT ALL ON public.job_costs TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('job-cost-receipts', 'job-cost-receipts', false, 10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Owners can upload cost receipts" ON storage.objects;
CREATE POLICY "Owners can upload cost receipts" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'job-cost-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[2] AND p.user_id = auth.uid()));
DROP POLICY IF EXISTS "Owners can read cost receipts" ON storage.objects;
CREATE POLICY "Owners can read cost receipts" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'job-cost-receipts'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public.projects p
    WHERE p.id::text = (storage.foldername(name))[2] AND p.user_id = auth.uid()));

NOTIFY pgrst, 'reload schema';
COMMIT;
