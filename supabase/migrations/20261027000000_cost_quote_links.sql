-- Costing-only links to existing included work. Does not change any quote or its totals.
BEGIN;

ALTER TABLE public.job_costs
  ADD COLUMN IF NOT EXISTS scope_item_id uuid REFERENCES public.scope_items(id) ON DELETE SET NULL;

ALTER TABLE public.job_costs DROP CONSTRAINT IF EXISTS job_costs_one_quote_item;
ALTER TABLE public.job_costs ADD CONSTRAINT job_costs_one_quote_item
  CHECK (quote_line_item_id IS NULL OR scope_item_id IS NULL);

CREATE INDEX IF NOT EXISTS job_costs_scope_item_idx
  ON public.job_costs(scope_item_id) WHERE scope_item_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_job_cost_scope_link()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.scope_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.scope_items item
    WHERE item.id = NEW.scope_item_id
      AND item.project_id = NEW.job_id
      AND item.category = 'included'
  ) THEN
    RAISE EXCEPTION 'Included quote item must belong to this job';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validate_job_cost_scope_link_trigger ON public.job_costs;
CREATE TRIGGER validate_job_cost_scope_link_trigger
  BEFORE INSERT OR UPDATE ON public.job_costs
  FOR EACH ROW EXECUTE FUNCTION public.validate_job_cost_scope_link();

NOTIFY pgrst, 'reload schema';
COMMIT;
