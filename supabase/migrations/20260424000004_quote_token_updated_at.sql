-- Add token_updated_at to quotes so tradespeople can see when the shareable link was last regenerated
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS token_updated_at TIMESTAMPTZ;

-- Back-fill existing quotes using created_at as the initial value
UPDATE public.quotes
SET token_updated_at = created_at
WHERE token_updated_at IS NULL;

-- Set default so every future insert automatically records the creation time
ALTER TABLE public.quotes
  ALTER COLUMN token_updated_at SET DEFAULT now();

ALTER TABLE public.quotes
  ALTER COLUMN token_updated_at SET NOT NULL;
