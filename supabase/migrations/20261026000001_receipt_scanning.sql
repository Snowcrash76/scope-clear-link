-- Run AFTER 20261026000000_job_costing.sql. Existing cost rows are preserved.
BEGIN;
ALTER TABLE public.job_costs
  ADD COLUMN IF NOT EXISTS receipt_line_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS receipt_confidence text;

DO $$ BEGIN
  ALTER TABLE public.job_costs ADD CONSTRAINT receipt_line_items_valid
    CHECK (jsonb_typeof(receipt_line_items) = 'array' AND jsonb_array_length(receipt_line_items) <= 200);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE public.job_costs ADD CONSTRAINT receipt_confidence_valid
    CHECK (receipt_confidence IS NULL OR receipt_confidence IN ('high', 'medium', 'low'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
NOTIFY pgrst, 'reload schema';
COMMIT;
