-- Track whether the quote token has ever been explicitly regenerated
-- (as opposed to being generated for the first time)
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS token_regenerated BOOLEAN NOT NULL DEFAULT false;
